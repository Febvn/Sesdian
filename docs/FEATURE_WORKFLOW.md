# SESDIAN Asset Management - Feature Enhancement Workflow

## 📋 Daftar Fitur Baru

1. **Laporan Peminjaman** (Harian, Mingguan, Bulanan)
2. **Import Data Aset dari Excel**
3. **Guest Mode** (Akses tanpa login, tapi pinjam harus login)
4. **Dual Verification** (Admin + Verifikator)
5. **QR Code untuk Detail Aset** (dengan 10 sampel awal)
6. **Verifikasi Registrasi Karyawan** (Admin approval untuk registrasi)

---

## 1️⃣ Laporan Peminjaman (Reports)

### 📊 Fitur
- Laporan harian: Peminjaman per hari
- Laporan mingguan: Peminjaman per minggu (7 hari)
- Laporan bulanan: Peminjaman per bulan
- Export ke PDF dan Excel
- Filter by: status, aset, peminjam, tanggal range

### 🗄️ Database Changes

**Tabel baru: `borrowing_logs`** (optional - untuk tracking history)
```sql
create table borrowing_logs (
  id bigserial primary key,
  borrowing_id bigint references borrowings(id) on delete cascade,
  status_from text,
  status_to text,
  changed_by bigint references users(id),
  changed_at timestamptz not null default now(),
  notes text
);
```

**Index untuk performa query laporan:**
```sql
create index on borrowings (created_at);
create index on borrowings (status, created_at);
create index on borrowings (user_id, created_at);
```

### 🔌 API Endpoints

**GET /api/reports/borrowings**
- Query params: 
  - `period`: 'daily' | 'weekly' | 'monthly'
  - `start_date`: YYYY-MM-DD
  - `end_date`: YYYY-MM-DD
  - `status`: filter by status (optional)
  - `format`: 'json' | 'excel' | 'pdf'
- Response: Agregasi data peminjaman dengan statistik

**GET /api/reports/summary**
- Dashboard summary untuk periode tertentu
- Total peminjaman, most borrowed items, top borrowers
- Response: `{total, by_status, top_assets[], top_borrowers[]}`

### 🎨 Frontend Files

**Halaman baru: `public/laporan.html`**
- Date range picker
- Filter by period (daily/weekly/monthly)
- Table view dengan pagination
- Chart visualization (bar chart, line chart)
- Export buttons (PDF, Excel)

**JS Module: `public/assets/reports.js`**
- Chart rendering (menggunakan Chart.js atau vanilla SVG)
- Excel export logic (SheetJS / xlsx library)
- PDF generation (jsPDF library)

### 📦 Dependencies Baru

```json
{
  "dependencies": {
    "exceljs": "^4.4.0",
    "pdfkit": "^0.15.0"
  }
}
```

### 🔄 Workflow

```
User (Admin) → Pilih Period → Set Date Range → Generate Report
                    ↓
             View di Browser (Table + Chart)
                    ↓
          Export to Excel/PDF (Optional)
```

---

## 2️⃣ Import Data Aset dari Excel

### 📊 Fitur
- Upload file Excel (.xlsx, .xls)
- Preview data sebelum import
- Validasi data (required fields, format)
- Bulk insert dengan progress bar
- Error handling: skip invalid rows, show summary

### 📄 Excel Format Template

**Kolom yang diperlukan:**
| Kode | Nama | Kategori | Brand | Ruangan | Tahun | Kondisi | Tipe | Jenis Aset | Stok Total |
|------|------|----------|-------|---------|-------|---------|------|------------|------------|
| A001 | Monitor LG 24" | Elektronik | LG | Ruang TU | 2024 | Baik | BMN | Fixed Asset | 10 |

### 🔌 API Endpoints

**POST /api/assets/import**
- Body: `multipart/form-data` dengan file Excel
- Process:
  1. Parse Excel file
  2. Validate each row
  3. Check for duplicates (by code)
  4. Bulk insert valid rows
  5. Return summary: `{success: 15, failed: 2, errors: [...]}`

**GET /api/assets/template**
- Download Excel template dengan header dan sample data
- Response: Excel file

