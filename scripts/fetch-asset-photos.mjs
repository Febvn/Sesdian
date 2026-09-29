// Replace the generated icon cards with REAL photos per asset name, using the
// curated LEAD IMAGE of a mapped Wikipedia article (far more representative than
// raw Commons search). Output overwrites public/assets/aset/<slug>.webp (the
// conventional path db.js falls back to). Names without a mapped article, or
// whose article has no usable image, keep their icon card (run
// generate-asset-images.mjs first). Credits go to docs/asset-image-credits.json.
//
//   npm i --no-save xlsx sharp
//   node scripts/generate-asset-images.mjs   (base icons)
//   node scripts/fetch-asset-photos.mjs      (overlay real photos)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const XLSX_FILE = path.join(ROOT, 'daftar-aset 2025-1.xlsx');
const OUT_DIR = path.join(ROOT, 'public', 'assets', 'aset');
const CREDITS_FILE = path.join(ROOT, 'docs', 'asset-image-credits.json');
const UA = 'SESDIAN-asset-images/1.0 (asset management app; adi377503@gmail.com)';

// MUST stay in sync with slugAsset() in public/assets/db.js
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/* slug -> English Wikipedia article whose lead image depicts the item.
   Unmapped slugs keep the generated icon card. */
const ARTICLES = {
  'a-c-sentral': 'Air conditioning',
  'a-c-split': 'Air conditioning',
  'alat-penghancur-kertas': 'Paper shredder',
  'alat-selam-seet': 'Scuba set',
  'analytical-balance-electric': 'Analytical balance',
  'aquarium-alat-rumah-tangga-lainnya-home-use': 'Aquarium',
  'autoclave-alat-laboratorium-umum': 'Autoclave',
  'baju-pengaman-lainnya': 'Personal protective equipment',
  'bangunan-gedung-laboratorium-permanen': 'Laboratory',
  'bangunan-parkir-terbuka-semi-permanen': 'Carport',
  'blender': 'Blender',
  'brandkas': 'Safe',
  'bunsen-burner-kelengkapannya': 'Bunsen burner',
  'cctv-camera-control-television-system': 'Closed-circuit television',
  'camera-digital': 'Digital camera',
  'camera-video': 'Camcorder',
  'centrifuge-alat-laboratorium-umum': 'Laboratory centrifuge',
  'cooler-alat-laboratorium-makanan': 'Cooler',
  'deep-freezer-alat-laboratorium-kimia': 'ULT freezer',
  'deep-freezer-alat-laboratorium-pertanian': 'ULT freezer',
  'digital-keyboard-technics': 'Electronic keyboard',
  'dispenser': 'Water dispenser',
  'elisa-reader-computerized-semi-manual': 'Plate reader',
  'evaporator': 'Rotary evaporator',
  'filing-cabinet-besi': 'Filing cabinet',
  'filing-cabinet-kayu': 'Filing cabinet',
  'freezer-alat-laboratorium-patologi': 'ULT freezer',
  'gedung-pos-jaga-permanen': 'Guardhouse',
  'generator-set-lab-scale': 'Diesel generator',
  'hard-disk': 'Hard disk drive',
  'hot-plate-stirrer-alat-laboratorium-oceanografi': 'Magnetic stirrer',
  'humidity-meter': 'Hygrometer',
  'incubator-alat-laboratorium-umum': 'Incubator (culture)',
  'intermediate-telephone-key-telephone': 'Telephone',
  'jam-elektronik': 'Digital clock',
  'kamera-udara': 'Quadcopter',
  'kasur-spring-bed': 'Mattress',
  'kitchen-set': 'Kitchen cabinet',
  'kursi-besi-metal': 'Office chair',
  'lcd-projector-infocus': 'Video projector',
  'laminar-air-flow': 'Laminar flow cabinet',
  'lampu': 'Light fixture',
  'lap-top': 'Laptop',
  'lemari-asam': 'Fume hood',
  'lemari-besi-metal': 'Cabinet (furniture)',
  'lemari-es': 'Refrigerator',
  'lemari-kayu': 'Wardrobe',
  'locker': 'Locker',
  'loudspeaker': 'Loudspeaker',
  'meja-kerja-alat-laboratorium-lainnya': 'Workbench',
  'meja-kerja-besi-metal': 'Desk',
  'meja-kerja-kayu': 'Desk',
  'meja-komputer': 'Computer desk',
  'meja-rapat': 'Conference hall',
  'mesin-absensi': 'Time clock',
  'mesin-fotocopy-electronic': 'Photocopier',
  'mesin-ketik-elektronik-selektrik': 'IBM Selectric',
  'mesin-pemotong-rumput': 'Lawn mower',
  'micro-meter': 'Micrometer (device)',
  'micro-pippettes': 'Air displacement pipette',
  'microcentrifuge': 'Laboratory centrifuge',
  'microphone-table-stand': 'Microphone stand',
  'microphone-wireless-mic': 'Wireless microphone',
  'micropipette-50-200-ui': 'Air displacement pipette',
  'microscope': 'Optical microscope',
  'microscope-binocular': 'Optical microscope',
  'mimbar-podium': 'Lectern',
  'mini-bus-penumpang-14-orang-kebawah': 'Minibus',
  'mixer': 'Mixing console',
  'mixer-perkakas-bengkel-listrik': 'Concrete mixer',
  'note-book': 'Laptop',
  'oven-alat-laboratorium-pertanian': 'Laboratory oven',
  'oven-alat-laboratorium-umum': 'Laboratory oven',
  'p-c-unit': 'Desktop computer',
  'ph-meter-alat-ukur-universal': 'PH meter',
  'ph-meter-digital': 'PH meter',
  'papan-visual-papan-nama': 'Bulletin board',
  'peralatan-personal-komputer-lainnya': 'Computer keyboard',
  'pesawat-telephone': 'Telephone',
  'peta': 'World map',
  'plankton-net-alat-laboratorium-kwalitas-air-dan-tanah': 'Plankton net',
  'polymerase-chain-reactor-alat-laboratorium-pertanian': 'Thermal cycler',
  'power-supply-peralatan-studio-video-dan-film': 'Power supply',
  'printer-peralatan-personal-komputer': 'Inkjet printing',
  'propipette': 'Pipette',
  'rak-besi': 'Shelf (storage)',
  'rak-kayu': 'Bookcase',
  'refractometer-alat-laboratorium-umum': 'Refractometer',
  'refrigerator': 'Refrigerator',
  'refrigerator-freezer': 'Refrigerator',
  'scafolding-set-tool': 'Scaffolding',
  'scanner-peralatan-personal-komputer': 'Image scanner',
  'sentrifus-elektrik': 'Laboratory centrifuge',
  'sepeda-motor': 'Motorcycle',
  'server': 'Server (computing)',
  'sice': 'Couch',
  'sketsel': 'Folding screen',
  'sofa': 'Couch',
  'stabilisator': 'Voltage regulator',
  'station-wagon': 'Station wagon',
  'stomacher': 'Stomacher',
  'tv-monitor': 'Television set',
  'tabung-pemadam-api': 'Fire extinguisher',
  'tabung-van-dorn': 'Nansen bottle',
  'tangga-aluminium': 'Ladder',
  'tangki-air': 'Water tank',
  'televisi': 'Television set',
  'thermocycle': 'Thermal cycler',
  'thermometer-digital-alat-laboratorium-lainnya': 'Medical thermometer',
  'unit-power-supply': 'Uninterruptible power supply',
  'vortex-mixer-alat-laboratorium-pertanian': 'Vortex mixer',
  'waterbath-shake-still': 'Bain-marie',
};

