// ============================================================
//  SESDIAN - HTTP server for a plain Node host (Hostinger VPS,
//  Hostinger Node.js app / Passenger, or any box that runs Node).
//
//  It serves /public as a static site and runs the /api/*.js handlers
//  in-process, so the same codebase works with or without Vercel.
//  The rules vercel.json used to provide (cleanUrls, no trailing slash,
//  immutable /assets, no-store /api) are implemented here instead.
//
//  Production:  npm start            -> listens on PORT (default 3000)
//  Development: npm run dev          -> same server, no asset caching
// ============================================================
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadEnv } from './lib/load-env.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.webp': 'image/webp',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json', '.pdf': 'application/pdf',
};
// Types worth compressing; images/fonts are already compressed.
const COMPRESSIBLE = /^(?:text\/|application\/json|image\/svg)/;
const YEAR = 'public, max-age=31536000, immutable';

/* ---------- api handlers ---------- */
const handlerCache = new Map();
async function getApiHandler(name) {
  // endpoint names map 1:1 to api/<name>.js; "_" files are shared helpers
  if (!/^[a-zA-Z0-9-]+$/.test(name)) return null;
  if (handlerCache.has(name)) return handlerCache.get(name);
  const file = path.join(ROOT, 'api', name + '.js');
  if (!fs.existsSync(file)) { handlerCache.set(name, null); return null; }
  const mod = await import(pathToFileURL(file).href);
  const fn = mod.default || null;
  handlerCache.set(name, fn);
  return fn;
}

/* ---------- static files ---------- */
function cacheHeaderFor(pathname, ext, dev) {
  if (dev) return 'no-cache';
  // /assets/* is cache-busted with ?v=N, so it can be held for a year.
  if (pathname.startsWith('/assets/')) return YEAR;
  // HTML carries those ?v=N references, so it must always be revalidated.
  if (ext === '.html') return 'no-cache, must-revalidate';
  return 'public, max-age=3600';
}

async function serveStatic(req, res, pathname, dev) {
  let rel;
  try { rel = decodeURIComponent(pathname); }
  catch { return sendText(res, 400, 'Bad Request'); }
  if (rel.indexOf('\0') !== -1) return sendText(res, 400, 'Bad Request');
  if (rel === '/' || rel === '') rel = '/index.html';

  let target = path.normalize(path.join(PUBLIC, rel));
  // never let a crafted path escape public/
  if (target !== PUBLIC && !target.startsWith(PUBLIC + path.sep)) return sendText(res, 403, 'Forbidden');

  // cleanUrls: an extension-less path resolves to its .html file
  if (!path.extname(target) && !fs.existsSync(target) && fs.existsSync(target + '.html')) target += '.html';

  let stat;
  try {
    stat = await fsp.stat(target);
    if (stat.isDirectory()) {
      target = path.join(target, 'index.html');
      stat = await fsp.stat(target);
    }
  } catch {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end('<h1>404</h1><p>' + escapeHtml(rel) + ' tidak ditemukan</p>');
  }

  const ext = path.extname(target).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const etag = '"' + stat.size.toString(16) + '-' + stat.mtimeMs.toString(16) + '"';

  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', cacheHeaderFor(pathname, ext, dev));
  res.setHeader('ETag', etag);
  res.setHeader('Last-Modified', stat.mtime.toUTCString());

  if (req.headers['if-none-match'] === etag) { res.statusCode = 304; return res.end(); }
  if (req.method === 'HEAD') { res.setHeader('Content-Length', stat.size); return res.end(); }

  const data = await fsp.readFile(target);
  const accepts = String(req.headers['accept-encoding'] || '');
  if (COMPRESSIBLE.test(type) && data.length > 1024 && /\bgzip\b/.test(accepts)) {
    const gz = zlib.gzipSync(data);
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Vary', 'Accept-Encoding');
    res.setHeader('Content-Length', gz.length);
    return res.end(gz);
  }
  res.setHeader('Content-Length', data.length);
  return res.end(data);
}

function sendText(res, status, msg) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.end(msg);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ---------- request handling ---------- */
async function handleRequest(req, res, dev) {
  const u = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const pathname = u.pathname;

  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (pathname.startsWith('/api/')) {
    const name = pathname.slice(5).split('/')[0];
    // handlers read req.query the same way they do on Vercel
    req.query = Object.fromEntries(u.searchParams.entries());
    // API responses are never cached; a handler may override this (the jenis
    // image in api/public.js sets its own immutable header).
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    try {
      const handler = await getApiHandler(name);
      if (!handler) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ error: 'Endpoint /api/' + name + ' tidak ada' }));
      }
      await handler(req, res);
    } catch (e) {
      console.error('API error /api/' + name + ':', e && e.message);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: dev ? String(e && e.message) : 'Terjadi kesalahan pada server' }));
      }
    }
    return;
  }

  // trailingSlash: false — redirect /foo/ to /foo so links stay canonical
  if (pathname.length > 1 && pathname.endsWith('/')) {
    res.statusCode = 308;
    res.setHeader('Location', pathname.slice(0, -1) + (u.search || ''));
    return res.end();
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return sendText(res, 405, 'Method Not Allowed');
  return serveStatic(req, res, pathname, dev);
}

/* ---------- startup ---------- */
export function startServer(options) {
  const dev = !!(options && options.dev);
  loadEnv(ROOT);

  const port = parseInt(process.env.PORT || '3000', 10);
  const server = http.createServer((req, res) => {
    handleRequest(req, res, dev).catch((e) => {
      console.error('Unhandled request error:', e && e.message);
      if (!res.headersSent) sendText(res, 500, 'Internal Server Error');
    });
  });

  server.listen(port, () => {
    const dbOk = !!process.env.DATABASE_URL;
    const jwtOk = !!process.env.JWT_SECRET;
    if (dev) {
      console.log('\n  SESDIAN dev server  ->  http://localhost:' + port);
      console.log('  DATABASE_URL : ' + (dbOk ? 'OK (terbaca)' : 'BELUM DISET — isi .env.local'));
      console.log('  JWT_SECRET   : ' + (jwtOk ? 'OK' : 'BELUM DISET — login akan gagal') + '\n');
      if (!dbOk) console.log('  Tip: cp .env.example .env.local  lalu isi DATABASE_URL & JWT_SECRET\n');
    } else {
      console.log('SESDIAN listening on port ' + port);
      if (!dbOk) console.error('PERINGATAN: DATABASE_URL belum diset — semua endpoint data akan gagal.');
      if (!jwtOk) console.error('PERINGATAN: JWT_SECRET belum diset — login akan gagal.');
    }
  });

  // pm2 and Passenger restart by signal; finish in-flight requests first
  const shutdown = (sig) => () => {
    console.log(sig + ' diterima, menutup server...');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10000).unref();
  };
  process.on('SIGTERM', shutdown('SIGTERM'));
  process.on('SIGINT', shutdown('SIGINT'));

  return server;
}

// `node server.mjs` (or Passenger loading app.js) starts production mode.
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) startServer({ dev: false });
