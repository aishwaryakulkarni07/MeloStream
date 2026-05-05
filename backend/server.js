const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const https = require('https');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

const JWT_SECRET = 'melo_secret_key_123';

// Auth Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Signup
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await db.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);

        const token = jwt.sign({ id: result.insertId, username }, JWT_SECRET);
        res.status(201).json({ message: 'User created successfully', token, username });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: 'Username already exists' });
        } else {
            console.error('Signup Database Error:', err);
            res.status(500).json({ error: 'Database error' });
        }
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        const user = users[0];

        if (!user) return res.status(400).json({ error: 'Invalid username or password' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Invalid username or password' });

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
        res.json({ token, username: user.username });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Get all songs
app.get('/api/songs', authenticateToken, async (req, res) => {
    try {
        const [songs] = await db.query('SELECT * FROM songs');
        res.json(songs);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Search songs
app.get('/api/songs/search', authenticateToken, async (req, res) => {
    try {
        const query = req.query.q || '';
        const [songs] = await db.query('SELECT * FROM songs WHERE title LIKE ? OR artist LIKE ? OR language LIKE ?', [`%${query}%`, `%${query}%`, `%${query}%`]);
        res.json(songs);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Get recently played
app.get('/api/songs/recently-played', authenticateToken, async (req, res) => {
    try {
        const [history] = await db.query(`
            SELECT s.*, r.played_at 
            FROM recently_played r 
            JOIN songs s ON r.song_id = s.id 
            WHERE r.user_id = ? 
            ORDER BY r.played_at DESC 
            LIMIT 10
        `, [req.user.id]);
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Log recently played & handle achievements
app.post('/api/songs/play', authenticateToken, async (req, res) => {
    try {
        const { song_id } = req.body;
        await db.query('INSERT INTO recently_played (user_id, song_id) VALUES (?, ?)', [req.user.id, song_id]);
        await db.query('UPDATE songs SET play_count = play_count + 1 WHERE id = ?', [song_id]);

        // Achievement 1: First Spin
        const [plays] = await db.query('SELECT COUNT(*) as play_count FROM recently_played WHERE user_id = ?', [req.user.id]);
        if (plays[0].play_count === 1) {
            await db.query('INSERT IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, 1)', [req.user.id]);
        }

        // Achievement 2: Night Owl (between 00:00 and 04:00)
        const currentHour = new Date().getHours();
        if (currentHour >= 0 && currentHour < 4) {
            await db.query('INSERT IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, 2)', [req.user.id]);
        }

        // Achievement 3: Mood Explorer (3 distinct moods)
        const [moods] = await db.query(`
            SELECT COUNT(DISTINCT s.mood) as mood_count 
            FROM recently_played r 
            JOIN songs s ON r.song_id = s.id 
            WHERE r.user_id = ?
        `, [req.user.id]);
        if (moods[0].mood_count >= 3) {
            await db.query('INSERT IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, 3)', [req.user.id]);
        }

        // Fetch newly unlocked achievements to return to the client
        const [unlocked] = await db.query(`
            SELECT a.* FROM user_achievements ua
            JOIN achievements a ON ua.achievement_id = a.id
            WHERE ua.user_id = ? AND ua.unlocked_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)
        `, [req.user.id]);

        res.status(200).json({ message: 'Logged played song', unlocked_achievements: unlocked });
    } catch (err) {
        console.log("REAL ERROR", err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get recommended songs (top played)
app.get('/api/songs/recommended', authenticateToken, async (req, res) => {
    try {
        const [songs] = await db.query('SELECT * FROM songs ORDER BY play_count DESC LIMIT 10');
        res.json(songs);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Get songs by mood
app.get('/api/songs/mood/:mood', authenticateToken, async (req, res) => {
    try {
        const { mood } = req.params;
        const [songs] = await db.query('SELECT * FROM songs WHERE mood = ?', [mood]);
        res.json(songs);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Toggle Favorite
app.post('/api/favorites', authenticateToken, async (req, res) => {
    try {
        const { song_id } = req.body;
        // Check if already favorited
        const [existing] = await db.query('SELECT * FROM favorites WHERE user_id = ? AND song_id = ?', [req.user.id, song_id]);
        if (existing.length > 0) {
            await db.query('DELETE FROM favorites WHERE user_id = ? AND song_id = ?', [req.user.id, song_id]);
            res.json({ message: 'Removed from favorites', isFavorite: false });
        } else {
            await db.query('INSERT INTO favorites (user_id, song_id) VALUES (?, ?)', [req.user.id, song_id]);
            res.json({ message: 'Added to favorites', isFavorite: true });
        }
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Get Favorites
app.get('/api/favorites', authenticateToken, async (req, res) => {
    try {
        const [favorites] = await db.query(`
            SELECT s.* 
            FROM favorites f 
            JOIN songs s ON f.song_id = s.id 
            WHERE f.user_id = ?
            ORDER BY f.created_at DESC
        `, [req.user.id]);
        res.json(favorites);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Get Analytics
app.get('/api/analytics', authenticateToken, async (req, res) => {
    try {
        const [totalPlaysRow] = await db.query('SELECT COUNT(*) as total_plays FROM recently_played WHERE user_id = ?', [req.user.id]);
        const totalPlays = totalPlaysRow[0].total_plays;

        const [mostPlayedArtistRow] = await db.query(`
            SELECT s.artist, COUNT(*) as play_count
            FROM recently_played r
            JOIN songs s ON r.song_id = s.id
            WHERE r.user_id = ?
            GROUP BY s.artist
            ORDER BY play_count DESC
            LIMIT 1
        `, [req.user.id]);
        
        const topArtist = mostPlayedArtistRow.length > 0 ? mostPlayedArtistRow[0].artist : 'None';

        // Get daily plays for chart (last 7 days)
        const [dailyPlays] = await db.query(`
            SELECT DATE(played_at) as date, COUNT(*) as count
            FROM recently_played
            WHERE user_id = ? AND played_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            GROUP BY DATE(played_at)
            ORDER BY DATE(played_at) ASC
        `, [req.user.id]);

        res.json({ totalPlays, topArtist, dailyPlays });
    } catch (err) {
        console.error("Analytics Error", err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get Achievements
app.get('/api/achievements', authenticateToken, async (req, res) => {
    try {
        const [allAchievements] = await db.query('SELECT * FROM achievements');
        const [userAchievements] = await db.query('SELECT achievement_id FROM user_achievements WHERE user_id = ?', [req.user.id]);
        
        const unlockedIds = userAchievements.map(ua => ua.achievement_id);
        
        const achievements = allAchievements.map(a => ({
            ...a,
            unlocked: unlockedIds.includes(a.id)
        }));
        res.json(achievements);
    } catch (err) {
        console.error("Achievements Error", err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Smart Mix Maker
app.post('/api/songs/smart-mix', authenticateToken, async (req, res) => {
    try {
        const { moods } = req.body; // array of moods
        if (!moods || !Array.isArray(moods) || moods.length === 0) {
            return res.status(400).json({ error: 'Please select at least one mood' });
        }
        
        const placeholders = moods.map(() => '?').join(',');
        const query = `SELECT * FROM songs WHERE mood IN (${placeholders}) ORDER BY RAND() LIMIT 10`;
        const [songs] = await db.query(query, moods);
        res.json(songs);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Audio Proxy (Bypass CORS for Web Audio API)
app.get('/api/audio-proxy', (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).send('No URL provided');
    
    https.get(url, (response) => {
        // We only care about passing through audio safely with CORS
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Content-Type', response.headers['content-type'] || 'audio/mpeg');
        res.set('Content-Length', response.headers['content-length']);
        if (response.headers['accept-ranges']) {
            res.set('Accept-Ranges', response.headers['accept-ranges']);
        }
        response.pipe(res);
    }).on('error', (err) => {
        res.status(500).send('Error proxying audio');
    });
});

// --- NEW FEATURES API ---

// Get Graffiti for a song
app.get('/api/graffiti/:song_id', authenticateToken, async (req, res) => {
    try {
        const [stickers] = await db.query(`
            SELECT g.*, u.username 
            FROM graffiti g
            JOIN users u ON g.user_id = u.id
            WHERE g.song_id = ?
            ORDER BY g.created_at ASC
        `, [req.params.song_id]);
        res.json(stickers);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Post Graffiti sticker
app.post('/api/graffiti', authenticateToken, async (req, res) => {
    try {
        const { song_id, text_content, x_pos, y_pos } = req.body;
        if (!text_content) return res.status(400).json({ error: 'Text required' });
        
        await db.query(`
            INSERT INTO graffiti (song_id, user_id, text_content, x_pos, y_pos) 
            VALUES (?, ?, ?, ?, ?)
        `, [song_id, req.user.id, text_content.substring(0, 50), x_pos, y_pos]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Create Time Capsule
app.post('/api/capsules', authenticateToken, async (req, res) => {
    try {
        const { unlock_date, song_ids } = req.body;
        if (!song_ids || song_ids.length === 0) return res.status(400).json({ error: 'Songs required' });

        const [result] = await db.query('INSERT INTO time_capsules (user_id, unlock_date) VALUES (?, ?)', [req.user.id, unlock_date]);
        const capsuleId = result.insertId;

        for (const sid of song_ids) {
            await db.query('INSERT INTO capsule_songs (capsule_id, song_id) VALUES (?, ?)', [capsuleId, sid]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Get user's locked songs
app.get('/api/capsules/locked', authenticateToken, async (req, res) => {
    try {
        const [lockedRows] = await db.query(`
            SELECT cs.song_id, tc.unlock_date 
            FROM time_capsules tc
            JOIN capsule_songs cs ON tc.id = cs.capsule_id
            WHERE tc.user_id = ? AND tc.unlock_date > NOW()
        `, [req.user.id]);
        res.json(lockedRows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Socket.io Setup for Party Room
io.on('connection', (socket) => {
    console.log('User connected to socket:', socket.id);

    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room ${roomId}`);
        socket.to(roomId).emit('roomMessage', 'A new user joined the party!');
    });

    socket.on('syncPlay', (data) => {
        socket.to(data.roomId).emit('syncPlay', data);
    });

    socket.on('syncPause', (data) => {
        socket.to(data.roomId).emit('syncPause', data);
    });

    socket.on('syncSeek', (data) => {
        socket.to(data.roomId).emit('syncSeek', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
    // Try to create achievements tables if they don't exist
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS achievements (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT NOT NULL,
                icon_class VARCHAR(50) NOT NULL
            )
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS user_achievements (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                achievement_id INT NOT NULL,
                unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
                UNIQUE KEY unique_user_achievement (user_id, achievement_id)
            )
        `);
        await db.query(`
            INSERT IGNORE INTO achievements (id, name, description, icon_class) VALUES
            (1, 'First Spin', 'Played your first song on Melo Cloud.', 'fa-compact-disc'),
            (2, 'Night Owl', 'Listened to music between 12 AM and 4 AM.', 'fa-moon'),
            (3, 'Mood Explorer', 'Listened to songs from at least 3 different moods.', 'fa-masks-theater')
        `);

        // New Next-Level Features Tables
        await db.query(`
            CREATE TABLE IF NOT EXISTS graffiti (
                id INT AUTO_INCREMENT PRIMARY KEY,
                song_id INT NOT NULL,
                user_id INT NOT NULL,
                text_content VARCHAR(100) NOT NULL,
                x_pos FLOAT NOT NULL,
                y_pos FLOAT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS time_capsules (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                unlock_date DATETIME NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS capsule_songs (
                capsule_id INT NOT NULL,
                song_id INT NOT NULL,
                FOREIGN KEY (capsule_id) REFERENCES time_capsules(id) ON DELETE CASCADE,
                FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
                UNIQUE KEY unique_capsule_song (capsule_id, song_id)
            )
        `);

        console.log("Database tables verified.");
    } catch (err) {
        console.error("Error creating tables on startup:", err);
    }
    
    console.log(`Server running on port ${PORT}`);
});
