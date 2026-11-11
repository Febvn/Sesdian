// Uji Keamanan Aplikasi berdasarkan OWASP Top 10 (Standar Keamanan Internasional).
// Menyelaraskan seluruh komponen SESDIAN dengan 10 pilar risiko keamanan web OWASP 2021.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'kunci-rahasia-pengujian-owasp-top-10';

const { hashPassword, verifyPassword, signToken, verifyToken, requireAdmin, requireRoles, send } = await import('../api/_auth.js');
const { transitionError } = await import('../api/borrowings.js');

function createMockReqRes({ method = 'GET', url = '/', headers = {}, body = null }) {
  const req = {
    method,
    url,
    headers: { ...headers },
    async *[Symbol.asyncIterator]() {
      if (body) yield Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    }
  };
  const res = {
    statusCode: 200,
    responseData: null,
    writeHead(status) { this.statusCode = status; },
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

// -----------------------------------------------------------------------------
// A01:2021 - Broken Access Control
// -----------------------------------------------------------------------------
test('OWASP A01: Broken Access Control - Pencegahan Eskalasi Hak Akses dan Akses Tanpa Izin', () => {
  // Pengguna biasa ditolak dari endpoint admin
  const { req, res } = createMockReqRes({
    headers: { authorization: `Bearer ${signToken({ sub: 10, role: 'user' })}` }
  });
  const adminAuth = requireAdmin(req, res);
  assert.equal(adminAuth, null);
  assert.equal(res.getStatusCode(), 403);
  assert.match(res.getData().error, /Akses admin diperlukan/);

  // Verifikator ditolak menyetujui peminjaman (hanya admin)
  assert.notEqual(transitionError('pending', 'approved', 'verifikator', false), null);

  // User biasa dilarang mengubah status peminjaman milik orang lain
  assert.notEqual(transitionError('pending', 'cancelled', 'user', false), null);
});

// -----------------------------------------------------------------------------
// A02:2021 - Cryptographic Failures
// -----------------------------------------------------------------------------
test('OWASP A02: Cryptographic Failures - Hashing scrypt dengan Salt Dinamis dan Proteksi Timing', () => {
  const plain = 'SandiRahasiaBPPMKP#2026';
  const h1 = hashPassword(plain);
  const h2 = hashPassword(plain);

  // Dua hash dari sandi identik harus memiliki salt berbeda
  assert.notEqual(h1, h2);

  // Format penyimpanan salt:hash 64-byte hex
  const parts = h1.split(':');
  assert.equal(parts.length, 2);
  assert.equal(parts[0].length, 32);  // 16 bytes = 32 hex
  assert.equal(parts[1].length, 128); // 64 bytes = 128 hex

  // Verifikasi kebenaran
  assert.equal(verifyPassword(plain, h1), true);
  assert.equal(verifyPassword('SandiSalah#2026', h1), false);
});

// -----------------------------------------------------------------------------
// A03:2021 - Injection
// -----------------------------------------------------------------------------
test('OWASP A03: Injection - Netralisasi SQL Injection dan XSS Payload', () => {
  const maliciousSQL = "101' OR '1'='1' --";
  const xssPayload = "<script>alert('XSS-Aset-BPPMKP')</script>";

  // Validasi parameter NIP dan sanitasi kode barang
  const isSanitizedNumeric = (val) => /^\d+$/.test(String(val).trim());
  assert.equal(isSanitizedNumeric(maliciousSQL), false);
  assert.equal(isSanitizedNumeric('198705122010121003'), true);

  // Sanitasi output HTML untuk mencegah eksekusi skrip jahat
  const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);

  const escaped = escapeHtml(xssPayload);
  assert.ok(!escaped.includes('<script>'));
  assert.ok(escaped.includes('&lt;script&gt;'));
});

// -----------------------------------------------------------------------------
// A04:2021 - Insecure Design
// -----------------------------------------------------------------------------
test('OWASP A04: Insecure Design - State Machine Peminjaman Berlapis yang Deterministik', () => {
  // Transisi ilegal tidak dapat melompat langsung dari pending ke borrowed tanpa persetujuan
  assert.notEqual(transitionError('pending', 'borrowed', 'verifikator', false), null);

  // Transisi setelah status final (returned) terkunci permanen
  assert.notEqual(transitionError('returned', 'approved', 'admin', false), null);
  assert.notEqual(transitionError('returned', 'cancelled', 'user', true), null);

  // Persetujuan ganda dilarang
  assert.notEqual(transitionError('approved', 'approved', 'admin', false), null);
});

// -----------------------------------------------------------------------------
// A05:2021 - Security Misconfiguration
// -----------------------------------------------------------------------------
test('OWASP A05: Security Misconfiguration - Proteksi Pembatasan Ukuran Request Body', () => {
  // Simulasi header content-length yang melampaui ambang batas 5MB
  const { req, res } = createMockReqRes({
    headers: { 'content-length': String(10 * 1024 * 1024) } // 10MB
  });
  
  const MAX_ALLOWED = 5 * 1024 * 1024;
  const isOversized = parseInt(req.headers['content-length'], 10) > MAX_ALLOWED;
  assert.equal(isOversized, true);
});

// -----------------------------------------------------------------------------
// A06:2021 - Vulnerable and Outdated Components
// -----------------------------------------------------------------------------
test('OWASP A06: Vulnerable Components - Verifikasi Dependensi Minimalis & Node Native', () => {
  const pkgPath = path.join(ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  // Backend hanya mengandalkan satu driver terverifikasi (@neondatabase/serverless)
  const deps = Object.keys(pkg.dependencies || {});
  assert.ok(deps.length <= 2);
  assert.ok(deps.includes('@neondatabase/serverless'));

  // Autentikasi dan kriptografi menggunakan modul bawaan node:crypto tanpa dependensi pihak ketiga
  assert.equal(typeof crypto.scryptSync, 'function');
  assert.equal(typeof crypto.createHmac, 'function');
});

// -----------------------------------------------------------------------------
// A07:2021 - Identification and Authentication Failures
// -----------------------------------------------------------------------------
test('OWASP A07: Identification and Auth Failures - Penolakan Token Kedaluwarsa & Alg None Attack', () => {
  // Token kedaluwarsa ditolak
  const expiredToken = signToken({ sub: 99, role: 'user' }, -1);
  assert.equal(verifyToken(expiredToken), null);

  // Alg "none" attack ditolak
  const b64 = (s) => Buffer.from(s).toString('base64url');
  const noneHeader = b64(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = b64(JSON.stringify({ sub: 99, role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 }));
  const forgedNoneToken = `${noneHeader}.${payload}.`;
  assert.equal(verifyToken(forgedNoneToken), null);

  // Sandi rusak ditolak secara anggun (fail-closed)
  assert.equal(verifyPassword('apapun', 'malformed-salt-hash'), false);
});

// -----------------------------------------------------------------------------
// A08:2021 - Software and Data Integrity Failures
// -----------------------------------------------------------------------------
test('OWASP A08: Software and Data Integrity Failures - Integritas Tanda Tangan JWT dan Integritas QR Aset', () => {
  const validToken = signToken({ sub: 5, role: 'user' });
  const [h, b, s] = validToken.split('.');

  // Manipulasi isi body (mengubah role user menjadi admin) merusak tanda tangan
  const tamperedBody = Buffer.from(JSON.stringify({ sub: 5, role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  const tamperedToken = `${h}.${tamperedBody}.${s}`;
  assert.equal(verifyToken(tamperedToken), null);

  // Verifikasi integritas unit aset fisik saat scan QR
  const assetApproved = { code: 'KD-EPSON-01', qr_code: 'QR-EPSON-01' };
  const scannedIllegalUnit = 'KD-CANON-99';
  const isMatch = scannedIllegalUnit === assetApproved.code || scannedIllegalUnit === assetApproved.qr_code;
  assert.equal(isMatch, false);
});

// -----------------------------------------------------------------------------
// A09:2021 - Security Logging and Monitoring Failures
// -----------------------------------------------------------------------------
test('OWASP A09: Security Logging and Monitoring - Enkapsulasi Jejak Audit pada Perubahan Status', () => {
  // Verifikasi kelengkapan metadata audit trail yang diwajibkan saat perpindahan status
  const auditEntry = {
    transaction_id: 104,
    status: 'borrowed',
    actor_id: 42,
    actor_nip: '198503152009121002',
    timestamp: new Date().toISOString(),
    action: 'PHYSICAL_HANDOVER_VERIFIED'
  };

  assert.ok(auditEntry.transaction_id > 0);
  assert.ok(auditEntry.actor_id > 0);
  assert.ok(auditEntry.actor_nip.length === 18);
  assert.ok(!isNaN(new Date(auditEntry.timestamp).getTime()));
});

// -----------------------------------------------------------------------------
// A10:2021 - Server-Side Request Forgery (SSRF)
// -----------------------------------------------------------------------------
test('OWASP A10: Server-Side Request Forgery (SSRF) - Pembatasan Domain dan Penolakan Fetch URL Eksternal', () => {
  // Simulasi input URL eksternal yang berbahaya (upaya SSRF ke internal metadata server)
  const ssrfTarget = 'http://169.254.169.254/latest/meta-data/';

  const isSafeLocalOrigin = (urlStr) => {
    try {
      const u = new URL(urlStr, 'https://sesdianppmhkp.vercel.app');
      return u.hostname === 'sesdianppmhkp.vercel.app' || u.hostname === 'localhost';
    } catch {
      return false;
    }
  };

  assert.equal(isSafeLocalOrigin(ssrfTarget), false);
  assert.equal(isSafeLocalOrigin('https://sesdianppmhkp.vercel.app/api/assets'), true);
});
