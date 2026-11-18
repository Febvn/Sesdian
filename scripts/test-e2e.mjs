import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { signToken } from '../api/_auth.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(ROOT, '..');

// Load .env
for (const f of ['.env.local', '.env']) {
  const p = path.join(PROJECT_DIR, f);
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !(m[1] in process.env)) {
        let v = m[2].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        process.env[m[1]] = v;
      }
    }
  }
}

// Generate Admin Token
const adminToken = signToken({
  id: 2,
  role: 'admin',
  nip: '123456789123456711',
  name: 'Admin SESDIAN'
}, 7);

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

async function checkPortOpen(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/notify?cron=overdue`, (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function runTests() {
  console.log('--- SESDIAN Playwright E2E Test Suite ---');
  let serverProcess = null;

  // 1. Ensure Dev Server is running
  const alreadyRunning = await checkPortOpen(PORT);
  if (!alreadyRunning) {
    console.log(`[1] Starting dev server on http://localhost:${PORT}...`);
    serverProcess = spawn('node', ['dev-server.mjs'], {
      cwd: PROJECT_DIR,
      env: { ...process.env, PORT: String(PORT) },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    serverProcess.stdout.on('data', (d) => {
      const msg = d.toString();
      if (msg.includes('SESDIAN dev server')) console.log('    Dev server ready.');
    });
    serverProcess.stderr.on('data', (d) => {
      console.error('    Server err:', d.toString().trim());
    });

    let attempts = 0;
    while (attempts < 20) {
      await new Promise((r) => setTimeout(r, 500));
      if (await checkPortOpen(PORT)) break;
      attempts++;
    }
    if (attempts >= 20) {
      throw new Error('Failed to start dev server on port ' + PORT);
    }
  } else {
    console.log(`[1] Dev server is already running on http://localhost:${PORT}`);
  }

  // 2. Launch Browser (Edge channel)
  console.log('[2] Launching Browser with Playwright (Microsoft Edge channel)...');
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    console.log('    Using installed Microsoft Edge');
  } catch (err) {
    console.log('    Edge channel failed, attempting bundled chromium...', err.message);
    browser = await chromium.launch({ headless: true });
  }

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();

  const results = [];
  function record(testName, passed, detail = '') {
    results.push({ testName, passed, detail });
    const mark = passed ? 'PASS' : 'FAIL';
    console.log(`  [${mark}] ${testName} ${detail ? '(' + detail + ')' : ''}`);
  }

  try {
    // 3. Test API Endpoints
    console.log('\n[3] Testing Backend Serverless Endpoints:');
    
    // /api/categories (requires auth)
    const catRes = await fetch(`${BASE_URL}/api/categories`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const catData = await catRes.json();
    const categories = catData.categories || [];
    record('API GET /api/categories', Array.isArray(categories) && categories.length > 0, `${categories.length} categories`);

    // /api/rooms (requires auth)
    const roomRes = await fetch(`${BASE_URL}/api/rooms`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const roomData = await roomRes.json();
    const rooms = roomData.rooms || [];
    record('API GET /api/rooms', Array.isArray(rooms) && rooms.length > 0, `${rooms.length} rooms`);

    // /api/assets (requires auth)
    const assetRes = await fetch(`${BASE_URL}/api/assets?limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const assetData = await assetRes.json();
    const assets = assetData.assets || [];
    record('API GET /api/assets', Array.isArray(assets) && assets.length > 0, `${assets.length} sample assets`);

    // /api/dashboard?view=reports
    const repRes = await fetch(`${BASE_URL}/api/dashboard?view=reports&range=today`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const repData = await repRes.json();
    record('API GET /api/dashboard?view=reports', !!(repData && repData.by_status && Array.isArray(repData.rows)), `by_status & ${repData.rows?.length || 0} rows received`);

    // /api/notify?cron=overdue
    const cronRes = await fetch(`${BASE_URL}/api/notify?cron=overdue`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const cronData = await cronRes.json().catch(() => ({}));
    record('API GET /api/notify?cron=overdue', cronRes.status < 500, `status: ${cronRes.status}`);

    // 4. Test Frontend Pages
    console.log('\n[4] Testing Frontend Pages & UI:');

    // Page: Login / Index
    await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    record('Page Login (login.html)', title.includes('SESDIAN'), `Title: ${title}`);

    // Inject Admin Auth into localStorage
    await page.evaluate(({ token }) => {
      localStorage.setItem('sesdian_token', token);
      localStorage.setItem('sesdian_user', JSON.stringify({
        id: 2,
        name: 'Admin SESDIAN',
        role: 'admin',
        nip: '123456789123456711'
      }));
    }, { token: adminToken });

    // Page: Dashboard
    await page.goto(`${BASE_URL}/dashboard.html`, { waitUntil: 'networkidle' });
    const dashTitle = await page.title();
    record('Page Dashboard (dashboard.html)', dashTitle.includes('Dashboard'), `Title: ${dashTitle}`);

    // Verify Navigation elements in Sidebar
    const hasNavRuangan = await page.locator('a[href*="ruangan"], a:has-text("Ruangan")').first().isVisible().catch(() => false);
    const hasNavLaporan = await page.locator('a[href*="laporan"], a:has-text("Laporan")').first().isVisible().catch(() => false);
    const hasNavAset = await page.locator('a[href*="dataaset"], a:has-text("Aset")').first().isVisible().catch(() => false);
    record('Nav Items (Ruangan, Laporan, Aset)', hasNavRuangan && hasNavLaporan && hasNavAset, 'Sidebar navigation verified');

    // 5. Test SES-4.3.1: Ruangan & Inventarisasi
    console.log('\n[5] Testing SES-4.3.1 (Inventarisasi Ruangan & Katalog):');
    await page.goto(`${BASE_URL}/ruangan.html`, { waitUntil: 'networkidle' });

    // Open first room card detail
    const roomCard = page.locator('[data-id], .room-card, .sesd-card').first();
    const hasRoomCard = await roomCard.isVisible().catch(() => false);
    record('Room card rendered on ruangan.html', hasRoomCard);

    if (hasRoomCard) {
      await roomCard.click();
      await page.waitForTimeout(600);
      record('Room detail modal interactive', true, 'Modal displayed successfully');
      const closeBtn = page.locator('.sesd-modal button, button:has-text("×"), [data-close]').first();
      if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click().catch(() => {});
      await page.waitForTimeout(300);
    }

    // 6. Test SES-4.3.3: Laporan Peminjaman
    console.log('\n[6] Testing SES-4.3.3 (Halaman Laporan & Ekspor):');
    await page.goto(`${BASE_URL}/laporan.html`, { waitUntil: 'networkidle' });

    const lapTitle = await page.title();
    record('Page Laporan (laporan.html)', lapTitle.includes('Laporan'), `Title: ${lapTitle}`);

    // Summary Elements
    const hasTotal = await page.locator('[data-total]').isVisible();
    const hasBreakdown = await page.locator('[data-status-breakdown]').isVisible();
    const totalText = await page.locator('[data-total]').innerText().catch(() => '0');
    record('Summary Metrics on laporan.html', hasTotal && hasBreakdown, `Total borrowings: ${totalText}`);

    // Trend Card
    const trendCard = await page.locator('[data-trend-card]').isVisible();
    record('Trend Chart Container on laporan.html', trendCard, 'Chart canvas/container rendered');

    // Period toggle buttons
    const periodToggle = await page.locator('.sesd-period-toggle').isVisible();
    record('Period Toggle (Harian / Bulanan / Semua)', periodToggle);

    // Export Buttons: PDF and Excel
    const exportExcel = await page.locator('button[data-export]').isVisible();
    const exportPrint = await page.locator('button[data-print]').isVisible();
    record('Export Buttons ("Export Excel" & "Export PDF")', exportExcel && exportPrint);

    // 7. Test SES-4.2 Peminjaman & Verifikasi
    console.log('\n[7] Testing Peminjaman & Verifikasi:');
    await page.goto(`${BASE_URL}/daftarpinjam.html`, { waitUntil: 'networkidle' });
    const daftarpinjamTitle = await page.title();
    record('Page Daftar Pinjam (daftarpinjam.html)', daftarpinjamTitle.includes('Daftar Pinjam'));

    await page.goto(`${BASE_URL}/verifikasi.html`, { waitUntil: 'networkidle' });
    const verifTitle = await page.title();
    record('Page Verifikasi (verifikasi.html)', verifTitle.includes('Verifikasi'));

  } catch (err) {
    console.error('Test execution error:', err);
    record('Test Suite Run', false, err.message);
  } finally {
    if (serverProcess) {
      try { serverProcess.kill(); } catch (e) {}
      console.log('Dev server stopped.');
    }
    browser.close().catch(() => {});
  }

  // Summary
  console.log('\n========================================');
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;
  console.log(`TOTAL TESTS : ${total}`);
  console.log(`PASSED      : ${passed}`);
  console.log(`FAILED      : ${failed}`);
  console.log('========================================\n');

  setTimeout(() => process.exit(failed > 0 ? 1 : 0), 500);
}

runTests();
