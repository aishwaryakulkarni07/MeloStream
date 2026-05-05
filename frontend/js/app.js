const API_URL = 'http://localhost:3000/api';
let currentSong = null;
let isPlaying = false;
let audioInstance = document.getElementById('audioElement');
const PREVIEW_LIMIT = 30; // 30 seconds
let sleepTimer = null;
let favoriteSongIds = new Set();
let lockedSongIds = new Set(); // Time Capsule

// Web Audio API Globals
let audioCtx = null;
let analyser = null;
let sourceNode = null;
let dataArray = null;
let isAudioCtxInit = false;

// Socket.io initialization
let socket = null;
let currentRoomId = null;
if (typeof io !== 'undefined') {
    socket = io('http://localhost:3000');
    
    socket.on('roomMessage', (msg) => {
        document.getElementById('roomStatus').textContent = msg;
    });

    socket.on('syncPlay', (data) => {
        if (!isPlaying && audioInstance && currentSong && currentSong.id === data.songId) {
            audioInstance.play();
        } else if (currentSong && currentSong.id !== data.songId) {
            // Need to fetch and play that song... simplistic for now
        }
    });

    socket.on('syncPause', () => {
        if (isPlaying && audioInstance) {
            audioInstance.pause();
        }
    });

    socket.on('syncSeek', (data) => {
        if (audioInstance) {
            audioInstance.currentTime = data.time;
        }
    });
}

const moodColors = {
    chill: '#4facfe',
    workout: '#ff3366',
    party: '#ff00ff',
    happy: '#ffdd00',
    sad: '#1a2980',
    default: '#ffffff'
};

// Check Auth
const token = localStorage.getItem('melo_token');
const user = localStorage.getItem('melo_user');

if (!token) {
    if(!window.location.href.includes('login.html') && !window.location.href.includes('signup.html')) {
        window.location.href = 'login.html';
    }
} else {
    const userDisplay = document.getElementById('usernameDisplay');
    if (userDisplay && user) {
        userDisplay.textContent = `Welcome, ${user}`;
        userDisplay.nextElementSibling.textContent = user.charAt(0).toUpperCase();
    }
}

// Logout
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('melo_token');
        localStorage.removeItem('melo_user');
        window.location.href = 'login.html';
    });
}

// SPA Navigation
const navLinks = {
    'nav-home': 'home-view',
    'nav-explore': 'explore-view',
    'nav-library': 'library-view',
    'nav-map': 'map-view'
};

Object.keys(navLinks).forEach(navId => {
    const btn = document.getElementById(navId);
    if(btn) {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            // Update active link
            document.querySelectorAll('.nav-links a').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            
            // Update active view
            document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
            document.getElementById(navLinks[navId]).classList.add('active');

            // Fetch specific data if needed
            if (navId === 'nav-explore') {
                fetchAnalytics();
                fetchAchievements();
            }
            if (navId === 'nav-library') fetchFavorites();
            if (navId === 'nav-map') initUndergroundMap();
        });
    }
});