async function wikiLeadImage(title) {
  const u = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_'));
  const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!r.ok) return null;
  const j = await r.json();
  const orig = j.originalimage && j.originalimage.source;
  const origW = (j.originalimage && j.originalimage.width) || 0;
  const thumb = j.thumbnail && j.thumbnail.source;
  if (!orig && !thumb) return null;
  // Wikimedia's thumb service only renders standard widths (250/330/500/960) for
  // anonymous clients; anything else is HTTP 400. Use the 960px thumb for large
  // originals, otherwise fetch the original file directly.
  let url;
  if (thumb && origW > 960) url = thumb.replace(/\/\d+px-/, '/960px-');
  else url = orig || thumb;
  if (!/\.(jpe?g|png|webp)(\?|$)/i.test(url)) {
    if (orig && /\.(jpe?g|png|webp)(\?|$)/i.test(orig)) url = orig; else return null;
  }
  return { url, page: (j.content_urls && j.content_urls.desktop && j.content_urls.desktop.page) || '', title: j.title || title };
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
async function download(url) {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    if (r.status === 429 && attempt < 3) { await sleep(8000 * (attempt + 1)); continue; }  // rate limited: back off
    throw new Error('HTTP ' + r.status);
  }
}

/* ---------------- run ---------------- */
const wb = XLSX.readFile(XLSX_FILE);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
const names = new Map();
for (let i = 2; i < rows.length; i++) {
  const n = String(rows[i][6] || '').trim();
  if (n && !names.has(slug(n))) names.set(slug(n), n);
}
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(path.dirname(CREDITS_FILE), { recursive: true });

const credits = fs.existsSync(CREDITS_FILE) ? JSON.parse(fs.readFileSync(CREDITS_FILE, 'utf8')) : {};
const articleCache = new Map();
let ok = 0, icon = 0, fail = 0;
for (const [key, name] of names) {
  const article = ARTICLES[key];
  if (!article) { icon++; console.log('  (icon) ' + name); continue; }
  if (credits[key]) { ok++; continue; }   // already fetched on a previous run
  try {
    let hit = articleCache.get(article);
    if (hit === undefined) { hit = await wikiLeadImage(article); articleCache.set(article, hit); await sleep(150); }
    if (!hit) { icon++; console.log('  (icon) ' + name + '  [' + article + ': no image]'); continue; }
    const buf = await download(hit.url);
    await sharp(buf)
      .resize(640, 420, { fit: 'cover', position: 'attention' })
      .webp({ quality: 80 })
      .toFile(path.join(OUT_DIR, key + '.webp'));
    credits[key] = { name, article: hit.title, source: hit.page };
    ok++;
    console.log('  foto   ' + name + '  <- ' + article);
    await sleep(700); // polite rate limit
  } catch (e) { fail++; console.log('  GAGAL  ' + name + ': ' + e.message); }
}
fs.writeFileSync(CREDITS_FILE, JSON.stringify(credits, null, 2));
console.log('\nSelesai: ' + ok + ' foto asli (Wikipedia lead image), ' + icon + ' tetap ikon, ' + fail + ' gagal.');
console.log('Kredit sumber: docs/asset-image-credits.json');