### 🎨 Frontend Files

**Tambahan di `public/dataaset.html`**
- Button "Import dari Excel"
- File upload modal
- Preview table (first 10 rows)
- Validation feedback
- Progress bar saat upload

**JS Module: `public/assets/import.js`**
- File upload handler
- Client-side Excel parsing (SheetJS)
- Preview rendering
- API call with FormData

### 📦 Dependencies Baru

```json
{
  "dependencies": {
    "@neondatabase/serverless": "^0.10.0",
    "exceljs": "^4.4.0",
    "busboy": "^1.6.0"
  }
}
```

### 🔄 Workflow

```
Admin → Upload Excel → Preview Data → Validate
              ↓
     Show Validation Errors (if any)
              ↓
        Confirm Import
              ↓
      Bulk Insert → Show Summary
```

---

## 3️⃣ Guest Mode (Akses Tanpa Login)

### 🌐 Fitur
- Homepage menampilkan katalog aset tanpa login
- Guest dapat browse: aset, kategori, ruangan
- Guest dapat search dan filter
- Guest **tidak bisa**: pinjam, lihat detail stok, akses dashboard
- Tombol "Pinjam" redirect ke login page

### 🗄️ Database Changes

**Tidak ada perubahan database** - hanya logic di frontend dan API

### 🔌 API Endpoints

**GET /api/assets/public**
- Public endpoint (tanpa auth)
- Return: `{id, code, name, category, room, brand, image}` (tanpa stock details)
- Hide: stock_available, stock_borrowed, stock_total

**GET /api/categories/public** (public)
**GET /api/rooms/public** (public)

### 🎨 Frontend Changes

**Homepage baru: `public/index.html` (redesign)**
- Landing page dengan katalog aset
- Search bar prominent
- Category filter sidebar
- Asset cards (tanpa stok info)
- Button "Login untuk Pinjam"
- Header: Logo + "Login" button

**Navigation:**
- Guest: Home, Katalog, Kategori, Ruangan, Login, Register
- User: Dashboard, Pinjam, Riwayat, Profile, Logout
- Admin: + Kelola Aset, Users, Settings

**Update `assets/app.js`:**
- Detect user state (guest, user, admin)
- Conditional rendering based on role
- Redirect guard for protected actions

### 🔄 Workflow

```
Guest → Browse Homepage (Public Catalog)
           ↓
     Click "Pinjam" → Redirect to Login
           ↓
     Login Success → Redirect to Ajukan Pinjam
           ↓
     Submit Borrowing Request
```

---

## 4️⃣ Dual Verification (Admin + Verifikator)

### 👥 Fitur
- Role baru: **Verifikator**
- Workflow peminjaman: User → Admin (approve) → Verifikator (verify) → Borrowed
- Admin: approve/reject peminjaman awal
- Verifikator: verifikasi fisik sebelum dipinjamkan
- Notifikasi cascade: User → Admin → Verifikator

### 🗄️ Database Changes

**Update `users` table:**
```sql
alter table users alter column role type text;
-- role options: 'user' | 'admin' | 'verifikator'
```

**Update `borrowings` table:**
```sql
alter table borrowings add column approved_by bigint references users(id);
alter table borrowings add column approved_at timestamptz;
alter table borrowings add column verified_by bigint references users(id);
alter table borrowings add column verified_at timestamptz;
```

**Status baru:**
- `pending` → menunggu approval admin
- `approved` → admin approve, menunggu verifikasi
- `verified` → verifikator verify, siap dipinjam
- `borrowed` → sudah dipinjamkan
- `returned` → sudah dikembalikan
- `rejected` → ditolak (bisa di stage mana saja)

### 🔌 API Endpoints

**PATCH /api/borrowings/approve** (admin only)
- Body: `{id, action: 'approve' | 'reject', notes?}`
- Sets: `approved_by`, `approved_at`, `status = 'approved'`
- Notif: → Verifikator

**PATCH /api/borrowings/verify** (verifikator only)
- Body: `{id, action: 'verify' | 'reject', notes?}`
- Sets: `verified_by`, `verified_at`, `status = 'verified'`
- Notif: → User (ready to borrow)

