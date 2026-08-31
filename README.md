# SESDIAN — Asset Management

Lightweight **static** rebuild of the SESDIAN asset-management UI. No framework, no
build step, no server — plain HTML/CSS/JS that deploys anywhere (Vercel, GitHub Pages,
any static host). The whole site is ~190 KB and loads instantly, replacing the original
Laravel + React build that shipped a 1.1 MB JS bundle on every page.

## Pages
| File | Purpose |
|------|---------|
| `index.html` | Entry — redirects to dashboard or login based on session |
| `login.html` / `register.html` | Authentication (NIP + password, stored in `localStorage`) |
| `dashboard.html` | Overview: stats, stock monitor, recent borrowings |
| `dataaset.html` | Asset list with search + type/status filters |
| `asetdetail.html` | Single asset detail |
| `kategoriaset.html` | Asset categories |
| `ruangan.html` | Rooms |
| `daftarpinjam.html` | Borrowings list with search + status filters |
| `ajukanpinjam.html` | Submit a borrowing request |

## Shared assets
- `assets/app.css` — design tokens + animations (from the original design system)
- `assets/app.js` — client runtime: auth/session, search, filtering, navigation, toasts

## Run locally
Just open `index.html` in a browser, or serve the folder:

```bash
npx serve .
# or
python -m http.server
```

## Deploy
- **Vercel:** import this repo — `vercel.json` enables clean URLs (`/dashboard`). No build command needed.
- **GitHub Pages:** enable Pages on the repo root.

## Demo login
Any NIP + password works. NIP `123456789012345678` signs in as the demo user
"Adi Septriansyah".
