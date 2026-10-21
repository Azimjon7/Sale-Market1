'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const baseUrl = String(process.env.CATALOG_QA_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const outputDir = path.resolve(process.env.CATALOG_QA_OUTPUT || path.join(__dirname, '..', 'artifacts', 'catalog-responsive'));
const widths = process.env.CATALOG_QA_INTERACTIONS_ONLY === '1' ? [] : [360, 390, 430, 768, 1366, 1440, 1920];

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CATALOG_QA_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const reportPath = path.join(outputDir, 'catalog-responsive-report.json');
  let report = [];
  if (process.env.CATALOG_QA_INTERACTIONS_ONLY === '1' && fs.existsSync(reportPath)) {
    try { report = JSON.parse(fs.readFileSync(reportPath, 'utf8')).filter(row => !row.interactions); } catch (_) {}
  }
  try {
    for (const width of widths) {
      const height = width <= 430 ? 844 : width === 768 ? 1024 : width === 1366 ? 768 : 900;
      const context = await browser.newContext({ viewport: { width, height } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => {
        if (response.status() >= 400 && !/favicon\.ico(?:\?|$)/.test(response.url())) errors.push(`${response.status()} ${response.url()}`);
      });
      await page.goto(`${baseUrl}/shop.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.locator('#shop-grid .product__item').first().waitFor({ state: 'visible', timeout: 15000 });
      await page.waitForTimeout(300);
      const metrics = await page.evaluate(() => ({
        cards: document.querySelectorAll('#shop-grid .product__item').length,
        columns: getComputedStyle(document.querySelector('#shop-grid')).gridTemplateColumns.split(' ').length,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        titleSize: getComputedStyle(document.querySelector('.sm-catalog-intro h1')).fontSize,
        heroHeight: Math.round(document.querySelector('.sm-catalog-intro').getBoundingClientRect().height),
        toolbarHeight: Math.round(document.querySelector('.sct-bar').getBoundingClientRect().height),
        eagerImages: document.querySelectorAll('#shop-grid img[loading="eager"]').length,
        lazyImages: document.querySelectorAll('#shop-grid img[loading="lazy"]').length,
        duplicateIds: (() => { const ids=[...document.querySelectorAll('#shop-grid .js-add-card')].map(x=>x.dataset.id); return ids.length-new Set(ids).size; })(),
      }));
      assert.equal(metrics.cards, 24);
      assert.equal(metrics.horizontalOverflow, false);
      assert.equal(metrics.duplicateIds, 0);
      assert.ok(metrics.heroHeight < (width <= 430 ? 150 : 180), `hero is too tall at ${width}px`);
      await page.screenshot({ path: path.join(outputDir, `catalog-${width}.png`), fullPage: width === 390 || width === 1440 });
      report.push({ width, height, ...metrics, errors });
      assert.deepEqual(errors, []);
      await context.close();
    }

    if (process.env.CATALOG_QA_WIDTHS_ONLY === '1') {
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/shop.html`, { waitUntil: 'domcontentloaded' });
    await page.locator('#shop-grid .product__item').first().waitFor();
    const initialIds = await page.locator('#shop-grid .js-add-card').evaluateAll(nodes => nodes.map(node => node.dataset.id));
    await page.locator('.catalog-load-more__button').click();
    await page.waitForFunction(() => document.querySelectorAll('#shop-grid .product__item').length === 48);
    const loadedIds = await page.locator('#shop-grid .js-add-card').evaluateAll(nodes => nodes.map(node => node.dataset.id));
    assert.equal(new Set(loadedIds).size, 48);
    assert.deepEqual(loadedIds.slice(0, 24), initialIds);

    await page.locator('#sct-filter-btn').click();
    let searchResponse = page.waitForResponse(response => response.url().includes('/api/products?') && response.url().includes('search=marker'));
    await page.locator('#sct-search').fill('marker');
    await searchResponse;
    await page.locator('#shop-grid .product__item').first().waitFor();
    const latinCount = await page.locator('#shop-grid .product__item').count();
    assert.ok(latinCount > 0 && latinCount <= 24);
    searchResponse = page.waitForResponse(response => response.url().includes('/api/products?') && decodeURIComponent(response.url()).includes('search=маркер'));
    await page.locator('#sct-search').fill('маркер');
    await searchResponse;
    await page.locator('#shop-grid .product__item').first().waitFor();
    const cyrillicCount = await page.locator('#shop-grid .product__item').count();
    assert.ok(cyrillicCount > 0 && cyrillicCount <= 24);
    await page.goto(`${baseUrl}/shop.html`, { waitUntil: 'domcontentloaded' });
    await page.locator('#shop-grid .product__item').first().waitFor();

    await page.evaluate(() => {
      const category = [...document.querySelectorAll('.filter-btn')].find(button => button.dataset.category === 'Uy jihozlari');
      category.click();
    });
    await page.waitForTimeout(500);
    assert.match(await page.locator('.sm-catalog-intro h1').textContent(), /Uy jihozlari/);
    const sortResponse = page.waitForResponse(response => response.url().includes('/api/products?') && response.url().includes('sort=price_asc'));
    await page.evaluate(() => {
      document.querySelectorAll('.filter-btn').forEach(button => button.classList.remove('active'));
      const all = document.querySelector('.filter-btn[data-category=""]');
      all.classList.add('active');
      const sort = document.getElementById('shop-sort');
      sort.value = 'price_asc';
      sort.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await sortResponse;
    await page.waitForFunction(() => {
      const prices = [...document.querySelectorAll('#shop-grid .product__price')]
        .map(node => Number((node.childNodes[0].textContent || '').replace(/[^0-9]/g, '') || 0));
      return prices.length === 24 && prices.every((price, index) => index === 0 || prices[index - 1] <= price);
    });
    const prices = await page.locator('#shop-grid .product__price').evaluateAll(nodes => nodes.map(node => Number((node.childNodes[0].textContent || '').replace(/[^0-9]/g, '') || 0)));
    assert.equal(prices.length, 24);
    assert.deepEqual(prices, [...prices].sort((a, b) => a - b));

    const productHref = await page.locator('#shop-grid .product__item h6 a').first().getAttribute('href');
    const detailResponse = await page.request.get(new URL(productHref, `${baseUrl}/shop.html`).href);
    assert.equal(detailResponse.status(), 200);
    await page.locator('#shop-grid .js-add-card').first().click();
    assert.notEqual(await page.locator('.js-cart-count').first().textContent(), '0');
    await page.locator('[data-language-select]').selectOption('ru');
    assert.equal(await page.locator('html').getAttribute('lang'), 'ru');
    report.push({ interactions: { pagination: 48, uniqueProducts: 48, latinSearch: latinCount, cyrillicSearch: cyrillicCount,
      category: 'Uy jihozlari', productLink: detailResponse.status(), addToCart: true, russianInterface: true } });
    await context.close();
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
