const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 10000;

// This will hold the complete, pre-generated HTML page.
let cachedHtml = '<!DOCTYPE html><html><head><title>Study Smarterz</title><style>body{display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;background-color:#f8fafc;color:#475569;} .spinner {width: 56px;height: 56px;border-radius: 50%;padding: 6px;background: conic-gradient(from 180deg at 50% 50%, rgba(255, 255, 255, 0) 0deg, #4f46e5 360deg);animation: spin 1s linear infinite;} .spinner::before {content: "";display: block;width: 100%;height: 100%;border-radius: 50%;background: #f8fafc;} @keyframes spin {to {transform: rotate(1turn);}}</style></head><body><div class="spinner"></div><p style="margin-left: 16px; font-size: 1.25rem;">Loading live classes, please wait...</p></body></html>';

/**
 * UTILITY FUNCTIONS
 * These are helper functions moved from the original HTML file.
 */
const textReplacer = (text) => {
    if (typeof text !== 'string') return text;
    // Strict replacement for "rolexcoderz", "rolex", and "coderz"
    return text.replace(/rolexcoderz/gi, 'studysmarterz')
               .replace(/rolex/gi, 'study')
               .replace(/coderz/gi, 'smarter');
};

const fetchApiData = async (endpoint) => {
    const url = `https://api.rolexcoderz.live/${endpoint}`;
    try {
        const response = await fetch(url, { timeout: 10000 });
        if (!response.ok) {
            console.error(`HTTP error for ${url}: ${response.status}`);
            return [];
        }
        const json = await response.json();
        return json.data || [];
    } catch (error) {
        console.error(`Failed to fetch data from ${url}:`, error.message);
        return [];
    }
};


/**
 * HTML RENDERING FUNCTIONS
 * These functions build the dynamic parts of the HTML.
 */
const renderLectureCards = (data) => {
    if (!data || data.length === 0) {
        return '';
    }
    return data.map(item => {
        const title = textReplacer(item.title);
        const batch = textReplacer(item.batch);

        let imageHtml = '';
        let isImageValid = false;
        if (item.image) {
            try {
                const imageUrl = new URL(item.image);
                if (imageUrl.hostname.endsWith('cloudfront.net')) {
                    isImageValid = true;
                    imageHtml = `<img src="${item.image}" alt="${title}" class="h-40 w-full object-cover" loading="lazy" onerror="this.onerror=null; this.parentElement.innerHTML = '<div class=\'h-40 w-full bg-slate-200 flex items-center justify-center p-4 text-center font-semibold text-slate-600\'>${title}</div>';">`;
                }
            } catch (e) { /* Invalid URL */ }
        }
        if (!isImageValid) {
            imageHtml = `<div class="h-40 w-full bg-slate-200 flex items-center justify-center p-4 text-center font-semibold text-slate-600">${title}</div>`;
        }

        let finalLink = null;
        if (item.link) {
            try {
                const linkUrl = new URL(item.link);
                const playerUrlParam = linkUrl.searchParams.get('url');
                if (playerUrlParam) {
                    const cdnUrl = new URL(playerUrlParam);
                    if (cdnUrl.hostname.endsWith('cloudfront.net')) {
                        finalLink = `https://studysmarterx.netlify.app/player/?url=${encodeURIComponent(playerUrlParam)}`;
                    }
                }
            } catch (e) { /* Invalid URL */ }
        }

        const cardContent = `
            <div class="bg-white rounded-lg shadow-md overflow-hidden flex flex-col h-full relative group lecture-card" data-batch="${item.batch}">
                <span class="absolute top-2 right-2 bg-indigo-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full z-10">${batch}</span>
                ${imageHtml}
                <div class="p-4 flex flex-col flex-grow">
                    <h3 class="text-base font-semibold text-slate-800 flex-grow">${title}</h3>
                </div>
            </div>
        `;

        return finalLink
            ? `<a href="${finalLink}" target="_blank" rel="noopener noreferrer" class="block transition-transform duration-200 hover:-translate-y-1">${cardContent}</a>`
            : `<div class="transition-transform duration-200">${cardContent}</div>`;
    }).join('');
};

const renderNotifications = (notifications) => {
    if (!notifications || notifications.length === 0) {
        return `<p class="text-slate-500 text-center py-10">No new notifications.</p>`;
    }
    return notifications.map(notif => {
        const title = textReplacer(notif.title);
        const message = textReplacer(notif.message);
        return `
            <div class="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <p class="font-semibold text-slate-800">${title}</p>
                <p class="text-sm text-slate-600">${message}</p>
            </div>
        `;
    }).join('');
};

