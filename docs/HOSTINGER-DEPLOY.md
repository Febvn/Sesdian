# Deploy SESDIAN ke Hostinger

Aplikasi ini tidak terikat ke Vercel. Frontend statis (`public/`) dan endpoint
`api/*.js` dijalankan oleh satu proses Node lewat `server.mjs`, jadi aturan yang
dulu diatur `vercel.json` (cleanUrls, tanpa trailing slash, cache `/assets`
setahun, `no-store` untuk `/api`) sekarang sudah ada di dalam server itu sendiri.

Basis datanya tetap **Neon**. Yang berpindah hanya tempat aplikasi berjalan,
bukan datanya, sehingga tidak ada migrasi database saat pindah hosting.

---

## Yang perlu disiapkan

| Kebutuhan | Nilai |
|---|---|
| Node.js | versi 18 ke atas (uji terakhir: Node 24) |
| Paket Hostinger | **VPS**, atau **Web Hosting Business ke atas** yang punya menu Node.js |
| Variabel environment | `DATABASE_URL`, `JWT_SECRET`, opsional `FONNTE_TOKEN` |

> **`JWT_SECRET` wajib sama persis dengan produksi lama.** Nilai ini yang
> menandatangani token login. Bila berubah, semua sesi yang sedang berjalan
> langsung tidak berlaku dan semua pengguna dipaksa login ulang.

---

## Opsi A — Hostinger VPS (disarankan)

Paling lancar karena prosesnya berjalan terus, tidak ada cold start.

### 1. Siapkan server

```bash
ssh root@IP-SERVER
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs git nginx
npm install -g pm2
```

### 2. Ambil kode dan pasang dependensi

```bash
cd /var/www
git clone https://github.com/Protoflicker/AssetManagement.git sesdian
cd sesdian
npm install --omit=dev
```

`--omit=dev` melewatkan `puppeteer-core`, `sharp`, dan `xlsx` yang hanya dipakai
skrip generator gambar, sehingga instalasi jauh lebih ringan di server.

### 3. Isi environment

```bash
cp .env.example .env
nano .env        # isi DATABASE_URL, JWT_SECRET, FONNTE_TOKEN
chmod 600 .env
```

### 4. Jalankan dengan pm2

```bash
pm2 start npm --name sesdian -- start
pm2 save
pm2 startup      # jalankan perintah yang ditampilkan agar otomatis hidup saat reboot
```

Cek log kapan saja dengan `pm2 logs sesdian`.

### 5. Pasang nginx sebagai reverse proxy

Buat `/etc/nginx/sites-available/sesdian`:

```nginx
server {
    listen 80;
    server_name domain-anda.id www.domain-anda.id;

    # unggah foto aset dan impor Excel butuh body lebih besar dari default 1MB
    client_max_body_size 8m;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

Aktifkan lalu pasang sertifikat:

```bash
ln -s /etc/nginx/sites-available/sesdian /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
apt install -y certbot python3-certbot-nginx
certbot --nginx -d domain-anda.id -d www.domain-anda.id
```

### 6. Memperbarui aplikasi

```bash
cd /var/www/sesdian
git pull
npm install --omit=dev
pm2 restart sesdian
```

---

## Opsi B — Hostinger Web Hosting (hPanel, Business ke atas)

hPanel menjalankan aplikasi Node lewat Passenger.

1. Unggah isi repositori ke folder aplikasi (lewat Git di hPanel atau File Manager).
2. Buka **hPanel > Website > Node.js**, lalu isi:
   - **Node version**: 18 ke atas
   - **Application root**: folder tempat repositori diunggah
   - **Application startup file**: `app.js`
3. Tambahkan environment variable `DATABASE_URL`, `JWT_SECRET`, dan bila dipakai
   `FONNTE_TOKEN` di panel yang sama.
4. Klik **NPM Install**, lalu **Restart**.

Berkas [`public/.htaccess`](../public/.htaccess) sudah menyiapkan pemaksaan HTTPS,
cleanUrls, header cache, dan kompresi untuk LiteSpeed. Berkas itu sengaja tidak
pernah menyentuh `/api/` karena routing API sepenuhnya milik Node.

> Catatan: paket shared hosting membatasi jumlah proses dan RAM. Bila aplikasi
> terasa berat saat banyak pengguna bersamaan, VPS pada Opsi A jauh lebih lega.

---

## Setelah pindah: yang wajib dicek

1. **Login** dengan satu akun yang ada. Bila gagal, hampir pasti `JWT_SECRET`
   berbeda dari produksi lama.
2. **Katalog publik** di `/katalog` tampil beserta foto asetnya.
3. **Kode QR yang sudah tercetak.** Stiker yang menempel di barang dan ruangan
   masih menyimpan alamat `sesdianppmhkp.vercel.app`. Jangan hapus proyek Vercel
   lama; ubah menjadi pengalihan permanen ke domain baru, lalu cetak ulang stiker
   secara bertahap. Rincian ada di Bab X dokumen serah terima.
4. **Notifikasi WhatsApp**, bila `FONNTE_TOKEN` dipakai.
5. Perbarui alamat situs di buku manual dan template label QR setelah stabil.

---

## Menjalankan tanpa Hostinger

Server yang sama berjalan di mana pun ada Node:

```bash
npm install
npm start          # produksi, port dari env PORT (default 3000)
npm run dev        # pengembangan, aset tidak di-cache
```

`vercel.json` sengaja tetap dipertahankan di repositori supaya deployment Vercel
yang lama tidak rusak selama masa transisi.
