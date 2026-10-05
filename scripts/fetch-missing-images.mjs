// Fill the combos that still use icon cards with a real product photo found via
// image search (DuckDuckGo, no API key) using "nama aset + merk" as the query.
// Overwrites public/assets/aset/<key>.webp and updates docs/asset-image-credits.json.
//
//   npm i --no-save sharp
//   node scripts/fetch-missing-images.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'assets', 'aset');
const CREDITS_FILE = path.join(ROOT, 'docs', 'asset-image-credits.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* hand-tuned queries where nama+merk alone searches poorly */
const QUERIES = {
  'mini-bus-penumpang-14-orang-kebawah-toyota-new-kijang-innova': 'Toyota Kijang Innova putih',
  'sepeda-motor-honde-beat': 'Honda Beat motor',
  'kursi-besi-metal-ichico-bahan-oscar': 'kursi kerja kantor bahan oscar',
  'meja-komputer-expo': 'meja komputer kayu Expo',
  'kasur-spring-bed-busa-informa': 'kasur busa spring bed informa',
  'sketsel-rotan-kayu': 'sketsel penyekat ruangan rotan',
  'sketsel-kayu-lokal-pinus': 'wooden folding screen room divider',
  'publik-astari-pembatas-antrian-stainless-steel': 'tiang antrian stainless steel',
  'sofa-lokal': 'sofa ruang tamu kantor',
  'sofa-lokal-satuan': 'sofa single kantor',
  'jam-elektronik-seiko': 'jam dinding digital Seiko',
  'mesin-pemotong-rumput-stihl-fr-3001': 'STIHL FR 3001 brushcutter',
  'lemari-es-sharp': 'kulkas Sharp 2 pintu',
  'lemari-es-panasonic': 'kulkas Panasonic 2 pintu',
  'lemari-es-lg': 'kulkas LG 2 pintu',
  'micro-meter-krisbow': 'micrometer Krisbow',
  'refractometer-alat-laboratorium-umum-sperscientific': 'handheld refractometer',
  'refrigerator-freezer-gea-expo-800': 'GEA Expo 800 showcase cooler',
  'baju-pengaman-lainnya-atunas': 'Atunas wetsuit diving',
};

async function imageSearch(q) {
  // Bing Images (DuckDuckGo tidak dapat diakses dari Indonesia): the result page
  // embeds each hit as JSON in m="{...murl...}" attributes.
  const u = 'https://www.bing.com/images/search?q=' + encodeURIComponent(q) + '&form=HDRSC2&first=1&cw=1177&ch=696';
  const r = await fetch(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8' } });
  if (!r.ok) throw new Error('bing HTTP ' + r.status);
  const html = await r.text();
  const out = [];
  // Bing embeds hit JSON HTML-escaped: m="{&quot;murl&quot;:&quot;https://...&quot;,...}"
  const re = /murl&quot;:&quot;(https?:.+?)&quot;/g;
  let m;
  while ((m = re.exec(html)) && out.length < 12) {
    const url = m[1].replace(/&amp;/g, '&');
    out.push({ image: url });   // content-type is validated at download time
  }
  return out;
}

async function download(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const ct = r.headers.get('content-type') || '';
    if (ct.indexOf('image/') !== 0) throw new Error('bukan gambar: ' + ct);
    return Buffer.from(await r.arrayBuffer());
  } finally { clearTimeout(t); }
}

const credits = JSON.parse(fs.readFileSync(CREDITS_FILE, 'utf8'));
const targets = Object.entries(credits).filter(([, v]) => v.source === 'icon');
console.log('kombinasi tanpa foto:', targets.length);
let ok = 0, fail = 0;
for (const [key, v] of targets) {
  const q = QUERIES[key] || (String(v.name).replace(/\(.*?\)/g, ' ').trim() + ' ' + String(v.brand || '')).trim();
  try {
    const results = await imageSearch(q);
    let done = false;
    for (const cand of results.slice(0, 6)) {
      try {
        const buf = await download(cand.image);
        await sharp(buf).rotate().resize(640, 420, { fit: 'cover', position: 'attention' }).webp({ quality: 80 }).toFile(path.join(OUT_DIR, key + '.webp'));
        credits[key] = { name: v.name, brand: v.brand, source: cand.image, query: q };
        console.log('  foto   ' + v.name + ' | ' + (v.brand || '') + '  <- ' + q);
        ok++; done = true; break;
      } catch (e) { /* kandidat berikutnya */ }
    }
    if (!done) { console.log('  GAGAL  ' + v.name + ' (' + q + '): tidak ada kandidat yang bisa diunduh'); fail++; }
  } catch (e) { console.log('  GAGAL  ' + v.name + ' (' + q + '): ' + e.message); fail++; }
  await sleep(1200);   // sopan ke DDG
}
fs.writeFileSync(CREDITS_FILE, JSON.stringify(credits, null, 2));
console.log('\nSelesai: ' + ok + ' foto ditambahkan, ' + fail + ' tetap ikon.');
