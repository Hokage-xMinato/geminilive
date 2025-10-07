const express = require('express');
const cron = require('node-cron');
const https = require('https');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 10000; // Render uses PORT environment variable

// --- Security Middleware ---
// Use Helmet to set various security headers
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      frameAncestors: ["'none'"], // Disallow embedding in iframes
      connectSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https://placehold.co"], // Allow data URIs and placeholder images
    },
  })
);
app.use(helmet.frameguard({ action: 'deny' })); // Another layer to prevent iframe embedding

// CORS configuration to allow requests only from your own domain
const allowedOrigins = [
  // Add your Render URL here when you have it, e.g., 'https://your-app-name.onrender.com'
  // For local development, you might add 'http://localhost:10000'
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
}));


// --- Environment Variables ---
// It's better to use environment variables for sensitive URLs
const TOKEN_URL = process.env.TOKEN_URL || 'https://rolexcoderz.in/api/get-token';
const CONTENT_URL = process.env.CONTENT_URL || 'https://rolexcoderz.in/api/get-live-classes';

const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
const REFERER = 'https://rolexcoderz.in/live-classes';

let cachedData = {
  live: [],
  up: [],
  completed: [],
  lastUpdated: null
};

// --- Helper Functions ---
function httpsRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ data, statusCode: res.statusCode, headers: res.headers }));
    });
    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function fetchToken() {
  try {
    const response = await httpsRequest(TOKEN_URL, {
      method: 'GET',
      headers: {
        'User-Agent': UA,
        'Referer': REFERER
      }
    });

    const jsonData = JSON.parse(response.data);
    
    if (jsonData.timestamp && jsonData.signature) {
      return {
        timestamp: jsonData.timestamp,
        signature: jsonData.signature
      };
    }
    
    throw new Error('Authentication failed');
  } catch (error) {
    console.error('Token fetch failed:', error.message);
    throw error;
  }
}

async function fetchContent(type, timestamp, signature) {
  try {
    const payload = JSON.stringify({ type });
    
    const response = await httpsRequest(CONTENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'x-timestamp': timestamp.toString(),
        'x-signature': signature,
        'User-Agent': UA,
        'Referer': REFERER
      },
      body: payload
    });

    let jsonData;
    try {
      jsonData = JSON.parse(response.data);
    } catch (parseError) {
      throw new Error('Invalid response format');
    }
    
    if (!jsonData.data) {
      throw new Error('No content available');
    }

    const decodedData = Buffer.from(jsonData.data, 'base64').toString('utf-8');
    let parsedData = JSON.parse(decodedData);
    
    if (parsedData && typeof parsedData === 'object' && parsedData.data && Array.isArray(parsedData.data)) {
      parsedData = parsedData.data;
    }
    
    const modifiedData = modifyContent(parsedData);
    
    return modifiedData;
  } catch (error) {
    console.error(`Failed to fetch ${type}:`, error.message);
    return []; // Return empty array on failure
  }
}

function modifyContent(data) {
  if(!data) return [];
  let jsonString = JSON.stringify(data);
  
  jsonString = jsonString.replace(/https:\/\/www\.rolexcoderz\.xyz\/Player\/\?url=/gi, '');
  jsonString = jsonString.replace(/rolex coderz/gi, 'Smartrz');
  jsonString = jsonString.replace(/rolexcoderz\.xyz/gi, 'Smartrz');
  jsonString = jsonString.replace(/rolexcoderz/gi, 'Smartrz');
  
  return JSON.parse(jsonString);
}

async function updateData() {
  console.log('Updating classes data...');
  try {
    const token = await fetchToken();
    
    const [liveData, upData, completedData] = await Promise.all([
      fetchContent('live', token.timestamp, token.signature),
      fetchContent('up', token.timestamp, token.signature),
      fetchContent('completed', token.timestamp, token.signature)
    ]);
    
    cachedData = {
      live: Array.isArray(liveData) ? liveData : [],
      up: Array.isArray(upData) ? upData : [],
      completed: Array.isArray(completedData) ? completedData : [],
      lastUpdated: new Date().toISOString()
    };
    
    console.log(`Update successful - Live: ${cachedData.live.length}, Upcoming: ${cachedData.up.length}, Completed: ${cachedData.completed.length}`);
  } catch (error) {
    console.error('Data update process failed:', error.message);
  }
}

// --- API Endpoints ---
// Middleware to check referer for API calls
const checkReferer = (req, res, next) => {
    const referer = req.get('Referer');
    const host = req.get('host');
    // In a real production environment, you would check against your actual domain
    // For now, we'll allow requests that seem to come from the same host.
    if (referer && referer.includes(host)) {
        next();
    } else if (process.env.NODE_ENV !== 'production') {
        // Allow in development
        next();
    }
     else {
        res.status(403).send('Forbidden: Invalid Referer');
    }
};


// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));


app.get('/api/lectures', checkReferer, (req, res) => {
  res.json(cachedData);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', lastUpdated: cachedData.lastUpdated });
});

// All other GET requests not handled before will return the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// --- Cron Job ---
// Schedule data update every minute
cron.schedule('* * * * *', () => {
  updateData();
});

// --- Initial Data Fetch and Server Start ---
// Initial fetch
updateData();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
