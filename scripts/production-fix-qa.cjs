'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const baseUrl = String(process.env.DODOLA_QA_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const outputDir = path.resolve(process.env.DODOLA_QA_OUTPUT || path.join(__dirname, '..', 'artifacts', 'production-fix'));

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CATALOG_QA_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const report = { baseUrl, capturedAt: new Date().toISOString(), product: {}, contact: {}, catalog: {} };
  try {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${baseUrl}/product-details.html?id=buyo_lora`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.locator('.pd-title').waitFor({ state: 'visible', timeout: 30000 });
      const quality = await page.evaluate(() => ({
        title: document.querySelector('.pd-title')?.textContent.trim(),
        standardSelectors: [...document.querySelectorAll('.pd-chip')].filter(node => /^(standart|standard)$/i.test(node.textContent.trim())).length,
        oldPriceVisible: Boolean(document.querySelector('.pd-old-price')),
        extremeBadgeVisible: [...document.querySelectorAll('.pd-img-badge--discount')].some(node => /-(9\d|100)%/.test(node.textContent)),
        placeholderVisible: /admin panel orqali tekshiring/i.test(document.body.innerText),
        availability: document.querySelector('.pd-img-badge--stock')?.textContent.trim(),
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      }));
      quality.errors = errors;
      report.product[width] = quality;
      await page.screenshot({ path: path.join(outputDir, `lora-${width}.png`), fullPage: true });
      await context.close();
    }

    const contactContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const contact = await contactContext.newPage();
    await contact.goto(`${baseUrl}/contact.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    report.contact = await contact.evaluate(() => ({
      maps: document.querySelectorAll('iframe[src*="google.com/maps"],a[href*="google.com/maps"]').length,
      officialTelegramLinks: [...document.querySelectorAll('a[href*="t.me/"]')].map(link => link.href),
      phoneVisible: document.body.innerText.includes('+998 99 002 00 15'),
    }));
    await contactContext.close();

    const catalogContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const catalog = await catalogContext.newPage();
    await catalog.route(/\.(?:webp|png|jpe?g|avif)(?:\?|$)/i, route => route.abort());
    await catalog.goto(`${baseUrl}/shop.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await catalog.locator('#shop-grid .product__item').first().waitFor({ timeout: 30000 });
    const total = Number((await catalog.locator('#shop-count').textContent()).match(/\d+/)?.[0] || 0);
    let previous = 0;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const count = await catalog.locator('#shop-grid .product__item').count();
      if (count >= total) break;
      await catalog.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await catalog.waitForFunction(oldCount => document.querySelectorAll('#shop-grid .product__item').length > oldCount, count, { timeout: 15000 });
      previous = count;
    }
    report.catalog = await catalog.evaluate(expected => {
      const ids = [...document.querySelectorAll('#shop-grid .js-add-card')].map(node => node.dataset.id);
      return { expected, rendered: ids.length, unique: new Set(ids).size, duplicates: ids.length - new Set(ids).size };
    }, total);
    report.catalog.previousCheckpoint = previous;
    await catalogContext.close();

    const failures = [];
    for (const [width, row] of Object.entries(report.product)) {
      if (row.standardSelectors || row.oldPriceVisible || row.extremeBadgeVisible || row.placeholderVisible || row.horizontalOverflow || row.errors.length) failures.push(`product-${width}`);
      if (!/Buyurtma asosida/.test(row.availability || '')) failures.push(`availability-${width}`);
    }
    if (report.contact.maps || !report.contact.phoneVisible || report.contact.officialTelegramLinks.some(link => !/DodolaSupportBot/.test(link))) failures.push('contact');
    if (report.catalog.expected !== 1164 || report.catalog.rendered !== 1164 || report.catalog.unique !== 1164 || report.catalog.duplicates) failures.push('catalog');
    report.failures = failures;
    fs.writeFileSync(path.join(outputDir, 'production-fix-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    if (failures.length) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
