# SESDIAN — Style Guide & Design System Reference

> **Versi**: Design System v7 (Notion design language)
> **Bahasa desain**: Warm paper canvas · near-black ink · ONE blue accent · hairlines
> **Mode**: Light (default) | Dark via `[data-theme="dark"]`
> **Sumber utama**: [`app.css`](../public/assets/app.css) (2 510 baris), [`theme.js`](../public/assets/theme.js), [`preloader.css`](../public/assets/preloader.css), [`icons.js`](../public/assets/icons.js)

---

## Daftar Isi

1. [Prinsip Desain](#1-prinsip-desain)
2. [Tipografi](#2-tipografi)
3. [Palet Warna & Design Tokens](#3-palet-warna--design-tokens)
4. [Radius & Spacing](#4-radius--spacing)
5. [Elevasi & Shadow](#5-elevasi--shadow)
6. [Animasi & Motion](#6-animasi--motion)
7. [Komponen — Sidebar](#7-komponen--sidebar)
8. [Komponen — Header & Top Bar](#8-komponen--header--top-bar)
9. [Komponen — Card & Panel](#9-komponen--card--panel)
10. [Komponen — Stat Card](#10-komponen--stat-card)
11. [Komponen — Asset Card (Data Aset)](#11-komponen--asset-card-data-aset)
12. [Komponen — Button](#12-komponen--button)
13. [Komponen — Form & Input](#13-komponen--form--input)
14. [Komponen — Table](#14-komponen--table)
15. [Komponen — Modal & Overlay](#15-komponen--modal--overlay)
16. [Komponen — Toast Notification](#16-komponen--toast-notification)
17. [Komponen — Segmented Filter](#17-komponen--segmented-filter)
18. [Komponen — Custom Dropdown & Autocomplete](#18-komponen--custom-dropdown--autocomplete)
19. [Komponen — Image Drop Zone & Crop](#19-komponen--image-drop-zone--crop)
20. [Komponen — Profile Menu & Notification](#20-komponen--profile-menu--notification)
21. [Komponen — Dashboard Greeting Hero](#21-komponen--dashboard-greeting-hero)
22. [Komponen — Login Page](#22-komponen--login-page)
23. [Komponen — Preloader & Skeleton](#23-komponen--preloader--skeleton)
24. [Komponen — Back-to-Top](#24-komponen--back-to-top)
25. [Sistem Ikon](#25-sistem-ikon)
26. [Theme Switching](#26-theme-switching)
27. [Text Size Preference](#27-text-size-preference)
28. [Responsive Breakpoints](#28-responsive-breakpoints)
29. [Aksesibilitas](#29-aksesibilitas)
30. [Status & Semantic Colors](#30-status--semantic-colors)
31. [Z-Index Stack](#31-z-index-stack)
32. [Print Styles](#32-print-styles)
33. [Konvensi Penamaan CSS](#33-konvensi-penamaan-css)

---

## 1. Prinsip Desain

| Prinsip | Implementasi |
|---|---|
| **Kanvas paper-soft hangat** | `--bg: #f6f5f4` bukan putih klinis; surface putih untuk kartu/field → figure/ground lembut |
| **Satu aksen struktural** | Notion blue `#0075de`. Warna lain (hijau/oranye/merah) hanya untuk status semantik |
| **Tipografi Inter** | Heading berat (700/800) dengan tracking negatif; body 400 |
| **Elevasi tipis** | Hairline `#e6e6e6` + shadow berlapis sangat transparan, bukan drop-shadow berat |
| **Radius konsisten** | Input 8px, kartu 12–16px, CTA/badge pill (9999px) |
| **Dark mode** | Via `[data-theme="dark"]` (kanvas near-black `#191918`) |
| **Motion yang hormat** | `prefers-reduced-motion: reduce` menghentikan semua animasi |

---

## 2. Tipografi

### Font Stack

```css
font-family: "Inter", -apple-system, system-ui, "Segoe UI", sans-serif;
font-feature-settings: "cv11", "ss01";
```

| Peran | Font | Weight | Tracking |
|---|---|---|---|
| **Body teks** | Inter | 400–500 | Normal |
| **Label form** | Inter | 800 | `0.6–0.8px` |
| **Heading h1** | Inter | 800 | `-0.03em` |
| **Heading h2, h3** | Inter | 800 | `-0.02em` |
| **Monospace** (kode aset, NIP, tanggal) | JetBrains Mono | 400–600 | Normal |

### Import

```css
@import "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap";
```

### Skala Ukuran Teks (User Preference)

| Preferensi | `html font-size` | Atribut |
|---|---|---|
| **Small** | `15px` | `html[data-textsize="small"]` |
| **Medium** (default) | `16px` (browser default) | Tidak ada atribut |
| **Large** | `18px` | `html[data-textsize="large"]` |

Seluruh ukuran rem di aplikasi otomatis skala mengikuti base ini.

### Anti-aliasing

```css
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
```

---

## 3. Palet Warna & Design Tokens

### 3.1 Light Mode (Default)

#### Brand & Aksen

| Token | Nilai | Deskripsi |
|---|---|---|
| `--primary` | `#0075de` | Notion blue — satu-satunya aksen struktural |
| `--chart-1` | `#0075de` | Warna seri chart (validated vs white surface) |
| `--primary-dark` | `#005bab` | Hover state primary |
| `--primary-glow` | `rgba(0,117,222,0.16)` | Focus ring / glow efek |
| `--primary-light` | `#e7f1fc` | Tint badge / chip background |
| `--secondary` | `#213183` | Deep indigo — hanya untuk inverted "night" band |
| `--purple` | `#d6b6f6` | Dekoratif saja, bukan struktural |

#### Status Semantik

| Token | Nilai | Penggunaan |
|---|---|---|
| `--success` | `#1aae39` | Tersedia, Kembali, operasi berhasil |
| `--danger` | `#e03e3e` | Habis, Ditolak, error |
| `--warning` | `#dd5b00` | Maintenance, Pending |
| `--info` | `#0075de` | Informasional (= primary) |

#### Surface & Background

| Token | Nilai | Deskripsi |
|---|---|---|
| `--bg` | `#f6f5f4` | Warm paper canvas (halaman) |
| `--bg-mid` | `#efedea` | Inset yang sedikit lebih gelap |
| `--bg-card` | `#ffffff` | Permukaan kartu solid putih |
| `--bg-surface` | `#ffffff` | Permukaan modal/dropdown |
| `--sidebar-bg` | `#ffffff` | Background sidebar |

#### Teks

| Token | Nilai | Deskripsi |
|---|---|---|
| `--text` | `#1f1e1c` | Near-black warm ink |
| `--text-muted` | `#615d59` | Notion stone — teks sekunder |

#### Border

| Token | Nilai | Deskripsi |
|---|---|---|
| `--border` | `#e6e6e6` | Hairline border |

#### Glass Surface Tokens (Flat)

| Token | Nilai |
|---|---|
| `--glass-bg` | `#ffffff` |
| `--glass-border` | `#e6e6e6` |
| `--glass-blur` | `saturate(100%)` |
| `--glass-card` | `#ffffff` |
| `--glass-hover` | `#faf9f8` |

#### Sidebar Tokens

| Token | Nilai |
|---|---|
| `--sidebar-border` | `#ececec` |
| `--sidebar-divider` | `#e6e6e6` |
| `--sidebar-card-bg` | `#f6f5f4` |
| `--sidebar-link-hover` | `rgba(0,117,222,0.07)` |
| `--sidebar-link-active-bg` | `rgba(0,117,222,0.10)` |
| `--sidebar-link-active-border` | `rgba(0,117,222,0.22)` |
| `--sidebar-text` | `#615d59` |
| `--sidebar-active` | `#0075de` |

---

### 3.2 Dark Mode (`[data-theme="dark"]`)

#### Brand (Adjusted Contrast)

| Token | Nilai | Catatan |
|---|---|---|
| `--primary` | `#4a9eea` | Lighter blue, holds contrast on dark |
| `--chart-1` | `#3987e5` | Validated vs dark surface |
| `--primary-dark` | `#2f86d6` | |
| `--primary-glow` | `rgba(74,158,234,0.22)` | |
| `--primary-light` | `rgba(74,158,234,0.16)` | |
| `--secondary` | `#2a3a8f` | |

#### Surface & Background

| Token | Nilai |
|---|---|
| `--bg` | `#191918` — near-black canvas |
| `--bg-mid` | `#202020` |
| `--bg-card` | `#2a2a29` |
| `--bg-surface` | `#2f2f2e` |
| `--sidebar-bg` | `#202020` |

#### Teks

| Token | Nilai |
|---|---|
| `--text` | `#e7e6e3` |
| `--text-muted` | `#9b9893` |

#### Border

| Token | Nilai |
|---|---|
| `--border` | `rgba(255,255,255,0.10)` |

#### Glass (Dark)

| Token | Nilai |
|---|---|
| `--glass-bg` | `#2a2a29` |
| `--glass-border` | `rgba(255,255,255,0.10)` |
| `--glass-card` | `#2a2a29` |
| `--glass-hover` | `#313130` |

#### Sidebar (Dark)

| Token | Nilai |
|---|---|
| `--sidebar-border` | `rgba(255,255,255,0.07)` |
| `--sidebar-divider` | `rgba(255,255,255,0.12)` |
| `--sidebar-card-bg` | `#262625` |
| `--sidebar-link-hover` | `rgba(74,158,234,0.12)` |
| `--sidebar-link-active-bg` | `rgba(74,158,234,0.18)` |
| `--sidebar-link-active-border` | `rgba(74,158,234,0.4)` |
| `--sidebar-text` | `#9b9893` |
| `--sidebar-active` | `#6db4f0` |

---

## 4. Radius & Spacing

### Skala Radius

| Token | Nilai | Penggunaan |
|---|---|---|
| `--radius-input` | `8px` | Input, select, textarea |
| `--radius` | `12px` | Card standar, badge, chip |
| `--radius-lg` | `16px` | Panel besar, table wrapper, modal |
| `--radius-xl` | `20px` | Login card, container utama |
| `--radius-pill` | `9999px` | Button CTA, badge status, filter pill |

### Spacing Umum

| Konteks | Padding |
|---|---|
| Card body | `0.85rem 1rem 1rem` |
| Modal | `2rem` (desktop), `1.5rem` (tablet), `1rem` (phone) |
| Stat card | `1.15rem 1.25rem` |
| Form field | `0.7rem 0.85rem` |
| Button standar | `0.55rem 1.1rem` |
| Button sm | `0.3rem 0.7rem` |
| Button lg | `0.72rem 1.45rem` |
| Login card | `2.5rem` |
| Greeting hero | `2rem 2.4rem` |

---

## 5. Elevasi & Shadow

### Light Mode

| Token | Nilai | Penggunaan |
|---|---|---|
| `--card-shadow` | 4-layer: `0 0.2px 1px rgba(0,0,0,0.012)`, `0 0.8px 2.9px rgba(0,0,0,0.02)`, `0 2px 7.8px rgba(0,0,0,0.027)`, `0 4px 18px rgba(0,0,0,0.04)` | Resting card |
| `--card-hover-shadow` | `0 1px 2px rgba(0,0,0,0.04)`, `0 8px 22px rgba(0,0,0,0.07)`, `0 18px 44px rgba(0,0,0,0.07)` | Card hover (lifted) |
| `--glass-shadow` | = `--card-shadow` | Surface standar |
| `--glass-shadow-lg` / `--shadow-lg` | `0 1px 2px rgba(0,0,0,0.03)`, `0 6px 16px rgba(0,0,0,0.06)`, `0 18px 40px rgba(0,0,0,0.06)` | Dropdown, popover |

### Dark Mode

| Token | Nilai |
|---|---|
| `--card-shadow` | `0 1px 2px rgba(0,0,0,0.4)`, `0 6px 18px rgba(0,0,0,0.4)` |
| `--card-hover-shadow` | `0 12px 36px rgba(0,0,0,0.55)` |
| `--glass-shadow` | `0 1px 2px rgba(0,0,0,0.4)`, `0 8px 24px rgba(0,0,0,0.4)` |
| `--glass-shadow-lg` | `0 12px 40px rgba(0,0,0,0.6)` |

### Neumorphism (Greeting Hero)

```css
/* Light */
box-shadow:
  8px 8px 16px rgba(163, 177, 198, 0.45),
  -8px -8px 16px rgba(255, 255, 255, 1);

/* Dark */
box-shadow:
  8px 8px 16px rgba(0, 0, 0, 0.6),
  -8px -8px 16px rgba(55, 65, 81, 0.25);
```

### Topbar Scrolled Shadow

```css
/* Light */
box-shadow: 0 1px 0 var(--border), 0 8px 20px rgba(0,0,0,0.07);

/* Dark */
box-shadow: 0 1px 0 var(--border), 0 10px 26px rgba(0,0,0,0.5);
```

---

## 6. Animasi & Motion

### Easing Curves

| Token | Nilai | Deskripsi |
|---|---|---|
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Overshoot spring untuk transform |
| `--ease-smooth` | `cubic-bezier(0.4, 0, 0.2, 1)` | Material-style smooth ease |

### Duration Scale

| Token | Nilai | Penggunaan |
|---|---|---|
| `--dur-fast` | `0.16s` | Hover color/border |
| `--dur-normal` | `0.26s` | Fade, translate |
| `--dur-slow` | `0.5s` | Scale bounce-in |

### Keyframes

| Nama | Efek |
|---|---|
| `fadeUp` | Fade in + translateY(20px → 0) |
| `fadeIn` | Opacity 0 → 1 |
| `slideInLeft` | Fade in + translateX(-20px → 0) |
| `scaleUp` | Scale 0.9 → 1.02 → 1 (spring bounce) |
| `shimmer` | Background-position sweep (skeleton loading) |
| `pulse` | Opacity 1 → 0.5 → 1 |
| `spin` | 360° rotate (loader) |
| `floatY` | TranslateY(0 → -6px → 0) — floating efek |
| `glowPulse` | Box-shadow primary glow pulsating |
| `sesdLoaderBounce` | Scale 0 → 1 → 0 (three-dot loader) |
| `themeToggle` | Rotate 0 → 360 + scale bounce |

### Utility Classes

| Class | Animasi | Durasi |
|---|---|---|
| `.animate-fade-up` | `fadeUp` | `--dur-normal` |
| `.animate-fade-in` | `fadeIn` | `--dur-normal` |
| `.animate-slide-in` | `slideInLeft` | `--dur-normal` |
| `.animate-bounce-in` | `scaleUp` | `--dur-slow`, spring easing |
| `.animate-float` | `floatY` | `3.5s`, infinite |
| `.animate-glow` | `glowPulse` | `2.5s`, infinite |

### Stagger Delays

| Class | Delay |
|---|---|
| `.delay-1` | `60ms` |
| `.delay-2` | `120ms` |
| `.delay-3` | `180ms` |
| `.delay-4` | `240ms` |
| `.delay-5` | `300ms` |

---

## 7. Komponen — Sidebar

### Struktur

```
aside[style]
├── div:first-child          → Header: logo + collapse button
│   ├── .sesd-brand-logo     → <img> wordmark
│   └── .sesd-collapse-btn   → Toggle expand/rail
├── .sesd-navsec             → Section header (UTAMA/ASET/dst.)
├── a[style]                 → Nav link (masing-masing halaman)
└── div:last-child           → Account card (avatar + name + logout)
```

### Styling

| Properti | Nilai |
|---|---|
| Background | `var(--sidebar-bg)` (putih / dark) |
| Border right | `1px solid var(--sidebar-border)` |
| Border radius | `0 0 16px 16px` (rounded bottom only) |
| Link border-radius | `12px` |
| Link hover | `translateX(4px)` + `var(--sidebar-link-hover)` bg |
| Active link | `var(--sidebar-link-active-bg)` + border `var(--sidebar-link-active-border)` + glow shadow |
| Section divider | `2px solid var(--sidebar-divider)` |

### Rail Mode (Collapsed Sidebar)

Triggered oleh: `aside.sesd-rail` atau `html.sesd-rail-pref`

| Properti | Expanded | Rail |
|---|---|---|
| Width | Auto (~220px) | `78px` |
| Logo | Visible | Hidden |
| Nav labels | Visible | Hidden (icon only) |
| Icon size | `1em` | `25px` |
| Collapse button | `30×30px`, neutral | `44×44px`, primary filled + glow |
| Account card | Full (name + role + logout) | Avatar only |
| Section headers | Visible | Hidden |

### Mobile (≤768px)

- Sidebar menjadi **fixed drawer** (`translateX(-100%)`)
- Kelas `.sesd-open` menampilkannya dengan `translateX(0)` + shadow
- Backdrop overlay: `.sesd-mobile-backdrop`

---

## 8. Komponen — Header & Top Bar

### Cluster Kanan (`.sesd-headbar`)

```
.sesd-headbar
├── .theme-switch             → Animated sun/moon toggle (Uiverse)
├── .sesd-textsize            → Text-size segmented control (A A A)
├── .sesd-head-date           → "8 Jul 2026" + calendar icon
├── .sesd-head-iconbtn        → Notification bell
└── .sesd-head-profile        → Profile avatar (circular)
```

### Sizing

| Elemen | Desktop | Mobile (≤768px) |
|---|---|---|
| Icon button / Profile | `38×38px` | `34×34px` |
| Border-radius | `10px` (icon), `50%` (profile) | Sama |
| Date | Visible | `display: none` |
| Gap | `10px` | `7px` |

### Topbar Sticky

```css
.sesd-topbar, [data-topbar] {
  position: sticky;
  top: 0;
  z-index: 50;
}
/* Shadow muncul saat scroll */
.sesd-topbar.sesd-scrolled {
  box-shadow: 0 1px 0 var(--border), 0 8px 20px rgba(0,0,0,0.07);
}
```

---

## 9. Komponen — Card & Panel

### Card Dasar

```css
background: var(--glass-card);
border: 1px solid var(--glass-border);
border-radius: var(--radius-lg);  /* 16px */
box-shadow: var(--card-shadow);
```

### Hover Behavior

```css
:hover {
  background: var(--glass-hover);
  box-shadow: var(--card-hover-shadow);
  transform: translateY(-3px);
}
```

### Container Hover (Stat Cards & Panels)

```css
:hover {
  transform: scale(1.025) translateY(-4px);
  box-shadow: var(--card-hover-shadow);
}
```

Mobile (≤768px): hover dikurangi → `scale(1.015) translateY(-2px)`

---

## 10. Komponen — Stat Card

### A. Dashboard Stat Card (`.stat-card`)

Layout: **horizontal** (icon kiri + info kanan)

```
.stat-card
├── .stat-icon-wrap       → 60px wide, colored bg, white SVG icon
│   └── svg               → 24px, rotated -12° → hover: rotate(0) scale(1.08)
└── .stat-info
    ├── .stat-label        → 0.7rem, uppercase, 700, muted
    ├── .stat-number       → 1.8rem, 800, --text, tnum
    └── .stat-subtitle     → 0.7rem, muted
```

### B. Data Aset Stat Card (`.sesd-stat-card`)

Layout: **vertikal sederhana**, border-left accent

```css
.sesd-stat-card {
  border-left: 3px solid var(--primary);
  border-radius: var(--radius);  /* 12px */
  padding: 1.15rem 1.25rem;
}
.sesd-stat-num { font-size: 1.65rem; color: var(--primary); }
.sesd-stat-label { font-size: 0.75rem; color: var(--text-muted); }
```

---

## 11. Komponen — Asset Card (Data Aset)

### Grid Layout

```css
.sesd-aset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(248px, 1fr));
  gap: 1rem;
}
```

Mobile breakpoints:
- `≤768px`: `minmax(150px, 1fr)`
- `≤480px`: `1fr` (single column)

### Card Anatomy

```
.sesd-aset-card
├── .sesd-aset-img          → 128px height, object-fit: cover
│   └── img
├── .sesd-aset-body
│   ├── .sesd-aset-top      → Flex row: type badge + availability badge
│   │   ├── .sesd-aset-type → "BMN" / "NON-BMN"
│   │   └── .sesd-aset-avail → "Tersedia 5" / "Habis"
│   ├── .sesd-aset-code     → Kode aset (monospace)
│   ├── .sesd-aset-name     → Nama aset (bold, 0.95rem)
│   ├── .sesd-aset-merk     → Badge merk (pill, uppercase)
│   ├── .sesd-aset-chips    → Ruangan, kategori, kondisi chips
│   │   └── .sesd-aset-chip → Icon + label chip
│   ├── .sesd-aset-cond     → Badge kondisi (green pill)
│   └── .sesd-aset-stock    → Stock section (pinned to bottom)
│       ├── .sesd-aset-stock-row → "STOK" label + "5 / 10" numbers
│       ├── .sesd-aset-bar       → Progress bar (6px)
│       │   └── .sesd-aset-bar-fill → Green fill, animated width
│       └── .sesd-aset-borrowed  → "2 dipinjam" warning text
```

### Type Badge Colors

| Modifier | Light BG | Text |
|---|---|---|
| `.is-bmn` | `var(--primary-light)` | `var(--primary)` |
| `.is-non` | `rgba(97,93,89,0.12)` | `var(--text-muted)` |

### Availability Badge Colors

| Modifier | Light BG | Text Color | Dark BG | Dark Text |
|---|---|---|---|---|
| `.is-ok` | `rgba(26,174,57,0.13)` | `var(--success)` | `rgba(26,174,57,0.2)` | `#6ee7a0` |
| `.is-out` | `rgba(224,62,62,0.12)` | `var(--danger)` | `rgba(224,62,62,0.2)` | `#f6a5a5` |
| `.is-maint` | `rgba(221,91,0,0.12)` | `var(--warning)` | `rgba(221,91,0,0.2)` | `#fbbf24` |

### Card Hover

```css
transform: translateY(-3px);
box-shadow: var(--card-hover-shadow);
border-color: rgba(0,117,222,0.28);
```

---

## 12. Komponen — Button

### Base (`.sesd-btn`)

```css
padding: 0.55rem 1.1rem;
border: 1px solid var(--border);
border-radius: var(--radius-pill);  /* 9999px */
font-weight: 600;
font-size: 0.85rem;
background: var(--bg-card);
color: var(--text);
box-shadow: var(--glass-shadow);
```

### Variants

| Class | Background | Color | Hover BG | Hover Shadow |
|---|---|---|---|---|
| `.sesd-btn-primary` | `var(--primary)` | `#fff` | `var(--primary-dark)` | `0 2px 10px var(--primary-glow)` |
| `.sesd-btn-success` | `var(--success)` | `#fff` | `#128a2e` | `rgba(26,174,57,0.3)` |
| `.sesd-btn-danger` | `var(--danger)` | `#fff` | `#c5302f` | `rgba(224,62,62,0.3)` |
| `.sesd-btn-warning` | `var(--warning)` | `#fff` | `#b94a00` | — |
| `.sesd-btn-ghost` | `transparent` | `var(--text-muted)` | `var(--bg-mid)` | `none` |

### Sizes

| Class | Padding | Font Size |
|---|---|---|
| `.sesd-btn-sm` | `0.3rem 0.7rem` | `0.76rem` |
| `.sesd-btn` (default) | `0.55rem 1.1rem` | `0.85rem` |
| `.sesd-btn-lg` | `0.72rem 1.45rem` | `0.95rem` |

### Interactions

```css
:hover  → background shift, subtle shadow
:active → transform: scale(0.97)
```

---

## 13. Komponen — Form & Input

### Field Wrapper (`.sesd-field`)

```css
.sesd-field { margin-bottom: 1rem; }
.sesd-field label {
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--text-muted);
  margin-bottom: 6px;
}
```

### Input Styling

```css
input, select, textarea {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-input);  /* 8px */
  padding: 0.7rem 0.85rem;
  font-size: 0.9rem;
  color: var(--text);
}
```

### Focus State

```css
:focus {
  background: var(--bg-surface);
  border-color: rgba(0,117,222,0.55);
  box-shadow: 0 0 0 3px var(--primary-glow);
  outline: none;
}
```

### Register Page Exception

Input pada register page tetap light-on-dark (panel gelap tetap):

```css
body[data-page="register"] input {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.14);
  color: #ffffff;
}
```

---

## 14. Komponen — Table

### Base Table

```css
table {
  background: var(--bg-card);
  border-radius: var(--radius-lg);  /* 16px */
  border: 1px solid var(--border);
  overflow: hidden;
}
```

### Header (thead)

```css
thead th {
  background: var(--bg-mid);
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.7px;
}
```

### Row Hover

```css
tbody tr:hover td {
  background: rgba(0,117,222,0.05);
}
```

### Mobile Card Table (`.sesd-cardtable`)

Di ≤640px, baris table berubah jadi **card berlabel**:

```
thead → display: none
tbody tr → display: block, border, rounded, shadow
td → display: flex (label::before + value), full-width
td::before { content: attr(data-label); }
```

### Table Toolbar (`.sesd-table-tools`)

```
.sesd-table-tools
├── .sesd-table-search   → Pill search input (170px)
└── .sesd-table-filter   → Filter icon button (34×34px)
    └── .sesd-table-filter-menu → Dropdown options
```

---

## 15. Komponen — Modal & Overlay

### Overlay (`.sesd-overlay`)

```css
background: rgba(15,23,42,0.5);
backdrop-filter: blur(8px) saturate(140%);
z-index: 1000;
animation: fadeIn 0.2s;
```

Dark mode: `background: rgba(4,7,20,0.7)`

### Modal (`.sesd-modal`)

```css
background: var(--bg-surface);
backdrop-filter: blur(32px) saturate(180%);
border: 1px solid var(--glass-border);
border-radius: var(--radius-xl);  /* 20px */
padding: 2rem;
width: 500px;
max-width: calc(100vw - 2rem);
max-height: 90vh;
overflow: auto;
box-shadow: var(--card-hover-shadow);
animation: scaleUp 0.45s var(--ease-spring);
```

### Lightbox (`.sesd-lightbox`)

```css
z-index: 1200;  /* Di atas modal (1000) */
background: rgba(10, 12, 18, 0.85);
cursor: zoom-out;
```

Image: `max-width: 94vw`, `max-height: 86vh`, `border-radius: 12px`

---

## 16. Komponen — Toast Notification

### Container

```css
.sesd-toast-wrap {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 9999;
}
```

### Toast Box

```css
.sesd-toast {
  min-width: 260px;
  max-width: 380px;
  padding: 0.9rem 1.1rem;
  border-radius: var(--radius-lg);
  animation: fadeUp 0.4s var(--ease-spring);
}
```

### Variants

| Class | Light BG | Light Border | Light Text | Dark Text |
|---|---|---|---|---|
| `.success` | `rgba(16,185,129,0.12)` | `rgba(16,185,129,0.3)` | `#065f46` | `#a7f3d0` |
| `.error` | `rgba(239,68,68,0.1)` | `rgba(239,68,68,0.3)` | `#991b1b` | `#fca5a5` |
| `.info` | `rgba(0,117,222,0.1)` | `rgba(0,117,222,0.3)` | `#005bab` | `#c7d2fe` |

---

## 17. Komponen — Segmented Filter

### Status Filter (`.sesd-segfilter`)

Container pill (`border-radius: 13px`) dengan button di dalamnya.

```css
.sesd-segfilter {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 13px;
}
```

Button:
- Default: `transparent` bg, `var(--text-muted)` text
- Hover: `var(--bg-mid)` bg
- Active (`[data-filter-active]`): `var(--primary)` bg, `#fff` text, blue shadow

Sub-elements:
- `.seg-dot` — 8px colored circle
- `.seg-count` — rounded counter badge (18px height, pill)

### Text Size Toggle (`.sesd-textsize`)

```css
display: inline-flex;
background: var(--bg-mid);
border: 1px solid var(--border);
border-radius: var(--radius-pill);
padding: 3px;
```

Button: `30×30px` circle, `.is-active` → primary bg + white text

---

## 18. Komponen — Custom Dropdown & Autocomplete

### Dropdown (`.sesd-dd`)

```
.sesd-dd
├── .sesd-dd-btn        → Trigger button (full-width, flex)
│   ├── .sesd-dd-label  → Selected value text
│   └── .sesd-dd-caret  → Chevron (rotates 180° on open)
└── .sesd-dd-menu       → Options panel
    ├── .sesd-dd-opt    → Each option row
    ├── .sesd-dd-empty  → "Tidak ada data" message
    └── .sesd-dd-add    → Inline add form (input + button)
```

Menu: `max-height: 240px`, `overflow: auto`, `border-radius: 12px`

### Autocomplete (`.sesd-ac`)

Serupa dengan dropdown, ditambah:
- `.sesd-ac-status` — badge "Sudah ada" / "Baru" (positioned absolute, right side)
- `.sesd-ac-status.is-exist` → primary tint
- `.sesd-ac-status.is-new` → success tint

---

## 19. Komponen — Image Drop Zone & Crop

### Drop Zone (`.sesd-drop`)

```css
min-height: 150px;
border: 2px dashed var(--border);
border-radius: 12px;
background: var(--bg);
```

States:
- `:hover` → `border-color: rgba(0, 117, 222, 0.45)`
- `.is-over` (drag active) → `border-color: var(--primary)`, `background: var(--primary-light)`
- `.has-img` → preview visible, hint overlay with dark bg

### Crop Stage (`.sesd-crop-stage`)

```css
aspect-ratio: 32 / 21;
border-radius: 12px;
background: #191918;
cursor: grab;
/* Rule-of-thirds guides via ::after pseudo */
```

---

## 20. Komponen — Profile Menu & Notification

### Profile Menu (`.sesd-profile-menu`)

```css
position: fixed;
width: 264px;
border-radius: var(--radius-lg);
box-shadow: var(--card-hover-shadow);
padding: 1rem;
z-index: 9000;
animation: fadeUp 0.18s;
```

Struktur:
```
.sesd-profile-menu
├── .sesd-profile-head
│   ├── .sesd-profile-av    → 56×56px, rounded 14px
│   └── div
│       ├── .sesd-profile-name
│       ├── .sesd-profile-nip  → Monospace
│       └── .sesd-profile-role → Pill badge
├── .sesd-btn.sesd-btn-primary → "Detail Profil"
├── .sesd-profile-divider      → 1px line
└── .sesd-btn.sesd-btn-danger  → "Keluar"
```

### Notification Menu (`.sesd-notif-menu`)

```css
position: fixed;
width: 320px;
max-height: 70vh;
z-index: 9000;
```

Row (`.sesd-notif-row`):
- Icon (`.sesd-notif-ic`): 30×30px, rounded 8px, primary tint
- Unread (`.is-unread`): `rgba(0,117,222,0.06)` background
- Badge (`.sesd-notif-badge`): absolute top-right, red, `16px` min-width

---

## 21. Komponen — Dashboard Greeting Hero

### Container (`.sesd-greet`)

```css
border-radius: 24px;
padding: 2rem 2.4rem;
margin-bottom: 1.5rem;
background: var(--bg-card);
/* Neumorphism shadow */
box-shadow:
  8px 8px 16px rgba(163, 177, 198, 0.45),
  -8px -8px 16px rgba(255, 255, 255, 1);
```

### Sub-elements

| Class | Style |
|---|---|
| `.sesd-greet-eyebrow` | JetBrains Mono, 0.7rem, uppercase, muted |
| `.sesd-greet-title` | 1.95rem, 800, tight tracking |
| `.sesd-greet-sub` | 0.95rem, muted, max-width 580px |
| `.sesd-greet-role` | Pill badge, primary tint, green dot |

---

## 22. Komponen — Login Page

### Layout (`.sesd-login`)

Split 2 kolom: brand pane (kiri) + form pane (kanan).

```css
.sesd-login {
  min-height: 100vh;
  display: flex;
  background:
    radial-gradient(...primary tint...),
    radial-gradient(...lighter tint...),
    var(--bg);
}
```

### Brand Pane (`.sesd-login__brandpane`)

- Logo: `max-height: 150px` (desktop: 180px)
- Title: `2.6rem`, 800 weight, `-0.03em` tracking
- Title accent: `color: var(--primary)`

### Form Card (`.sesd-login__card`)

```css
background: var(--bg-card);
border: 1px solid var(--border);
border-radius: var(--radius-xl);  /* 20px */
padding: 2.5rem;
box-shadow: var(--card-hover-shadow);
```

Submit button: full-width, pill, primary bg, glow shadow

### Mobile (≤860px)

Layout menjadi vertikal: brand di atas, form di bawah, centered.

---

## 23. Komponen — Preloader & Skeleton

### Full-page Preloader (`#sesd-preloader`)

```css
position: fixed;
inset: 0;
background: linear-gradient(135deg, #667eea, #764ba2);
z-index: 9999;
```

Spinner: `50×50px` border ring, animasi `spin 0.8s`

### Three-dot Page Loader (`.sesd-page-loader`)

```css
/* 3 dots, primary color, staggered bounce */
span { width: 12px; height: 12px; border-radius: 50%; }
animation: sesdLoaderBounce 1.4s infinite;
/* Delays: -0.32s, -0.16s, 0s */
```

### Skeleton

```css
.skeleton {
  background: linear-gradient(90deg, var(--bg-card) 25%, rgba(255,255,255,0.5) 50%, var(--bg-card) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.6s infinite;
}
```

Dark mode: gradient with `rgba(255,255,255,0.05/0.12)` stops.

### Skeleton Variants (preloader.css)

| Class | Deskripsi |
|---|---|
| `.sesd-skeleton-container` | Full-area loader with pulsing bg |
| `.sesd-skeleton-card` | Card-shaped placeholder |
| `.sesd-skeleton-text` | Text line placeholder (shimmer) |
| `.sesd-skeleton-text-short` | 60% width |
| `.sesd-skeleton-text-medium` | 80% width |
| `.sesd-skeleton-row` | Table row placeholder (staggered) |
| `.sesd-loading-dots` | "Memuat..." text with animated dots |
| `.sesd-loading-inline` | Inline "..." ellipsis for stats |

### Dashboard Load-in

```css
.dashboard-stat-card {
  opacity: 0;
  transform: translateY(10px);
  transition: opacity 0.4s, transform 0.4s;
}
.dashboard-stat-card.loaded {
  opacity: 1;
  transform: translateY(0);
}
/* Stagger: 0ms, 100ms, 200ms, 300ms, 400ms */
```

---

## 24. Komponen — Back-to-Top

### Button (`#sesd-totop-btn`)

```css
position: fixed;
bottom: 24px; right: 24px;
z-index: 8888;
width: 48px; height: 48px;
border-radius: 50%;
background: var(--glass-card);
color: var(--primary);
/* Hidden by default */
opacity: 0; visibility: hidden;
transform: translateY(14px) scale(0.8);
```

States:
- `.show` → visible, translated to position
- `:hover` → `translateY(-3px) scale(1.1)`, elevated shadow, primary border
- `:active` → `scale(0.95)`

Muncul setelah scroll > 240px. Mobile (≤768px): `bottom: 80px`, `42×42px`.

---

## 25. Sistem Ikon

### Arsitektur

```javascript
window.SESDIAN_ICONS[name]  → '<svg ...>'  // 1em, currentColor, stroke
window.SESDIAN_EMOJI[emoji] → name         // mapping legacy emoji
window.sesdIcon(name)       → '<span class="ic">svg</span>'
```

### CSS Icon Container

```css
.ic {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
  vertical-align: -0.125em;
}
.ic svg { width: 1em; height: 1em; }
```

### Daftar Lengkap Ikon (33 ikon)

| Nama | Deskripsi |
|---|---|
| `zap` | Dashboard / grid layout |
| `package` | Paket / aset |
| `tag` | Kategori / label |
| `home` | Beranda |
| `refresh` | Refresh / daftar pinjam |
| `clipboard` | Ajukan pinjam |
| `bell` | Notifikasi |
| `search` | Pencarian |
| `wrench` | Pengaturan / maintenance |
| `pin` | Lokasi / ruangan |
| `check_circle` | Verifikasi / approved |
| `user` | Profil / pengguna |
| `phone` | Telepon |
| `x` | Tutup / cancel |
| `wave` | Senyum / greeting |
| `archive` | Arsip |
| `clock` | Waktu / riwayat |
| `chart` | Laporan / grafik |
| `building` | Gedung / kantor |
| `factory` | Pabrik |
| `monitor` | Monitor / komputer |
| `chair` | Kursi / furniture |
| `car` | Kendaraan |
| `file` | Dokumen / file |
| `lock` | Keamanan / terkunci |
| `eye` | Lihat / preview |
| `idcard` | Kartu identitas |
| `mail` | Email |
| `pencil` | Edit |
| `trash` | Hapus |
| `shield` | Admin / keamanan |
| `users` | Kelola user |
| `check` | Centang / konfirmasi |

### Icon Styling dalam Konteks

- Default: `color: currentColor` (inherit)
- Sidebar nav: `1em` (expanded), `25px` (rail)
- Header buttons: `1.15rem`
- Asset card chips: `0.78rem`
- Asset availability: `0.82rem`

---

## 26. Theme Switching

### localStorage Keys

| Key | Nilai | Default |
|---|---|---|
| `sesdian_theme` | `'light'` / `'dark'` | `'light'` |
| `sesdian_textsize` | `'small'` / `'medium'` / `'large'` | `'medium'` |
| `sesdian_avatar_{nip}` | Base64 data URL | `''` |

### Mekanisme

1. **Inline `<head>` script** — membaca localStorage, set `data-theme` sebelum first paint (anti-flash)
2. **`theme.js`** — builds animated sun/moon Uiverse toggle, wires event listener
3. CSS `[data-theme="dark"]` — overrides semua token

### Toggle Widget

Animated Uiverse sun/moon switch (by Galahhad):
- Ukuran base: `--toggle-size: 8px`
- Container: `5.625em × 2.5em`
- Day state: blue sky (`#3D7EAE`) + clouds + sun
- Night state: dark (`#1D1F2C`) + stars + moon with craters
- Transition: `0.5s cubic-bezier(0, -0.02, 0.4, 1.25)`

---

## 27. Text Size Preference

### Widget (`.sesd-textsize`)

3 tombol bulat: A (kecil 0.68rem) | A (sedang 0.92rem) | A (besar 1.18rem)

```css
button {
  width: 30px; height: 30px;
  border-radius: 50%;
}
button.is-active {
  background: var(--primary);
  color: #fff;
}
```

### Effect on Root

```css
html[data-textsize="small"] { font-size: 15px; }
/* medium = browser default 16px */
html[data-textsize="large"] { font-size: 18px; }
```

Semua nilai `rem` di seluruh app otomatis skala.

---

## 28. Responsive Breakpoints

| Breakpoint | Target | Perubahan Utama |
|---|---|---|
| `≤900px` | **Tablet** | Grid 4/3 col → 2 col; sidebar panel collapse; verif chart stacked |
| `≤860px` | **Login split** | 2-col → vertical stack |
| `≤768px` | **Tablet kecil / Phone landscape** | Sidebar → fixed drawer; all grids → 1 col; font-size root → 14px; table compact; header date hidden |
| `≤640px` | **Phone** | Card tables (row → card); segfilter full-width; popups capped to viewport |
| `≤600px` | **Small phone** | Guest text-size control hidden |
| `≤480px` | **Ultra small** | Asset grid → 1 col; modal 95vh; extra compact stats |

### Mobile Sidebar

```css
@media (max-width: 768px) {
  aside {
    position: fixed;
    width: 260px;
    height: 100vh;
    transform: translateX(-100%);
    z-index: 1000;
  }
  aside.sesd-open {
    transform: translateX(0);
    box-shadow: 8px 0 40px rgba(0,0,0,0.2);
  }
}
```

### Mobile Stat Cards (Dashboard)

Layout: **2-2-1 grid** (4 cards di 2 baris, 1 di bawah centered):
- Semua card → `flex-direction: column` (icon atas, info bawah)
- Total Aset (card 1) → `grid-column: 1 / -1`, centered, 50% width

---

## 29. Aksesibilitas

### Keyboard Focus

```css
a:focus-visible,
button:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible,
.sesd-btn:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
  /* All animated elements → immediate visible state */
  .animate-fade-up, .animate-fade-in, ... {
    opacity: 1 !important;
    transform: none !important;
  }
}
```

### Smooth Scrolling

```css
@media (prefers-reduced-motion: no-preference) {
  html { scroll-behavior: smooth; }
}
```

### Touch Targets

Semua interactive element minimal `34×34px` (mobile), `38×38px` (desktop).

### ARIA Labels

- Theme toggle: `aria-label="Toggle dark mode"`
- Text-size group: `role="group"`, `aria-label="Ukuran teks"`
- Bell: `aria-label="Notifikasi"`
- Profile: `aria-label="Profil"`
- Back-to-top: `aria-label="Kembali ke atas"`

---

## 30. Status & Semantic Colors

### Peminjaman Status (app.js)

| Key | Label | BG | FG |
|---|---|---|---|
| `pending` | Pending | `#fdecd9` | `#7a3d00` |
| `approved` | Disetujui Admin | `#e3f0fb` | `#005bab` |
| `verified` | Terverifikasi | `#daf0ef` | `#1c6e6a` |
| `borrowed` | Dipinjam | `#efe5fb` | `#3a1d58` |
| `return_pending` | Menunggu Verifikasi Kembali | `#fce4ef` | `#8e2f63` |
| `returned` | Kembali | `#e2f6e7` | `#127a2b` |
| `rejected` | Ditolak | `#fbe4e4` | `#a02020` |
| `cancelled` | Dibatalkan | `#eceff3` | `#5b6472` |

### Peminjaman Status — Laporan (reports.js)

| Key | Label | Chart Color |
|---|---|---|
| `pending` | Pending | `#dd5b00` |
| `approved` | Disetujui Admin | `#0075de` |
| `verified` | Terverifikasi | `#2a9d99` |
| `borrowed` | Dipinjam | `#7b54c0` |
| `return_pending` | Menunggu Verifikasi Kembali | `#c44a8a` |
| `returned` | Kembali | `#1aae39` |
| `rejected` | Ditolak | `#e03e3e` |

### Role Meta (app.js)

| Role | Label | Ikon | Badge BG | Badge FG |
|---|---|---|---|---|
| `admin` | Admin | `shield` | `#e3f0fb` | `#005bab` |
| `verifikator` | Verifikator | `check_circle` | `#daf0ef` | `#1c6e6a` |
| `user` | User | `user` | `#eceae7` | `#615d59` |

### Role Badge CSS

| Class | Light BG | Light Color |
|---|---|---|
| `.sesd-role-admin` | `rgba(0,117,222,0.10)` | `var(--primary)` |
| `.sesd-role-user` | `rgba(100,116,139,0.1)` | `var(--text-muted)` |

---

## 31. Z-Index Stack

| Layer | Z-Index | Elemen |
|---|---|---|
| Preloader | `9999` | `#sesd-preloader`, `.sesd-toast-wrap` |
| Profile/Notif menu | `9000` | `.sesd-profile-menu`, `.sesd-notif-menu`, `.sesd-table-filter-menu` |
| Back-to-top / Theme float | `8888` | `#sesd-totop-btn`, `.sesd-theme-floating` |
| Lightbox | `1200` | `.sesd-lightbox` |
| Modal overlay | `1000` | `.sesd-overlay`, `.sesd-mobile-backdrop` |
| Sidebar drawer | `1000` | `aside` (mobile) |
| Mobile backdrop | `999` | `.sesd-mobile-backdrop` |
| Dropdown menu | `60` | `.sesd-dd-menu`, `.sesd-ac-menu` |
| Topbar sticky | `50` | `.sesd-topbar`, `[data-topbar]` |

---

## 32. Print Styles

```css
@media print {
  body { background: #fff; color: #000; }
  aside, .sesd-headbar, #sesd-totop-btn, .sesd-toast-wrap {
    display: none;
  }
}
```

---

## 33. Konvensi Penamaan CSS

### Prefix

Semua class menggunakan prefix `sesd-` (singkatan SESDIAN):

```
.sesd-{komponen}          → .sesd-btn, .sesd-modal, .sesd-overlay
.sesd-{komponen}-{sub}    → .sesd-aset-card, .sesd-aset-body
.sesd-{komponen}.is-{state} → .sesd-dd.is-open, .sesd-aset-avail.is-ok
```

### State Modifiers

| Pattern | Contoh |
|---|---|
| `.is-{state}` | `.is-active`, `.is-open`, `.is-ok`, `.is-out`, `.is-maint`, `.is-bmn`, `.is-non`, `.is-over`, `.is-unread`, `.is-exist`, `.is-new` |
| `[data-filter-active]` | Active segmented filter button |
| `.sesd-open` | Sidebar/backdrop open state |
| `.sesd-scrolled` | Topbar scrolled shadow |
| `.show` | Back-to-top visibility |
| `.loaded` | Dashboard stat card loaded |
| `.has-img` | Drop zone with preview |

### BEM-like dalam Konteks Aset Card

```
.sesd-aset-grid
.sesd-aset-card
.sesd-aset-card:hover
.sesd-aset-img
.sesd-aset-body
.sesd-aset-top
.sesd-aset-type.is-bmn
.sesd-aset-avail.is-ok
.sesd-aset-code
.sesd-aset-name
.sesd-aset-merk
.sesd-aset-chips
.sesd-aset-chip
.sesd-aset-stock
.sesd-aset-stock-row
.sesd-aset-stock-label
.sesd-aset-stock-num
.sesd-aset-bar
.sesd-aset-bar-fill
.sesd-aset-borrowed
.sesd-aset-cond
```

### Scrollbar Styling

#### Global Scrollbar

```css
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 999px; }
::-webkit-scrollbar-thumb:hover { background: rgba(0,117,222,0.35); }
```

#### Refined Scrollbar (`.sesd-scroll`)

```css
scrollbar-width: thin;
scrollbar-color: var(--border) transparent;
/* Webkit: 9px, padded pill, blue on hover/active */
```

---

> **Catatan**: Dokumen ini diekstrak langsung dari source code aktif. Selalu cross-reference dengan file CSS/JS terbaru jika ada perubahan setelah tanggal pembuatan (8 Juli 2026).
