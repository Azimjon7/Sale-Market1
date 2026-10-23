'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'theme-browser-test-secret-at-least-32-characters';
process.env.ADMIN_USERNAME = 'theme-admin';
process.env.ADMIN_PASSWORD = 'theme-admin-password';
process.env.PUBLIC_WRITES_ENABLED = 'false';
process.env.STORAGE_BACKEND = 'json';

const { createApp } = require('../server');

(async () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'dodola-theme-'));
  const dataDir = path.join(fixture, 'data');
  const uploadsDir = path.join(fixture, 'uploads');
  const screenshotsDir = process.env.DODOLA_QA_SCREENSHOTS_DIR
    ? path.resolve(process.env.DODOLA_QA_SCREENSHOTS_DIR)
    : '';
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });
  if (screenshotsDir) fs.mkdirSync(screenshotsDir, { recursive: true });

  const product = {
    id: 'theme-product', sku: 'DOD-THEME-1', name: 'Tungi rejim mahsuloti',
    desc: 'Tema kontrasti va mahsulot sahifasi uchun sinov mahsuloti.',
    category: 'Aksesuarlar', price: 199000, oldPrice: 399000, stock: 10,
    image: 'img/placeholders/dodola-product.svg', images: ['img/placeholders/dodola-product.svg']
  };
  const files = {
    'products.json': [product], 'orders.json': [], 'categories.json': ['Aksesuarlar'],
    'promocodes.json': [], 'reviews.json': [], 'customers.json': [], 'auth-tokens.json': [],
    'customer-sessions.json': {}, 'identifier-counters.json': { nextSku: 2, nextOrderNumber: 1001 }
  };
  for (const [name, value] of Object.entries(files)) {
    fs.writeFileSync(path.join(dataDir, name), JSON.stringify(value));
  }

  const server = createApp({ dataDir, uploadsDir, notifyOrder: async () => {}, emailSender: async () => true })
    .listen(0, '127.0.0.1');
  await new Promise(resolve => server.on('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const installedChrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(fs.existsSync(installedChrome) ? { executablePath: installedChrome } : {})
    });
    const pages = [
      ['home', 'index.html', '#dodola-content'],
      ['catalog', 'shop.html', '.product__item'],
      ['product', 'product-details.html?id=theme-product', '.pd-title'],
      ['cart', 'shop-cart.html', 'main'],
      ['checkout', 'checkout.html', '.checkout-shell'],
      ['auth', 'auth.html', '.auth-card']
    ];
    let checks = 0;

    for (const width of [320, 390, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : 844 }, colorScheme: 'light', reducedMotion: 'reduce' });
      await context.addInitScript(() => {
        if (!localStorage.getItem('dodola_theme')) localStorage.setItem('dodola_theme', 'dark');
        localStorage.setItem('dodola_language', 'uz');
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));

      for (const [name, url, selector] of pages) {
        await page.goto(`${base}/${url}`, { waitUntil: 'domcontentloaded' });
        await page.locator(selector).first().waitFor();
        assert.strictEqual(await page.getAttribute('html', 'data-theme'), 'dark', `${name} theme at ${width}px`);
        assert.strictEqual(await page.locator('[data-theme-toggle]').isVisible(), true, `${name} toggle at ${width}px`);
        assert.strictEqual(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${name} overflow at ${width}px`);
        const colors = await page.evaluate(() => ({ body: getComputedStyle(document.body).backgroundColor, text: getComputedStyle(document.body).color }));
        assert.notStrictEqual(colors.body, 'rgb(252, 250, 247)', `${name} still uses light background`);
        assert.notStrictEqual(colors.body, colors.text, `${name} has no text contrast`);
        if (screenshotsDir && (width === 390 || width === 1440) && ['home', 'catalog', 'auth'].includes(name)) {
          await page.screenshot({ path: path.join(screenshotsDir, `${name}-dark-${width}.png`), fullPage: true });
        }
        checks += 1;
      }

      await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded' });
      await page.locator('[data-theme-toggle]').click();
      assert.strictEqual(await page.getAttribute('html', 'data-theme'), 'light');
      assert.strictEqual(await page.evaluate(() => localStorage.getItem('dodola_theme')), 'light');
      await page.goto(`${base}/shop.html`, { waitUntil: 'domcontentloaded' });
      assert.strictEqual(await page.getAttribute('html', 'data-theme'), 'light', 'theme did not persist across pages');
      checks += 3;
      await context.close();
    }

    const russian = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await russian.addInitScript(() => {
      localStorage.setItem('dodola_theme', 'dark');
      localStorage.setItem('dodola_language', 'ru');
    });
    const russianPage = await russian.newPage();
    await russianPage.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded' });
    assert.strictEqual(await russianPage.locator('[data-theme-toggle]').getAttribute('aria-label'), 'Включить светлую тему');
    await russian.close();
    console.log(`PASS: ${checks + 1} dark-mode responsive, persistence and bilingual checks`);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(fixture, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
