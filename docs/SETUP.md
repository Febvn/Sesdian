# Setup SESDIAN Asset Management

## Environment Variables

Aplikasi ini memerlukan environment variables berikut:

### Required (Wajib)

1. **DATABASE_URL** - Connection string Neon Postgres
   ```
   postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/DBNAME?sslmode=require
   ```

2. **JWT_SECRET** - Secret key untuk signing JWT token
   ```
   GENERATE_A_LONG_RANDOM_STRING
   ```

### Optional (Opsional)

3. **FONNTE_TOKEN** - Token untuk auto-send WhatsApp notifications
   - Dapatkan dari: https://fonnte.com
   - Jika tidak diset, notifikasi akan menggunakan link wa.me (manual)

---

## Setup Database

### Fresh Install (Database Baru)

Jalankan script ini di Neon SQL Editor:

```bash
db/neon-schema.sql
```

Script ini akan:
- Membuat semua tabel (users, categories, rooms, assets, borrowings, settings)
- Menambahkan data seed (kategori dan ruangan default)
- Menambahkan data contoh (1 laptop, 1 borrowing)

### Existing Database (Database yang Sudah Ada)

Jika database sudah memiliki data, gunakan migration script:

```bash
db/migrate.sql
```

Script ini akan:
- Menambahkan tabel `settings` (jika belum ada)
- Update data tanpa menghapus data existing

---

## Local Development

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment Variables

File `.env.local` sudah dibuat dengan credentials Anda.

### 3. Jalankan Development Server

```bash
npm run dev
```

### 4. Akses Aplikasi

Buka browser: http://localhost:3000

---

## Deployment ke Server Produksi (Domain Resmi)

Domain resmi produksi: **https://sesdian-lpg.bppmhkp.id/**

Panduan lengkap penerapan menggunakan Node.js (`server.mjs`), Nginx reverse proxy, PM2, atau Hostinger hPanel tersedia di [HOSTINGER-DEPLOY.md](HOSTINGER-DEPLOY.md).

Ringkasan langkah produksi:
1. Clone repositori ke server dan pasang dependensi produksi (`npm install --omit=dev`).
2. Siapkan file `.env` atau environment variables panel hosting:
   - `DATABASE_URL` = [connection string Neon PostgreSQL]
   - `JWT_SECRET` = [kunci rahasia JWT produksi]
   - `FONNTE_TOKEN` = [opsional, token WhatsApp]
3. Jalankan aplikasi melalui `npm start` (PM2) atau startup file `app.js` (Passenger/hPanel).
4. Arahkan domain resmi `sesdian-lpg.bppmhkp.id` ke server dengan sertifikat SSL aktif.

---

## First Login

Setelah deployment berhasil:

1. Buka aplikasi Anda
2. Klik "Register" atau "Daftar"
3. Isi form registrasi:
   - NIP: 18 digit angka (contoh: 123456789012345678)
   - Nama: nama lengkap Anda
   - No. HP: untuk notifikasi WhatsApp (opsional)
   - Password: minimal 8 karakter

4. **User pertama yang register otomatis menjadi ADMIN**
5. User berikutnya akan menjadi user biasa
6. Admin bisa promote/demote user lain di halaman "Kelola User"

---

## Testing

### Demo Mode (Tanpa Backend)

Untuk testing UI tanpa database:

1. Edit `public/assets/config.js`:
   ```javascript
   window.SESDIAN_CONFIG = {
     BACKEND: 'demo',  // ubah dari 'api' ke 'demo'
     API_BASE: '',
   };
   ```

2. Buka `public/index.html` langsung di browser
   atau gunakan: `npx serve public`

3. Data akan tersimpan di memory (hilang saat refresh)

---

## Troubleshooting

### Error: JWT_SECRET belum diset

**Solusi**: Pastikan environment variable `JWT_SECRET` sudah diset

### Error: DATABASE_URL belum diset

**Solusi**: Pastikan environment variable `DATABASE_URL` sudah diset

### Error: 401 Unauthorized

**Solusi**: Token expired atau invalid, logout dan login kembali

### WhatsApp notification tidak terkirim otomatis

**Expected**: Jika `FONNTE_TOKEN` tidak diset, sistem akan membuka link wa.me (manual click-to-send)

**Solusi untuk auto-send**:
1. Daftar di https://fonnte.com
2. Dapatkan API token
3. Set `FONNTE_TOKEN` di environment variables
4. Redeploy aplikasi

---

## Security Notes

⚠️ **JANGAN commit credentials ke Git!**

- File `.env.local` sudah di-ignore oleh `.gitignore`
- Jangan share `JWT_SECRET` dan `DATABASE_URL` ke public
- Gunakan environment variables berbeda untuk production dan development

---

## Support

Untuk pertanyaan atau issue:
- Lihat README.md untuk dokumentasi lengkap
- Check GitHub issues: https://github.com/Protoflicker/AssetManagement
