'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, 'artifacts', 'catalog-quality');
const sourceArg = process.argv.find(value => value.startsWith('--source='));
const source = sourceArg ? sourceArg.slice('--source='.length) : path.join(root, 'data', 'products.json');

async function loadProducts() {
  if (!/^https?:\/\//i.test(source)) return JSON.parse(fs.readFileSync(source, 'utf8'));
  const products = [];
  let page = 1;
  while (true) {
    const url = new URL('/api/products', source);
    url.searchParams.set('page', String(page));
    url.searchParams.set('limit', '100');
    url.searchParams.set('sort', 'newest');
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Catalog audit failed: HTTP ${response.status}`);
    const payload = await response.json();
    products.push(...payload.products);
    if (page >= Number(payload.meta.pages)) break;
    page += 1;
  }
  return products;
}

function csvCell(value) {
  return `"${String(value == null ? '' : value).replace(/"/g, '""')}"`;
}

(async () => {
  const products = await loadProducts();
  const rows = products.map(product => {
    const price = Number(product.price || 0);
    const oldPrice = Number(product.oldPrice || 0);
    const discountPercent = oldPrice > price && price > 0 ? Math.round((1 - price / oldPrice) * 100) : 0;
    const description = String(product.desc || product.description || '');
    const options = [...(Array.isArray(product.sizes) ? product.sizes : []), ...(Array.isArray(product.colors) ? product.colors : [])];
    const issues = [];
    if (discountPercent >= 90) issues.push('unverified_extreme_old_price');
    if (/batafsil xususiyatlarni admin panel orqali tekshiring/i.test(description)) issues.push('internal_placeholder_description');
    if (options.some(value => /^(standart|standard)$/i.test(String(value).trim()))) issues.push('meaningless_standard_variant');
    if (!product.nameRu && !product.name_ru) issues.push('russian_name_missing');
    return {
      id: product.id, sku: product.sku, name: product.name, category: product.category,
      sellingPrice: price, oldPrice, discountPercent, inventoryMode: product._inventoryMode || 'standard',
      sizes: product.sizes || [], colors: product.colors || [], issues,
      recommendedAction: issues.includes('unverified_extreme_old_price')
        ? 'Keep selling price; hide old price and badge until owner verifies historical price.'
        : issues.length ? 'Review source data; do not invent customer-facing values.' : '',
    };
  });
  const affected = rows.filter(row => row.issues.length);
  const categories = [...new Set(products.map(product => product.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'uz'));
  const report = {
    generatedAt: new Date().toISOString(), source: /^https?:\/\//i.test(source) ? new URL(source).origin : 'local-catalog',
    totals: {
      products: products.length, categories: categories.length,
      extremeOldPricesHiddenPendingReview: rows.filter(row => row.issues.includes('unverified_extreme_old_price')).length,
      placeholderDescriptionsHidden: rows.filter(row => row.issues.includes('internal_placeholder_description')).length,
      meaninglessStandardVariantsHidden: rows.filter(row => row.issues.includes('meaningless_standard_variant')).length,
      missingRussianProductNames: rows.filter(row => row.issues.includes('russian_name_missing')).length,
    },
    categories, affected,
  };
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'catalog-anomalies.json'), JSON.stringify(report, null, 2));
  const headers = ['sku','id','name','category','sellingPrice','oldPrice','discountPercent','inventoryMode','issues','recommendedAction'];
  const csv = [headers.join(','), ...affected.map(row => headers.map(key => csvCell(key === 'issues' ? row.issues.join('|') : row[key])).join(','))].join('\n');
  fs.writeFileSync(path.join(outputDir, 'catalog-anomalies.csv'), csv);
  console.log(JSON.stringify(report.totals));
  if (products.length !== 1164) process.exitCode = 2;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
