# Menjalankan SESDIAN di Lokal (terhubung ke Neon)

Project ini = frontend statis (`public/`) + fungsi serverless (`api/`) yang membaca
`DATABASE_URL` dari environment. Di lokal kita pakai **dev-server.mjs** yang menjalankan
keduanya tanpa perlu Vercel CLI.

## 1. Buat file `.env.local`
Salin template lalu isi nilainya:
```
cp .env.example .env.local
```
Isi `.env.local`:
- **DATABASE_URL** — Neon dashboard → project kamu → **Connection Details** → salin
  *connection string* (yang **Pooled** juga boleh). Pastikan ada `?sslmode=require`.
- **JWT_SECRET** — string acak panjang. Untuk login yang sama dengan produksi, salin
  `JWT_SECRET` dari Environment Variables project Vercel kamu.

> `.env.local` sudah di-`.gitignore` — kredensial tidak akan ikut ter-commit.

## 2. Install dependency (sekali saja)
```
npm install
```

## 3. Cek koneksi ke Neon
```
npm run db:check
```
Kalau berhasil akan tampil jumlah baris `users`, `assets`, dll.

## 4. Migrasi + masukkan data aset (sekali saja)
```
npm run db:setup
```
Sama dengan menjalankan `db/migrate-v3.sql` lalu `db/seed-aset-2025.sql`
(697 aset BMN 2025 + 5 kategori, lalu menandai QR semua aset). Idempotent — aman diulang.

Atau terpisah:
```
npm run db:migrate      # db/migrate-v3.sql
npm run db:seed         # db/seed-aset-2025.sql
npm run db:run <file>   # menjalankan file .sql apa pun
```

## 5. Jalankan aplikasinya
```
npm run dev
```
Buka **http://localhost:3000**. Frontend memanggil `/api/*` di server lokal yang sama,
yang terhubung ke Neon. (Ganti port: `PORT=4000 npm run dev`.)

---

### Catatan
- Butuh **Node 18+** (kamu pakai Node 24 ✔). Tidak perlu Vercel CLI.
- Belum punya admin di DB? Buka `http://localhost:3000/register` sekali untuk membuat
  admin pertama (bootstrap hanya jalan saat tabel `users` masih kosong), lalu registrasi
  otomatis terkunci. User berikutnya ditambah dari menu **Kelola User**.
- WhatsApp auto-kirim opsional: isi `FONNTE_TOKEN` di `.env.local` (kosongkan untuk pakai
  tautan wa.me biasa).
