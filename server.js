const express = require('express');
const fetch = require('node-fetch'); // Using v2 for CommonJS compatibility

const app = express();
const PORT = process.env.PORT || 10000;

// This will hold the complete, pre-generated HTML page.
// It starts with a simple loader that will be replaced once the cache is built.
let cachedHtml = '<!DOCTYPE html><html><head><title>Study Smarterz</title><style>body{display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;background-color:#111827;color:#e5e7eb;} .spinner {width: 56px;height: 56px;border-radius: 50%;padding: 6px;background: conic-gradient(from 180deg at 50% 50%, rgba(255, 255, 255, 0) 0deg, #8b5cf6 360deg);animation: spin 1s linear infinite;} .spinner::before {content: "";display: block;width: 100%;height: 100%;border-radius: 50%;background: #111827;} @keyframes spin {to {transform: rotate(1turn);}}</style></head><body><div class="spinner"></div><p style="margin-left: 16px; font-size: 1.25rem;">Loading live classes, please wait...</p></body></html>';


/**
 * UTILITY FUNCTIONS
 */
const textReplacer = (text) => {
    if (typeof text !== 'string') return text;
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
 */
const renderLectureCards = (data, type) => {
    if (!data || data.length === 0) {
        return '';
    }
    const iconMap = { live: '🔥', up: '⏰', completed: '📚' };

    return data.map(item => {
        const title = textReplacer(item.title);
        const batch = textReplacer(item.batch);

        let imageHtml = `<div class="w-full h-[180px] flex items-center justify-center bg-gray-700 font-bold text-center text-xl p-4">${title}</div>`;
        if (item.image) {
            imageHtml = `<img src="${item.image}" alt="${title}" loading="lazy" class="w-full h-[180px] object-cover transition-transform duration-500 group-hover:scale-110">`;
        }

        let finalLink = '#';
        if (item.link) {
            try {
                const linkUrl = new URL(item.link);
                const playerUrlParam = linkUrl.searchParams.get('url');
                if (playerUrlParam) {
                    finalLink = `https://studysmarterx.netlify.app/player/?url=${encodeURIComponent(playerUrlParam)}`;
                }
            } catch (e) { /* Invalid URL */ }
        }

        const cardContent = `
            <div class="lecture-card group flex flex-col rounded-2xl overflow-hidden h-full" data-batch="${item.batch}">
                <div class="overflow-hidden relative image-container">
                    ${imageHtml}
                </div>
                <div class="p-5 flex-grow flex flex-col">
                    <h3 class="font-bold text-lg mb-2 leading-tight flex-grow">${title}</h3>
                    <p class="text-sm font-semibold opacity-70 mt-2">${batch}</p>
                    <span class="absolute top-4 right-4 text-xl select-none backdrop-blur-sm bg-black/30 p-2 rounded-full w-10 h-10 flex items-center justify-center">${iconMap[type] || '🎓'}</span>
                </div>
            </div>
        `;

        return `<a href="${finalLink}" target="${finalLink !== '#' ? '_blank' : '_self'}" rel="noopener noreferrer" class="block h-full">${cardContent}</a>`;
    }).join('');
};

const renderNotifications = (notifications) => {
    if (!notifications || !notifications.length) {
        return `<div class="text-center p-10 opacity-70">
                    <svg class="mx-auto h-16 w-16" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p class="font-semibold mt-4">You're all caught up!</p>
                </div>`;
    }
    return notifications.map(notif => {
        const title = textReplacer(notif.title);
        const message = textReplacer(notif.message);
        return `<div class="bg-white/5 dark:bg-white/5 p-4 rounded-lg border border-white/10 hover:bg-white/10 transition light:bg-black/5 light:border-black/10 light:hover:bg-black/10">
                    <p class="font-bold text-purple-300 dark:text-purple-300 light:text-purple-600">${title}</p>
                    <p class="mt-1 text-gray-300 dark:text-gray-300 text-sm light:text-gray-700">${message}</p>
                </div>`;
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
 */
const buildFullHtmlPage = (live, up, completed, notifications) => {
    const liveCards = renderLectureCards(live, 'live');
    const upCards = renderLectureCards(up, 'up');
    const completedCards = renderLectureCards(completed, 'completed');
    const notificationItems = renderNotifications(notifications);
    const batchOptions = renderBatchOptions(live, up, completed);
    
    const notificationCount = notifications ? notifications.length : 0;
    const notificationCountBadge = notificationCount > 0 
        ? `<span class="absolute top-1 right-1 w-5 h-5 bg-pink-500 rounded-full text-xs font-bold flex items-center justify-center text-white">${notificationCount}</span>` 
        : '';

    return `
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Study Smarterz - Live Classes</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&family=Inter:wght@400;500&display=swap" rel="stylesheet">
    <style>
        @keyframes moveGradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        body { font-family: 'Poppins', 'Inter', sans-serif; color: #e5e7eb; background: linear-gradient(-45deg, #111827, #1f2937, #374151, #4b5563); background-size: 400% 400%; animation: moveGradient 20s ease infinite; }
        html.light body { color: #1f2937; background: linear-gradient(-45deg, #f5f3ff, #e0e7ff, #c7d2fe, #a5b4fc); background-size: 400% 400%; }
        .animate-load { animation: slideUp 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }
        header { position: sticky; top: 0; z-index: 40; background: rgba(17, 24, 39, 0.6); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-bottom: 1px solid rgba(139, 92, 246, 0.2); padding: 1.25rem 1.5rem; margin: 0 -1.5rem; }
        html.light header { background: rgba(255, 255, 255, 0.6); border-bottom: 1px solid rgba(124, 58, 237, 0.15); }
        .tab-btn.active { background: linear-gradient(135deg, #7c3aed, #ec4899); color: #fff !important; box-shadow: 0 8px 20px rgb(236 72 153 / 0.4); transform: translateY(-3px); }
        .lecture-card { background: #1f2937; transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.4s; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2); }
        html.light .lecture-card { background: #ffffff; box-shadow: 0 10px 25px rgba(165, 180, 252, 0.25); }
        .lecture-card:hover { transform: translateY(-10px) scale(1.03); box-shadow: 0 20px 40px rgba(124, 58, 237, 0.25); }
        .image-container::after { content: 'Tap to Watch'; font-weight: 700; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.5); color: white; opacity: 0; transition: opacity 0.4s; }
        .lecture-card:hover .image-container::after { opacity: 1; }
        #notifications-panel { transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94); transform: translateX(100%); }
        #notifications-panel.open { transform: translateX(0); }
    </style>
</head>
<body class="transition-colors duration-500">
    <script> if (window.top !== window.self) { try { window.top.location = window.self.location; } catch (e) {} } </script>

    <div id="app-container" class="min-h-screen px-4 sm:px-6 py-8 max-w-7xl mx-auto">
        <header class="mb-12">
            <div class="flex justify-between items-center max-w-7xl mx-auto">
                <h1 class="font-extrabold text-3xl sm:text-4xl text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">Study Smarterz</h1>
                <div class="flex items-center gap-3">
                    <button id="notification-btn" aria-label="Show notifications" class="relative w-12 h-12 text-xl rounded-full flex items-center justify-center transition-all duration-300 text-purple-300 bg-gray-800/50 hover:bg-purple-500 hover:text-white light:text-indigo-600 light:bg-white/50 light:hover:bg-indigo-500 light:hover:text-white">
                        <i class="fa-solid fa-bell"></i>
                        ${notificationCountBadge}
                    </button>
                    <button id="toggle-theme" aria-label="Toggle Dark/Light Mode" class="w-12 h-12 text-xl rounded-full flex items-center justify-center transition-all duration-300 text-purple-300 bg-gray-800/50 hover:bg-purple-500 hover:text-white light:text-indigo-600 light:bg-white/50 light:hover:bg-indigo-500 light:hover:text-white">
                        <i id="theme-icon" class="fa-solid fa-moon"></i>
                    </button>
                </div>
            </div>
        </header>

        <div class="animate-load" style="opacity: 0;">
            <div class="flex flex-col md:flex-row justify-between items-center gap-6 mb-10">
                <nav class="flex space-x-2 sm:space-x-4" role="tablist">
                    <button role="tab" data-tab="live" class="tab-btn active text-sm sm:text-base px-4 py-2 sm:px-8 sm:py-3 rounded-lg font-bold uppercase tracking-wider transition-all duration-300">🔥 Live</button>
                    <button role="tab" data-tab="up" class="tab-btn text-sm sm:text-base px-4 py-2 sm:px-8 sm:py-3 rounded-lg font-bold uppercase tracking-wider transition-all duration-300">⏰ Upcoming</button>
                    <button role="tab" data-tab="completed" class="tab-btn text-sm sm:text-base px-4 py-2 sm:px-8 sm:py-3 rounded-lg font-bold uppercase tracking-wider transition-all duration-300">📚 Recorded</button>
                </nav>
                <div class="relative inline-block w-full max-w-xs">
                    <select id="batch-filter" aria-label="Batch filter" class="appearance-none w-full px-4 py-3 bg-gray-700 dark:bg-gray-700 text-white dark:text-white border-2 border-purple-600 rounded-lg font-semibold cursor-pointer transition focus:border-pink-500 light:bg-purple-50 light:text-purple-800 light:border-purple-400">
                        ${batchOptions}
                    </select>
                    <i class="fa-solid fa-chevron-down absolute top-1/2 right-4 -translate-y-1/2 text-purple-400 pointer-events-none"></i>
                </div>
            </div>

            <main id="content-area" aria-live="polite" class="relative min-h-[400px]">
                <div id="live-content" class="content-panel grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 transition-opacity duration-500">${liveCards}</div>
                <div id="up-content" class="content-panel absolute inset-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 transition-opacity duration-500 opacity-0 pointer-events-none">${upCards}</div>
                <div id="completed-content" class="content-panel absolute inset-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 transition-opacity duration-500 opacity-0 pointer-events-none">${completedCards}</div>
            </main>
            
            <div id="empty-state" class="text-center mt-20 hidden" role="alert">
                <svg class="mx-auto h-20 w-20 text-gray-600 dark:text-gray-400 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 15.75l-2.489-2.489m0 0a3.375 3.375 0 10-4.773-4.773 3.375 3.375 0 004.774 4.774zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <div id="empty-state-text"></div>
            </div>
        </div>
    </div>

    <footer class="mt-20 py-10 bg-gray-900/50 border-t border-purple-500/20 text-center light:bg-white/50 light:border-purple-500/10">
        <div class="max-w-7xl mx-auto px-4"><p class="font-bold text-lg mb-2">&copy; ${new Date().getFullYear()} Study Smarterz</p><p class="italic text-sm opacity-70 mb-4">"The beautiful thing about learning is that no one can take it away from you."</p><a href="https://t.me/studysmarterhub" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center gap-2 px-6 py-3 font-bold rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:scale-105 transition-transform duration-300 shadow-lg hover:shadow-pink-500/50"><i class="fa-brands fa-telegram text-xl"></i> Join Community</a></div>
    </footer>

    <div id="notification-overlay" class="fixed inset-0 bg-black/60 z-40 hidden"></div>
    <aside id="notifications-panel" class="fixed top-0 right-0 h-full w-full max-w-md bg-gray-800 dark:bg-gray-800 text-white dark:text-white shadow-2xl z-50 p-6 flex flex-col light:bg-gray-50 light:text-gray-800">
        <div class="flex justify-between items-center mb-6"><h2 class="text-2xl font-bold">Notifications</h2><button id="close-notification-btn" aria-label="Close notifications" class="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition light:hover:bg-black/10"><i class="fa-solid fa-xmark text-xl"></i></button></div>
        <div class="overflow-y-auto h-[calc(100vh-80px)] space-y-4 pr-2">${notificationItems}</div>
    </aside>

    <div id="telegram-popup" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 hidden items-center justify-center p-4"><div id="popup-content" class="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 text-center transform transition-all scale-95 opacity-0 light:text-slate-800"><h3 class="text-lg font-medium mt-4">Join Our Community!</h3><p class="text-sm text-slate-500 mt-2">Stay updated with the latest classes, notes, and announcements.</p><div class="mt-5 space-y-3"><a href="https://t.me/studysmarterhub" target="_blank" class="inline-flex justify-center w-full rounded-md shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700">Join Telegram</a><button type="button" id="close-popup-btn" class="inline-flex justify-center w-full rounded-md border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50">Maybe Later</button></div></div></div>

    <script>
    document.addEventListener('DOMContentLoaded', () => {
        const tabs = document.querySelectorAll('[role="tab"]');
        const contentPanels = document.querySelectorAll('.content-panel');
        const batchFilter = document.getElementById('batch-filter');
        const emptyState = document.getElementById('empty-state');
        const emptyStateText = document.getElementById('empty-state-text');
        const toggleThemeBtn = document.getElementById('toggle-theme');
        const themeIcon = document.getElementById('theme-icon');
        const htmlEl = document.documentElement;
        const notificationBtn = document.getElementById('notification-btn');
        const notificationPanel = document.getElementById('notifications-panel');
        const closeNotificationBtn = document.getElementById('close-notification-btn');
        const notificationOverlay = document.getElementById('notification-overlay');
        const popup = document.getElementById('telegram-popup');
        let activeTab = 'live';

        function applyTheme(theme) {
            htmlEl.classList.toggle('light', theme === 'light');
            htmlEl.classList.toggle('dark', theme !== 'light');
            themeIcon.className = theme === 'light' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
            localStorage.setItem('theme', theme);
        }
        toggleThemeBtn.addEventListener('click', () => applyTheme(htmlEl.classList.contains('light') ? 'dark' : 'light'));
        applyTheme(localStorage.getItem('theme') || 'dark');

        function filterContent() {
            const selectedBatch = batchFilter.value;
            const activePanel = document.getElementById(activeTab + '-content');
            if (!activePanel) return;
            let visibleCount = 0;
            activePanel.querySelectorAll('a.block').forEach(card => {
                const cardElement = card.querySelector('.lecture-card');
                if (selectedBatch === 'all' || cardElement.dataset.batch === selectedBatch) {
                    card.style.display = 'block';
                    visibleCount++;
                } else {
                    card.style.display = 'none';
                }
            });
            emptyState.style.display = visibleCount === 0 ? 'block' : 'none';
            if (visibleCount === 0) {
                let message = '';
                switch (activeTab) {
                    case 'live': message = '<h3>No Live Lectures Now</h3><p class="text-lg italic opacity-80">New classes could arrive anytime! 🚀</p>'; break;
                    case 'up': message = '<h3>No Upcoming Lectures</h3><p class="text-lg italic opacity-80">Stay tuned for new batches! 🎯</p>'; break;
                    case 'completed': message = '<h3>No Recorded Lectures Found</h3><p class="text-lg italic opacity-80">Keep learning for a successful tomorrow.</p>'; break;
                }
                emptyStateText.innerHTML = message;
            }
        }

        function showTab(tabId) {
            if (activeTab === tabId) return;
            activeTab = tabId;
            tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabId));
            contentPanels.forEach(panel => {
                const isActive = panel.id === tabId + '-content';
                panel.style.opacity = isActive ? '1' : '0';
                panel.style.pointerEvents = isActive ? 'auto' : 'none';
                panel.classList.toggle('absolute', !isActive);
                panel.classList.toggle('inset-0', !isActive);
            });
            filterContent();
        }
        tabs.forEach(tab => tab.addEventListener('click', () => showTab(tab.dataset.tab)));
        batchFilter.addEventListener('change', filterContent);

        function toggleNotifications(show) {
            notificationOverlay.style.display = show ? 'block' : 'none';
            notificationPanel.classList.toggle('open', show);
        }
        notificationBtn.addEventListener('click', () => toggleNotifications(true));
        closeNotificationBtn.addEventListener('click', () => toggleNotifications(false));
        notificationOverlay.addEventListener('click', () => toggleNotifications(false));

        if (sessionStorage.getItem('popupDismissed') !== 'true') {
            setTimeout(() => {
                const popupContent = document.getElementById('popup-content');
                popup.style.display = 'flex';
                popupContent.classList.remove('scale-95', 'opacity-0');
                popupContent.classList.add('scale-100', 'opacity-100');
            }, 2000);
        }
        document.getElementById('close-popup-btn').addEventListener('click', () => {
            popup.style.display = 'none';
            sessionStorage.setItem('popupDismissed', 'true');
        });

        filterContent();
        setTimeout(() => { window.location.reload(); }, 60000);
    });
    </script>
</body>
</html>`;
};


/**
 * CACHE UPDATE LOGIC
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
    updateCache();
    setInterval(updateCache, 60000); // 60 seconds
});
