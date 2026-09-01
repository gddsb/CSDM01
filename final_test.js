const sharp = require('/opt/milk-can-mes/server/node_modules/sharp');
const fs = require('fs');
const http = require('http');

async function createTestImages() {
  await sharp({ create: { width: 2000, height: 1500, channels: 3, background: { r: 42, g: 99, b: 155 } } }).webp().toFile('/tmp/t2_big.webp');
  await sharp({ create: { width: 2500, height: 2000, channels: 3, background: { r: 222, g: 55, b: 111 } } }).jpeg().toFile('/tmp/t3_big.jpg');
  await sharp({ create: { width: 800, height: 600, channels: 4, background: { r: 255, g: 128, b: 0, alpha: 0.7 } } }).png().toFile('/tmp/t4.png');
  console.log('Test images created');
}

function upload(filePath, token, recordId) {
  return new Promise((resolve) => {
    const boundary = '----TestBoundary' + Date.now() + Math.random();
    const fileContent = fs.readFileSync(filePath);
    const filename = filePath.split('/').pop();
    let mime = 'image/jpeg';
    if (filename.endsWith('.webp')) mime = 'image/webp';
    else if (filename.endsWith('.png')) mime = 'image/png';
    else if (filename.endsWith('.gif')) mime = 'image/gif';
    const header = `--${boundary}\r\nContent-Disposition: form-data; name="images"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;
    const body = Buffer.concat([Buffer.from(header), fileContent, Buffer.from(footer)]);
    const options = {
      hostname: 'localhost', port: 3001,
      path: `/api/basic/device-records/${recordId}/images`,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        'Authorization': `Bearer ${token}`,
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve({raw: data}); } });
    });
    req.on('error', e => resolve({error: e.message}));
    req.write(body);
    req.end();
  });
}

function login() {
  return new Promise((resolve) => {
    const data = JSON.stringify({ username: 'admin', password: '123456' });
    const req = http.request({
      hostname: 'localhost', port: 3001, path: '/api/auth/login',
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { const json = JSON.parse(d); resolve(json.data?.token || json.token || ''); } catch (e) { resolve(''); }
      });
    });
    req.on('error', () => resolve(''));
    req.write(data);
    req.end();
  });
}

async function main() {
  await createTestImages();
  const token = await login();
  if (!token) { console.error('Login failed'); process.exit(1); }
  console.log('Token obtained OK\n');
  
  const tests = [
    { name: 'Big WebP (2000x1500)', file: '/tmp/t2_big.webp' },
    { name: 'Big JPG (2500x2000)', file: '/tmp/t3_big.jpg' },
    { name: 'PNG with alpha (800x600)', file: '/tmp/t4.png' },
  ];
  
  for (const t of tests) {
    process.stdout.write(`=== ${t.name}: `);
    const r = await upload(t.file, token, 11);
    if (r.success) console.log(`SUCCESS - ${r.message}`);
    else console.log(`FAILED - ${JSON.stringify(r).slice(0, 150)}`);
  }
}

main().catch(console.error);