**PATCH /api/borrowings/lend** (admin/verifikator)
- Body: `{id}`
- Sets: `status = 'borrowed'`
- Notif: → User (confirmation)

**GET /api/borrowings?role=verifikator**
- Filter: `status = 'approved'` (pending verification)
- Return: borrowings yang perlu diverifikasi

### 🎨 Frontend Files

**Halaman baru: `public/verifikasi.html`** (untuk role verifikator)
- List borrowings dengan status `approved`
- Button: "Verifikasi" dan "Tolak"
- Notes field (optional)

**Update `public/daftarpinjam.html`:**
- Show different actions based on role:
  - Admin: Approve/Reject (untuk status pending)
  - Verifikator: Verify/Reject (untuk status approved)
  - Both: Lend (untuk status verified), Return (untuk status borrowed)

**Update `assets/app.js`:**
- Role detection untuk Verifikator
- Conditional button rendering
- Navigation menu update

### 🔄 Workflow

```
User → Request Borrowing (status: pending)
              ↓
        Notify Admin
              ↓
  Admin → Approve/Reject (status: approved/rejected)
              ↓
      Notify Verifikator
              ↓
  Verifikator → Verify/Reject (status: verified/rejected)
              ↓
        Notify User
              ↓
  Admin/Verifikator → Lend (status: borrowed)
              ↓
        Item Borrowed
              ↓
  Admin/Verifikator → Return (status: returned)
```

---

## 5️⃣ QR Code untuk Detail Aset

### 📱 Fitur
- Setiap aset memiliki QR Code unik
- Scan QR → Redirect ke halaman detail aset
- Halaman detail: foto, spesifikasi, lokasi, availability, history
- Generate 10 QR code sampel saat install
- Print QR sticker untuk ditempel di aset fisik

### 🗄️ Database Changes

**Update `assets` table:**
```sql
alter table assets add column qr_code text unique;
alter table assets add column qr_generated_at timestamptz;
```

**Seed 10 QR codes:**
```sql
update assets set qr_code = 'QR' || lpad(id::text, 6, '0') where id <= 10;
-- QR000001, QR000002, ..., QR000010
```

### 🔌 API Endpoints

**GET /api/assets/:id/qr**
- Generate QR code image (SVG atau PNG)
- Return: QR code sebagai data URL atau file
- Public endpoint

**GET /api/assets/by-qr/:code**
- Public endpoint untuk scan result
- Return: Asset detail dengan availability
- Example: `/api/assets/by-qr/QR000001`

**GET /api/assets/:id/detail**
- Full detail aset termasuk borrowing history
- Public (limited info) atau Authenticated (full info)

### 🎨 Frontend Files

**Halaman baru: `public/aset-detail.html?qr=QR000001`**
- Asset image (large view)
- Specifications table
- Current location (room)
- Availability status
- Borrowing history (jika authenticated)
- Button "Pinjam" (redirect to login if guest)

**Halaman baru: `public/qr-print.html`**
- Grid layout untuk print multiple QR codes
- Asset name + QR code + Asset code
- Print-friendly CSS
- Generate PDF for bulk print

**Update `public/dataaset.html`:**
- Button "Generate QR" untuk setiap aset
- Button "Print QR" untuk bulk print
- Preview QR modal

**JS Module: `public/assets/qr.js`**
- QR code generation (menggunakan qrcode.js atau QRCode library)
- Print handler

### 📦 Dependencies Baru

```json
{
  "dependencies": {
    "qrcode": "^1.5.4"
  }
}
```

### 🔄 Workflow

**Generate QR:**
```
Admin → Click "Generate QR" pada aset
              ↓
        API generate unique code
              ↓
        Save to database
              ↓
        Display QR code
              ↓
        Option: Download/Print
```

**Scan QR:**
```
User → Scan QR Code (via camera/app)
              ↓
        Redirect ke /aset-detail.html?qr=QR000001
              ↓
        Load asset detail
              ↓
        Show availability
              ↓
        Button "Pinjam" (if available)
```

---

## 6️⃣ Verifikasi Registrasi Karyawan