// Theme Switcher
const themeSwitcher = document.getElementById('themeSwitcher');
if(themeSwitcher) {
    const savedTheme = localStorage.getItem('melo_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeSwitcher.value = savedTheme;

    themeSwitcher.addEventListener('change', (e) => {
        const theme = e.target.value;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('melo_theme', theme);
    });
}

// Smart Timer
const smartTimer = document.getElementById('smartTimer');
if(smartTimer) {
    smartTimer.addEventListener('change', (e) => {
        const mins = parseInt(e.target.value);
        if(sleepTimer) clearTimeout(sleepTimer);
        
        if(mins > 0) {
            sleepTimer = setTimeout(() => {
                if(isPlaying && audioInstance) {
                    audioInstance.pause();
                }
                smartTimer.value = "0"; // Reset UI
            }, mins * 60 * 1000);
            alert(`Sleep timer set for ${mins} minutes.`);
        }
    });
}

// Mood Filtering
const moodChips = document.querySelectorAll('.mood-chip');
moodChips.forEach(chip => {
    chip.addEventListener('click', async (e) => {
        moodChips.forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        const mood = e.target.dataset.mood;
        
        if(mood === 'all') {
            fetchSongs();
        } else {
            try {
                const res = await fetch(`${API_URL}/songs/mood/${mood}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if(res.ok) {
                    const songs = await res.json();
                    renderSongs(songs, 'songsContainer');
                }
            } catch(err) {
                console.error(err);
            }
        }
    });
});

// Fetch Initial Data
async function fetchSongs() {
    try {
        const res = await fetch(`${API_URL}/songs`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch');
        const songs = await res.json();
        renderSongs(songs, 'songsContainer');
    } catch (err) {
        console.error(err);
    }
}

async function fetchRecommended() {
    try {
        const res = await fetch(`${API_URL}/songs/recommended`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if(res.ok) {
            const songs = await res.json();
            renderSongs(songs, 'recommendedContainer');
        }
    } catch(err) {
        console.error(err);
    }
}

async function fetchFavoriteIds() {
    try {
        const res = await fetch(`${API_URL}/favorites`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if(res.ok) {
            const faves = await res.json();
            favoriteSongIds = new Set(faves.map(s => s.id));
        }
    } catch(err) {
        console.error(err);
    }
}

async function fetchFavorites() {
    try {
        const res = await fetch(`${API_URL}/favorites`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if(res.ok) {
            const faves = await res.json();
            renderSongs(faves, 'favoritesContainer');
        }
    } catch(err) {
        console.error(err);
    }
}

// Render Songs
function renderSongs(songs, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    songs.forEach(song => {
        const isLiked = favoriteSongIds.has(song.id);
        const isLocked = lockedSongIds.has(song.id);
        
        const card = document.createElement('div');
        card.className = `song-card ${isLocked ? 'locked-song' : ''}`;
        if (isLocked) {
            card.style.opacity = '0.5';
            card.style.pointerEvents = 'none';
        }
        
        card.innerHTML = `
            <img src="${song.cover_url || 'https://via.placeholder.com/150'}" alt="${song.title}" class="song-cover">
            <div class="like-btn ${isLiked ? 'liked' : ''}" data-id="${song.id}">
                <i class="fa-solid fa-heart"></i>
            </div>
            ${isLocked ? '<div class="lock-icon" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:30px;color:white;"><i class="fa-solid fa-lock"></i></div>' : ''}
            <div class="card-play-btn" data-id="${song.id}" style="${isLocked ? 'display:none;' : ''}"><i class="fa-solid fa-play"></i></div>
            <div class="song-info">
                <h3>${song.title}</h3>
                <p>${song.artist}</p>
            </div>
        `;
        
        if (!isLocked) {
            // Play click
            const playBtn = card.querySelector('.card-play-btn');
            playBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                playSong(song);
            });

            // Like click
            const likeBtn = card.querySelector('.like-btn');
            likeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await toggleFavorite(song.id, likeBtn);
            });
        }
        
        container.appendChild(card);
    });
}

async function toggleFavorite(songId, btnEl) {
    try {
        const res = await fetch(`${API_URL}/favorites`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ song_id: songId })
        });
        if(res.ok) {
            const data = await res.json();
            if(data.isFavorite) {
                btnEl.classList.add('liked');
                favoriteSongIds.add(songId);
            } else {
                btnEl.classList.remove('liked');
                favoriteSongIds.delete(songId);
            }
        }
    } catch(err) {
        console.error(err);
    }
}

// Fetch Recently Played
async function fetchRecentlyPlayed() {
    try {
        const res = await fetch(`${API_URL}/songs/recently-played`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const history = await res.json();
        renderRecentlyPlayed(history);
    } catch (err) {
        console.error(err);
    }
}

function renderRecentlyPlayed(history) {
    const container = document.getElementById('recentlyPlayedContainer');
    const section = document.getElementById('recentSection');
    if (!container) return;
    
    const uniqueHistory = [];
    const seen = new Set();
    
    for(const item of history) {
        if(!seen.has(item.song_id)) {
            seen.add(item.song_id);
            uniqueHistory.push(item);
        }
    }

    if(uniqueHistory.length === 0) {
        if(section) section.style.display = 'none';
        return;
    }
    if(section) section.style.display = 'block';
    
    container.innerHTML = '';
    
    uniqueHistory.forEach(song => {
        const div = document.createElement('div');
        div.className = 'recent-item';
        div.innerHTML = `
            <img src="${song.cover_url || 'https://via.placeholder.com/50'}" class="recent-cover">
            <div class="recent-info">
                <h4>${song.title}</h4>
                <p>${song.artist}</p>
            </div>
        `;
        div.addEventListener('click', () => playSong(song));
        container.appendChild(div);
    });
}

// Search
const searchInput = document.getElementById('searchInput');
if (searchInput) {
    searchInput.addEventListener('input', debounce(async (e) => {
        const query = e.target.value;
        const title = document.getElementById('searchResultsTitle');
        const container = document.getElementById('searchResultsContainer');
        const mainContainer = document.getElementById('songsContainer');
        const recommendedTitle = document.getElementById('recommendedTitle');
        const recommendedContainer = document.getElementById('recommendedContainer');
        const trendingTitle = document.getElementById('trendingTitle');
        const moodContainer = document.getElementById('moodContainer');
        
        if (query.trim() === '') {
            if(title) title.style.display = 'none';
            if(container) container.style.display = 'none';
            if(mainContainer) mainContainer.style.display = 'grid';
            if(trendingTitle) trendingTitle.style.display = 'block';
            if(recommendedTitle) recommendedTitle.style.display = 'block';
            if(recommendedContainer) recommendedContainer.style.display = 'grid';
            if(moodContainer) moodContainer.style.display = 'flex';
            return;
        }
        
        try {
            const res = await fetch(`${API_URL}/songs/search?q=${encodeURIComponent(query)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const results = await res.json();
                if(mainContainer) mainContainer.style.display = 'none';
                if(trendingTitle) trendingTitle.style.display = 'none';
                if(recommendedTitle) recommendedTitle.style.display = 'none';
                if(recommendedContainer) recommendedContainer.style.display = 'none';
                if(moodContainer) moodContainer.style.display = 'none';
                
                if(title) title.style.display = 'block';
                if(container) {
                    container.style.display = 'grid';
                    renderSongs(results, 'searchResultsContainer');
                }
            }
        } catch (err) {
            console.error(err);
        }
    }, 500));
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Analytics
let chartInstance = null;
async function fetchAnalytics() {
    try {
        const res = await fetch(`${API_URL}/analytics`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if(res.ok) {
            const data = await res.json();
            document.getElementById('statTotalPlays').textContent = data.totalPlays || 0;
            document.getElementById('statTopArtist').textContent = data.topArtist || '-';
            
            renderChart(data.dailyPlays);
        }
    } catch(err) {
        console.error(err);
    }
}

function renderChart(dailyPlays) {
    const ctx = document.getElementById('playsChart');
    if(!ctx) return;
    
    if(chartInstance) {
        chartInstance.destroy();
    }
    
    const labels = dailyPlays.map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    });
    const data = dailyPlays.map(d => d.count);
    
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Songs Played',
                data: data,
                borderColor: '#FF3366',
                backgroundColor: 'rgba(255, 51, 102, 0.2)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: { color: '#a0a5b1', stepSize: 1 },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                x: {
                    ticks: { color: '#a0a5b1' },
                    grid: { display: false }
                }
            }
        }
    });
}

