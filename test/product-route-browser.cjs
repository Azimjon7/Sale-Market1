'use strict';
// Production HTML/JS and public catalog, isolated local JSON storage, no live writes.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const rules = require('../js/product-rules');

const evidence = path.resolve('artifacts/p0-handover');
const products = JSON.parse(fs.readFileSync(path.join(evidence, 'public-products.json')));
const expectBroken = process.argv.includes('--expect-broken');
const runDir = fs.mkdtempSync(path.join(evidence, expectBroken ? 'baseline-' : 'browser-'));
const dataDir = path.join(runDir, 'data');
const uploadsDir = path.join(runDir, 'uploads');
fs.mkdirSync(dataDir); fs.mkdirSync(uploadsDir);
for (const [name, value] of Object.entries({ products, orders: [], customers: [], reviews: [], promocodes: [],
  categories: [...new Set(products.map(p => p.category))], 'auth-tokens': [], 'customer-sessions': {},
  'identifier-counters': { nextSku: 99999, nextOrderNumber: 1001 } })) {
  fs.writeFileSync(path.join(dataDir, `${name}.json`), JSON.stringify(value));
}
Object.assign(process.env, { NODE_ENV: 'test', JWT_SECRET: 'isolated-p0-browser-secret-32-characters-long',
  ADMIN_USERNAME: 'local-test', ADMIN_PASSWORD: 'local-test-only', PUBLIC_WRITES_ENABLED: 'false',
  STORAGE_BACKEND: 'json', FILE_STORAGE_BACKEND: 'local', PAYMENT_MODE: 'disabled' });
const app = require('../server').createApp({ dataDir, uploadsDir, notifyOrder: async () => {}, env: { ...process.env } });

