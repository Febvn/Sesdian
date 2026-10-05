// Tahap kurasi gambar untuk kombinasi tanpa foto Drive:
//   node scripts/curate-missing-images.mjs sheets   -> unduh 4 kandidat/item ke
//        scratchpad + montase 2x2 per item untuk direview secara visual
//   node scripts/curate-missing-images.mjs apply key=idx key=idx ... (idx 1-4, atau key=icon)
//        -> tulis kandidat terpilih ke public/assets/aset/<key>.webp
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { svgCard } from './asset-icons.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'assets', 'aset');
const CREDITS_FILE = path.join(ROOT, 'docs', 'asset-image-credits.json');
const CAND_DIR = process.env.CAND_DIR || path.join(ROOT, '.cand');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const QUERIES = {
  'mini-bus-penumpang-14-orang-kebawah-toyota-new-kijang-innova': 'Toyota Kijang Innova Reborn',
  'sepeda-motor-honde-beat': 'Honda BeAT sepeda motor matic',
  'kursi-besi-metal-ichico-bahan-oscar': 'kursi kerja kantor hitam oscar',
  'meja-komputer-expo': 'meja komputer kantor kayu',
  'kasur-spring-bed-busa-informa': 'kasur spring bed putih',
  'sketsel-rotan-kayu': 'sketsel penyekat ruangan rotan anyaman',
  'sketsel-kayu-lokal-pinus': 'partisi penyekat ruangan kayu lipat',
  'publik-astari-pembatas-antrian-stainless-steel': 'tiang pembatas antrian stainless',
  'sofa-lokal': 'sofa ruang tamu abu',
  'sofa-lokal-satuan': 'sofa single satu dudukan',
  'jam-elektronik-seiko': 'Seiko digital clock wall',
  'mesin-pemotong-rumput-stihl-fr-3001': 'mesin potong rumput gendong STIHL',
  'lemari-es-sharp': 'kulkas Sharp dua pintu silver',
  'lemari-es-panasonic': 'kulkas Panasonic dua pintu',
  'lemari-es-lg': 'kulkas LG dua pintu hitam',
  'micro-meter-krisbow': 'micrometer sekrup alat ukur',
  'refractometer-alat-laboratorium-umum-sperscientific': 'refractometer digital laboratorium',
  'refrigerator-freezer-gea-expo-800': 'GEA showcase cooler minuman',
  'baju-pengaman-lainnya-atunas': 'wetsuit selam lengan panjang',
};

async function imageSearch(q) {
  const u = 'https://www.bing.com/images/search?q=' + encodeURIComponent(q) + '&qft=+filterui%3Aphoto-photo&form=IRFLTR&first=1';
  const r = await fetch(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8' } });
  if (!r.ok) throw new Error('bing HTTP ' + r.status);
  const html = await r.text();
  const out = [];
  const re = /murl&quot;:&quot;(https?:.+?)&quot;/g;
  let m;
  while ((m = re.exec(html)) && out.length < 10) out.push(m[1].replace(/&amp;/g, '&'));
  return out;
}
async function download(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    if ((r.headers.get('content-type') || '').indexOf('image/') !== 0) throw new Error('bukan gambar');
    return Buffer.from(await r.arrayBuffer());
  } finally { clearTimeout(t); }
}

const mode = process.argv[2];
if (mode === 'sheets') {
  fs.mkdirSync(CAND_DIR, { recursive: true });
  for (const [key, q] of Object.entries(QUERIES)) {
    const tiles = [];
    try {
      const urls = await imageSearch(q);
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
    } catch (e) { console.log('search gagal', key, e.message); }
    if (!tiles.length) { console.log('0 kandidat: ' + key); continue; }
    const comps = tiles.map((t, i) => ({ input: t, left: (i % 2) * 440 + 5, top: Math.floor(i / 2) * 290 + 5 }));
    const nums = tiles.map((t, i) => ({
      input: Buffer.from('<svg width="40" height="40"><rect width="40" height="40" rx="8" fill="#0075de"/><text x="20" y="28" text-anchor="middle" font-family="Arial" font-size="24" font-weight="bold" fill="#fff">' + (i + 1) + '</text></svg>'),
      left: (i % 2) * 440 + 10, top: Math.floor(i / 2) * 290 + 10,
    }));
    await sharp({ create: { width: 880, height: 590, channels: 3, background: '#ffffff' } })
      .composite(comps.concat(nums)).png().toFile(path.join(CAND_DIR, 'sheet-' + key + '.png'));
    console.log('sheet: ' + key + ' (' + tiles.length + ' kandidat)  [' + q + ']');
    await sleep(900);
  }
  console.log('\nMontase di: ' + CAND_DIR);
} else if (mode === 'apply') {
  const credits = JSON.parse(fs.readFileSync(CREDITS_FILE, 'utf8'));
  for (const arg of process.argv.slice(3)) {
    const [key, pick] = arg.split('=');
    const v = credits[key] || { name: key, brand: '' };
    if (pick === 'icon') {
      const label = v.name + (v.brand ? ' ' + v.brand : '');
      await sharp(Buffer.from(svgCard(label.length > 60 ? v.name : label))).webp({ quality: 82 }).toFile(path.join(OUT_DIR, key + '.webp'));
      credits[key] = { name: v.name, brand: v.brand, source: 'icon' };
      console.log('icon  ' + key);
    } else {
      const buf = fs.readFileSync(path.join(CAND_DIR, key + '-' + pick + '.bin'));
      const url = fs.readFileSync(path.join(CAND_DIR, key + '-' + pick + '.url'), 'utf8');
      await sharp(buf).rotate().resize(640, 420, { fit: 'cover', position: 'attention' }).webp({ quality: 80 }).toFile(path.join(OUT_DIR, key + '.webp'));
      credits[key] = { name: v.name, brand: v.brand, source: url };
      console.log('foto  ' + key + ' <- kandidat ' + pick);
    }
  }
  fs.writeFileSync(CREDITS_FILE, JSON.stringify(credits, null, 2));
  console.log('selesai');
} else {
  console.log('mode: sheets | apply key=idx ...');
}
