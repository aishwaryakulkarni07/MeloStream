const https = require('https');
const db = require('./db');

function fetchPreview(song) {
  return new Promise((resolve) => {
    const term = encodeURIComponent(`${song.artist} ${song.title}`);
    https.get(`https://itunes.apple.com/search?term=${term}&entity=song&limit=1`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.results && json.results.length > 0 && json.results[0].previewUrl) {
            resolve(json.results[0].previewUrl);
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => {
      resolve(null);
    });
  });
}

async function run() {
  console.log("Fetching real 30-second audio previews from iTunes...");
  try {
    const [songs] = await db.query('SELECT id, title, artist FROM songs');
    
    for (const song of songs) {
      console.log(`Searching for: ${song.title} by ${song.artist}`);
      const previewUrl = await fetchPreview(song);
      
      if (previewUrl) {
        await db.query('UPDATE songs SET audio_url = ? WHERE id = ?', [previewUrl, song.id]);
        console.log(`✅ Updated ${song.title} with real audio!`);
      } else {
        console.log(`❌ Could not find real audio for ${song.title}`);
      }
    }
    console.log("Done! Exiting...");
    process.exit(0);
  } catch (err) {
    console.error("Database error", err);
    process.exit(1);
  }
}

run();