const renderBatchOptions = (live, up, completed) => {
    const allData = [...live, ...up, ...completed];
    const batches = ['all', ...new Set(allData.map(item => item.batch))];
    return batches.map(batch =>
        `<option value="${batch}">${batch === 'all' ? 'All Batches' : textReplacer(batch)}</option>`
    ).join('');
};

/**
 * MAIN PAGE TEMPLATE
 * This function generates the entire HTML page with the fetched data.
 */
const buildFullHtmlPage = (live, up, completed, notifications) => {
    const liveCards = renderLectureCards(live);
    const upCards = renderLectureCards(up);
    const completedCards = renderLectureCards(completed);
    const notificationItems = renderNotifications(notifications);
    const batchOptions = renderBatchOptions(live, up, completed);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Study Smarterz - Live Classes</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-E7FMZ2D4HH');
    </script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #f8fafc; }
        ::-webkit-scrollbar { width: 8px; } ::-webkit-scrollbar-track { background: #f1f5f9; } ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .tab-active { border-color: #4f46e5; color: #4f46e5; font-weight: 600; }
        .notification-panel { transition: transform 0.3s ease-in-out; }
    </style>
</head>
<body class="text-slate-800">
    <!-- Frame Buster Script -->
    <script>
        if (window.top !== window.self) { try { window.top.location = window.self.location; } catch (e) { console.error("Frame-busting failed:", e); } }
    </script>

    <div id="app-container" class="min-h-screen">
        <header class="bg-white/80 backdrop-blur-lg sticky top-0 z-30 shadow-sm">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex items-center justify-between h-16">
                    <div class="flex-shrink-0"><h1 class="text-2xl font-bold text-indigo-600">Study Smarterz</h1></div>
                    <div class="relative">
                        <button id="notification-btn" class="p-2 rounded-full text-slate-500 hover:bg-slate-100"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg></button>
                    </div>
                </div>
            </div>
        </header>

        <div id="notification-panel" class="notification-panel fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-lg z-50 transform translate-x-full">
            <div class="flex items-center justify-between p-4 border-b">
                <h2 class="text-lg font-semibold">Notifications</h2>
                <button id="close-notification-btn" class="p-2 rounded-full hover:bg-slate-100"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div class="overflow-y-auto h-[calc(100vh-65px)] p-4 space-y-3">${notificationItems}</div>
        </div>
        <div id="notification-overlay" class="fixed inset-0 bg-black/30 z-40 hidden"></div>

        <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div class="border-b border-slate-200">
                <nav class="-mb-px flex space-x-6" aria-label="Tabs">
                    <button data-tab="live" class="tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm tab-active">Live</button>
                    <button data-tab="up" class="tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm border-transparent text-slate-500 hover:text-slate-700">Upcoming</button>
                    <button data-tab="completed" class="tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm border-transparent text-slate-500 hover:text-slate-700">Recorded</button>
                </nav>
            </div>
            <div class="mt-6">
                <select id="batch-filter" class="block w-full max-w-xs pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm">${batchOptions}</select>
            </div>
            
            <div id="content-area">
                <div id="live-content" class="content-panel mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">${liveCards}</div>
                <div id="up-content" class="content-panel mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 hidden">${upCards}</div>
                <div id="completed-content" class="content-panel mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 hidden">${completedCards}</div>
            </div>
            <div id="empty-state" class="text-center py-20 hidden"><h3 class="mt-2 text-sm font-medium text-slate-900">No Lectures Found</h3></div>
        </main>
        
        <footer class="bg-white border-t mt-12"><div class="max-w-7xl mx-auto py-6 px-4 text-center text-sm text-slate-500"><p>&copy; ${new Date().getFullYear()} Study Smarterz. All rights reserved.</p><a href="https://t.me/studysmarterhub" target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:text-indigo-800 font-medium mt-2 inline-block">Join our Telegram Channel</a></div></footer>
    </div>

    <div id="telegram-popup" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"><div id="popup-content" class="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 text-center transform transition-all scale-95 opacity-0"><h3 class="text-lg font-medium text-slate-900 mt-4">Join Our Community!</h3><p class="text-sm text-slate-500 mt-2">Stay updated with the latest classes, notes, and announcements.</p><div class="mt-5 space-y-3"><a href="https://t.me/studysmarterhub" target="_blank" class="inline-flex justify-center w-full rounded-md shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700">Join Telegram</a><button type="button" id="close-popup-btn" class="inline-flex justify-center w-full rounded-md border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50">Maybe Later</button></div></div></div>

    <script>
        document.addEventListener('DOMContentLoaded', () => {
            // Client-side interactivity script
            const tabs = document.querySelectorAll('.tab-btn');
            const contentPanels = document.querySelectorAll('.content-panel');
            const batchFilter = document.getElementById('batch-filter');
            const emptyState = document.getElementById('empty-state');
            let activeTab = 'live';

            function filterContent() {
                const selectedBatch = batchFilter.value;
                const activePanel = document.getElementById(activeTab + '-content');
                const cards = activePanel.querySelectorAll('a, div.transition-transform');
                let visibleCount = 0;
                cards.forEach(card => {
                    const cardElement = card.querySelector('.lecture-card');
                    if (selectedBatch === 'all' || cardElement.dataset.batch === selectedBatch) {
                        card.style.display = 'block';
                        visibleCount++;
                    } else {
                        card.style.display = 'none';
                    }
                });
                emptyState.style.display = visibleCount === 0 ? 'block' : 'none';
            }

            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    activeTab = tab.dataset.tab;
                    tabs.forEach(t => t.classList.remove('tab-active', 'text-slate-500', 'hover:text-slate-700', 'border-transparent'));
                    tabs.forEach(t => {
                        if (t.dataset.tab === activeTab) {
                            t.classList.add('tab-active');
                        } else {
                            t.classList.add('text-slate-500', 'hover:text-slate-700', 'border-transparent');
                        }
                    });
                    contentPanels.forEach(panel => {
                        panel.id === activeTab + '-content' ? panel.classList.remove('hidden') : panel.classList.add('hidden');
                    });
                    filterContent();
                });
            });

            batchFilter.addEventListener('change', filterContent);
            
            // Initial check for empty state on load
            filterContent();
            
            // Notification Panel Logic
            const notificationBtn = document.getElementById('notification-btn');
            const closeNotificationBtn = document.getElementById('close-notification-btn');
            const notificationPanel = document.getElementById('notification-panel');
            const notificationOverlay = document.getElementById('notification-overlay');
            notificationBtn.addEventListener('click', () => {
                notificationPanel.classList.remove('translate-x-full');
                notificationOverlay.classList.remove('hidden');
            });
            closeNotificationBtn.addEventListener('click', () => {
                notificationPanel.classList.add('translate-x-full');
                notificationOverlay.classList.add('hidden');
            });
            notificationOverlay.addEventListener('click', () => {
                 notificationPanel.classList.add('translate-x-full');
                notificationOverlay.classList.add('hidden');
            });

            // Popup Logic
            const popup = document.getElementById('telegram-popup');
            setTimeout(() => {
                const popupContent = document.getElementById('popup-content');
                popup.style.display = 'flex';
                popupContent.classList.remove('scale-95', 'opacity-0');
                popupContent.classList.add('scale-100', 'opacity-100');
            }, 500);
            document.getElementById('close-popup-btn').addEventListener('click', () => popup.style.display = 'none');

            // Auto-refresh the page every 60 seconds to get new server-rendered content
            setTimeout(() => { window.location.reload(); }, 60000);
        });
    </script>
</body>
</html>`;
};

/**
 * CACHE UPDATE LOGIC
 * This function runs periodically to refresh the data and rebuild the HTML.
 */
const updateCache = async () => {
    console.log('Updating cache...');
    try {
        const [live, up, completed, notifications] = await Promise.all([
            fetchApiData('Live/?get=live'),
            fetchApiData('Live/?get=up'),
            fetchApiData('Live/?get=completed'),
            fetchApiData('Live/?get=notifications')
        ]);

        cachedHtml = buildFullHtmlPage(live, up, completed, notifications);
        console.log('Cache updated successfully.');
    } catch (error) {
        console.error('Failed to update cache:', error);
    }
};

// --- SERVER SETUP ---
app.get('/', (req, res) => {
    res.send(cachedHtml);
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    // Immediately update cache on start, then set interval.
    updateCache();
    setInterval(updateCache, 60000); // 60 seconds
});
