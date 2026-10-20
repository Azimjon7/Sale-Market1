'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildCatalog } = require('../scripts/postgres/build-beta-catalog');
const { validateTarget } = require('../scripts/postgres/initialize-beta-test');
const { rowChecksum } = require('../scripts/postgres/sourceSnapshot');
// The test suite remains runnable from the clean Git checkout without private data.
const source = () => ({ products: Array.from({ length:1164 }, (_,i) => ({ id:`product-${i}`,sku:`DOD-${String(i+1).padStart(4,'0')}`,
  name:'Synthetic catalog product',price:100000,oldPrice:150000,category:'Test category',images:['uploads/synthetic.webp'],
  colors:['Black'],sizes:['M'],_inventoryMode:'made-to-order',_acceptsMTO:true,available:i===0?14:15,stock:i===0?14:15,
  reserved:i===0?1:0,sold:0,returned:0,stockHistory:[{type:'initial_setup',orderId:null,oldBalance:0,newBalance:15,change:15},
    ...(i===0?[{type:'order_reserved',orderId:'test-order',change:-1}]:[])] })),
  categories:['Test category'],customers:[{id:'test-customer'}],orders:[{id:'test-order'}],tokens:[{id:'test-token'}],
  sessions:{ synthetic:{} },promoCodes:[],reviews:[] });

test('complete catalog retains prices, variants and images, excluding all test identities/orders', () => {
  const original = source(), before = rowChecksum(original), clean = buildCatalog(original);
  assert.equal(clean.products.length, 1164);
  assert.equal(rowChecksum(original), before);
  for (const key of ['customers','orders','tokens','promoCodes','reviews']) assert.equal(clean[key].length, 0);
  assert.deepEqual(clean.sessions, {});
  assert.ok(clean.counters.nextProductSku > Math.max(...clean.products.map(p => Number(p.sku.slice(4)))));
  assert.equal(clean.counters.nextOrderNumber, 1001);
  assert.deepEqual(clean.categories, original.categories);
  for (const [i, p] of clean.products.entries()) {
    for (const field of ['id','sku','price','oldPrice','images','colors','sizes','_inventoryMode','_acceptsMTO']) assert.deepEqual(p[field], original.products[i][field]);
    assert.equal(p.reserved, 0); assert.equal(p.sold, 0);
    assert.equal(p.stockHistory.length, 1);
    assert.equal(p.stockHistory[0].orderId, null);
  }
});
test('incomplete catalog cannot be prepared', () => {
  const s = source(); s.products.pop(); assert.throws(() => buildCatalog(s), /complete/);
});
test('unexplained inventory differences or unknown movements stop export', () => {
  let s = source(); s.products[0].available++; assert.throws(() => buildCatalog(s), /reconcile/);
  s = source(); s.products[0].stockHistory.push({ type:'manual_adjustment', change:1 });
  assert.throws(() => buildCatalog(s), /manual reconciliation/);
  s = source(); s.products[0].stockHistory.push({ type:'order_reserved', orderId:'unknown-order' });
  assert.throws(() => buildCatalog(s), /manual reconciliation/);
});
test('import refuses production database, remote targets and open public writes', () => {
  const safe={PGHOST:'localhost',PGDATABASE:'dodola_pg15_test_20261020',PGUSER:'dodola_app',BETA_TEST_IMPORT_APPROVED:'yes',PUBLIC_WRITES_ENABLED:'false'};
  assert.doesNotThrow(()=>validateTarget(safe));
  for(const [key,value] of Object.entries({PGHOST:'remote.example',PGDATABASE:'dodola_db',PGUSER:'postgres',BETA_TEST_IMPORT_APPROVED:'no',PUBLIC_WRITES_ENABLED:'true'})) {
    assert.throws(()=>validateTarget({...safe,[key]:value}), { code:'UNSAFE_IMPORT_TARGET' });
  }
});
