'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { marketplaceFixture } = require('./marketplace-fixture.cjs');

test('public SEO routes expose canonical product metadata without exposing private pages', async () => {
  const ctx = await marketplaceFixture({ readOnly: true });
  try {
    const robots = await request(ctx.app).get('/robots.txt').expect(200);
    assert.match(robots.text, /Sitemap: https:\/\/dodola\.uz\/sitemap\.xml/);
    assert.match(robots.text, /Disallow: \/admin\.html/);

    const sitemap = await request(ctx.app).get('/sitemap.xml').expect(200);
    assert.match(sitemap.text, /<loc>https:\/\/dodola\.uz\/p\/p1<\/loc>/);
    assert.doesNotMatch(sitemap.text, /admin\.html|account\.html|checkout\.html/);

    const product = await request(ctx.app).get('/p/p1').expect(200);
    assert.match(product.text, /<link rel="canonical" href="https:\/\/dodola\.uz\/p\/p1">/);
    assert.match(product.text, /property="og:type" content="product"/);
    assert.match(product.text, /application\/ld\+json/);
    assert.match(product.text, /window\.DODOLA_PRODUCT_ID="p1"/);
    // Nested canonical routes must load the same dependencies as the legacy page.
    // A 200 HTML response alone previously missed eight /p/js/* 404s.
    for (const route of ['/p/p1', '/product-details.html?id=p1']) {
      const page = await request(ctx.app).get(route).expect(200);
      const baseHref = page.text.match(/<base\s+href="([^"]+)"/i)?.[1];
      assert.equal(baseHref, '/');
      assert(page.text.indexOf('<base ') < page.text.indexOf('<script '));
      const base = new URL(baseHref, `https://dodola.uz${route}`);
      const scripts = [...page.text.matchAll(/<script\s+src="([^"]+)"/g)].map(m => new URL(m[1], base));
      assert(scripts.some(url => url.pathname === '/js/helpers.js'));
      assert(scripts.findIndex(url => url.pathname === '/js/product-rules.js') < scripts.findIndex(url => url.pathname === '/js/helpers.js'));
      assert(scripts.findIndex(url => url.pathname === '/js/helpers.js') < scripts.findIndex(url => url.pathname === '/js/store.js'));
      for (const script of scripts) {
        const asset = await request(ctx.app).get(script.pathname).expect(200);
        assert.match(asset.headers['content-type'], /javascript/);
      }
      assert.match(page.text, /window\.location\.pathname \+ window\.location\.search \+ '#dodola-content'/);
      assert.match(page.text, /window\.location\.pathname\.match\(\/\^\\\/p\\\//);
      assert.match(page.text, /MBHelpers dependency is unavailable/);
      assert.match(page.text, /Product request timed out/);
      assert.match(page.text, /renderLoadError\(\)/);
    }
    await request(ctx.app).get('/p/does-not-exist').expect(404);

    for (const page of ['/returns.html', '/privacy.html', '/terms.html']) {
      await request(ctx.app).get(page).expect(200).expect('X-Content-Type-Options', 'nosniff');
    }
  } finally { await ctx.close(); }
});

test('bundled assets have correct MIME and anonymous analytics stores only allowlisted aggregate data', async () => {
  const ctx = await marketplaceFixture({ readOnly: true });
  try {
    const css = await request(ctx.app).get('/css/storefront-catalog.bundle.css').expect(200);
    assert.match(css.headers['content-type'], /^text\/css/);
    assert.match(css.headers['cache-control'], /max-age=300/);

    await request(ctx.app).post('/api/analytics/events')
      .send({ event: 'search', subjectId: 'catalog' }).expect(204);
    await request(ctx.app).post('/api/analytics/events')
      .send({ event: 'unknown', subjectId: 'catalog' }).expect(400);
    await request(ctx.app).post('/api/analytics/events')
      .send({ event: 'search', subjectId: 'phone=+998901234567' }).expect(400);
    const count = await ctx.pool.query("SELECT event_count FROM storefront_events_daily WHERE event_name='search' AND subject_id='catalog'");
    assert.equal(Number(count.rows[0].event_count), 1);
  } finally { await ctx.close(); }
});
