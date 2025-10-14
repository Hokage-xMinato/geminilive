document.addEventListener('DOMContentLoaded', () => {

    const liveGrid = document.getElementById('live-grid');
    const upcomingGrid = document.getElementById('upcoming-grid');
    const recordedGrid = document.getElementById('recorded-grid');
    const lastUpdatedEl = document.getElementById('last-updated');

    const telegramPopup = document.getElementById('telegram-popup');
    const closePopupButton = document.getElementById('close-popup');
    const joinTelegramBtn = document.getElementById('join-telegram-btn');

    
    const showPopup = () => {
        // Show popup only if it hasn't been shown before in this session
        if (!sessionStorage.getItem('telegramPopupShown')) {
             setTimeout(() => {
                telegramPopup.classList.add('show');
            }, 1500);
        }
    };

    const hidePopup = () => {
        telegramPopup.classList.remove('show');
        sessionStorage.setItem('telegramPopupShown', 'true');
    };

    closePopupButton.addEventListener('click', hidePopup);
    joinTelegramBtn.addEventListener('click', hidePopup);
    telegramPopup.addEventListener('click', (e) => {
        if (e.target === telegramPopup) {
            hidePopup();
        }
    });

    // --- Data Fetching and Rendering ---
    const createLectureCard = (lecture) => {
        const card = document.createElement('div');
        card.className = 'lecture-card';

        const thumbnailUrl = lecture.thumbnail || `https://placehold.co/600x400/6a5acd/ffffff?text=${encodeURIComponent(lecture.batchName || 'Lecture')}`;

        card.innerHTML = `
            <img src="${thumbnailUrl}" alt="${lecture.lectureName}" class="card-thumbnail" onerror="this.src='https://placehold.co/600x400/EEE/333?text=Image+Error'">
            <div class="card-content">
                <span class="batch-name">${lecture.batchName || 'General'}</span>
                <h3 class="lecture-name">${lecture.lectureName || lecture.name || lecture.title || 'Untitled Lecture'}</h3>
                ${lecture.link ? `<a href="${lecture.link}" target="_blank" class="watch-button">Watch Now</a>` : ''}
            </div>
        `;
        return card;
    };

    const renderLectures = (gridElement, lectures) => {
        gridElement.innerHTML = ''; // Clear skeletons
        if (lectures && lectures.length > 0) {
            lectures.forEach(lecture => {
                const card = createLectureCard(lecture);
                gridElement.appendChild(card);
            });
        } else {
            gridElement.innerHTML = '<p class="empty-state">No classes available in this category right now.</p>';
        }
    };

    const timeSince = (date) => {
        const seconds = Math.floor((new Date() - date) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " years ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutes ago";
        return "Just now";
    }

    const fetchData = async () => {
        try {
            const response = await fetch('/api/lectures');
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();

            renderLectures(liveGrid, data.live);
            renderLectures(upcomingGrid, data.up);
            renderLectures(recordedGrid, data.completed);

            if (data.lastUpdated) {
                lastUpdatedEl.textContent = `Last updated: ${timeSince(new Date(data.lastUpdated))}`;
            }

        } catch (error) {
            console.error('Failed to fetch lecture data:', error);
            liveGrid.innerHTML = '<p class="empty-state">Could not load live classes. Please try again later.</p>';
            upcomingGrid.innerHTML = '<p class="empty-state">Could not load upcoming classes.</p>';
            recordedGrid.innerHTML = '<p class="empty-state">Could not load recorded classes.</p>';
        }
    };

    // --- Initialization ---
    fetchData(); // Initial fetch
    showPopup(); // Show popup on page load

    // Auto-refresh data every 60 seconds
    setInterval(fetchData, 60000);
});
