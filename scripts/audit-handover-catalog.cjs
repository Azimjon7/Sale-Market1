'use strict';

// Read-only audit of the public catalog. Never imports production credentials.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

async function audit(base, output) {
  const origin = new URL(base).origin;
  const response = await fetch(`${origin}/api/products`, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw Error(`Catalog HTTP ${response.status}`);
  const products = await response.json();
  if (!Array.isArray(products)) throw Error('Unexpected catalog format');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'public-products.json'), JSON.stringify(products, null, 2));
  const urls = [...new Set(products.flatMap(p => [p.image, ...(Array.isArray(p.images) ? p.images : [])]).filter(Boolean))];
  const results = [];
  // Same deterministic first-120 sample as the original audit.
  for (let start = 0; start < Math.min(120, urls.length); start += 3) {
    const batch = await Promise.all(urls.slice(start, Math.min(start + 3, 120)).map(async value => {
      const url = new URL(value, origin + '/').href;
      let status = 0, bytes = null, etag = null, error = null;
      try {
        const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
        status = r.status; bytes = r.headers.get('content-length'); etag = r.headers.get('etag');
      } catch (e) { error = e.name; }
      return { url, status, bytes, etag, error, productIds: products.filter(p => p.image === value || p.images?.includes(value)).map(p => p.id) };
    }));
    results.push(...batch);
  }
  const discounts = products.filter(p => Number(p.oldPrice) > 0 && (1 - Number(p.price) / Number(p.oldPrice)) >= 0.9)
    .map(p => ({ id: p.id, name: p.name, price: p.price, oldPrice: p.oldPrice,
      discountPercent: Math.round((1 - Number(p.price) / Number(p.oldPrice)) * 10000) / 100,
      proposedChange: { price: 'KEEP_PENDING_OWNER_EVIDENCE', oldPrice: 'Verify previous genuine selling price; if unsubstantiated, propose clearing oldPrice after owner approval.' }, approved: false }));
  const variants = products.filter(p => /standart|standard|стандарт/i.test(JSON.stringify([p.sizes, p.colors])))
    .map(p => ({ id: p.id, name: p.name, sizes: p.sizes, colors: p.colors,
      proposedChange: 'Owner verifies actual selectable variants. If none, clear placeholder only after checking product_variants and inventory references. Do not invent size/color.', approved: false }));
  const report = { checkedAt: new Date().toISOString(), base: origin, productCount: products.length,
    publicCatalogSha256: crypto.createHash('sha256').update(JSON.stringify(products)).digest('hex'),
    uniqueImages: urls.length, imageSample: results, failedImages: results.filter(x => x.status < 200 || x.status >= 300),
    suspiciousDiscounts: discounts, placeholderVariants: variants, productionWrites: 0 };
  fs.writeFileSync(path.join(output, 'catalog-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ products: products.length, imageSample: results.length, failedImages: report.failedImages,
    suspiciousDiscounts: discounts.length, placeholderVariants: variants.length, output }, null, 2));
}
if (require.main === module) audit(process.argv[2] || 'https://dodola.uz', process.argv[3] || path.resolve('artifacts/p0-handover')).catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { audit };
