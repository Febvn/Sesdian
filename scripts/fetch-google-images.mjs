// Foto produk untuk kombinasi (nama, merk) tanpa link Drive — dicari lewat
// GOOGLE IMAGES (dirender Chrome headless via puppeteer-core, tanpa API key),
// query dibangun dari nama aset + merk. Alur dua tahap seperti kurasi sebelumnya:
//   node scripts/fetch-google-images.mjs sheets            -> unduh kandidat + montase 2x2
//   node scripts/fetch-google-images.mjs sheets key key2   -> ulangi item tertentu saja
//   node scripts/fetch-google-images.mjs apply key=idx ... -> tulis pilihan ke public/assets/aset/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'assets', 'aset');
const CREDITS_FILE = path.join(ROOT, 'docs', 'asset-image-credits.json');
const CAND_DIR = process.env.CAND_DIR || path.join(ROOT, '.cand-google');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 19 kombinasi tanpa foto Drive di daftar 2026. Query = nama + merk apa adanya;
// hanya dibersihkan dari tanda kurung/garis miring supaya Google tidak bingung.
const TARGETS = [
  'mini-bus-penumpang-14-orang-kebawah-toyota-new-kijang-innova',
  'sepeda-motor-honde-beat',
  'kursi-besi-metal-ichico-bahan-oscar',
  'meja-komputer-expo',
  'kasur-spring-bed-busa-informa',
  'sketsel-rotan-kayu',
  'sketsel-kayu-lokal-pinus',
  'publik-astari-pembatas-antrian-stainless-steel',
  'sofa-lokal',
  'sofa-lokal-satuan',
  'jam-elektronik-seiko',
  'mesin-pemotong-rumput-stihl-fr-3001',
  'lemari-es-sharp',
  'lemari-es-panasonic',
  'lemari-es-lg',
  'micro-meter-krisbow',
  'refractometer-alat-laboratorium-umum-sperscientific',
  'refrigerator-freezer-gea-expo-800',
  'baju-pengaman-lainnya-atunas',
];
function buildQuery(v) {
  return ((v.name || '').replace(/\(.*?\)/g, ' ').replace(/[\/]/g, ' ') + ' ' + (v.brand || ''))
    .replace(/\s+/g, ' ').trim();
}

async function googleImageSearch(page, q) {
  const u = 'https://www.google.com/search?q=' + encodeURIComponent(q) + '&udm=2&hl=id&gl=id';
  await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('[data-docid]', { timeout: 15000 });
  await sleep(1200);   // biarkan data hasil selesai disuntik ke DOM
  // URL asli tiap hasil tertanam di data JS halaman sebagai ["url",tinggi,lebar]
  const html = await page.content();
  const re = /\["(https?:\/\/[^"]{10,400}?)",(\d{2,5}),(\d{2,5})\]/g;
  const seen = new Set(), out = [];
  let m;
  while ((m = re.exec(html)) && out.length < 20) {
    const url = m[1].replace(/\\u003d/g, '=').replace(/\\u0026/g, '&');
    if (/gstatic|google|ggpht|schema\.org|w3\.org/.test(url)) continue;
    if (+m[3] < 380) continue;               // buang yang lebarnya kurang
    if (seen.has(url)) continue;
    seen.add(url); out.push(url);
  }
  return out;
}
async function download(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'image/*,*/*;q=0.8' }, signal: ctrl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const ct = r.headers.get('content-type') || '';
    if (ct.indexOf('image/') !== 0) throw new Error('bukan gambar: ' + ct);
    const buf = Buffer.from(await r.arrayBuffer());
    const meta = await sharp(buf).metadata();
    if ((meta.width || 0) < 380) throw new Error('terlalu kecil: ' + meta.width);
    return buf;
  } finally { clearTimeout(t); }
}

const credits = JSON.parse(fs.readFileSync(CREDITS_FILE, 'utf8'));
const mode = process.argv[2];

if (mode === 'sheets') {
  if (!CHROME) { console.error('Chrome/Edge tidak ditemukan'); process.exit(1); }
  const only = process.argv.slice(3);
  const keys = only.length ? only : TARGETS;
  fs.mkdirSync(CAND_DIR, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--disable-blink-features=AutomationControlled', '--lang=id-ID'] });
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1280, height: 900 });
  for (const key of keys) {
    const v = credits[key];
    if (!v) { console.log('key tak dikenal: ' + key); continue; }
    const q = process.env.Q || buildQuery(v);
    const tiles = [];
    try {
      const urls = await googleImageSearch(page, q);
      for (const u of urls) {
        if (tiles.length >= 4) break;
        try {
          const buf = await download(u);
          const png = await sharp(buf).rotate().resize(430, 280, { fit: 'cover' }).png().toBuffer();
          fs.writeFileSync(path.join(CAND_DIR, key + '-' + (tiles.length + 1) + '.bin'), buf);
          fs.writeFileSync(path.join(CAND_DIR, key + '-' + (tiles.length + 1) + '.url'), u);
          tiles.push(png);
        } catch (e) { /* kandidat berikutnya */ }
      }
      console.log('google: ' + key + ' -> ' + urls.length + ' hasil, ' + tiles.length + ' kandidat  [' + q + ']');
    } catch (e) { console.log('search gagal ' + key + ': ' + e.message); }
    if (!tiles.length) continue;
    const comps = tiles.map((t, i) => ({ input: t, left: (i % 2) * 440 + 5, top: Math.floor(i / 2) * 290 + 5 }));
    const nums = tiles.map((t, i) => ({
      input: Buffer.from('<svg width="40" height="40"><rect width="40" height="40" rx="8" fill="#0075de"/><text x="20" y="28" text-anchor="middle" font-family="Arial" font-size="24" font-weight="bold" fill="#fff">' + (i + 1) + '</text></svg>'),
      left: (i % 2) * 440 + 10, top: Math.floor(i / 2) * 290 + 10,
    }));
    await sharp({ create: { width: 880, height: 590, channels: 3, background: '#ffffff' } })
      .composite(comps.concat(nums)).png().toFile(path.join(CAND_DIR, 'sheet-' + key + '.png'));
    await sleep(1000 + Math.random() * 800);
  }
  await browser.close();
  console.log('\nMontase di: ' + CAND_DIR);
} else if (mode === 'apply') {
  for (const arg of process.argv.slice(3)) {
    const [key, pick] = arg.split('=');
    const v = credits[key] || { name: key, brand: '' };
    const buf = fs.readFileSync(path.join(CAND_DIR, key + '-' + pick + '.bin'));
    const url = fs.readFileSync(path.join(CAND_DIR, key + '-' + pick + '.url'), 'utf8');
    await sharp(buf).rotate().resize(640, 420, { fit: 'cover', position: 'attention' }).webp({ quality: 80 }).toFile(path.join(OUT_DIR, key + '.webp'));
    credits[key] = { name: v.name, brand: v.brand, source: url, query: buildQuery(v), via: 'google-images' };
    console.log('foto  ' + key + ' <- kandidat ' + pick);
  }
  fs.writeFileSync(CREDITS_FILE, JSON.stringify(credits, null, 2));
  console.log('selesai — jangan lupa bump ASSET_IMG_V di public/assets/db.js');
} else {
  console.log('mode: sheets [key ...] | apply key=idx ...');
}
