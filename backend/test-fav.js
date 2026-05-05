const http = require('http');

const data = JSON.stringify({ username: 'testuser', password: 'password123' });

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    const json = JSON.parse(body);
    const token = json.token;
    
    if (!token) {
        console.log("Failed to register/login:", json);
        return;
    }

    const favData = JSON.stringify({ song_id: 1 });
    const favOptions = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/favorites',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
          'Content-Length': favData.length
        }
    };
    const req2 = http.request(favOptions, res2 => {
        let body2 = '';
        res2.on('data', d => body2 += d);
        res2.on('end', () => console.log("Fav response:", body2));
    });
    req2.write(favData);
    req2.end();
  });
});

req.write(data);
req.end();
