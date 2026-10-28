'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const request = require('supertest');
const { parse } = require('dotenv');

process.env.NODE_ENV = 'production';
process.env.PUBLIC_WRITES_ENABLED = 'false';
process.env.JWT_SECRET = 'synthetic-jwt-secret-that-is-long-enough';
process.env.CUSTOMER_SESSION_SECRET = 'synthetic-session-secret-that-is-long-enough';
process.env.ADMIN_USERNAME = 'synthetic-admin';
process.env.ADMIN_PASSWORD = 'synthetic-admin-password';

const { createApp } = require('../server');

// Recovered from local checkpoint 9827195; the template now lives in docs/.
function productionApp(t, publicWrites) {
  const previous = process.env.PUBLIC_WRITES_ENABLED;
  if (publicWrites === undefined) delete process.env.PUBLIC_WRITES_ENABLED;
  else process.env.PUBLIC_WRITES_ENABLED = publicWrites;
  t.after(() => {
    if (previous === undefined) delete process.env.PUBLIC_WRITES_ENABLED;
    else process.env.PUBLIC_WRITES_ENABLED = previous;
  });
  const dirs = fixture();
  t.after(() => fs.rmSync(dirs.root, { recursive: true, force: true }));
  const app = createApp({
    ...dirs,
    storageBackend: 'json',
    env: { FILE_STORAGE_BACKEND: 'local' },
    notifyOrder: async () => {},
  });
  return { app, dirs };
}

async function assertWritesLocked(app) {
  const health = await request(app).get('/api/health').expect(200);
  assert.equal(health.body.publicWritesEnabled, false);
  for (const [method, route] of [
    ['post', '/api/orders'], ['post', '/api/reviews'],
    ['post', '/api/auth/register'], ['post', '/api/promocodes/apply'],
    ['patch', '/api/customer/profile'], ['put', '/api/customer/addresses'],
    ['delete', '/api/customer/addresses/synthetic-address'],
  ]) {
    const response = await request(app)[method](route).send({}).expect(503);
    assert.equal(response.body.code, 'PUBLIC_LAUNCH_LOCKED', `${method} ${route}`);
  }
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dodola-launch-lock-'));
  const dataDir = path.join(root, 'data');
  const uploadsDir = path.join(root, 'uploads');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });
  const files = {
    'products.json': [], 'orders.json': [], 'customers.json': [],
    'customer-sessions.json': {}, 'auth-tokens.json': [],
    'identifier-counters.json': { nextProductSku: 1, nextOrderNumber: 1001 },
    'inventory-state.json': {}, 'categories.json': [], 'promocodes.json': [], 'reviews.json': [],
  };
  for (const [name, value] of Object.entries(files)) {
    fs.writeFileSync(path.join(dataDir, name), JSON.stringify(value));
  }
  return { root, dataDir, uploadsDir };
}

test('production launch lock blocks customer writes but permits health and admin login', async t => {
  const { app } = productionApp(t, 'false');

  const health = await request(app).get('/api/health').expect(200);
  assert.equal(health.body.publicWritesEnabled, false);
  await request(app).post('/api/orders').send({}).expect(503, {
    success: false,
    code: 'PUBLIC_LAUNCH_LOCKED',
    message: 'Sayt ishga tushirishga tayyorlanmoqda. Bu amal hozircha yopiq.',
  });
  await request(app).post('/api/auth/register').send({}).expect(503);
  await request(app).post('/api/reviews').send({}).expect(503);
  const login = await request(app).post('/api/admin/login').send({
    username: 'synthetic-admin', password: 'synthetic-admin-password',
  }).expect(200);
  assert.equal(login.body.success, true);
});

test('production defaults to locked when PUBLIC_WRITES_ENABLED is absent', async t => {
  const { app } = productionApp(t, undefined);
  await assertWritesLocked(app);
});

test('the copied example keeps production public writes locked', async t => {
  const example = parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'environment.example')));
  assert.equal(example.PUBLIC_WRITES_ENABLED, 'false');
  const { app } = productionApp(t, example.PUBLIC_WRITES_ENABLED);
  await assertWritesLocked(app);
});

test('production public writes require an explicit true opt-in', async t => {
  const { app, dirs } = productionApp(t, 'true');
  const health = await request(app).get('/api/health').expect(200);
  assert.equal(health.body.publicWritesEnabled, true);
  fs.writeFileSync(path.join(dirs.dataDir, 'products.json'), JSON.stringify([{
    id: 'synthetic-product', name: 'Synthetic product', price: 10000,
    stock: 0, _inventoryMode: 'made-to-order', _acceptsMTO: true,
  }]));
  const response = await request(app).post('/api/orders').send({
    name: 'Synthetic customer', phone: '+998900000000',
    address: 'Synthetic test address', paymentType: 'naqd',
    delivery: { city: 'tashkent-city', district: 'Chilonzor', street: 'Synthetic street', house: '24' },
    items: [{ productId: 'synthetic-product', qty: 1 }],
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.success, true);
  const orders = JSON.parse(fs.readFileSync(path.join(dirs.dataDir, 'orders.json'), 'utf8'));
  assert.equal(orders.length, 1);
});
