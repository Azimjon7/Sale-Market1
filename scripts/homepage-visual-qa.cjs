'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const baseUrl = process.env.HOME_QA_BASE_URL || 'http://127.0.0.1:62121';
const tag = String(process.env.HOME_QA_TAG || 'after').replace(/[^a-z0-9_-]/gi, '-');
const outputDir = path.resolve(process.env.HOME_QA_OUTPUT || '.local-tests/homepage-compact');
const browserExecutable = process.env.HOME_QA_BROWSER
  || (process.platform === 'win32' && fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : undefined);
const viewports = [
  { width: 320, height: 720 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];
const screenshotWidths = new Set([390, 1366, 1440]);

async function inspect(browser, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const consoleErrors = [];
  const httpErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push({ text: message.text(), location: message.location() });
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 400) httpErrors.push({ status: response.status(), url: response.url() });
  });

  await page.goto(`${baseUrl}/index.html`, { waitUntil: 'networkidle' });
  await page.locator('.lx-hero').waitFor();
  await page.locator('#category-grid .market-category').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(300);

  if (screenshotWidths.has(viewport.width)) {
    await page.screenshot({
      path: path.join(outputDir, `${tag}-${viewport.width}x${viewport.height}.png`),
      fullPage: false,
    });
  }

  const metrics = await page.evaluate(() => {
    const rect = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return { top: Math.round(box.top), bottom: Math.round(box.bottom), height: Math.round(box.height) };
    };
    return {
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      header: rect('.dodola-header'),
      topLine: rect('.lx-topline'),
      hero: rect('.lx-hero'),
      service: rect('.lx-service-line'),
      categories: rect('#category-section'),
      firstCategory: rect('#category-grid .market-category'),
    };
  });
  await context.close();
  return { viewport, metrics, consoleErrors, httpErrors };
}

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: browserExecutable });
  try {
    const results = [];
    for (const viewport of viewports) results.push(await inspect(browser, viewport));
    const ok = results.every((result) => (
      !result.metrics.horizontalOverflow
      && !result.consoleErrors.length
      && !result.httpErrors.length
    ));
    console.log(JSON.stringify({ ok, tag, outputDir, results }));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(JSON.stringify({ ok: false, tag, error: error.message }));
  process.exitCode = 1;
});
