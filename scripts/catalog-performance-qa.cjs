'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const baseUrl = String(process.env.CATALOG_QA_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const label = String(process.env.CATALOG_QA_LABEL || 'catalog');
const outputDir = path.resolve(process.env.CATALOG_QA_OUTPUT || path.join(__dirname, '..', 'artifacts', 'catalog-performance'));

async function measure(browser, viewport, suffix) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const requests = [];
  page.on('response', response => {
    const url = response.url();
    if (/\/api\/(products|reviews)|\.(?:avif|webp|jpe?g|png)(?:\?|$)/i.test(url)) {
      const timing = response.request().timing();
      const headers = response.headers();
      requests.push({
        url,
        status: response.status(),
        type: response.request().resourceType(),
        durationMs: timing.responseEnd >= 0 ? Math.round(timing.responseEnd) : null,
        ttfbMs: timing.responseStart >= 0 ? Math.round(timing.responseStart) : null,
        bytes: Number(headers['content-length'] || 0) || null,
        cacheControl: headers['cache-control'] || '',
      });
    }
  });

  const started = Date.now();
  await page.goto(`${baseUrl}/shop.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const domContentLoadedMs = Date.now() - started;
  await page.locator('#shop-grid .product__item').first().waitFor({ state: 'visible', timeout: 60000 });
  const firstProductMs = Date.now() - started;
  const firstImage = page.locator('#shop-grid .d-catalog-image').first();
  await firstImage.evaluate(img => img.complete ? Promise.resolve() : new Promise(resolve => {
    img.addEventListener('load', resolve, { once: true });
    img.addEventListener('error', resolve, { once: true });
  }));
  const firstImageMs = Date.now() - started;
  await page.waitForTimeout(800);

  const browserMetrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const layoutShifts = performance.getEntriesByType('layout-shift')
      .filter(entry => !entry.hadRecentInput)
      .reduce((sum, entry) => sum + entry.value, 0);
    return {
      responseStartMs: nav ? Math.round(nav.responseStart) : null,
      domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      loadMs: nav ? Math.round(nav.loadEventEnd) : null,
      transferBytes: nav ? nav.transferSize : null,
      cards: document.querySelectorAll('#shop-grid .product__item').length,
      images: document.querySelectorAll('#shop-grid img').length,
      domNodes: document.getElementsByTagName('*').length,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      cls: Number(layoutShifts.toFixed(4)),
    };
  });

  const screenshot = path.join(outputDir, `${label}-${suffix}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });

  const repeatStarted = Date.now();
  await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.goto(`${baseUrl}/shop.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('#shop-grid .product__item').first().waitFor({ state: 'visible', timeout: 60000 });
  const repeatedFirstProductMs = Date.now() - repeatStarted;

  const firstProductHref = await page.locator('#shop-grid .product__item a').first().getAttribute('href');
  await page.goto(new URL(firstProductHref || '/index.html', `${baseUrl}/shop.html`).href, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const backStarted = Date.now();
  await page.goBack({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('#shop-grid .product__item').first().waitFor({ state: 'visible', timeout: 60000 });
  const backFirstProductMs = Date.now() - backStarted;

  await context.close();
  return {
    viewport,
    domContentLoadedMs,
    firstProductMs,
    firstImageMs,
    repeatedRoundTripFirstProductMs: repeatedFirstProductMs,
    backRoundTripFirstProductMs: backFirstProductMs,
    browserMetrics,
    requests,
    screenshot,
  };
}

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CATALOG_QA_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  try {
    const results = [];
    results.push(await measure(browser, { width: 1366, height: 768 }, '1366'));
    results.push(await measure(browser, { width: 390, height: 844 }, '390'));
    const report = { baseUrl, label, capturedAt: new Date().toISOString(), results };
    const reportPath = path.join(outputDir, `${label}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
