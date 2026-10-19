'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),request=require('supertest');const {customerUiFixture}=require('./customer-ui-fixture.cjs');
test('primary address belongs to authenticated customer, survives edit, and only one is primary',async t=>{const c=await customerUiFixture();t.after(c.close);let p=(await c.agent.get('/api/customer/profile')).body.customer;assert.equal(p.addresses.filter(a=>a.isPrimary).length,1);const other=p.addresses.find(a=>!a.isPrimary);
 await request(c.app).patch('/api/customer/addresses/'+other.id+'/primary').send({}).expect(401);
 await c.agent.patch('/api/customer/addresses/'+other.id+'/primary').send({}).expect(403);
 await c.agent.patch('/api/customer/addresses/not-owned/primary').set('X-CSRF-Token',c.csrf).send({}).expect(404);
 p=(await c.agent.patch('/api/customer/addresses/'+other.id+'/primary').set('X-CSRF-Token',c.csrf).send({}).expect(200)).body;
 assert.deepEqual(p.addresses.filter(a=>a.isPrimary).map(a=>a.id),[other.id]);
 if(process.env.DODOLA_TEST_PG_PORT){await Promise.all(p.addresses.map(a=>c.agent.patch('/api/customer/addresses/'+a.id+'/primary').set('X-CSRF-Token',c.csrf).send({}).expect(200)));const current=(await c.agent.get('/api/customer/profile')).body.customer;assert.equal(current.addresses.filter(a=>a.isPrimary).length,1);await c.agent.patch('/api/customer/addresses/'+other.id+'/primary').set('X-CSRF-Token',c.csrf).send({}).expect(200);}
 p=(await c.agent.put('/api/customer/addresses').set('X-CSRF-Token',c.csrf).send({...other,house:'29'}).expect(200)).body;
 assert.deepEqual(p.addresses.filter(a=>a.isPrimary).map(a=>a.id),[other.id]);
 await c.agent.delete('/api/customer/addresses/'+other.id).set('X-CSRF-Token',c.csrf).expect(200);
});
test('expanded order details are private, show server totals and never leak tracking hashes or admin notes',async t=>{const c=await customerUiFixture();t.after(c.close);await request(c.app).get('/api/checkout/orders/'+c.orders[0].id).expect(404);const r=await c.agent.get('/api/checkout/orders/'+c.orders[0].id).expect(200);assert.equal(r.body.order.items.length,2);assert.equal(Number(r.body.order.total),150000);assert.match(r.body.order.address,/Chilonzor/);assert.ok(!JSON.stringify(r.body).includes('guestTrackingTokenHash'));assert.equal(r.body.order.status,'pending_confirmation');const methods=(await c.agent.get('/api/payments/methods')).body.methods;assert.ok(methods.every(m=>!m.enabled));});
