const express = require('express');
const cron = require('node-cron');
const https = require('https');
const path = require('path');
const zlib = require('zlib');

const app = express();
// Render sets the PORT environment variable.
const PORT = process.env.PORT || 10000;

// --- Security Middleware (Manual Headers) ---
app.use((req, res, next) => {
    // Prevents the site from being embedded in an iframe
    res.setHeader('X-Frame-Options', 'DENY');
    // Basic Content Security Policy
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; font-src 'self' https://fonts.gstatic.com; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; script-src 'self' 'unsafe-inline';"
    );
    next();
});


// --- API Configuration ---
// We use the IP address directly to bypass DNS issues on the server.
const API_IP = '104.21.38.230';
const TOKEN_URL = process.env.TOKEN_URL || `https://${API_IP}/api/get-token`;
const CONTENT_URL = process.env.CONTENT_URL || `https://${API_IP}/api/get-live-classes`;
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
// The Referer should still use the domain name.
const REFERER = 'https://rolexcoderz.in/live-classes';

// --- Enhanced Browser-like Headers ---
// To better mimic a real user and avoid bot detection, we add more headers.
const BROWSER_HEADERS = {
    // CRITICAL FIX: The 'Host' header tells the server which domain we want,
    // allowing the SSL/TLS certificate to match even when we connect via IP.
    'Host': 'rolexcoderz.in',
    'User-Agent': UA,
    'Referer': REFERER,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'DNT': '1', // Do Not Track
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
};

// --- In-Memory Cache ---
let cachedData = {
    live: [],
    up: [],
    completed: [],
    lastUpdated: null
};

// --- Helper Functions ---
// --- Helper Functions ---
function httpsRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        // Add a 10-second timeout to all requests for robustness.
        const requestOptions = { ...options, timeout: 10000 };

        const req = https.request(url, requestOptions, (res) => {
            const body = [];
            const contentEncoding = res.headers['content-encoding'];

            // Choose the correct decompression stream based on the header
            let responseStream;
            if (contentEncoding === 'gzip') {
                responseStream = res.pipe(zlib.createGunzip());
            } else if (contentEncoding === 'br') {
                responseStream = res.pipe(zlib.createBrotliDecompress());
            } else if (contentEncoding === 'deflate') {
                responseStream = res.pipe(zlib.createInflate());
            } else {
                // If no compression, use the original response stream
                responseStream = res;
            }

            responseStream.on('data', (chunk) => body.push(chunk));

            responseStream.on('end', () => {
                try {
                    const data = Buffer.concat(body).toString();
                    resolve({ data, statusCode: res.statusCode });
                } catch (e) {
                    reject(e);
                }
            });
            
            responseStream.on('error', (err) => {
                console.error('Error during response stream processing (decompression failed):', err);
                reject(err);
            });
        });

        // Log the full error object for better debugging of network issues.
        req.on('error', (err) => {
            console.error('Internal HTTPS Request Error:', err);
            reject(err);
        });

        // Handle timeouts explicitly to provide a clear error message.
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timed out after 10 seconds'));
        });

        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

async function fetchToken() {
    try {
        // Using a full set of browser-like headers to appear as a legitimate user.
        // This helps get past security measures like Cloudflare.
        const response = await httpsRequest(TOKEN_URL, {
            method: 'GET',
            headers: BROWSER_HEADERS
        });

        // The API might be returning an HTML error page, which we need to handle.
        if (response.data.trim().startsWith('<!DOCTYPE')) {
            console.error('Token fetch failed: Received HTML instead of JSON. Full HTML response below:');
            console.error(response.data);
            throw new Error('Received HTML from token endpoint, expected JSON.');
        }

        const jsonData = JSON.parse(response.data);
        if (jsonData.timestamp && jsonData.signature) {
            return jsonData;
        }
        throw new Error('Authentication failed: Invalid token format.');
    } catch (error) {
        // This will now catch more detailed errors from httpsRequest.
        // Using console.error(error) instead of error.message to see the full object.
        console.error('A detailed error occurred in fetchToken:', error);
        throw error;
    }
}

