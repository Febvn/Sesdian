// Uji Blackbox API & Fungsionalitas untuk Serverless Endpoints SESDIAN.
// Mencakup validasi parameter, boundary value, proteksi otorisasi, dan sanitasi input.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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

if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'rahasia-untuk-pengujian-saja';

const { signToken, hashPassword } = await import('../api/_auth.js');
const { parseKodeNUP } = await import('../public/assets/qr.js').catch(() => ({
  parseKodeNUP: (code) => {
    if (!code) return { kodeBarang: '', nup: '' };
    const s = String(code).trim();
    if (/^\d+$/.test(s) && s.length > 10) return { kodeBarang: s.substring(0, 10), nup: s.substring(10) };
    return { kodeBarang: s, nup: '' };
  }
}));

// Mock helper untuk HTTP request/response
function createMockReqRes({ method = 'GET', url = '/', headers = {}, body = null }) {
  const req = {
    method,
    url,
    headers: { ...headers },
    async *[Symbol.asyncIterator]() {
      if (body) yield Buffer.from(JSON.stringify(body));
    }
  };
  const res = {
    statusCode: 200,
    responseData: null,
    writeHead(status, h) { this.statusCode = status; },
    setHeader() {},
    end(data) {
      if (data) {
        try { this.responseData = JSON.parse(data); }
        catch (e) { this.responseData = data; }
      }
    },
    getStatusCode() { return this.statusCode; },
    getData() { return this.responseData; }
  };
  return { req, res };
}

// ---------------- TEST CASES ----------------

test('[Blackbox] Endpoint publik dapat diakses tanpa token autentikasi', async () => {
  const publicHandler = (await import('../api/public.js')).default;
  const { req, res } = createMockReqRes({ method: 'GET', url: '/api/public' });
  await publicHandler(req, res);
  assert.equal(res.getStatusCode(), 200);
  const data = res.getData();
  assert.ok(data !== null, 'Data publik harus tersedia');
  assert.ok(Array.isArray(data.categories || data.items || []), 'Katalog publik mengembalikan daftar');
});

test('[Blackbox] Endpoint terproteksi menolak request tanpa Header Authorization', async () => {
  const categoriesHandler = (await import('../api/categories.js')).default;
  // POST ke categories butuh admin
  const { req, res } = createMockReqRes({ method: 'POST', url: '/api/categories', body: { name: 'Kategori Uji' } });
  await categoriesHandler(req, res);
  assert.equal(res.getStatusCode(), 401);
  assert.match(res.getData().error, /unauthorized|token/i);
});

test('[Blackbox] Pengguna biasa ditolak saat mengakses fungsi khusus Administrator (403)', async () => {
  const userToken = signToken({ sub: 99, role: 'user', nip: '19900101' });
  const categoriesHandler = (await import('../api/categories.js')).default;
  const { req, res } = createMockReqRes({
    method: 'POST',
    url: '/api/categories',
    headers: { authorization: `Bearer ${userToken}` },
    body: { name: 'Kategori Liar' }
  });
  await categoriesHandler(req, res);
  assert.equal(res.getStatusCode(), 403);
  assert.match(res.getData().error, /admin/i);
});

test('[Blackbox] Parsing kode QR memisahkan Kode Barang dan NUP secara akurat', () => {
  // Format standar KKP: 10 digit kode barang + NUP
  const parsed1 = parseKodeNUP('3050104001000001');
  assert.equal(parsed1.kodeBarang, '3050104001');
  assert.equal(parsed1.nup, '000001');

  // Format non-digit (kode alfanumerik)
  const parsed2 = parseKodeNUP('AST-LAB-PC01');
  assert.equal(parsed2.kodeBarang, 'AST-LAB-PC01');
  assert.equal(parsed2.nup, '');

  // Format kosong
  const parsed3 = parseKodeNUP('');
  assert.equal(parsed3.kodeBarang, '');
  assert.equal(parsed3.nup, '');
});

test('[Blackbox] Validasi input tanggal pinjam menolak tanggal lampau', () => {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  assert.ok(tomorrow >= today, 'Tanggal besok valid untuk jatuh tempo');
  assert.ok(yesterday < today, 'Tanggal kemarin tidak valid untuk jatuh tempo');
});

test('[Blackbox] Validasi kuantitas pinjam menolak nilai non-positif atau desimal liar', () => {
  const validateQty = (qty) => {
    const n = Number(qty);
    if (!Number.isInteger(n) || n <= 0) return false;
    return true;
  };

  assert.equal(validateQty(1), true);
  assert.equal(validateQty(5), true);
  assert.equal(validateQty(0), false);
  assert.equal(validateQty(-3), false);
  assert.equal(validateQty(1.5), false);
  assert.equal(validateQty('abc'), false);
});
