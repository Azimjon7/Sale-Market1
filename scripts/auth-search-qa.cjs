'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const baseUrl = String(process.env.DODOLA_QA_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const outputDir = path.resolve(process.env.DODOLA_QA_OUTPUT || path.join(__dirname, '..', 'artifacts', 'auth-search-qa'));

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.DODOLA_QA_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const report = [];
  try {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));

      await page.goto(`${baseUrl}/auth.html`, { waitUntil: 'domcontentloaded' });
      await page.locator('.password-toggle').first().waitFor();
      const toggleCount = await page.locator('.password-toggle').count();
      assert.equal(toggleCount, 3);
      assert.equal(await page.locator('#loginPassword').getAttribute('type'), 'password');
      await page.locator('.password-toggle').first().click();
      assert.equal(await page.locator('#loginPassword').getAttribute('type'), 'text');
      assert.equal(await page.locator('.password-toggle').first().getAttribute('aria-pressed'), 'true');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.screenshot({ path: path.join(outputDir, `auth-${width}.png`), fullPage: true });

      await page.goto(`${baseUrl}/shop.html`, { waitUntil: 'domcontentloaded' });
      await page.locator('#shop-grid .product__item').first().waitFor();
      await page.locator('#sct-filter-btn').click();
      const response = page.waitForResponse(item => item.url().includes('/api/products?') && item.url().includes('search=marker'));
      await page.locator('#sct-search').fill('marker');
      await response;
      await page.locator('#sct-search-suggestions:not([hidden]) a').first().waitFor();
      const suggestionCount = await page.locator('#sct-search-suggestions a').count();
      assert.ok(suggestionCount > 0 && suggestionCount <= 6);
      assert.match(await page.locator('#sct-search-suggestions a').first().getAttribute('href'), /^product-details\.html\?id=/);
      assert.equal(await page.locator('#sct-search').getAttribute('aria-expanded'), 'true');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.screenshot({ path: path.join(outputDir, `catalog-suggestions-${width}.png`), fullPage: true });

      report.push({ width, passwordToggles: toggleCount, passwordVisible: true, suggestions: suggestionCount, horizontalOverflow: false, errors });
      assert.deepEqual(errors, []);
      await context.close();
    }
    fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
