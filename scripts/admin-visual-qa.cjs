'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const baseUrl = process.env.ADMIN_QA_BASE_URL || 'http://127.0.0.1:62121';
const username = process.env.ADMIN_QA_USERNAME;
const password = process.env.ADMIN_QA_PASSWORD;
const outputDir = path.resolve(process.env.ADMIN_QA_OUTPUT || '.local-tests/admin-luxury');
const browserExecutable = process.env.ADMIN_QA_BROWSER
  || (process.platform === 'win32' && fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : undefined);

if (!username || !password) {
  throw new Error('ADMIN_QA_USERNAME and ADMIN_QA_PASSWORD are required.');
}

const pages = [
  ['dashboard', '#menuDashboard', '#sectionDashboard'],
  ['products', '#menuProducts', '#sectionProducts'],
  ['add-product', '#menuAdd', '#sectionAdd'],
  ['orders', '#menuOrders', '#sectionOrders'],
  ['categories', '#menuCategories', '#sectionCategories'],
  ['settings', '#menuSettings', '#sectionSettings'],
];

async function login(page) {
  await page.goto(`${baseUrl}/admin.html`, { waitUntil: 'networkidle' });
  await page.getByLabel('Login').fill(username);
  await page.getByLabel('Parol').fill(password);
  await page.getByRole('button', { name: 'Kirish' }).click();
  await page.locator('#adminApp:not(.hidden)').waitFor();
  await page.locator('#statProducts').waitFor();
}

async function captureViewport(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const consoleErrors = [];
  const httpErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      httpErrors.push({ status: response.status(), url: response.url() });
    }
  });
  await login(page);

  const suffix = `${viewport.width}x${viewport.height}`;
  for (const [name, buttonSelector, sectionSelector] of pages) {
    if (viewport.width <= 900) {
      const sidebar = page.locator('.sidebar');
      if (!(await sidebar.evaluate((node) => node.classList.contains('sidebar--open')))) {
        await page.locator('#adminMobileBrand').click();
      }
    }
    await page.locator(buttonSelector).click();
    await page.locator(`${sectionSelector}:not(.hidden)`).waitFor();
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(outputDir, `${name}-${suffix}.png`), fullPage: false });
  }

  if (viewport.width <= 900) await page.locator('#adminMobileBrand').click();
  await page.locator('#menuProducts').click();
  await page.locator('#productsList .js-edit-product').first().click();
  await page.locator('#sectionAdd:not(.hidden)').waitFor();
  await page.screenshot({ path: path.join(outputDir, `edit-product-${suffix}.png`), fullPage: false });

  if (viewport.width <= 900) await page.locator('#adminMobileBrand').click();
  await page.locator('#menuOrders').click();
  if (viewport.width <= 900) {
    await page.locator('#ordersList .order-compact-row').first().click();
  } else {
    await page.locator('#ordersList .js-order-detail').first().click();
  }
  await page.locator('#orderDetailOverlay:not(.hidden)').waitFor();
  await page.screenshot({ path: path.join(outputDir, `order-detail-${suffix}.png`), fullPage: false });

  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
    overflowing: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  }));
  await context.close();
  return { viewport, overflow, consoleErrors, httpErrors };
}

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: browserExecutable });
  try {
    const results = [];
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      results.push(await captureViewport(browser, viewport));
    }
    console.log(JSON.stringify({
      ok: results.every((r) => !r.overflow.overflowing && !r.consoleErrors.length && !r.httpErrors.length),
      outputDir,
      results,
    }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exitCode = 1;
});
