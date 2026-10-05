// Shared icon-card renderer for asset illustrations (extracted from the 2025 generator).
export const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/* ---------------- icons (24x24 stroke paths, feather-style) ---------------- */
export const ICONS = {
  snowflake: '<path d="M12 2v20M4 6l16 12M20 6L4 18M12 6l-3-2m3 2 3-2M12 18l-3 2m3-2 3 2M6.5 7.5 6 4m.5 3.5L3 8.5M17.5 7.5 18 4m-.5 3.5L21 8.5M6.5 16.5 3 15.5m3.5 1L6 20M17.5 16.5l3.5-1m-3.5 1 .5 3.5"/>',
  cabinet: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M10 6h4M10 12h4M10 18h4"/>',
  shelves: '<path d="M4 3v18M20 3v18M4 8h16M4 14h16M4 20h16"/>',
  chair: '<path d="M6 11V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6"/><path d="M5 11h14a1 1 0 0 1 1 1v3H4v-3a1 1 0 0 1 1-1zM6 15v6M18 15v6"/>',
  sofa: '<path d="M5 10V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3"/><path d="M3 13a2 2 0 0 1 4 0v1h10v-1a2 2 0 0 1 4 0v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM5 19v2M19 19v2"/>',
  desk: '<path d="M3 7h18v2H3zM5 9v10M19 9v10M5 13h6v6"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/>',
  laptop: '<rect x="5" y="4" width="14" height="10" rx="1.5"/><path d="M3 18h18l-2-4H5z"/>',
  printer: '<path d="M7 8V3h10v5"/><rect x="4" y="8" width="16" height="8" rx="1.5"/><path d="M7 16v5h10v-5"/><path d="M17 11h.5"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  projector: '<rect x="3" y="8" width="18" height="8" rx="2"/><circle cx="16" cy="12" r="2.2"/><path d="M6 11h4M6 13h4M7 16v3M17 16v3"/>',
  fridge: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M6 9h12M9 5v2M9 12v3"/>',
  fan: '<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1.5-6 4-6 2 0 2.5 3-1 5m-5 5c-4 0-6-1.5-6-4 0-2 3-2.5 5 1m5 5c0 4-1.5 6-4 6-2 0-2.5-3 1-5m5-5c4 0 6 1.5 6 4 0 2-3 2.5-5-1"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 1 4 10.5c-.8.7-1 1.5-1 2.5h-6c0-1-.2-1.8-1-2.5A6 6 0 0 1 12 3z"/>',
  speaker: '<rect x="6" y="2" width="12" height="20" rx="2"/><circle cx="12" cy="15" r="3.5"/><circle cx="12" cy="7" r="1.5"/>',
  mic: '<rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4M9 21h6"/>',
  server: '<rect x="4" y="3" width="16" height="7" rx="1.5"/><rect x="4" y="14" width="16" height="7" rx="1.5"/><path d="M8 6.5h.5M8 17.5h.5M12 6.5h4M12 17.5h4"/>',
  hdd: '<rect x="3" y="8" width="18" height="8" rx="2"/><circle cx="8" cy="12" r="2"/><path d="M14 12h4"/>',
  tv: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="m8 2 4 4 4-4"/>',
  car: '<path d="M4 15V11l2-5h12l2 5v4"/><path d="M3 15h18v3h-2M3 15v3h2m0 0a2 2 0 1 0 4 0m-4 0a2 2 0 1 1 4 0m6 0a2 2 0 1 0 4 0m-4 0a2 2 0 1 1 4 0m-10 0h6M7 11h10"/>',
  bike: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16 9 9h5m-4.5 7H14l2.5-7H19M9 9 7.5 6H5"/>',
  building: '<rect x="5" y="3" width="14" height="18"/><path d="M9 7h2m2 0h2M9 11h2m2 0h2M9 15h2m2 0h2M11 21v-3h2v3"/>',
  flask: '<path d="M10 3v6L4.5 18a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9V3M8 3h8M7.5 14h9"/>',
  microscope: '<path d="M9 3h4v7a3 3 0 0 1-3 3h-1zM11 3v10M6 21h12M8 21a7 7 0 0 0 10-6c0-2-1-3.5-2.5-4.5M9 17h4"/>',
  balance: '<path d="M12 3v18M8 21h8M12 6h7m-7 0H5m0 0-2.5 6a3.5 3.5 0 0 0 7 0zm14 0-2.5 6a3.5 3.5 0 0 0 7 0z"/>',
  gauge: '<path d="M4 19a9 9 0 1 1 16 0"/><path d="m12 14 4-5"/><circle cx="12" cy="15" r="1.5"/>',
  thermometer: '<path d="M10 4a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z"/><path d="M12 9v6"/>',
  flame: '<path d="M12 2s5 4.5 5 9.5a5 5 0 0 1-10 0c0-2 1-4 2.5-5.5C10 7.5 12 5 12 2z"/><path d="M12 22a3.5 3.5 0 0 1-2-6.5c.5 1 1.5 1.5 2 1.5 0-1.5.5-2.5 1.5-3.5A3.5 3.5 0 0 1 12 22z"/>',
  oven: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 8h16M8 5.5h.5M12 5.5h.5M16 5.5h.5"/><rect x="8" y="12" width="8" height="5" rx="1"/>',
  zapbox: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="m13 7-4 6h3l-1 4 4-6h-3z"/>',
  plug: '<path d="M9 3v5m6-5v5M7 8h10v3a5 5 0 0 1-10 0zM12 16v5"/>',
  safe: '<rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="12" cy="12" r="4"/><path d="M12 8v2m0 4v2m4-4h-2m-4 0H8M19 6l1.5-1.5M19 18l1.5 1.5"/>',
  bed: '<path d="M3 18V8m0 6h18v4M3 14V8m18 6v-3a3 3 0 0 0-3-3H10v6"/><circle cx="6.5" cy="10.5" r="1.5"/>',
  utensils: '<path d="M7 3v7a2 2 0 0 1-2 2m2-2a2 2 0 0 0 2-2V3M7 12v9M16 3c-1.5 1-2.5 3-2.5 5.5 0 2 1 3.5 2.5 3.5s2.5-1.5 2.5-3.5C18.5 6 17.5 4 16 3zm0 9v9"/>',
  board: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v2m-4 3 4-3 4 3M7 8h6M7 11h10"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zm0 0v14m6-12v14"/>',
  ladder: '<path d="M8 3v18M16 3v18M8 7h8M8 12h8M8 17h8"/>',
  droplet: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M9.5 14a2.5 2.5 0 0 0 2.5 2.5"/>',
  extinguisher: '<rect x="8" y="8" width="8" height="13" rx="2.5"/><path d="M10 8V6h4v2m-2-2V3m0 0H8L5 5"/><path d="M15 3h3"/>',
  music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  shirt: '<path d="m9 3-5 3 2 4 2-1v12h8V9l2 1 2-4-5-3a3 3 0 0 1-6 0z"/>',
  fish: '<path d="M3 12s4-6 10-6c4 0 8 3 8 6s-4 6-8 6c-6 0-10-6-10-6z"/><circle cx="16" cy="11" r=".8"/><path d="M3 12 6 9m-3 3 3 3"/>',
  leaf: '<path d="M5 21c0-9 4-15 14-16 0 10-4 15-12 15"/><path d="M5 21c2-5 5-8 10-10"/>',
  badge: '<circle cx="12" cy="9" r="4"/><path d="m8.5 12.5-1.5 8 5-2.5 5 2.5-1.5-8"/>',
  spinner: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2"/><path d="M12 3.5V8m6 8.5L14 14M5.5 16.5 10 14"/>',
  package: '<path d="m12 3 8 4v10l-8 4-8-4V7z"/><path d="m4 7 8 4 8-4M12 11v10"/>',
};

