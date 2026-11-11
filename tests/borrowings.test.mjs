// Uji aturan perpindahan status peminjaman (transitionError di api/borrowings.js).
// null artinya perpindahan diizinkan; string artinya pesan penolakan.
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'rahasia-untuk-pengujian-saja';
const { transitionError } = await import('../api/borrowings.js');

const boleh = (prev, target, role, isOwner) => assert.equal(transitionError(prev, target, role, isOwner === true), null);
const tolak = (prev, target, role, isOwner) => assert.equal(typeof transitionError(prev, target, role, isOwner === true), 'string');

test('persetujuan awal: hanya admin, hanya dari pending', () => {
  boleh('pending', 'approved', 'admin');
  tolak('pending', 'approved', 'verifikator');
  tolak('pending', 'approved', 'user');
  tolak('approved', 'approved', 'admin');   // sudah disetujui, tidak bisa diulang
});

test('verifikasi kedua (serah terima): hanya verifikator, dari approved', () => {
  boleh('approved', 'borrowed', 'verifikator');
  tolak('approved', 'borrowed', 'admin');   // admin tidak boleh melewati lapis kedua
  tolak('pending', 'borrowed', 'verifikator');
});

test('konfirmasi pengembalian: peminjamnya sendiri atau petugas', () => {
  boleh('borrowed', 'return_pending', 'user', true);      // pemilik
  boleh('borrowed', 'return_pending', 'admin');
  tolak('borrowed', 'return_pending', 'user', false);     // bukan pemilik
  tolak('pending', 'return_pending', 'user', true);       // belum dipinjam
});

test('verifikasi pengembalian: hanya petugas', () => {
  boleh('return_pending', 'returned', 'admin');
  boleh('return_pending', 'returned', 'verifikator');
  tolak('return_pending', 'returned', 'user', true);
});

test('penolakan: petugas, selama transaksi belum selesai', () => {
  boleh('pending', 'rejected', 'admin');
  boleh('approved', 'rejected', 'verifikator');
  tolak('returned', 'rejected', 'admin');   // sudah final
  tolak('pending', 'rejected', 'user', true);
});

test('pembatalan: pemilik atau petugas sebelum barang diserahterimakan', () => {
  boleh('pending', 'cancelled', 'user', true);
  boleh('approved', 'cancelled', 'user', true);    // peminjam membatalkan sebelum serah terima
  boleh('pending', 'cancelled', 'admin', false);   // admin membatalkan sebelum serah terima
  tolak('pending', 'cancelled', 'user', false);    // bukan pemilik dan bukan petugas
  tolak('borrowed', 'cancelled', 'user', true);    // sudah serah terima fisik, harus alur pengembalian
  tolak('returned', 'cancelled', 'admin', false);  // sudah selesai
});

test('status verified warisan diperlakukan seperti sedang dipinjam', () => {
  boleh('verified', 'return_pending', 'user', true);
  boleh('verified', 'returned', 'admin');
});

test('status tidak dikenal ditolak', () => {
  tolak('pending', 'status-ngawur', 'admin');
});
