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
