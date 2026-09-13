import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const outDir = path.resolve(process.cwd(), 'screenshots');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const pagesToCapture = [
  { name: '01_homepage.png', url: 'http://127.0.0.1:3000/' },
  { name: '02_products_catalog.png', url: 'http://127.0.0.1:3000/products' },
  { name: '03_product_detail.png', url: 'http://127.0.0.1:3000/products/1' },
  { name: '04_admin_dashboard.png', url: 'http://127.0.0.1:3000/admin/' },
  { name: '05_admin_catalog.png', url: 'http://127.0.0.1:3000/admin/catalog' },
  { name: '06_admin_settings.png', url: 'http://127.0.0.1:3000/admin/settings' },
];

(async () => {
  console.log('Starting headless browser to capture app screenshots...');
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

    for (const item of pagesToCapture) {
      console.log(`Navigating to ${item.url}...`);
      try {
        await page.goto(item.url, { waitUntil: 'networkidle2', timeout: 15000 });
        // Wait a small moment for animations / state to settle
        await new Promise((r) => setTimeout(r, 1500));
        const dest = path.join(outDir, item.name);
        await page.screenshot({ path: dest, fullPage: false });
        console.log(`Saved screenshot: ${dest}`);
      } catch (err) {
        console.error(`Error capturing ${item.name}:`, err.message || err);
      }
    }

    console.log('All screenshots captured successfully!');
  } catch (err) {
    console.error('Puppeteer launch failed:', err);
  } finally {
    if (browser) await browser.close();
  }
})();
