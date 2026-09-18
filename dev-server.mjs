// ============================================================
//  SESDIAN - local dev server (no Vercel CLI required).
//  Serves /public as a static site and runs the /api/*.js serverless
//  handlers in-process, connected to your Neon database via DATABASE_URL.
//
//  Usage:  cp .env.example .env.local  (fill DATABASE_URL + JWT_SECRET)
//          npm install
//          npm run dev      ->  http://localhost:3000
// ============================================================
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const PORT = parseInt(process.env.PORT || '3000', 10);

/* ---------- load .env.local then .env into process.env ---------- */
function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!(m[1] in process.env)) process.env[m[1]] = v;
    }
  }
}
loadEnv();

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.webp': 'image/webp',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
};

const handlerCache = new Map();
async function getApiHandler(name) {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) return null;
  if (handlerCache.has(name)) return handlerCache.get(name);
  const file = path.join(ROOT, 'api', name + '.js');
  if (!fs.existsSync(file)) { handlerCache.set(name, null); return null; }
  const mod = await import(pathToFileURL(file).href);
  const fn = mod.default || null;
  handlerCache.set(name, fn);
  return fn;
}

async function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  let target = path.normalize(path.join(PUBLIC, rel));
  if (!target.startsWith(PUBLIC)) { res.statusCode = 403; return res.end('Forbidden'); }

  // cleanUrls: extension-less path -> try .html
  if (!path.extname(target) && !fs.existsSync(target) && fs.existsSync(target + '.html')) target += '.html';

  try {
    const stat = await fsp.stat(target);
    if (stat.isDirectory()) target = path.join(target, 'index.html');
    const data = await fsp.readFile(target);
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME[path.extname(target).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    return res.end(data);
  } catch {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end('<h1>404</h1><p>' + rel + ' tidak ditemukan</p>');
  }
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const pathname = u.pathname;

  if (pathname.startsWith('/api/')) {
    const name = pathname.slice(5).split('/')[0];
    req.query = Object.fromEntries(u.searchParams.entries());
    try {
      const handler = await getApiHandler(name);
      if (!handler) { res.statusCode = 404; res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ error: 'Endpoint /api/' + name + ' tidak ada' })); }
      await handler(req, res);
    } catch (e) {
      console.error('API error /api/' + name + ':', e.message);
      if (!res.headersSent) { res.statusCode = 500; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: e.message })); }
    }
    return;
  }
  return serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  const ok = !!process.env.DATABASE_URL;
  console.log('\n  SESDIAN dev server  ->  http://localhost:' + PORT);
  console.log('  DATABASE_URL : ' + (ok ? 'OK (terbaca)' : 'BELUM DISET — isi .env.local'));
  console.log('  JWT_SECRET   : ' + (process.env.JWT_SECRET ? 'OK' : 'BELUM DISET — login akan gagal') + '\n');
  if (!ok) console.log('  Tip: cp .env.example .env.local  lalu isi DATABASE_URL & JWT_SECRET\n');
});
