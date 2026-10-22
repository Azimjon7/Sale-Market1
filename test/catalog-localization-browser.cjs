'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');
const translations = require('../utils/product-translations.ru.json');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'catalog-localization-test-secret-32-characters';
process.env.ADMIN_USERNAME = 'browser-admin';
process.env.ADMIN_PASSWORD = 'browser-admin-password';
process.env.PUBLIC_WRITES_ENABLED = 'false';
process.env.STORAGE_BACKEND = 'json';

const { createApp } = require('../server');

(async () => {
  const screenshotsDir = process.env.DODOLA_QA_SCREENSHOTS_DIR ? path.resolve(process.env.DODOLA_QA_SCREENSHOTS_DIR) : '';
  if (screenshotsDir) fs.mkdirSync(screenshotsDir, { recursive: true });
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'dodola-catalog-localization-'));
  const dataDir = path.join(fixture, 'data');
  const uploadsDir = path.join(fixture, 'uploads');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });
  const ids = Object.keys(translations).slice(0, 2);
  const russianSearchTerm = String(translations[ids[0]].name).split(/\s+/).find(word => /[А-Яа-яЁё]{4,}/.test(word));
  const products = ids.map((id, index) => ({
    id,
    sku: `DOD-QA-${index + 1}`,
    name: index ? 'Sinov ayollar sumkasi' : 'Sinov mahsuloti',
    desc: 'Mahsulotning o‘zbekcha tavsifi',
    category: 'Sumkalar',
    price: index ? 100000 : 299000,
    oldPrice: index ? 300000 : 1299000,
    stock: 9,
    image: 'img/placeholders/dodola-product.svg',
    images: ['img/placeholders/dodola-product.svg'],
  }));
  const files = {
    'products.json': products,
    'orders.json': [],
    'categories.json': ['Sumkalar'],
    'promocodes.json': [],
    'reviews.json': [],
    'customers.json': [],
    'auth-tokens.json': [],
    'customer-sessions.json': {},
    'identifier-counters.json': { nextSku: 3, nextOrderNumber: 1001 },
  };
  for (const [name, value] of Object.entries(files)) fs.writeFileSync(path.join(dataDir, name), JSON.stringify(value));

  const server = createApp({ dataDir, uploadsDir, notifyOrder: async () => {}, emailSender: async () => true }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.on('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    const installedChrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    browser = await chromium.launch({ headless: true, ...(fs.existsSync(installedChrome) ? { executablePath: installedChrome } : {}) });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.addInitScript(() => localStorage.setItem('dodola_language', 'ru'));
    await page.goto(`${base}/shop.html`, { waitUntil: 'networkidle' });
    await page.locator('.product__item').first().waitFor();
    assert.match(await page.locator('.product__item h6').first().textContent(), /[А-Яа-яЁё]/);
    const searchResult = await page.evaluate(async term => (await fetch(`/api/products?lang=ru&page=1&limit=24&search=${encodeURIComponent(term)}`)).json(), russianSearchTerm);
    assert.ok(searchResult.products.some(product => product.id === ids[0]), 'Russian API search did not return translated product');
    assert.strictEqual(await page.locator('.product__item').first().locator('.product__oldprice').count(), 0, 'anomalous old price is visible');

    const first = page.locator('.product__item').first();
    await first.locator('.js-add-card').click();
    assert.strictEqual(await first.locator('.card-cart-stepper output').textContent(), '1');
    await first.locator('.js-card-qty[data-delta="1"]').click();
    assert.strictEqual(await first.locator('.card-cart-stepper output').textContent(), '2');
    if (screenshotsDir) await page.screenshot({ path: path.join(screenshotsDir, 'catalog-390.png'), fullPage: true });
    await first.locator('.js-card-qty[data-delta="-1"]').click();
    await first.locator('.js-card-qty[data-delta="-1"]').click();
    await first.locator('.js-add-card').waitFor();

    await page.goto(`${base}/product-details.html?id=${encodeURIComponent(ids[0])}`, { waitUntil: 'networkidle' });
    assert.match(await page.locator('.pd-title').textContent(), /[А-Яа-яЁё]/);
    await page.locator('#stickyAddToCartBtn').click();
    await page.locator('#pdCartState:not([hidden])').waitFor();
    assert.strictEqual(await page.locator('#pdCartQty').textContent(), '1');
    await page.locator('#pdQtyPlus').click();
    assert.strictEqual(await page.locator('#pdCartQty').textContent(), '2');
    if (screenshotsDir) await page.screenshot({ path: path.join(screenshotsDir, 'product-390.png'), fullPage: true });
    await page.locator('#pdQtyMinus').click();
    await page.locator('#pdQtyMinus').click();
    assert.strictEqual(await page.locator('#pdCartState').getAttribute('hidden'), '');
    if (screenshotsDir) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`${base}/shop.html`, { waitUntil: 'networkidle' });
      await page.locator('.product__item').first().waitFor();
      await page.locator('.product__item').first().locator('.js-add-card').click();
      await page.screenshot({ path: path.join(screenshotsDir, 'catalog-1440.png'), fullPage: true });
      await page.goto(`${base}/product-details.html?id=${encodeURIComponent(ids[0])}`, { waitUntil: 'networkidle' });
      await page.locator('.pd-title').waitFor();
      await page.screenshot({ path: path.join(screenshotsDir, 'product-1440.png'), fullPage: true });
    }
    console.log('PASS: Russian catalog and card/detail quantity controls at 390px');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(fixture, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
