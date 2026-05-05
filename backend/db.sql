CREATE DATABASE IF NOT EXISTS melo_stream;
USE melo_stream;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS songs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    artist VARCHAR(255) NOT NULL,
    cover_url VARCHAR(500) DEFAULT NULL,
    audio_url VARCHAR(500) DEFAULT NULL,
    duration INT DEFAULT 30, -- Since we play songs with 30s limit
    mood VARCHAR(50) DEFAULT 'chill',
    language VARCHAR(50) DEFAULT 'English',
    play_count INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS recently_played (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    song_id INT NOT NULL,
    played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS favorites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    song_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
    UNIQUE KEY unique_favorite (user_id, song_id)
);

-- Insert some dummy songs across different languages
INSERT INTO songs (title, artist, cover_url, audio_url, mood, language) VALUES
('Blinding Lights', 'The Weeknd', 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/a6/6e/bf/a66ebf79-5008-8948-b352-a790fc87446b/19UM1IM04638.rgb.jpg/300x300bb.jpg', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', 'party', 'English'),
('Levitating', 'Dua Lipa', 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/6c/11/d6/6c11d681-aa3a-d59e-4c2e-f77e181026ab/190295092665.jpg/300x300bb.jpg', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', 'happy', 'English'),
('Save Your Tears', 'The Weeknd', 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/83/3a/f7/833af71b-2e0c-3303-24f5-8f5c546c073b/20UMGIM21167.rgb.jpg/300x300bb.jpg', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', 'sad', 'English'),
('Watermelon Sugar', 'Harry Styles', 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/2b/c4/c9/2bc4c9d4-3bc6-ab13-3f71-df0b89b173de/886448022213.jpg/300x300bb.jpg', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3', 'happy', 'English'),
('Despacito', 'Luis Fonsi', 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/e2/ef/f0/e2eff0bc-c51d-7de5-9280-6891ddcee71b/18UMGIM85289.rgb.jpg/300x300bb.jpg', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', 'party', 'Spanish'),
('Tití Me Preguntó', 'Bad Bunny', 'https://is1-ssl.mzstatic.com/image/thumb/Music113/v4/b0/b9/7c/b0b97c63-14ff-8946-f34e-4239faecb1e0/820cc83e-1f8f-4738-8ee8-e1ebce5c123b.png/300x300bb.jpg', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', 'party', 'Spanish'),
('Dynamite', 'BTS', 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/03/8d/0e/038d0e52-e96d-f386-b8eb-9f77fa013543/195497146918_Cover.jpg/300x300bb.jpg', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', 'happy', 'Korean'),
('How You Like That', 'BLACKPINK', 'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/48/3b/39/483b3943-ffb2-3e78-0721-623dbdf737b9/20UMGIM50590.rgb.jpg/300x300bb.jpg', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3', 'workout', 'Korean'),
('Cupid', 'FIFTY FIFTY', 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/6b/2e/aa/6b2eaa77-af21-4b0d-5ae0-2062cbf44e55/196872355437.jpg/300x300bb.jpg', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3', 'chill', 'Korean'),
('Tum Hi Ho', 'Arijit Singh', 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/bb/23/ee/bb23eeed-0c35-4f1d-2b11-485622777ae4/8902894353007_cover.jpg/300x300bb.jpg', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3', 'sad', 'Hindi'),
('Chaleya', 'Arijit Singh', 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/1e/ff/32/1eff3216-190d-6fd9-8f68-acbba846e6ee/8903431956026_cover.jpg/300x300bb.jpg', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3', 'happy', 'Hindi'),
('Maan Meri Jaan', 'King', 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/a1/54/be/a154be36-2ba3-a22a-4064-c3d78f910c11/5054197602184.jpg/300x300bb.jpg', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3', 'chill', 'Hindi'),
('Idol', 'YOASOBI', 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/3a/17/eb/3a17eb30-eacb-82eb-51df-d1321dbb55bc/197188492205.jpg/300x300bb.jpg', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3', 'workout', 'Japanese'),
('Kick Back', 'Kenshi Yonezu', 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/4e/a8/75/4ea875d1-bdb6-9b83-185a-646391cbffbd/4547366589849.jpg/300x300bb.jpg', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3', 'workout', 'Japanese'),
('Suzume', 'RADWIMPS', 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/eb/0c/e3/eb0ce3d8-b9b9-ce8d-47f9-38d147128dee/0602448618207_cover.jpg/300x300bb.jpg', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3', 'sad', 'Japanese'),
('Papaoutai', 'Stromae', 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/37/9d/f3/379df395-48d6-f41a-f929-28e4050f5c7e/8721465519846.png/300x300bb.jpg', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', 'party', 'French'),
('Dernière Danse', 'Indila', 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/49/58/30/49583018-308b-431d-c691-4a28e78be8cd/14UMGIM01109.rgb.jpg/300x300bb.jpg', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', 'sad', 'French'),
('Mi Gente', 'J Balvin', 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/43/23/44/43234493-859a-53f6-e31c-805370dc33d7/18UMGIM19841.rgb.jpg/300x300bb.jpg', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', 'workout', 'Spanish'),
('Toofan', 'Ravi Basrur', 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/d8/42/85/d84285ff-adb1-9be0-3934-07c71cfda5e8/8903431872128_cover.jpg/300x300bb.jpg', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', 'workout', 'Kannada'),
('Singara Siriye', 'Vijay Prakash', 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/08/1e/a0/081ea00b-1dd6-876f-860a-a0add84d317e/8904337278427.jpg/300x300bb.jpg', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3', 'happy', 'Kannada'),
('Karma', 'B. Ajaneesh Loknath', 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/08/1e/a0/081ea00b-1dd6-876f-860a-a0add84d317e/8904337278427.jpg/300x300bb.jpg', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3', 'chill', 'Kannada');

CREATE TABLE IF NOT EXISTS achievements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    icon_class VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS user_achievements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    achievement_id INT NOT NULL,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_achievement (user_id, achievement_id)
);

INSERT IGNORE INTO achievements (id, name, description, icon_class) VALUES
(1, 'First Spin', 'Played your first song on Melo Cloud.', 'fa-compact-disc'),
(2, 'Night Owl', 'Listened to music between 12 AM and 4 AM.', 'fa-moon'),
(3, 'Mood Explorer', 'Listened to songs from at least 3 different moods.', 'fa-masks-theater');