// Audio Player Logic
async function playSong(song, skipSync = false) {
    if (currentSong && currentSong.id === song.id && isPlaying) {
        audioInstance.pause();
        return;
    }
    
    currentSong = song;
    document.getElementById('playerTitle').textContent = song.title;
    document.getElementById('playerArtist').textContent = song.artist;
    document.getElementById('playerCover').src = song.cover_url || 'https://via.placeholder.com/300';
    
    // Route through backend proxy to bypass CORS restrictions for Web Audio API
    document.getElementById('audioElement').src = `${API_URL}/audio-proxy?url=${encodeURIComponent(song.audio_url)}`;
    
    document.getElementById('limitWarning').style.display = 'none';
    
    // Aura Idea: Update background color based on mood
    const auraColor = moodColors[song.mood] || moodColors.default;
    document.documentElement.style.setProperty('--aura-color', auraColor);
    
    // Init Web Audio API on first interaction
    if (!isAudioCtxInit) {
        initWebAudio();
        isAudioCtxInit = true;
    }

    try {
        await audioInstance.play();
        logRecentlyPlayed(song.id);
        loadGraffiti(song.id); // Load graffiti stickers

        // Party Room Sync
        if (socket && currentRoomId && !skipSync) {
            socket.emit('syncPlay', { roomId: currentRoomId, songId: song.id });
        }
    } catch(err) {
        console.error("Playback failed", err);
    }
}