(async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined });
  const report = { node: process.version, base, productionWrites: 0, runDir, checks: [], errors: [], failedAssets: [] };
  try {
    const selected = ['buyo_amulet-moneta-schastya', 'buyo_light-domik', 'buyo_nakidnalob'];
    const variant = products.find(p => rules.options(p.sizes, 'size').length > 1 && rules.availability(p).purchasable);
    if (variant) selected.push(variant.id);
    if (!expectBroken) {
      const failureContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      await failureContext.route('**/js/helpers.js', route => route.abort());
      const failurePage = await failureContext.newPage();
      await failurePage.goto(`${base}/p/${selected[0]}`, { waitUntil: 'domcontentloaded' });
      await failurePage.locator('.pd-error[role="alert"]').waitFor({ timeout: 10000 });
      assert(!((await failurePage.locator('#productDetailApp').innerText()).includes('Yuklanmoqda')));
      report.checks.push({ name: 'dependency-failure-is-finite-and-actionable', viewport: { width: 390, height: 844 }, passed: true });
      await failureContext.close();
    }
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 360, height: 800 }]) {
      const context = await browser.newContext({ viewport, isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
      // Disallow any browser POST to production or third-party services.
      await context.route('**/*', route => {
        const request = route.request();
        if (!request.url().startsWith(base + '/') && !['GET', 'HEAD'].includes(request.method())) return route.abort();
        return route.continue();
      });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      page.on('pageerror', e => report.errors.push({ viewport, error: e.message }));
      page.on('response', r => {
        if (r.status() >= 400 && /\.(js|css)(\?|$)/.test(r.url())) report.failedAssets.push({ url: r.url(), status: r.status() });
      });
      if (expectBroken) {
        await page.goto(`${base}/p/${selected[0]}`, { waitUntil: 'networkidle' });
        assert(report.errors.some(x => /MBHelpers is not defined/.test(x.error)), 'Original error must reproduce');
        await page.screenshot({ path: path.join(evidence, 'product-before.png'), fullPage: true });
        report.checks.push({ name: 'original-regression-reproduced', passed: true });
        await context.close();
        break;
      }
      const viewportProducts = viewport.width === 360 ? selected.slice(0, 2) : selected;
      for (const id of viewportProducts) {
        const product = products.find(p => p.id === id);
        for (const routePath of [`/p/${id}`, `/product-details.html?id=${id}`]) {
          await page.goto(base + routePath, { waitUntil: 'domcontentloaded' });
          await page.locator('.pd-title').waitFor();
          assert.equal(await page.locator('.pd-title').textContent(), product.name);
          assert.equal(Number((await page.locator('.pd-price').textContent()).replace(/\D/g, '')), Number(product.price));
          assert.equal(await page.locator('#addToCartBtn').isEnabled(), rules.availability(product).purchasable);
          const sizeChips = page.locator('.pd-chip[data-group="size"]');
          assert.equal(await sizeChips.count(), rules.options(product.sizes, 'size').length);
          if (await sizeChips.count() > 1) await sizeChips.nth(1).click();
          const colorChips = page.locator('.pd-chip[data-group="color"]');
          if (await colorChips.count() > 1) await colorChips.nth(1).click();
          await page.locator('#pdMainImage').evaluate(img => img.decode().catch(() => {}));
          const image = await page.locator('#pdMainImage').evaluate(img => ({ src: img.currentSrc, loaded: img.complete && img.naturalWidth > 0, fallback: Boolean(img.dataset.dodolaFallback) }));
          assert(image.loaded, 'Product image or existing fallback must load');
          assert(!image.fallback, `Main image missing for ${id}`);
          // New browser context per viewport; clear only this test-origin cart between products.
          await page.evaluate(() => localStorage.removeItem('mujskoy_cart'));
          await page.reload({ waitUntil: 'domcontentloaded' });
          await page.locator('.pd-title').waitFor();
          const sizes = page.locator('.pd-chip[data-group="size"]');
          if (await sizes.count() > 1) await sizes.nth(1).click();
          const colors = page.locator('.pd-chip[data-group="color"]');
          if (await colors.count() > 1) await colors.nth(1).click();
          const selectedSize = await sizes.count() ? await page.locator('.pd-chip[data-group="size"].active').textContent() : '';
          const selectedColor = await colors.count() ? await page.locator('.pd-chip[data-group="color"].active').textContent() : '';
          await page.locator(viewport.width < 500 ? '#stickyAddToCartBtn' : '#addToCartBtn').click();
          const cart = await page.evaluate(() => JSON.parse(localStorage.getItem('mujskoy_cart') || '[]'));
          assert.equal(cart.length, 1); assert.equal(cart[0].productId, id); assert.equal(cart[0].qty, 1);
          assert.equal(cart[0].size, selectedSize.trim()); assert.equal(cart[0].color, selectedColor.trim());
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
          assert.equal(overflow, false, `Horizontal overflow at ${viewport.width} ${id}`);
          await page.reload({ waitUntil: 'domcontentloaded' });
          await page.locator('.pd-title').waitFor();
          const reloadedSizes = page.locator('.pd-chip[data-group="size"]');
          if (await reloadedSizes.count() > 1) await reloadedSizes.nth(1).click();
          const reloadedColors = page.locator('.pd-chip[data-group="color"]');
          if (await reloadedColors.count() > 1) await reloadedColors.nth(1).click();
          assert.equal((await page.locator('#pdCartQty').textContent()).trim(), '1');
          report.checks.push({ name: 'detail-price-image-variant-cart-refresh', viewport, route: routePath, passed: true });
          console.log(`PASS ${viewport.width} ${routePath}`);
        }
      }
      await page.screenshot({ path: path.join(evidence, `product-after-${viewport.width}.png`), fullPage: true });
      // Header/footer/mobile navigation must not resolve below /p/.
      const badLinks = await page.locator('a[href]').evaluateAll(links => links.filter(a => new URL(a.href).pathname.startsWith('/p/') && /\.html$/.test(new URL(a.href).pathname)).map(a => a.href));
      assert.deepEqual(badLinks, []);
      const catalogNav = viewport.width < 500
        ? page.locator('#mb-bottom-nav a').filter({ hasText: 'Katalog' })
        : page.locator('.dodola-header a[data-nav-page="shop"]');
      await catalogNav.click();
      await page.waitForURL('**/shop.html');
      await page.locator('a[href^="/p/"]').first().click();
      await page.locator('.pd-title').waitFor();
      await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
      await page.locator('a[href^="/p/"]').first().click();
      await page.locator('.pd-title').waitFor();
      if (viewport.width < 500) {
        await page.locator('#mb-bottom-nav a').filter({ hasText: 'Katalog' }).click();
        await page.waitForURL('**/shop.html');
        const mobileSearch = page.locator('input[type="search"]:visible').first();
        await mobileSearch.fill('Astronavt');
        await mobileSearch.press('Enter');
      } else {
        await page.locator('.dodola-search input').fill('Astronavt');
        await page.locator('.dodola-search button').click();
      }
      await page.waitForURL(url => url.pathname === '/shop.html' && (url.searchParams.get('search') || url.searchParams.get('q')) === 'Astronavt', { waitUntil: 'domcontentloaded' });
      await page.locator('a[href^="/p/"]').first().click();
      await page.locator('.pd-title').waitFor();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('.pd-title').waitFor();
      await page.locator(viewport.width < 500 ? '#stickyBuyNowBtn' : '#buyNowBtn').click();
      await page.waitForURL('**/checkout.html');
      assert((await page.locator('body').innerText()).includes('Buyurtma'));
      report.checks.push({ name: 'header-catalog-home-search-direct-refresh-buy-now-checkout', viewport, passed: true });
      await page.screenshot({ path: path.join(evidence, `checkout-after-${viewport.width}.png`), fullPage: true });
      await context.close();
    }
    if (!expectBroken) { assert.deepEqual(report.errors, []); assert.deepEqual(report.failedAssets, []); }
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed'; report.failure = error.stack; process.exitCode = 1;
  } finally {
    fs.writeFileSync(path.join(evidence, expectBroken ? 'browser-baseline.json' : 'browser-results.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    await browser.close(); await new Promise(resolve => server.close(resolve));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
