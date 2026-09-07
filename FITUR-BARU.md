# SESDIAN — Fitur Baru (v3)

Ringkasan implementasi 6 fitur baru beserta langkah pengaktifan.

## ⚠️ Langkah wajib setelah deploy

1. **Jalankan migrasi database** di Neon SQL Editor (atau `psql $DATABASE_URL -f migrate-v3.sql`):
   ```
   migrate-v3.sql
   ```
   Migrasi ini menambah kolom verifikasi ganda, kolom `qr_code`, membuat **10 QR sampel**
   (QR000001–QR000010 untuk 10 aset id terkecil), dan index untuk laporan. Aman dijalankan sekali.

2. **Tetapkan minimal 1 user sebagai `verifikator`** dari halaman **Kelola User** (atau SQL:
   `update users set role = 'verifikator' where nip = '...';`).
   Tanpa verifikator, pengajuan yang sudah disetujui admin tidak bisa lanjut ke tahap berikutnya
   (sesuai desain 2 verifikasi).

---

## 1. Laporan Peminjaman (harian / mingguan / bulanan)
- Halaman **`laporan.html`** (menu **Laporan**, untuk admin & verifikator).
- Pilih periode (Harian/Mingguan/Bulanan) + rentang tanggal → grafik tren, ringkasan status,
  aset paling sering dipinjam, peminjam teraktif, dan tabel detail.
- **Export CSV** (buka di Excel) dan **Cetak / PDF** (lewat dialog cetak browser).
- API: `GET /api/reports?period=daily|weekly|monthly&start=YYYY-MM-DD&end=YYYY-MM-DD`.

## 2. Import Data Aset dari Excel
- Tombol **Import Excel** di halaman **Data Aset** (admin).
- Upload `.xlsx/.xls/.csv` → pratinjau 10 baris → Import. Kode duplikat dilewati,
  kategori/ruangan baru dibuat otomatis. Tersedia tombol **Unduh template CSV**.
- Kolom: `Kode, Nama, Kategori, Brand, Ruangan, Tahun, Kondisi, Tipe (BMN/Non-BMN), Jenis Aset, Stok Total`.
- API: `POST /api/assets-import` (parsing Excel terjadi di browser memakai SheetJS via CDN).

## 3. Mode Guest (tanpa login)
- Pengunjung langsung masuk ke **katalog publik** (`katalog.html`) — tidak diminta login.
- Bisa: telusuri & cari aset, buka **detail aset** (termasuk via QR).
- Tidak bisa tanpa login: melihat stok/ketersediaan dan **mengajukan pinjam**
  (tombol Pinjam mengarahkan ke halaman login).
- API publik: `GET /api/catalog`, `GET /api/asset-detail?id=..|qr=..`.

## 4. Verifikasi Ganda (Admin + Verifikator)
- Alur status: `pending → (admin setujui) approved → (verifikator verifikasi) verified →
  (staff pinjamkan) borrowed → returned`. Bisa `rejected` di tahap mana pun.
- **Admin** = verifikasi 1 (di **Daftar Pinjam**). **Verifikator** = verifikasi 2
  (di halaman **Verifikasi** / `verifikasi.html`).
- Stok tetap "keluar" selama status pending/approved/verified/borrowed.

## 5. QR Code Detail Aset
- Setiap aset punya `qr_code` unik; aset baru otomatis dapat QR saat dibuat.
- Scan QR → `aset-detail.html?qr=QRxxxxxx` (halaman publik).
- Halaman **Cetak QR** (`qr-print.html`, tombol **Cetak QR** di Data Aset): grid QR siap cetak/stiker.
- **10 QR sampel** dibuat oleh `migrate-v3.sql`.

## 6. User hanya ditambah oleh admin (registrasi mandiri dimatikan)
- Halaman daftar (`register.html`) dialihkan ke login; `POST /api/register` menolak
  (kecuali bootstrap saat database benar-benar kosong → membuat admin pertama).
- Admin menambah/menghapus user dan mengatur role (User / Verifikator / Admin) di **Kelola User**.
- API: `POST /api/users` (tambah), `PATCH /api/users` (ubah role), `DELETE /api/users` (hapus).

---

## Berkas baru
- API: `api/catalog.js`, `api/asset-detail.js`, `api/reports.js`, `api/assets-import.js`
- Halaman: `katalog.html`, `aset-detail.html`, `verifikasi.html`, `laporan.html`, `qr-print.html`
- Skrip: `assets/guest.js`, `assets/reports.js`, `assets/import.js`, `assets/qr.js`
- Migrasi: `migrate-v3.sql`

## Catatan
- Import Excel & render QR memuat pustaka (SheetJS / qrcode-generator) dari CDN saat dibutuhkan —
  perlu koneksi internet ketika fitur itu dipakai. Fitur lain tetap berjalan offline-friendly.