async function logRecentlyPlayed(songId) {
    try {
        const res = await fetch(`${API_URL}/songs/play`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ song_id: songId })
        });
        
        if (res.ok) {
            const data = await res.json();
            if (data.unlocked_achievements && data.unlocked_achievements.length > 0) {
                // Show toast for the first newly unlocked achievement
                showAchievementToast(data.unlocked_achievements[0]);
            }
        }
        
        fetchRecentlyPlayed(); // Refresh history
        
        // If we are on Home view, refresh recommended
        if(document.getElementById('home-view').classList.contains('active')) {
            fetchRecommended();
        }
    } catch (err) {
        console.error(err);
    }
}

// Player Event Listeners
if (audioInstance) {
    const playBtn = document.getElementById('playBtn');
    const playerCover = document.getElementById('playerCover');
    const progressBar = document.getElementById('progressBar');
    const currentTimeEl = document.getElementById('currentTime');
    const limitWarning = document.getElementById('limitWarning');
    
    audioInstance.addEventListener('play', () => {
        isPlaying = true;
        playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        playerCover.classList.add('playing');
    });
    
    audioInstance.addEventListener('pause', () => {
        isPlaying = false;
        playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        playerCover.classList.remove('playing');
    });
    
    playBtn.addEventListener('click', () => {
        if (!currentSong) return;
        if (isPlaying) {
            audioInstance.pause();
            if (socket && currentRoomId) socket.emit('syncPause', { roomId: currentRoomId });
        } else {
            audioInstance.play();
            document.getElementById('limitWarning').style.display = 'none';
            if (socket && currentRoomId) socket.emit('syncPlay', { roomId: currentRoomId, songId: currentSong.id });
        }
    });
    
    audioInstance.addEventListener('timeupdate', () => {
        let current = audioInstance.currentTime;
        
        // 30-Second Limit Logic
        if (current >= PREVIEW_LIMIT) {
            audioInstance.pause();
            audioInstance.currentTime = 0;
            isPlaying = false;
            limitWarning.style.display = 'block';
            return;
        }
        
        const progressPercent = (current / PREVIEW_LIMIT) * 100;
        progressBar.style.width = `${progressPercent}%`;
        
        // Format time
        const secs = Math.floor(current % 60);
        currentTimeEl.textContent = `0:${secs < 10 ? '0' : ''}${secs}`;
    });
    
    document.getElementById('progressContainer').addEventListener('click', (e) => {
        if(!currentSong) return;
        const width = e.target.clientWidth;
        const clickX = e.offsetX;
        const duration = PREVIEW_LIMIT;
        
        const newTime = (clickX / width) * duration;
        audioInstance.currentTime = newTime;
        if (socket && currentRoomId) socket.emit('syncSeek', { roomId: currentRoomId, time: newTime });
    });
}

// ==========================================
// ADVANCED FEATURES LOGIC
// ==========================================

// --- Achievements ---
async function fetchAchievements() {
    try {
        const res = await fetch(`${API_URL}/achievements`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const achievements = await res.json();
            const container = document.getElementById('achievementsContainer');
            if (container) {
                container.innerHTML = '';
                achievements.forEach(ach => {
                    const el = document.createElement('div');
                    el.className = `achievement-card ${ach.unlocked ? 'unlocked' : ''}`;
                    el.innerHTML = `
                        <i class="fa-solid ${ach.icon_class}"></i>
                        <h4>${ach.name}</h4>
                        <p>${ach.description}</p>
                    `;
                    container.appendChild(el);
                });
            }
        }
    } catch (err) {
        console.error(err);
    }
}

