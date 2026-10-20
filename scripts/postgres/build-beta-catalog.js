'use strict';
// Offline preparation only: never connects to a database or modifies source data.
const fs = require('fs');
const path = require('path');
const { loadSource, validateSource, summarize, rowChecksum } = require('./sourceSnapshot');

function buildCatalog(source) {
  if (source.products.length !== 1164) throw new Error('Expected the complete 1,164-product catalog.');
  const testOrders = new Set(source.orders.map(order => String(order.id)));
  const products = source.products.map(original => {
    const product = structuredClone(original);
    const history = product.stockHistory || [];
    const initial = history.filter(m => m.type === 'initial_setup');
    const testMoves = history.filter(m => m.type !== 'initial_setup');
    // Fail closed if the ledger contains genuine/manual adjustments or unknown orders.
    if (initial.length !== 1 || initial[0].orderId || Number(initial[0].oldBalance) !== 0 ||
        testMoves.some(m => !['order_reserved', 'order_committed'].includes(m.type) || !testOrders.has(String(m.orderId)))) {
      throw new Error(`Inventory ledger requires manual reconciliation: ${product.id}`);
    }
    const baseline = Number(initial[0].newBalance);
    if (!Number.isSafeInteger(baseline) || baseline < 0 || baseline !== Number(initial[0].change) ||
        baseline !== Number(product.available) + Number(product.reserved) + Number(product.sold) || Number(product.returned) !== 0) {
      throw new Error(`Inventory totals do not reconcile: ${product.id}`);
    }
    product.available = baseline;
    product.stock = baseline;
    product.reserved = 0;
    product.sold = 0;
    product.returned = 0;
    product.stockHistory = initial;
    return product;
  });
  const skuNumbers = products.map(p => /^DOD-(\d+)$/.exec(p.sku)).map(match => {
    if (!match) throw new Error('SKU format requires manual reconciliation.');
    return Number(match[1]);
  });
  const counters = { nextProductSku: Math.max(...skuNumbers) + 1, nextOrderNumber: 1001 };
  const clean = { products, categories: structuredClone(source.categories), customers: [], orders: [], tokens: [],
    sessions: {}, counters, inventoryState: { applied: true, inventoryVersion: 1, productCount: products.length }, promoCodes: [], reviews: [] };
  const errors = validateSource(clean);
  if (errors.length) throw new Error(errors.join('\n'));
  return clean;
}

function writeCatalog(sourceDir, destination) {
  const source = loadSource(sourceDir);
  const clean = buildCatalog(source);
  // Existing exports and backups are never overwritten.
  fs.mkdirSync(destination, { recursive: false, mode: 0o700 });
  const files = { 'products.json': clean.products, 'categories.json': clean.categories, 'orders.json': [], 'customers.json': [],
    'auth-tokens.json': [], 'customer-sessions.json': {}, 'identifier-counters.json': clean.counters, 'inventory-state.json': clean.inventoryState,
    'promocodes.json': [], 'reviews.json': [] };
  for (const [name, value] of Object.entries(files)) fs.writeFileSync(path.join(destination, name), JSON.stringify(value), { flag: 'wx', mode: 0o600 });
  const exported = loadSource(destination);
  const report = { catalogChecksum: rowChecksum({ products: clean.products, categories: clean.categories }), counts: summarize(exported),
    excluded: { customers: source.customers.length, orders: source.orders.length, authTokens: source.tokens.length },
    inventoryPolicy: 'Restore only reconciled initial ledger balances; remove disposable test order movements. These catalog balances are not a guarantee of supplier availability. Admin confirmation remains mandatory.',
    immutableCatalogFieldsVerified: source.products.every((p, i) => {
      const omit = value => Object.fromEntries(Object.entries(value).filter(([key]) => !['available','reserved','sold','returned','stock','stockHistory'].includes(key)));
      return rowChecksum(omit(p)) === rowChecksum(omit(clean.products[i]));
    }) };
  if (!report.immutableCatalogFieldsVerified) throw new Error('Catalog fields changed.');
  fs.writeFileSync(path.join(destination, 'catalog-manifest.json'), JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 });
  return report;
}

if (require.main === module) {
  const [sourceDir, destination] = process.argv.slice(2);
  if (!sourceDir || !destination) throw new Error('Usage: node scripts/postgres/build-beta-catalog.js SOURCE_DIR NEW_OUTPUT_DIR');
  console.log(JSON.stringify(writeCatalog(path.resolve(sourceDir), path.resolve(destination)), null, 2));
}
module.exports = { buildCatalog, writeCatalog };
