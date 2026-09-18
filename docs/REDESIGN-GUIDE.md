# SESDIAN — Panduan Redesign UI/UX (Notion Design Language)

> Dokumen acuan tunggal untuk paket perubahan UI/UX besar ini. Tujuannya agar 11
> item pekerjaan dikerjakan rapi, konsisten, dan tidak tercampur. Setiap keputusan
> desain disertai justifikasi dari sudut pandang praktik sistem manajemen aset
> industri yang sudah matang.

Referensi rasa desain: `DESIGN-notion.md` (Notion design language) + taste-skill
(`design-taste-frontend`, varian `minimalist-ui`). Prinsip inti yang dipakai:

- **Kanvas paper-soft hangat** (`--bg: #f6f5f4`) bukan putih klinis; **surface putih**
  untuk kartu/field → figure/ground lembut.
- **Satu aksen struktural**: Notion blue `#0075de`. Warna lain (hijau/oranye/merah)
  hanya untuk status semantik, bukan dekorasi acak.
- **Tipografi Inter**, heading berat (700/800) dengan tracking negatif; body 400.
- **Elevasi tipis**: hairline `#e6e6e6` + shadow berlapis sangat transparan, bukan
  drop-shadow berat.
- **Radius**: input/kontrol 8px, kartu 12–16px, CTA/badge pill.
- Dark mode via `[data-theme="dark"]` (kanvas near-black `#191918`).

Semua aset statis di-*cache-bust* dari `?v=13` → **`?v=14`** setiap kali file
`assets/*` diubah, supaya browser pengguna mengambil versi terbaru.

---

## Arsitektur singkat (hasil analisis folder)

- Aplikasi **multi-page HTML + vanilla JS** (bukan SPA). Root yang dilayani = `public/`.
- Styling tunggal: [public/assets/app.css](../public/assets/app.css). Logika UI:
  [public/assets/app.js](../public/assets/app.js). Ikon: [public/assets/icons.js](../public/assets/icons.js).
  Header/tema: [public/assets/theme.js](../public/assets/theme.js).
- **2 jenis halaman:**
  - *Static shell* (sidebar + topbar ditulis langsung di HTML): `dashboard`,
    `dataaset`, `kategoriaset`, `ruangan`, `daftarpinjam`, `ajukanpinjam`, `users`.
  - *Dynamic shell* (sidebar/topbar dibangun `buildShell()` di app.js):
    `dipinjam`, `laporan`, `verifikasi` — memakai `<aside data-shell>` + `<div data-topbar>`.
- Karena markup sidebar/topbar terduplikasi di 7 file statis, **normalisasi chrome
  dilakukan via JS** (`normalizeChrome()` di app.js) agar satu sumber kebenaran
  memperbaiki semua halaman sekaligus (ikon, logo, judul header). Justifikasi:
  mengedit 7 blok SVG inline raksasa satu per satu rawan error dan tidak DRY.

---

## Peta 11 item → implementasi & justifikasi

### 1. Logo SESDIAN + re-skin login (Notion)
- `logosesdian.png` disalin ke `public/` agar bisa dilayani.
- Setelah login, logo tampil di **pojok kiri atas** = header sidebar (slot brand),
  via `installBrandLogo()` (berlaku di semua halaman, statis & dinamis).
- Login page di-skin ulang ke palet Notion: kanvas paper, panel kartu putih,
  aksen biru tunggal, input radius 8px, CTA pill. Logo juga tampil di panel kiri
  (tampilan utama) dengan `object-fit: contain` + frame membulat.
- **Justifikasi layout login** (split 2 kolom): kolom kiri = *brand/value
  proposition* (logo + headline + 3 trust signal), kolom kanan = *form fokus
  tunggal*. Pola ini standar pada produk B2B/enterprise (Linear, Notion, Vercel)
  karena (a) mengurangi beban kognitif — mata langsung ke satu form, (b) ruang kiri
  memperkuat kredibilitas merek tanpa mengganggu aksi utama, (c) di mobile kolom
  kiri di-collapse sehingga form tetap prioritas. Hierarki: judul → subjudul →
  field berlabel → satu CTA primer → tautan sekunder (katalog publik).