function showAchievementToast(achievement) {
    const toast = document.getElementById('achievementToast');
    const desc = document.getElementById('toastDesc');
    if (!toast || !desc) return;

    desc.textContent = achievement.name;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

// --- Smart Mix Maker ---
const generateMixBtn = document.getElementById('generateMixBtn');
if (generateMixBtn) {
    generateMixBtn.addEventListener('click', async () => {
        const checkboxes = document.querySelectorAll('#smartMixOptions input[type="checkbox"]:checked');
        const moods = Array.from(checkboxes).map(cb => cb.value);
        
        if (moods.length === 0) {
            alert('Please select at least one mood.');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/songs/smart-mix`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ moods })
            });
            if (res.ok) {
                const songs = await res.json();
                document.getElementById('trendingTitle').textContent = 'Your Smart Mix';
                renderSongs(songs, 'songsContainer');
                document.getElementById('recommendedTitle').style.display = 'none';
                document.getElementById('recommendedContainer').style.display = 'none';
            }
        } catch (err) {
            console.error(err);
        }
    });
}

// --- Focus Mode ---
let focusInterval = null;
let focusTimeRemaining = 25 * 60; // 25 minutes

const focusModeBtn = document.getElementById('focusModeBtn');
const exitFocusBtn = document.getElementById('exitFocusBtn');
const focusOverlay = document.getElementById('focusOverlay');
const focusTimerText = document.getElementById('focusTimerText');

if (focusModeBtn) {
    focusModeBtn.addEventListener('click', () => {
        focusOverlay.style.display = 'flex';
        focusTimeRemaining = 25 * 60;
        updateFocusTimerUI();
        
        focusInterval = setInterval(() => {
            focusTimeRemaining--;
            updateFocusTimerUI();
            if (focusTimeRemaining <= 0) {
                clearInterval(focusInterval);
                alert("Focus session completed!");
                exitFocusMode();
            }
        }, 1000);

        // Auto play chill music
        playFocusMusic();
    });
}

if (exitFocusBtn) {
    exitFocusBtn.addEventListener('click', exitFocusMode);
}

function updateFocusTimerUI() {
    const m = Math.floor(focusTimeRemaining / 60);
    const s = focusTimeRemaining % 60;
    focusTimerText.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
}

function exitFocusMode() {
    focusOverlay.style.display = 'none';
    if (focusInterval) clearInterval(focusInterval);
}

async function playFocusMusic() {
    try {
        const res = await fetch(`${API_URL}/songs/mood/chill`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const songs = await res.json();
            if (songs.length > 0) {
                playSong(songs[0]); // Just play the first chill song
            }
        }
    } catch (err) {
        console.error(err);
    }
}

// --- Party Room ---
const partyRoomBtn = document.getElementById('partyRoomBtn');
const partyModal = document.getElementById('partyModal');
const closePartyModal = document.getElementById('closePartyModal');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const roomCodeInput = document.getElementById('roomCodeInput');
const roomStatus = document.getElementById('roomStatus');

if (partyRoomBtn) {
    partyRoomBtn.addEventListener('click', () => {
        partyModal.style.display = 'flex';
    });
}

if (closePartyModal) {
    closePartyModal.addEventListener('click', () => {
        partyModal.style.display = 'none';
    });
}

if (createRoomBtn) {
    createRoomBtn.addEventListener('click', () => {
        if (!socket) return alert("Real-time syncing is not connected.");
        currentRoomId = 'room_' + Math.random().toString(36).substring(2, 9);
        socket.emit('joinRoom', currentRoomId);
        roomStatus.textContent = `Room created! Code: ${currentRoomId}`;
    });
}

if (joinRoomBtn) {
    joinRoomBtn.addEventListener('click', () => {
        if (!socket) return alert("Real-time syncing is not connected.");
        const code = roomCodeInput.value.trim();
        if (!code) return;
        currentRoomId = code;
        socket.emit('joinRoom', currentRoomId);
        roomStatus.textContent = `Joined room: ${currentRoomId}`;
    });
}

// --- Web Audio API (Beat-Matched Typography & Glass Smashing) ---
function initWebAudio() {
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        sourceNode = audioCtx.createMediaElementSource(audioInstance);
        sourceNode.connect(analyser);
        analyser.connect(audioCtx.destination);
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        requestAnimationFrame(audioLoop);
    } catch (e) {
        console.warn("Web Audio API not supported or CORS blocked", e);
    }
}

function audioLoop() {
    if (isPlaying && analyser) {
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate bass volume (lower frequencies)
        let bassSum = 0;
        for (let i = 0; i < 10; i++) {
            bassSum += dataArray[i];
        }
        const bassAvg = bassSum / 10;

        // Beat-Matched Typography
        const titleEl = document.getElementById('playerTitle');
        if (titleEl) {
            // Scale between 1.0 and 1.3 based on bass
            const scale = 1 + (bassAvg / 255) * 0.3;
            titleEl.style.transform = `scale(${scale})`;
            titleEl.style.fontWeight = bassAvg > 200 ? '900' : 'normal';
        }

        // Glass Smashing
        const glassPanels = document.querySelectorAll('.glass-panel');
        if (bassAvg > 245 && currentSong && (currentSong.mood === 'party' || currentSong.mood === 'workout')) {
            glassPanels.forEach(panel => {
                if (!panel.classList.contains('shatter')) {
                    panel.classList.add('shatter');
                    setTimeout(() => panel.classList.remove('shatter'), 300);
                }
            });
        }
    }
    requestAnimationFrame(audioLoop);
}

// --- Sleepscape / Dream Engine ---
const sleepModeBtn = document.getElementById('sleepModeBtn');
const exitSleepBtn = document.getElementById('exitSleepBtn');
const sleepscapeOverlay = document.getElementById('sleepscapeOverlay');
let sleepFadeInterval = null;

if (sleepModeBtn) {
    sleepModeBtn.addEventListener('click', () => {
        sleepscapeOverlay.style.display = 'flex';
        // Auto play chill music if nothing is playing
        if (!isPlaying) playFocusMusic();
        
        // Fade out over 5 minutes (for demo purposes)
        const totalFadeTime = 5 * 60 * 1000;
        const fadeSteps = 100;
        const stepTime = totalFadeTime / fadeSteps;
        let currentStep = 0;
        
        if (sleepFadeInterval) clearInterval(sleepFadeInterval);
        sleepFadeInterval = setInterval(() => {
            currentStep++;
            let newVolume = 1 - (currentStep / fadeSteps);
            if (newVolume <= 0) {
                newVolume = 0;
                audioInstance.pause();
                clearInterval(sleepFadeInterval);
            }
            audioInstance.volume = newVolume;
        }, stepTime);
    });
}

if (exitSleepBtn) {
    exitSleepBtn.addEventListener('click', () => {
        sleepscapeOverlay.style.display = 'none';
        if (sleepFadeInterval) clearInterval(sleepFadeInterval);
        audioInstance.volume = 1.0; // Reset volume
    });
}

// --- Nostalgia Time Capsule ---
async function fetchLockedSongs() {
    try {
        const res = await fetch(`${API_URL}/capsules/locked`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            lockedSongIds = new Set(data.map(d => d.song_id));
        }
    } catch (err) {
        console.error(err);
    }
}

const createCapsuleBtn = document.getElementById('createCapsuleBtn');
if (createCapsuleBtn) {
    createCapsuleBtn.addEventListener('click', async () => {
        const dateInput = document.getElementById('capsuleUnlockDate').value;
        if (!dateInput) return alert("Select an unlock date!");
        
        // Convert set to array
        const songIds = Array.from(favoriteSongIds);
        if (songIds.length === 0) return alert("You have no favorites to bury!");
        
        try {
            const res = await fetch(`${API_URL}/capsules`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ unlock_date: dateInput, song_ids: songIds })
            });
            if (res.ok) {
                alert("Favorites buried in Time Capsule!");
                await fetchLockedSongs();
                fetchFavorites(); // Re-render to show locks
            }
        } catch (err) {
            console.error(err);
        }
    });
}

// --- Graffiti Canvas ---
const graffitiOverlay = document.getElementById('graffitiOverlay');
const graffitiInputContainer = document.getElementById('graffitiInputContainer');
const graffitiTextInput = document.getElementById('graffitiTextInput');
let pendingGraffitiCoords = null;

if (graffitiOverlay) {
    graffitiOverlay.addEventListener('click', (e) => {
        if (!currentSong) return;
        const rect = graffitiOverlay.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        
        pendingGraffitiCoords = { x, y };
        graffitiInputContainer.style.display = 'block';
        graffitiInputContainer.style.top = `${e.clientY - rect.top - 40}px`;
        graffitiInputContainer.style.left = `${e.clientX - rect.left}px`;
        graffitiTextInput.focus();
    });
}

if (graffitiTextInput) {
    graffitiTextInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            const text = e.target.value.trim();
            if (text && pendingGraffitiCoords && currentSong) {
                try {
                    const res = await fetch(`${API_URL}/graffiti`, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}` 
                        },
                        body: JSON.stringify({
                            song_id: currentSong.id,
                            text_content: text,
                            x_pos: pendingGraffitiCoords.x,
                            y_pos: pendingGraffitiCoords.y
                        })
                    });
                    if (res.ok) {
                        e.target.value = '';
                        graffitiInputContainer.style.display = 'none';
                        loadGraffiti(currentSong.id);
                    }
                } catch (err) {
                    console.error(err);
                }
            }
        }
    });
}

