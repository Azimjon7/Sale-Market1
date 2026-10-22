'use strict';

const assert = require('assert');
const rules = require('../js/product-rules');
const { translations, localizeProduct, matchingProductIds } = require('../utils/productTranslations');
const { PostgresCatalogRepository } = require('../utils/postgres/catalogRepository');

const translationEntries = Object.entries(translations);
assert.strictEqual(translationEntries.length, 1164, 'every catalog product needs a Russian translation');
for (const [id, translation] of translationEntries) {
  assert.ok(translation.name && /[А-Яа-яЁё]/.test(translation.name), `Russian name missing: ${id}`);
  const product = { id, name: `O‘zbekcha nom ${id}`, description: 'O‘zbekcha tavsif' };
  const translated = localizeProduct(product, 'ru');
  assert.strictEqual(translated.name, translation.name, `Russian name not applied: ${id}`);
  assert.strictEqual(translated.nameUz, product.name, `Uzbek source name lost: ${id}`);
  assert.strictEqual(localizeProduct(product, 'uz'), product, `Uzbek product mutated: ${id}`);
}

const [firstId, firstTranslation] = translationEntries[0];
const russianNeedle = String(firstTranslation.name).split(/\s+/).find(word => /[А-Яа-яЁё]{4,}/.test(word));
assert.ok(russianNeedle && matchingProductIds(russianNeedle).includes(firstId), 'Russian search index does not find translated product');

assert.strictEqual(rules.discount({ price: 100000, oldPrice: 300000 }).visible, true, 'valid 3x comparison price should remain visible');
const anomaly = rules.discount({ price: 299000, oldPrice: 1299000 });
assert.strictEqual(anomaly.visible, false, 'extreme comparison price should be hidden');
assert.strictEqual(anomaly.anomalous, true, 'extreme comparison price should be marked anomalous');

(async () => {
  const calls = [];
  const pool = { query: async (sql, params) => {
    calls.push({ sql, params });
    return /count\(\*\)/.test(sql) ? { rows: [{ value: '0' }] } : { rows: [] };
  } };
  await new PostgresCatalogRepository(pool).listProductsPage({ page: 1, limit: 24, search: russianNeedle, searchIds: [firstId] });
  const catalogQuery = calls.find(call => /ORDER BY/.test(call.sql));
  assert.ok(catalogQuery && /p\.id=ANY\(/.test(catalogQuery.sql), 'translated product IDs are not included in PostgreSQL search');
  assert.ok(catalogQuery.params.some(value => Array.isArray(value) && value.includes(firstId)), 'translated search IDs are not bound safely');
  console.log(`PASS: ${translationEntries.length} Russian product translations, Russian/PostgreSQL search and comparison-price guard`);
})().catch(error => { console.error(error); process.exitCode = 1; });