### 2. Ikon sidebar & ikon header per halaman
- Topbar sebelumnya **selalu memakai ikon rumah** (hardcoded di `buildShell` dan di
  7 HTML statis). Diganti **ikon sesuai halaman** via peta `PAGE_ICONS`.
- Ikon link sidebar dinormalisasi dari `href → nama ikon` sehingga "Ajukan Pinjam"
  = clipboard, "Daftar Pinjam" = refresh, dst. Rapi dan konsisten di semua halaman.

### 3. Header sticky saat scroll
- Semua topbar dipaksa `position: sticky; top: 0; z-index: 50` + efek shadow halus
  saat halaman ter-scroll (`.sesd-scrolled`). Header "ikut turun", tidak tertinggal.
- Berlaku global lewat CSS + listener scroll ringan.

### 4. Palette BMN/Non-BMN (dark/light) & teks Laporan
- Badge BMN/Non-BMN dibuat *theme-aware* (token, bukan warna keras) di renderer card.
- Kartu "Total Peminjaman" di Laporan: teks "Total Peminjaman", angka, dan
  "pada periode terpilih" dipaksa **putih** (`#fff`) agar terbaca di light mode di
  atas fill biru; dark mode tetap (sudah benar).

### 5. Header judul Sedang Dipinjam / Laporan / Verifikasi
- Ketiga halaman dynamic-shell memakai judul topbar yang gayanya beda. Disatukan
  lewat `normalizeChrome()` → semua topbar memakai **breadcrumb seragam**
  (`[ikon halaman] [Judul]`) dengan ukuran/berat font identik di seluruh aplikasi.

### 6. Chip kosong di card data aset
- Penyebab: `applyBinds` menulis `textContent` kosong saat field (mis. ruangan)
  kosong → muncul "kotak kosong". Card aset kini dirender penuh di JS
  (`renderAssetGrid`) yang **menyembunyikan chip** bila nilainya kosong.

### 7. Format stok `16/16`
- Sebelumnya dua angka berdempetan (`1616`). Renderer baru menampilkan
  `tersedia / total` dengan pemisah garis miring → `16/16`.

### 8. Badge centang + "strip"
- "Strip" (`-`) adalah teks template sisa yang tak pernah di-bind — tidak bermakna.
- **Keputusan UI/UX**: badge pojok kanan-atas diganti **badge status ketersediaan**
  yang bermakna: hijau `Tersedia N` saat ada stok, abu/merah `Habis` saat 0.
  Justifikasi: di sistem aset, indikator paling berguna pada kartu ringkas adalah
  *availability*, bukan tanda centang ambigu. Centang murni tanpa konteks mudah
  disalahartikan sebagai "terverifikasi".

### 9. Kotak select role di Kelola User
- `<select>` role (user/verifikator/admin) + tombol hapus punya radius berbeda.
  Disamakan: select diberi radius & tinggi konsisten dengan tombol (kontrol pill
  yang rapi), termasuk panah kustom agar seragam lintas-browser.

### 10. Stat card Dashboard → Data Aset + grid proporsional
- Gaya `.stat-card` (ikon berwarna + label + angka + subjudul) dipindah dari inline
  `dashboard.html` ke `app.css` (shared) lalu diterapkan ke Data Aset.
- Grid stat dibuat proporsional (`auto-fit, minmax`) dan rapi di semua breakpoint.

### 11. Mobile view
- Audit & perbaikan: cegah overflow horizontal (`overflow-x` terkendali), grid
  stack 1–2 kolom, tombol & card tidak meleber ke kanan, target sentuh ≥ 40px,
  tabel scroll dalam wadah. Justifikasi: petugas aset sering memakai HP saat
  inventarisasi lapangan → mobile harus rapi dan tidak menggeser layout.

---

## Catatan rilis
- Author commit: **forkaton** (tanpa atribusi Claude), push ke `origin main`
  (`github.com/Protoflicker/assetmanage`).