async function fetchContent(type, timestamp, signature) {
    try {
        const payload = JSON.stringify({ type });
        const response = await httpsRequest(CONTENT_URL, {
            method: 'POST',
            headers: {
                ...BROWSER_HEADERS, // Spread the common browser headers
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                'x-timestamp': timestamp.toString(),
                'x-signature': signature,
            },
            body: payload
        });

        let jsonData;
        try {
            jsonData = JSON.parse(response.data);
        } catch (parseError) {
             console.error(`Invalid JSON for type '${type}':`, response.data);
             throw new Error(`Received invalid response format for ${type}.`);
        }

        if (!jsonData.data) {
            return []; // No content available, but not an error.
        }

        const decodedData = Buffer.from(jsonData.data, 'base64').toString('utf-8');
        let parsedData = JSON.parse(decodedData);

        // API sometimes wraps the data in another "data" property
        if (parsedData?.data && Array.isArray(parsedData.data)) {
            parsedData = parsedData.data;
        }

        return modifyContent(parsedData);

    } catch (error) {
        console.error(`Failed to fetch content for '${type}':`, error.message);
        return []; // Return an empty array on failure.
    }
}

function modifyContent(data) {
    if (!data || !Array.isArray(data)) return [];
    let jsonString = JSON.stringify(data);
    jsonString = jsonString.replace(/https:\/\/www\.rolexcoderz\.xyz\/Player\/\?url=/gi, '');
    jsonString = jsonString.replace(/rolex coderz|rolexcoderz\.xyz|rolexcoderz/gi, 'Smartrz');
    return JSON.parse(jsonString);
}


async function updateData() {
    console.log('Updating classes data...');
    let token;
    try {
        token = await fetchToken();
    } catch (error) {
        console.error('Halting update process because token could not be fetched.');
        // Don't clear old data if token fails, just keep what we have.
        return;
    }

    const [liveData, upData, completedData] = await Promise.all([
        fetchContent('live', token.timestamp, token.signature),
        fetchContent('up', token.timestamp, token.signature),
        fetchContent('completed', token.timestamp, token.signature)
    ]);

    // Only update if the data is a valid array
    if(Array.isArray(liveData)) cachedData.live = liveData;
    if(Array.isArray(upData)) cachedData.up = upData;
    if(Array.isArray(completedData)) cachedData.completed = completedData;
    
    cachedData.lastUpdated = new Date();

    console.log(`Update complete - Live: ${cachedData.live.length}, Upcoming: ${cachedData.up.length}, Completed: ${cachedData.completed.length}`);
}


