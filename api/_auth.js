// Auth + HTTP helpers for the SESDIAN API. Zero external deps (node:crypto only).
//   - passwords: scrypt with per-user salt, stored as "<saltHex>:<hashHex>"
//   - sessions:  compact HS256 JWT signed with JWT_SECRET
import crypto from 'node:crypto';

// Fail closed: never sign/verify with a predictable key. JWT_SECRET must be set
// (Vercel env var). Without it, token ops throw and endpoints return 500.
function secret() {
  var s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET belum diset (Vercel env var).');
  return s;
}

/* ---------- passwords ---------- */
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pw), salt, 64);
  return salt.toString('hex') + ':' + hash.toString('hex');
}
export function verifyPassword(pw, stored) {
  const [saltHex, hashHex] = String(stored || '').split(':');
  if (!saltHex || !hashHex) return false;
  const hash = crypto.scryptSync(String(pw), Buffer.from(saltHex, 'hex'), 64);
  const expected = Buffer.from(hashHex, 'hex');
  return expected.length === hash.length && crypto.timingSafeEqual(expected, hash);
}

/* ---------- JWT (HS256) ---------- */
const b64 = (s) => Buffer.from(s).toString('base64url');
export function signToken(payload, days = 7) {
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + days * 86400 }));
  const data = header + '.' + body;
  const sig = crypto.createHmac('sha256', secret()).update(data).digest('base64url');
  return data + '.' + sig;
}
export function verifyToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const data = parts[0] + '.' + parts[1];
  const expected = crypto.createHmac('sha256', secret()).update(data).digest('base64url');
  const a = Buffer.from(parts[2]); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString()); } catch (e) { return null; }
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null; // require valid, unexpired exp
  return payload;
}

/* ---------- request/response helpers ---------- */
export function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}
export function getAuth(req) {
  const h = req.headers['authorization'] || req.headers['Authorization'] || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? verifyToken(m[1]) : null;
}
export function requireAuth(req, res) {
  const u = getAuth(req);
  if (!u) { send(res, 401, { error: 'Unauthorized' }); return null; }
  return u;
}
export function requireAdmin(req, res) {
  const u = getAuth(req);
  if (!u) { send(res, 401, { error: 'Unauthorized' }); return null; }
  if (u.role !== 'admin') { send(res, 403, { error: 'Akses admin diperlukan' }); return null; }
  return u;
}
export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return await new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => (d += c));
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}