### 🔐 Fitur
- User register → Status: `pending`
- Admin review registrasi
- Admin approve/reject user baru
- User pending tidak bisa login hingga di-approve
- Notifikasi via email/WA saat approved

### 🗄️ Database Changes

**Update `users` table:**
```sql
alter table users add column status text not null default 'pending';
-- status: 'pending' | 'active' | 'suspended' | 'rejected'

alter table users add column approved_by bigint references users(id);
alter table users add column approved_at timestamptz;
alter table users add column rejection_reason text;
```

**Update first user logic:**
```sql
-- First user otomatis active (no approval needed)
-- Subsequent users = pending
```

### 🔌 API Endpoints

**POST /api/register**
- Update: Set status = 'pending' (kecuali first user)
- Return: `{message: 'Menunggu approval admin'}`
- No token issued untuk pending users

**POST /api/login**
- Check: user.status = 'active'
- Reject if: 'pending' | 'suspended' | 'rejected'
- Return error: "Akun Anda masih menunggu approval admin"

**GET /api/users/pending** (admin only)
- List users dengan status 'pending'
- Return: `{users: [{id, nip, name, phone, created_at}]}`

**PATCH /api/users/approve** (admin only)
- Body: `{id, action: 'approve' | 'reject', reason?}`
- Update status to 'active' atau 'rejected'
- Send notification (WA/Email)

### 🎨 Frontend Files

**Halaman baru: `public/approval.html`** (admin only)
- List pending registrations
- Card per user: NIP, Nama, Phone, Tanggal daftar
- Buttons: "Approve" dan "Reject"
- Reject modal dengan reason field

**Update `public/register.html`:**
- Success message: "Registrasi berhasil! Menunggu approval admin."
- Redirect ke login page dengan info message

**Update `public/login.html`:**
- Handle error: "Akun masih pending"
- Show message dengan styling khusus

**Update `public/users.html`:**
- Tab: Active Users | Pending | Rejected
- Filter by status
- Quick approve/reject actions

### 🔄 Workflow

```
User → Register (status: pending)
              ↓
        Cannot Login
              ↓
        Notify Admin
              ↓
  Admin → Review Registration (di halaman approval)
              ↓
        View User Details
              ↓
    Approve/Reject → Update status
              ↓
        Notify User (WA/Email)
              ↓
  User → Login (if approved)
```

**First User Exception:**
```
First User → Register → status: active (auto-approve)
                  ↓
            role: admin
                  ↓
            Can Login Immediately
```

---

## 🚀 Implementation Priority

### Phase 1 (Critical - Week 1-2)
1. ✅ Guest Mode (biggest UX impact)
2. ✅ Verifikasi Registrasi (security & control)

### Phase 2 (High Priority - Week 3-4)
3. ✅ Dual Verification (business process improvement)
4. ✅ QR Code Detail Aset (operational efficiency)

### Phase 3 (Medium Priority - Week 5-6)
5. ✅ Laporan Peminjaman (analytics & reporting)
6. ✅ Import Excel (data migration & bulk operations)

---

## 📁 File Structure (After Implementation)

```
AssetManagement/
├── api/
│   ├── assets/
│   │   ├── import.js          (NEW)
│   │   └── by-qr.js           (NEW)
│   ├── borrowings/
│   │   ├── approve.js         (NEW)
│   │   └── verify.js          (NEW)
│   ├── reports/
│   │   ├── borrowings.js      (NEW)
│   │   └── summary.js         (NEW)
│   ├── users/
│   │   ├── pending.js         (NEW)
│   │   └── approve.js         (NEW)
│   └── [existing files...]
├── public/
│   ├── laporan.html           (NEW)
│   ├── verifikasi.html        (NEW)
│   ├── approval.html          (NEW)
│   ├── aset-detail.html       (NEW)
│   ├── qr-print.html          (NEW)
│   ├── assets/
│   │   ├── reports.js         (NEW)
│   │   ├── import.js          (NEW)
│   │   ├── qr.js              (NEW)
│   │   └── [existing files...]
│   └── [existing files...]
├── migrate-v3.sql             (NEW - all schema changes)
├── qr-samples/                (NEW - 10 sample QR codes)
│   ├── QR000001.png
│   ├── QR000002.png
│   └── ...
└── [existing files...]
```

