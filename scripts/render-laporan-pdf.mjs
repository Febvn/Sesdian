import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function exportLaporanPdf() {
  console.log('[1] Launching Playwright browser (msedge)...');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true
  });

  const page = await browser.newPage({
    viewport: { width: 1280, height: 1024 }
  });

  const htmlPath = path.resolve(__dirname, '../docs/laporan-pengujian.html');
  const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;
  console.log(`[2] Navigating to ${fileUrl}...`);

  await page.goto(fileUrl, { waitUntil: 'networkidle' });

  // Wait for sheets to exist
  await page.waitForSelector('.sheet', { timeout: 10000 });

  const sheetCount = await page.evaluate(() => {
    return document.querySelectorAll('.sheet').length;
  });
  console.log(`[3] Paginated sheets count: ${sheetCount}`);

  await page.waitForTimeout(2000); // Allow images & fonts to render completely

  const outputPath = path.resolve(__dirname, '../docs/laporan-pengujian.pdf');
  console.log(`[4] Exporting PDF to ${outputPath}...`);

  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });

  await browser.close();

  const stats = fs.statSync(outputPath);
  console.log(`[SUCCESS] Laporan Pengujian PDF generated cleanly! Size: ${(stats.size / 1024).toFixed(1)} KB`);
}

exportLaporanPdf().catch((err) => {
  console.error('[ERROR] Failed to export Laporan Pengujian PDF:', err);
  process.exit(1);
});
