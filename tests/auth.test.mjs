// Uji unit untuk api/_auth.js: hashing password (scrypt) dan JWT (HS256).
// Jalankan: npm test  (butuh Node 18 ke atas, tanpa dependensi tambahan)
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'rahasia-untuk-pengujian-saja';
const { hashPassword, verifyPassword, signToken, verifyToken } = await import('../api/_auth.js');

test('password yang benar lolos verifikasi', () => {
  const stored = hashPassword('sandi-rahasia-123');
  assert.equal(verifyPassword('sandi-rahasia-123', stored), true);
});

test('password yang salah ditolak', () => {
  const stored = hashPassword('sandi-rahasia-123');
  assert.equal(verifyPassword('sandi-keliru', stored), false);
});

test('dua hash untuk password yang sama tidak pernah identik (salt per pengguna)', () => {
  assert.notEqual(hashPassword('sama'), hashPassword('sama'));
});

test('hash tersimpan berformat salt:hash heksadesimal', () => {
  assert.match(hashPassword('apa saja'), /^[0-9a-f]{32}:[0-9a-f]{128}$/);
});

test('verifyPassword tidak error pada hash tersimpan yang rusak', () => {
  assert.equal(verifyPassword('x', ''), false);
  assert.equal(verifyPassword('x', null), false);
  assert.equal(verifyPassword('x', 'bukan-format-yang-benar'), false);
});

test('token yang baru dibuat bisa diverifikasi dan membawa payload-nya', () => {
  const token = signToken({ sub: 7, nip: '198001012005011001', role: 'admin' });
  const payload = verifyToken(token);
  assert.equal(payload.sub, 7);
  assert.equal(payload.role, 'admin');
  assert.ok(payload.exp > Math.floor(Date.now() / 1000));
});

test('token yang diubah isinya ditolak', () => {
  const token = signToken({ sub: 1, role: 'user' });
  const [h, b, s] = token.split('.');
  const fakeBody = Buffer.from(JSON.stringify({ sub: 1, role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  assert.equal(verifyToken(h + '.' + fakeBody + '.' + s), null);
});

test('token kedaluwarsa ditolak', () => {
  const token = signToken({ sub: 1 }, -1); // kedaluwarsa sehari yang lalu
  assert.equal(verifyToken(token), null);
});

test('string yang bukan token ditolak tanpa error', () => {
  assert.equal(verifyToken('bukan.token'), null);
  assert.equal(verifyToken(''), null);
  assert.equal(verifyToken(null), null);
});
