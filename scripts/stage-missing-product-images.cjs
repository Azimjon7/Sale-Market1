'use strict';
// Downloads only the exact original URLs already recorded on the same product.
// Stages verified bytes locally; never uploads to R2 or changes catalog records.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { detectedImageType } = require('../utils/objectStorage');

(async () => {
  const output = path.resolve('artifacts/p0-handover');
  const products = JSON.parse(fs.readFileSync(path.join(output, 'public-products.json')));
  const audit = JSON.parse(fs.readFileSync(path.join(output, 'catalog-audit.json')));
  const rows = [];
  const folder = path.join(output, 'image-recovery');
  fs.mkdirSync(folder, { recursive: true });
  for (const failed of audit.failedImages) {
    const p = products.find(p => failed.productIds.includes(p.id));
    const index = p.images.indexOf(failed.url);
    const source = p.sourceImages?.[index];
    const key = new URL(failed.url).pathname.slice(1);
    const row = { productId: p.id, targetUrl: failed.url, key, sourceUrl: source,
      provenance: 'Exact same-index sourceImages entry in the public product record', status: 'unavailable' };
    if (source && new URL(source).hostname === 'media.buyo.uz') {
      try {
        const r = await fetch(source, { signal: AbortSignal.timeout(20000) });
        row.sourceStatus = r.status;
        if (r.ok) {
          const bytes = Buffer.from(await r.arrayBuffer());
          const type = detectedImageType(bytes);
          if (!type || bytes.length > 20 * 1024 * 1024) throw Error('Invalid image content or oversized image');
          const expected = path.extname(key).slice(1).toLowerCase();
          row.type = type; row.bytes = bytes.length;
          row.sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
          row.filename = `${p.id}-${index + 1}.${type === 'jpeg' ? 'jpg' : type}`;
          const destination = path.join(folder, row.filename);
          if (fs.existsSync(destination)) {
            assertSame(fs.readFileSync(destination), bytes);
          } else fs.writeFileSync(destination, bytes, { flag: 'wx' });
          row.status = expected === type || (expected === 'jpg' && type === 'jpeg') ? 'staged-same-key' : 'staged-type-mismatch-needs-review';
        }
      } catch (e) { row.error = e.message; }
    }
    rows.push(row);
  }
  const result = { checkedAt: new Date().toISOString(), productionWrites: 0, rows };
  fs.writeFileSync(path.join(output, 'image-recovery-plan.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });
function assertSame(a, b) { if (!a.equals(b)) throw Error('Existing staging file differs; preserving it'); }