// --- HTML Generation ---
function generateHTML() {
    const { live, up, completed, lastUpdated } = cachedData;

    const timeSince = (date) => {
        if (!date) return "never";
        const seconds = Math.floor((new Date() - date) / 1000);
        let interval = seconds / 60;
        if (interval < 1) return "Just now";
        if (interval < 60) return Math.floor(interval) + " minutes ago";
        interval = interval / 60;
        if (interval < 24) return Math.floor(interval) + " hours ago";
        return date.toLocaleString();
    };

    const renderLectures = (lectures) => {
        if (!lectures || lectures.length === 0) {
            return '<p class="empty-state">No classes available in this category right now.</p>';
        }
        return lectures.map(lecture => {
            const thumbnailUrl = lecture.image || `https://placehold.co/600x400/6a5acd/ffffff?text=${encodeURIComponent(lecture.title || 'Lecture')}`;
            
            // Create the new, full player link
            const playerLink = lecture.link ? `https://studysmarterx.netlify.app/player?url=${lecture.link}` : null;

            return `
            <div class="lecture-card">
                <img src="${thumbnailUrl}" alt="${lecture.title || 'Lecture Thumbnail'}" class="card-thumbnail" onerror="this.src='https://placehold.co/600x400/EEE/333?text=Image+Error'">
                <div class="card-content">
                    <span class="batch-name">${lecture.batch || 'General'}</span>
                    <h3 class="lecture-name">${lecture.title || 'Untitled Lecture'}</h3>
                        {/* UPDATED: Use the new playerLink variable for the href */}
                    ${playerLink ? `<a href="${playerLink}" target="_blank" class="watch-button">Watch Now</a>` : ''}
                </div>
            </div>`;
        }).join('');
    };

    // The entire HTML, CSS, and JS is now in one template string
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Smartrz - Live Lectures</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary-color: #6a5acd; --secondary-color: #483d8b; --background-color: #f4f7f6;
            --card-background: #ffffff; --text-color: #333; --light-text-color: #f8f9fa;
            --border-color: #e0e0e0; --shadow: 0 10px 30px rgba(0, 0, 0, 0.07); --border-radius: 12px;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; background-color: var(--background-color); color: var(--text-color); line-height: 1.6; position: relative; overflow-x: hidden; }
        .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 15vw; color: rgba(0, 0, 0, 0.04); font-weight: 800; z-index: -1; pointer-events: none; text-transform: uppercase; }
        .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
        .header { background: linear-gradient(135deg, var(--primary-color), var(--secondary-color)); color: var(--light-text-color); padding: 20px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.1); position: sticky; top: 0; z-index: 1000; }
        .header-content { display: flex; justify-content: space-between; align-items: center; }
        .logo { font-size: 2rem; font-weight: 800; }
        .header-info { text-align: right; font-size: 0.9rem; opacity: 0.9; }
        main { padding: 40px 0; }
        .lecture-section { margin-bottom: 50px; }
        .section-title { font-size: 2.2rem; font-weight: 700; margin-bottom: 25px; padding-bottom: 10px; border-bottom: 3px solid var(--primary-color); display: inline-flex; align-items: center; gap: 10px; }
        .live-dot { width: 15px; height: 15px; background-color: #ff4d4d; border-radius: 50%; animation: pulse 1.5s infinite; }
        @keyframes pulse { 0% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(255, 77, 77, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(255, 77, 77, 0); } 100% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(255, 77, 77, 0); } }
        .lecture-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 25px; }
        .lecture-card { background-color: var(--card-background); border-radius: var(--border-radius); box-shadow: var(--shadow); overflow: hidden; transition: transform 0.3s ease, box-shadow 0.3s ease; display: flex; flex-direction: column; }
        .lecture-card:hover { transform: translateY(-8px); box-shadow: 0 15px 40px rgba(0, 0, 0, 0.1); }
        .card-thumbnail { width: 100%; height: 170px; object-fit: cover; background-color: #eee; }
        .card-content { padding: 20px; display: flex; flex-direction: column; flex-grow: 1; }
        .batch-name { font-size: 0.8rem; font-weight: 600; color: var(--primary-color); text-transform: uppercase; margin-bottom: 8px; }
        .lecture-name { font-size: 1.2rem; font-weight: 600; margin-bottom: 15px; flex-grow: 1; }
        .watch-button { display: block; width: 100%; padding: 12px; background: var(--primary-color); color: var(--light-text-color); text-align: center; text-decoration: none; border-radius: 8px; font-weight: 600; transition: background-color 0.3s ease; margin-top: auto; }
        .watch-button:hover { background-color: var(--secondary-color); }
        .empty-state { grid-column: 1 / -1; text-align: center; padding: 50px; background: var(--card-background); border-radius: var(--border-radius); color: #888; }
        .footer { background-color: #333; color: var(--light-text-color); padding: 25px 0; text-align: center; }
        .footer a { color: var(--primary-color); text-decoration: none; font-weight: 600; }
        .footer a:hover { text-decoration: underline; }
        .popup-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.6); display: flex; justify-content: center; align-items: center; z-index: 2000; opacity: 0; visibility: hidden; transition: opacity 0.3s ease, visibility 0.3s ease; }
        .popup-overlay.show { opacity: 1; visibility: visible; }
        .popup-content { background-color: var(--card-background); padding: 40px; border-radius: var(--border-radius); text-align: center; max-width: 450px; width: 90%; position: relative; transform: scale(0.9); transition: transform 0.3s ease; }
        .popup-overlay.show .popup-content { transform: scale(1); }
        .close-btn { position: absolute; top: 15px; right: 15px; background: none; border: none; font-size: 1.8rem; cursor: pointer; color: #aaa; }
        .popup-content h2 { margin-bottom: 15px; color: var(--primary-color); }
        .popup-content p { margin-bottom: 25px; color: #555; }
        .telegram-btn { display: inline-block; padding: 12px 30px; background-color: var(--primary-color); color: var(--light-text-color); text-decoration: none; border-radius: 8px; font-weight: 600; transition: background-color 0.3s; }
        .telegram-btn:hover { background-color: var(--secondary-color); }
        @media (max-width: 768px) { .header-content { flex-direction: column; gap: 10px; } .header-info { text-align: center; } }
    </style>
</head>
<body>
    <div class="watermark">Smartrz</div>
    <header class="header">
        <div class="container header-content">
            <h1 class="logo">Smartrz</h1>
            <div class="header-info">
                <p>Proudly made by Smartrz</p>
                <p id="last-updated">Last updated: ${timeSince(lastUpdated)}</p>
            </div>
        </div>
    </header>
    <main class="container">
        <section class="lecture-section">
            <h2 class="section-title"><span class="live-dot"></span> Live Classes</h2>
            <div class="lecture-grid">${renderLectures(live)}</div>
        </section>
        <section class="lecture-section">
            <h2 class="section-title">Upcoming Classes</h2>
            <div class="lecture-grid">${renderLectures(up)}</div>
        </section>
        <section class="lecture-section">
            <h2 class="section-title">Recorded Classes</h2>
            <div class="lecture-grid">${renderLectures(completed)}</div>
        </section>
    </main>
    <footer class="footer">
        <div class="container">
            <p>&copy; ${new Date().getFullYear()} Smartrz. All rights reserved.</p>
            <a href="https://t.me/studysmarterhub" target="_blank">Join our Telegram Channel</a>
        </div>
    </footer>
    <div id="telegram-popup" class="popup-overlay">
        <div class="popup-content">
            <button id="close-popup" class="close-btn">&times;</button>
            <h2>Join Our Community!</h2>
            <p>Get the latest updates, notes, and interact with fellow students on our Telegram channel.</p>
            <a href="https://t.me/studysmarterhub" id="join-telegram-btn" class="telegram-btn" target="_blank">Join Now</a>
        </div>
    </div>
    <script>
        // Frame-busting script
        if (window.top !== window.self) {
            window.top.location.replace(window.self.location.href);
        }

        // Auto-refresh the page every 60 seconds to get new data
        setTimeout(() => { window.location.reload(); }, 60000);

        // Popup Logic
        document.addEventListener('DOMContentLoaded', () => {
            const telegramPopup = document.getElementById('telegram-popup');
            const closePopupButton = document.getElementById('close-popup');
            const joinTelegramBtn = document.getElementById('join-telegram-btn');

            const showPopup = () => {
                if (!sessionStorage.getItem('telegramPopupShown')) {
                    setTimeout(() => { telegramPopup.classList.add('show'); }, 1500);
                }
            };
            const hidePopup = () => {
                telegramPopup.classList.remove('show');
                sessionStorage.setItem('telegramPopupShown', 'true');
            };

            closePopupButton.addEventListener('click', hidePopup);
            joinTelegramBtn.addEventListener('click', hidePopup);
            telegramPopup.addEventListener('click', (e) => {
                if (e.target === telegramPopup) hidePopup();
            });
            showPopup();
        });
    </script>
</body>
</html>`;
}

// --- Express Routes ---
app.get('/', (req, res) => {
    // Generate and send the complete HTML page
    res.send(generateHTML());
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', lastUpdated: cachedData.lastUpdated });
});


// --- Server Initialization ---
cron.schedule('*/1 * * * *', updateData); // Fetch data every minute

// Initial data fetch on server start
updateData();

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
});





