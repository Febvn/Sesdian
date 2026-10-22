# Dokumentasi Sprint & Rencana Kerja (WBS) SESDIAN

Dokumen ini merangkum pembagian kerja, tahapan Sprint, dan pemetaan nomor tiket (Issue/Task ID) berdasarkan Work Breakdown Structure (WBS) proyek SESDIAN (Sistem Digital Inventarisasi Aset Negara).

---

## Tim & Peran Pengembang

| Nama Anggota | Peran Proyek | Fokus Tanggung Jawab |
| :--- | :--- | :--- |
| **Febrian Valentino Nugroho** | Project Manager & Front-End Developer | Perencanaan proyek, antarmuka utama, integrasi alur, dokumentasi akhir, dan serah terima |
| **Adi Septriansyah** | Back-End Developer | Basis data, API serverless, autentikasi JWT, aturan bisnis peminjaman, dan penerapan server |
| **Anselmus Herpin Hasugian** | Quality Assurance & Front-End Developer | Elisitasi kebutuhan, perancangan katalog/QR, pengujian sistem, dan UAT instansi |

---

## Pembagian Siklus Sprint Proyek

Proyek ini dibagi ke dalam siklus kerja berurutan (M1 s/d M6) dengan rincian Sprint sebagai berikut:

### M1: Sprint Inisiasi & Perencanaan (31/08/2026 – 18/09/2026)
Fokus: Pembagian peran, penetapan ruang lingkup, jadwal, anggaran, dan daftar risiko.

| WBS | ID Tiket | Aktivitas Pekerjaan | Penanggung Jawab | Peran | Status |
| :--- | :---: | :--- | :--- | :--- | :---: |
| **SES-1.1** | - | **Inisiasi Proyek** | Febrian Valentino Nugroho | Project Manager | Selesai |
| SES-1.1.1 | `P-01` | Rapat pembuka, pembagian peran, dan identifikasi pemangku kepentingan | Febrian Valentino Nugroho | Project Manager | Selesai |
| SES-1.1.2 | `P-02` | Penetapan ruang lingkup | Febrian Valentino Nugroho | Project Manager | Selesai |
| **SES-1.2** | - | **Perencanaan Proyek** | Febrian Valentino Nugroho | Project Manager | Selesai |
| SES-1.2.1 | `P-03` | Penyusunan Project Charter | Febrian Valentino Nugroho | Project Manager | Selesai |
| SES-1.2.2 | `P-04` | Penyusunan jadwal | Febrian Valentino Nugroho | Project Manager | Selesai |
| SES-1.2.3 | `P-05` | Rencana anggaran dan daftar risiko | Febrian Valentino Nugroho | Project Manager | Selesai |

---

### M2: Sprint Analisis Kebutuhan (07/09/2026 – 02/10/2026)
Fokus: Wawancara stakeholder BMN, audit kelemahan sistem v1, analisis QR code, dan penyusunan dokumen SKPL.

| WBS | ID Tiket | Aktivitas Pekerjaan | Penanggung Jawab | Peran | Status |
| :--- | :---: | :--- | :--- | :--- | :---: |
| **SES-2.1** | - | **Elisitasi Kebutuhan** | Adi Septriansyah | Back-End Developer | Selesai |
| SES-2.1.1 | `P-06` | Wawancara pengelola BMN dan verifikator | Adi Septriansyah | Back-End Developer | Selesai |
| SES-2.1.2 | `P-07` | Kajian pemakaian SESDIAN v1 | Anselmus Herpin Hasugian | Quality Assurance | Selesai |
| SES-2.1.3 | `P-08` | Analisis kebutuhan kode QR dan pemindaian | Anselmus Herpin Hasugian | Quality Assurance | Selesai |
| **SES-2.2** | - | **Spesifikasi Kebutuhan** | Adi Septriansyah | Back-End Developer | Selesai |
| SES-2.2.1 | `P-09` | Penyusunan SKPL Revisi A | Adi Septriansyah | Back-End Developer | Selesai |
| SES-2.2.2 | `P-10` | Penelaahan dan SKPL Revisi B | Adi Septriansyah | Back-End Developer | Selesai |

---

### M3: Sprint Perancangan Sistem (28/09/2026 – 23/10/2026)
Fokus: Diagram E-R, skema basis data PostgreSQL, wireframe antarmuka, dan standarisasi tata letak label QR.

| WBS | ID Tiket | Aktivitas Pekerjaan | Penanggung Jawab | Peran | Status |
| :--- | :---: | :--- | :--- | :--- | :---: |
| **SES-3.1** | - | **Perancangan Basis Data** | Adi Septriansyah | Back-End Developer | Selesai |
| SES-3.1.1 | `P-11` | Diagram E-R dan kamus data | Adi Septriansyah | Back-End Developer | Selesai |
| SES-3.1.2 | `P-12` | Skema basis data dan rencana pemindahan data | Adi Septriansyah | Back-End Developer | Selesai |
| **SES-3.2** | - | **Perancangan Antarmuka** | Febrian Valentino Nugroho | Project Manager | Selesai |
| SES-3.2.1 | `P-13` | Wireframe halaman utama dan halaman pemindaian | Febrian Valentino Nugroho | Front-End Developer | Selesai |
| SES-3.2.2 | `P-14` | Prototipe antarmuka dan telaah bersama pengguna | Febrian Valentino Nugroho | Front-End Developer | Selesai |
| **SES-3.3** | - | **Perancangan Label QR** | Febrian Valentino Nugroho | Project Manager | Selesai |
| SES-3.3.1 | `P-15` | Tata letak label barang dan label ruangan | Febrian Valentino Nugroho | Front-End Developer | Selesai |
| SES-3.3.2 | `P-16` | Uji cetak dan uji baca label | Anselmus Herpin Hasugian | Quality Assurance | Selesai |