---

## 🧪 Testing Checklist

### Guest Mode
- [ ] Homepage accessible tanpa login
- [ ] Katalog aset visible untuk guest
- [ ] Guest tidak bisa pinjam (redirect to login)
- [ ] Guest tidak bisa akses dashboard/settings

### Dual Verification
- [ ] User request → status pending
- [ ] Admin approve → status approved, notify verifikator
- [ ] Verifikator verify → status verified
- [ ] Stock reserved saat request, released saat reject
- [ ] Notifikasi cascade works

### QR Code
- [ ] Generate QR untuk aset baru
- [ ] Scan QR redirect ke detail page
- [ ] Detail page accessible by guest (limited info)
- [ ] Print QR layout correct (A4, 10 per page)

### Registration Approval
- [ ] New user register → status pending
- [ ] Pending user cannot login
- [ ] Admin see pending list
- [ ] Admin approve → user can login
- [ ] Admin reject → user cannot login
- [ ] First user auto-approved

### Reports
- [ ] Daily report correct aggregation
- [ ] Weekly report (7 days) correct
- [ ] Monthly report (30-31 days) correct
- [ ] Export to Excel works
- [ ] Export to PDF works

### Import Excel
- [ ] Upload Excel file success
- [ ] Preview shows correct data
- [ ] Validation catches errors
- [ ] Bulk insert works
- [ ] Duplicate handling correct
- [ ] Error summary accurate

---

## 🔐 Security Considerations

1. **Guest Mode**: Pastikan endpoint public tidak expose sensitive data
2. **Role-based Access**: Validate role di server-side, bukan hanya frontend
3. **File Upload**: Validate file type, size limit, sanitize filename
4. **QR Code**: Prevent QR enumeration attack (rate limit scanning)
5. **Registration**: Prevent spam registration (captcha atau rate limit)
6. **SQL Injection**: Use parameterized queries untuk semua input

---

## 📊 Database Migration Summary

**migrate-v3.sql** akan include:
```sql
-- 1. Add verifikator role & dual verification fields
alter table borrowings add column approved_by bigint references users(id);
alter table borrowings add column approved_at timestamptz;
alter table borrowings add column verified_by bigint references users(id);
alter table borrowings add column verified_at timestamptz;

-- 2. Add QR code fields
alter table assets add column qr_code text unique;
alter table assets add column qr_generated_at timestamptz;

-- 3. Add user approval fields
alter table users add column status text not null default 'active';
alter table users add column approved_by bigint references users(id);
alter table users add column approved_at timestamptz;
alter table users add column rejection_reason text;

-- 4. Create borrowing logs (for reports)
create table borrowing_logs (
  id bigserial primary key,
  borrowing_id bigint references borrowings(id) on delete cascade,
  status_from text,
  status_to text,
  changed_by bigint references users(id),
  changed_at timestamptz not null default now(),
  notes text
);

-- 5. Add indexes for performance
create index on borrowings (approved_by);
create index on borrowings (verified_by);
create index on borrowings (created_at, status);
create index on assets (qr_code);
create index on users (status);
create index on borrowing_logs (borrowing_id);
create index on borrowing_logs (changed_at);

-- 6. Generate 10 sample QR codes
update assets set 
  qr_code = 'QR' || lpad(id::text, 6, '0'),
  qr_generated_at = now()
where id <= 10 and qr_code is null;

-- 7. Set existing users as active (backward compatibility)
update users set status = 'active' where status is null or status = '';

-- 8. Set first user as active admin (if exists)
update users set status = 'active', role = 'admin' 
where id = (select min(id) from users);
```

---

## 📞 Support & Questions

Untuk implementasi, tanyakan:
1. "Mulai dari fitur mana?" (sesuai priority)
2. "Implement [nama fitur]"
3. "Test [nama fitur]"
4. "Deploy all changes"

Dokumentasi ini akan di-update seiring progress implementasi.
