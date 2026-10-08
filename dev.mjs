// Server lokal: node dev.mjs  (atau npm run dev) lalu buka http://localhost:3000
// Bila DATABASE_URL ada di .env / .env.local -> pakai Neon. Bila tidak -> simpan ke file .dev-deskripsi.json
import http from 'node:http';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
for (const f of ['.env', '.env.local']) if (existsSync(f)) for (const l of readFileSync(f, 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
execSync('node build.mjs', { stdio: 'inherit' });
let handler;
if (process.env.DATABASE_URL) { handler = require('./api/descriptions.js'); console.log('Database: Neon'); }
else {
  const F = '.dev-deskripsi.json'; const load = () => existsSync(F) ? JSON.parse(readFileSync(F, 'utf8')) : {};
  const sql = async (s, ...v) => { const q = s.join('?').replace(/\s+/g, ' ').trim(); const d = load();
    if (q.startsWith('SELECT')) return Object.entries(d).map(([file, text]) => ({ file, text }));
    if (q.startsWith('DELETE')) { delete d[v[0]]; writeFileSync(F, JSON.stringify(d, null, 2)); }
    if (q.startsWith('INSERT')) { d[v[0]] = v[1]; writeFileSync(F, JSON.stringify(d, null, 2)); } return []; };
  handler = require('./api/descriptions.js').makeHandler(() => sql);
  console.log('DATABASE_URL tidak ada: deskripsi disimpan di file .dev-deskripsi.json (hanya untuk uji lokal)');
}
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/api/descriptions') {
    res.status = c => { res.statusCode = c; return res; };
    res.json = o => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
    let b = ''; req.on('data', d => b += d);
    return req.on('end', () => { try { req.body = b ? JSON.parse(b) : undefined; } catch (e) {} handler(req, res); });
  }
  let p = normalize(join('public', decodeURIComponent(url))); if (!p.startsWith('public')) { res.statusCode = 403; return res.end(); }
  if (url.endsWith('/')) p = join(p, 'index.html');
  try { res.setHeader('Content-Type', types[extname(p)] || 'application/octet-stream'); res.end(readFileSync(p)); }
  catch (e) { res.statusCode = 404; res.end('Tidak ditemukan'); }
}).listen(3000, () => console.log('Buka http://localhost:3000'));