/* keyword rules, first match wins (checked against the lowercased name) */
export const RULES = [
  [/a\.?c\.?[ s]|air conditioner/, 'snowflake'],
  [/penghancur kertas/, 'printer'],
  [/microscope|mikroskop/, 'microscope'],
  [/balance|timbangan/, 'balance'],
  [/thermometer|termometer/, 'thermometer'],
  [/meter|refractometer/, 'gauge'],
  [/bunsen|burner/, 'flame'],
  [/oven|incubator|autoclave|waterbath|drat chamber|thermocycle/, 'oven'],
  [/freezer|kulkas|lemari es|refrigerator|cooler/, 'fridge'],
  [/centrifuge|sentrifus|stirrer|vortex|mixer|blender|stomacher/, 'spinner'],
  [/pippet|pipette|propipette|micro tic|saring|solvent|filtration|elisa|laminar|evaporator|polymerase|colony|laboratorium|lab scale/, 'flask'],
  [/plankton|van dorn|sampler|tangki air|selam/, 'droplet'],
  [/aquarium/, 'fish'],
  [/kamera|camera|cctv/, 'camera'],
  [/projector|infocus|proyektor/, 'projector'],
  [/lap ?top|note ?book/, 'laptop'],
  [/p\.?c |p\.?c$|komputer|computer/, 'monitor'],
  [/printer|scanner|fotocopy|mesin ketik/, 'printer'],
  [/hard disk|harddisk/, 'hdd'],
  [/server/, 'server'],
  [/televisi|tv monitor|^tv | tv$/, 'tv'],
  [/telephone|telepon|telpon|pabx|fax/, 'phone'],
  [/loudspeaker|speaker|sound system|amplifier/, 'speaker'],
  [/microphone|wireless mic|megaphone/, 'mic'],
  [/keyboard technics|piano|organ/, 'music'],
  [/power supply|stabilisator|stavolt|ups|splitter/, 'plug'],
  [/generator|genset/, 'zapbox'],
  [/lampu|lamp/, 'bulb'],
  [/jam elektronik|jam dinding/, 'clock'],
  [/absensi/, 'badge'],
  [/exhause|exhaust|kipas|fan/, 'fan'],
  [/brandkas|brankas|locker/, 'safe'],
  [/filing cabinet|lemari|laci|cabinet/, 'cabinet'],
  [/rak /, 'shelves'],
  [/kursi/, 'chair'],
  [/sofa|sice/, 'sofa'],
  [/meja/, 'desk'],
  [/kasur|spring bed|bed/, 'bed'],
  [/kitchen|dapur/, 'utensils'],
  [/dispenser/, 'droplet'],
  [/papan|whiteboard|visual|mimbar|podium|sketsel|pembatas antrian|astari|bracket|standing/, 'board'],
  [/peta$|peta /, 'map'],
  [/tangga|scafolding|scaffolding/, 'ladder'],
  [/pemadam api/, 'extinguisher'],
  [/mini bus|station wagon|mobil|bus /, 'car'],
  [/sepeda|motor(?!ola)/, 'bike'],
  [/bangunan|gedung|tanah|parkir|pos jaga/, 'building'],
  [/pemotong rumput|taman/, 'leaf'],
  [/baju|pakaian|wearpack/, 'shirt'],
];

