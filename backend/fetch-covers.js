const fs = require('fs');
const https = require('https');

const songs = [
  { title: 'Blinding Lights', artist: 'The Weeknd', mood: 'party', language: 'English', audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { title: 'Levitating', artist: 'Dua Lipa', mood: 'happy', language: 'English', audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { title: 'Save Your Tears', artist: 'The Weeknd', mood: 'sad', language: 'English', audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { title: 'Watermelon Sugar', artist: 'Harry Styles', mood: 'happy', language: 'English', audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3' },
  { title: 'Despacito', artist: 'Luis Fonsi', mood: 'party', language: 'Spanish', audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
  { title: 'Tití Me Preguntó', artist: 'Bad Bunny', mood: 'party', language: 'Spanish', audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
  { title: 'Dynamite', artist: 'BTS', mood: 'happy', language: 'Korean', audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
  { title: 'How You Like That', artist: 'BLACKPINK', mood: 'workout', language: 'Korean', audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3' },
  { title: 'Cupid', artist: 'FIFTY FIFTY', mood: 'chill', language: 'Korean', audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3' },
  { title: 'Tum Hi Ho', artist: 'Arijit Singh', mood: 'sad', language: 'Hindi', audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3' },
  { title: 'Chaleya', artist: 'Arijit Singh', mood: 'happy', language: 'Hindi', audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3' },
  { title: 'Maan Meri Jaan', artist: 'King', mood: 'chill', language: 'Hindi', audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3' },
  { title: 'Idol', artist: 'YOASOBI', mood: 'workout', language: 'Japanese', audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3' },
  { title: 'Kick Back', artist: 'Kenshi Yonezu', mood: 'workout', language: 'Japanese', audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3' },
  { title: 'Suzume', artist: 'RADWIMPS', mood: 'sad', language: 'Japanese', audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3' },
  { title: 'Papaoutai', artist: 'Stromae', mood: 'party', language: 'French', audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { title: 'Dernière Danse', artist: 'Indila', mood: 'sad', language: 'French', audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { title: 'Mi Gente', artist: 'J Balvin', mood: 'workout', language: 'Spanish', audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
  // Kannada Songs
  { title: 'Toofan', artist: 'Ravi Basrur', mood: 'workout', language: 'Kannada', audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
  { title: 'Singara Siriye', artist: 'Vijay Prakash', mood: 'happy', language: 'Kannada', audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3' },
  { title: 'Karma', artist: 'B. Ajaneesh Loknath', mood: 'chill', language: 'Kannada', audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3' }
];

function fetchCover(song) {
  return new Promise((resolve) => {
    const term = encodeURIComponent(`${song.artist} ${song.title}`);
    https.get(`https://itunes.apple.com/search?term=${term}&entity=song&limit=1`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.results && json.results.length > 0) {
            let url = json.results[0].artworkUrl100;
            url = url.replace('100x100bb', '300x300bb');
            resolve(url);
          } else {
            resolve('https://via.placeholder.com/300/1a1a2e/ffffff?text=' + encodeURIComponent(song.artist));
          }
        } catch (e) {
          resolve('https://via.placeholder.com/300/1a1a2e/ffffff?text=' + encodeURIComponent(song.artist));
        }
      });
    }).on('error', () => {
      resolve('https://via.placeholder.com/300/1a1a2e/ffffff?text=' + encodeURIComponent(song.artist));
    });
  });
}

async function run() {
  console.log("Fetching real covers from iTunes...");
  let sql = `-- Insert some dummy songs across different languages\nINSERT INTO songs (title, artist, cover_url, audio_url, mood, language) VALUES\n`;
  const values = [];
  
  for (const song of songs) {
    const coverUrl = await fetchCover(song);
    // Escape single quotes for SQL
    const title = song.title.replace(/'/g, "''");
    const artist = song.artist.replace(/'/g, "''");
    values.push(`('${title}', '${artist}', '${coverUrl}', '${song.audio}', '${song.mood}', '${song.language}')`);
  }
  
  sql += values.join(',\n') + ';\n';
  
  const dbSqlPath = 'c:/Users/HP/OneDrive/Desktop/base batch/CSS/melo-stream-app/backend/db.sql';
  let dbContent = fs.readFileSync(dbSqlPath, 'utf8');
  
  // Replace the INSERT INTO songs part
  const insertStart = dbContent.indexOf('-- Insert some dummy songs');
  if (insertStart !== -1) {
    dbContent = dbContent.substring(0, insertStart) + sql;
  } else {
    dbContent += '\n' + sql;
  }
  
  fs.writeFileSync(dbSqlPath, dbContent);
  console.log("Successfully updated db.sql with real image URLs.");
}

run();