async function loadGraffiti(songId) {
    if (!graffitiOverlay) return;
    // Clear existing
    const existing = graffitiOverlay.querySelectorAll('.graffiti-text');
    existing.forEach(el => el.remove());

    try {
        const res = await fetch(`${API_URL}/graffiti/${songId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const stickers = await res.json();
            stickers.forEach(st => {
                const el = document.createElement('div');
                el.className = 'graffiti-text';
                el.style.left = `${st.x_pos}%`;
                el.style.top = `${st.y_pos}%`;
                el.textContent = st.text_content;
                graffitiOverlay.appendChild(el);
            });
        }
    } catch (err) {
        console.error(err);
    }
}

let mapNodes = [];

// --- Underground Map ---
async function initUndergroundMap() {
    const canvas = document.getElementById('undergroundMapCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Resize
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;

    try {
        const res = await fetch(`${API_URL}/songs`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const songs = await res.json();
            drawMap(ctx, canvas, songs);
        }
    } catch (err) {
        console.error(err);
    }
}

function drawMap(ctx, canvas, songs) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const nodes = [];
    
    // Group songs into clusters by mood
    const clusters = {
        chill: { x: canvas.width * 0.2, y: canvas.height * 0.2 },
        party: { x: canvas.width * 0.8, y: canvas.height * 0.8 },
        workout: { x: canvas.width * 0.8, y: canvas.height * 0.2 },
        sad: { x: canvas.width * 0.2, y: canvas.height * 0.8 },
        happy: { x: canvas.width * 0.5, y: canvas.height * 0.5 }
    };

    songs.forEach(song => {
        const base = clusters[song.mood] || clusters.happy;
        nodes.push({
            song,
            x: base.x + (Math.random() * 150 - 75),
            y: base.y + (Math.random() * 150 - 75),
            color: moodColors[song.mood] || moodColors.default
        });
    });

    mapNodes = nodes; // Save globally for click detection

    // Draw lines between nodes in same cluster
    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            if (nodes[i].song.mood === nodes[j].song.mood) {
                const dist = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
                if (dist < 100) {
                    ctx.strokeStyle = `rgba(255,255,255,${1 - dist/100})`;
                    ctx.beginPath();
                    ctx.moveTo(nodes[i].x, nodes[i].y);
                    ctx.lineTo(nodes[j].x, nodes[j].y);
                    ctx.stroke();
                }
            }
        }
    }

    // Draw nodes
    nodes.forEach(n => {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.fill();
        ctx.shadowBlur = 10;
        ctx.shadowColor = n.color;
        
        ctx.fillStyle = "white";
        ctx.font = "10px sans-serif";
        ctx.fillText(n.song.title, n.x + 10, n.y + 4);
    });
}

// Map Click Listener
const undergroundMapCanvas = document.getElementById('undergroundMapCanvas');
if (undergroundMapCanvas) {
    undergroundMapCanvas.addEventListener('click', (e) => {
        const rect = undergroundMapCanvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        
        for (const n of mapNodes) {
            const dist = Math.hypot(n.x - clickX, n.y - clickY);
            if (dist < 12) { // Hit area
                playSong(n.song);
                break;
            }
        }
    });
}

// Bootstrap Application
if (window.location.href.includes('index.html') || window.location.pathname.endsWith('/frontend/')) {
    async function init() {
        await fetchFavoriteIds();
        await fetchLockedSongs();
        fetchSongs();
        fetchRecommended();
        fetchRecentlyPlayed();
    }
    init();
}