export const ACCENTS = [
  ['#0075de', '#e3f0fb'], // blue
  ['#2a9d99', '#daf0ef'], // teal
  ['#7b54c0', '#ece3f8'], // purple
  ['#dd5b00', '#fbe9dc'], // orange
  ['#1aae39', '#ddf3e1'], // green
  ['#c44a8a', '#f8e3ee'], // pink
];

export function pickIcon(name) {
  const n = ' ' + name.toLowerCase() + ' ';
  for (const [re, icon] of RULES) if (re.test(n)) return icon;
  return 'package';
}
export function hashAccent(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}
export const escXml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function wrapName(name) {
  const MAX = 30;
  const words = name.split(/\s+/);
  const lines = [''];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if (cur && (cur + ' ' + w).length > MAX) lines.push(w);
    else lines[lines.length - 1] = cur ? cur + ' ' + w : w;
  }
  if (lines.length > 2) { lines.length = 2; lines[1] = lines[1].slice(0, MAX - 1) + '…'; }
  return lines;
}

export function svgCard(name) {
  const [accent, accentLight] = hashAccent(name);
  const icon = ICONS[pickIcon(name)];
  const lines = wrapName(name);
  const fs1 = Math.max(...lines.map((l) => l.length)) > 26 ? 26 : 30;
  const textY = lines.length === 2 ? 316 : 336;
  const text = lines.map((l, i) =>
    `<text x="320" y="${textY + i * (fs1 + 10)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fs1}" font-weight="700" fill="#37352f">${escXml(l)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">
  <rect width="640" height="420" fill="#f7f6f3"/>
  <circle cx="320" cy="150" r="210" fill="${accentLight}" opacity="0.55"/>
  <circle cx="588" cy="30" r="90" fill="${accentLight}" opacity="0.4"/>
  <circle cx="52" cy="392" r="70" fill="${accentLight}" opacity="0.4"/>
  <rect x="236" y="62" width="168" height="168" rx="34" fill="#ffffff" stroke="#e8e6e1" stroke-width="2"/>
  <g transform="translate(272 98) scale(4)" fill="none" stroke="${accent}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${icon}</g>
  ${text}
</svg>`;
}