---

### M4: Sprint Pembangunan Sistem (12/10/2026 – 20/11/2026)
Fokus: Implementasi kode program aplikasi (Frontend, Backend Serverless, dan Database).

#### Sub-Sprint 4.1: Akun, Data Aset, Katalog, dan Label QR
| WBS | ID Tiket | Aktivitas Pekerjaan | Tipe | Penanggung Jawab | Peran | Status |
| :--- | :---: | :--- | :---: | :--- | :--- | :---: |
| SES-4.1.1 | `F-01` | Akun, hak akses, dan aktivasi mandiri berbasis NIP | Live | Adi Septriansyah | Back-End Developer | Selesai |
| SES-4.1.2 | `F-02` | Data aset, katalog publik, dan pembuatan kode QR | Live | Anselmus Herpin Hasugian | Front-End Developer | Selesai |

#### Sub-Sprint 4.2: Peminjaman Dua Lapis dan Pemindaian
| WBS | ID Tiket | Aktivitas Pekerjaan | Tipe | Penanggung Jawab | Peran | Status |
| :--- | :---: | :--- | :---: | :--- | :--- | :---: |
| SES-4.2.1 | F-03 | Siklus peminjaman dan aturan transisi status | Live | Adi Septriansyah | Back-End Developer | Direncanakan (02/11/2026) |
| SES-4.2.2 | F-04 | Pemindaian serah terima dan pengembalian | Live | Anselmus Herpin Hasugian | Front-End Developer | Direncanakan (06/11/2026) |

#### Sub-Sprint 4.3: Inventarisasi, Notifikasi, dan Laporan
| WBS | ID Tiket | Aktivitas Pekerjaan | Tipe | Penanggung Jawab | Peran | Status |
| :--- | :---: | :--- | :---: | :--- | :--- | :---: |
| SES-4.3.1 | F-05 | Inventarisasi ruangan berbasis pemindaian | Live | Anselmus Herpin Hasugian | Front-End Developer | Direncanakan (09/11/2026) |
| SES-4.3.2 | F-06 | Notifikasi dan tugas terjadwal | Live | Adi Septriansyah | Back-End Developer | Direncanakan (13/11/2026) |
| SES-4.3.3 | F-07 | Dashboard, laporan, dan jejak audit | Live | Febrian Valentino Nugroho | Front-End Developer | Direncanakan (16/11/2026) |

| SES-6.3 | D-05 | Serah Terima (BAST) dan Pemaparan Hasil Akhir | Febrian Valentino Nugroho | Project Manager | Direncanakan (10/12/2026) |

---

### M5: Sprint Pengujian & Penerapan (16/11/2026 – 04/12/2026)
Fokus: Uji integrasi, pengujian keamanan, migrasi data ril aset, penerapan ke hosting/Vercel, dan penempelan label QR.

| WBS | ID Tiket | Aktivitas Pekerjaan | Penanggung Jawab | Peran | Status |
| :--- | :---: | :--- | :--- | :--- | :---: |
| **SES-5.1** | - | **Pengujian Sistem** | Anselmus Herpin Hasugian | Quality Assurance | Selesai |
| SES-5.1.1 | T-01 | Pengujian modul dan integrasi | Anselmus Herpin Hasugian | Quality Assurance | Direncanakan (16/11/2026) |
| SES-5.1.2 | T-02 | Pengujian keamanan dan perbaikan cacat | Adi Septriansyah | Back-End Developer | Direncanakan (23/11/2026) |
| **SES-5.2** | - | **Penerapan Sistem** | Adi Septriansyah | Back-End Developer | Selesai |
| SES-5.2.1 | D-01 | Pemindahan data dari SESDIAN v1 | Adi Septriansyah | Back-End Developer | Direncanakan (23/11/2026) |
| SES-5.2.2 | D-02 | Penerapan ke server dan domain resmi | Adi Septriansyah | Back-End Developer | Direncanakan (27/11/2026) |
| **SES-5.3** | - | **UAT dan Pemasangan Label** | Anselmus Herpin Hasugian | Quality Assurance | Selesai |
| SES-5.3.1 | U-01 | UAT bersama instansi dan perbaikan | Anselmus Herpin Hasugian | Quality Assurance | Direncanakan (30/11/2026) |
| SES-5.3.2 | U-02 | Pencetakan dan penempelan label QR | Febrian Valentino Nugroho | Project Manager | Direncanakan (01/12/2026) |

---

### M6: Sprint Penutupan Proyek (01/12/2026 – 11/12/2026)
Fokus: Sosialisasi penggunaan aplikasi kepada staf/pegawai, finalisasi buku petunjuk teknis, dan serah terima hasil pekerjaan.

| WBS | ID Tiket | Aktivitas Pekerjaan | Penanggung Jawab | Peran | Status |
| :--- | :---: | :--- | :--- | :--- | :---: |
| SES-6.1 | D-03 | Sosialisasi dan Pelatihan Pengguna | Febrian Valentino Nugroho | Project Manager | Direncanakan (01/12/2026) |
| SES-6.2 | D-04 | Dokumentasi Akhir | Febrian Valentino Nugroho | Project Manager | Direncanakan (04/12/2026) |
| SES-6.3 | D-05 | Serah Terima (BAST) dan Pemaparan Hasil Akhir | Febrian Valentino Nugroho | Project Manager | Direncanakan (10/12/2026) |
