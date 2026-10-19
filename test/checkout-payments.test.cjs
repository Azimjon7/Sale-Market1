'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),request=require('supertest'),crypto=require('crypto');
const {fixture,delivery}=require('./checkout-fixture.cjs');
const rules=require('../utils/commerceRules');
async function setup(t){const c=await fixture();t.after(c.close);c.agent=request.agent(c.app);c.csrf=(await c.agent.get('/api/auth/session')).body.csrfToken;c.admin=(await request(c.app).post('/api/admin/login').send({username:'test-admin',password:'synthetic-password'})).body.token;return c;}
async function place(c,extra={}){const body={name:'Sinov Mijoz',phone:'+998900000001',delivery,items:[{productId:'p1',qty:1}],paymentType:'karta',submissionToken:crypto.randomUUID(),...extra};const r=await c.agent.post('/api/orders').send(body);assert.equal(r.status,201,JSON.stringify(r.body));return {order:r.body.order,body};}
async function confirm(c,o){await request(c.app).patch('/api/orders/'+o.id+'/confirm').set('Authorization','Bearer '+c.admin).send({}).expect(200);}
async function start(c,o,provider='payme',key=crypto.randomUUID()){const r=await c.agent.post('/api/payments/attempts').set('X-CSRF-Token',c.csrf).set('X-Order-Token',o.trackingToken).set('Idempotency-Key',key).send({orderId:o.id,provider});return r;}
function rpc(c,method,params,authorized=true){return request(c.app).post('/api/payments/webhooks/payme').set('Authorization',authorized?'Basic '+Buffer.from('Paycom:'+c.env.PAYME_KEY).toString('base64'):'Basic fake').send({id:1,method,params});}
const paymeParams=a=>({id:crypto.randomBytes(12).toString('hex'),time:Date.now(),amount:Math.round(a.amount*100),account:{order_id:a.id}});
test('delivery accepts every city district, rejects province/city spoofing and incomplete addresses',()=>{
 for(const district of rules.DISTRICTS)assert.equal(rules.delivery({...delivery,district}).deliveryFee,0);
 for(const city of ['tashkent-region','Toshkent','samarkand','tashkent-city ',null])assert.throws(()=>rules.delivery({...delivery,city}));
 for(const district of ['Qibray','Zangiota','Chirchiq',''])assert.throws(()=>rules.delivery({...delivery,district}));
 for(const body of [{...delivery,house:''},{...delivery,street:'x'},{...delivery,street:'<script>'}])assert.throws(()=>rules.delivery(body));
});
test('promotion expiry, minimum, cap, bounds and integer currency calculations',()=>{
 const p={code:'TEST10',discountPercent:10,minSpend:100,maxDiscount:15};assert.equal(rules.discount(p,200),15);
 assert.throws(()=>rules.discount(p,99));assert.throws(()=>rules.discount({...p,expiresAt:'2000-01-01'},200));assert.throws(()=>rules.discount({...p,usageLimit:1},200,1));assert.throws(()=>rules.discount({...p,active:false},200));assert.throws(()=>rules.discount({...p,discountPercent:1000},200));assert.equal(rules.minor('12.01'),1201);assert.throws(()=>rules.minor('1.001'));
});
test('server-authoritative quote, strict city validation, no card data or promo stacking',async t=>{
 const c=await setup(t);
 const q=await c.agent.post('/api/checkout/quote').send({items:[{productId:'p1',qty:1,price:1}],promoCode:'ONCE10',subtotal:1,total:1}).expect(200);assert.equal(q.body.total,92000);assert.equal(q.body.deliveryFee,0);
 await c.agent.post('/api/promocodes/apply').send({code:'SAVE20',subtotal:1000}).expect(400);
 await c.agent.post('/api/checkout/quote').send({items:[{productId:'p1',qty:1}],promoCode:['SAVE20','ONCE10']}).expect(400);
 const base={name:'Test',phone:'+998900000001',items:[{productId:'p1',qty:1}],delivery};
 await c.agent.post('/api/orders').send({...base,delivery:{...delivery,city:'tashkent-region'}}).expect(400);
 await c.agent.post('/api/orders').send({...base,cardNumber:'synthetic-forbidden'}).expect(400);
 await c.agent.post('/api/orders').send({...base,cvv:'synthetic-forbidden'}).expect(400);
 assert.equal(Number((await c.pool.query('SELECT count(*) AS n FROM orders')).rows[0].n),0);
});
test('order retry recovers guest token without redeeming promo twice; changed payload conflicts',async t=>{
 const c=await setup(t),{order,body}=await place(c,{promoCode:'ONCE10'});
 const retry=await c.agent.post('/api/orders').send(body).expect(201);assert.equal(retry.body.order.id,order.id);assert.equal(retry.body.order.trackingToken,order.trackingToken);
 await c.agent.post('/api/orders').send({...body,items:[{productId:'p1',qty:2}]}).expect(409);
 assert.equal(Number((await c.pool.query("SELECT redeemed_count FROM promo_codes WHERE code='ONCE10'")).rows[0].redeemed_count),1);
 await c.agent.post('/api/checkout/quote').send({items:body.items,promoCode:'ONCE10'}).expect(400);
});
test('confirmation, authorization, CSRF, payment idempotency and admin bypass protection',async t=>{
 const c=await setup(t),{order}=await place(c);assert.equal(order.status,'pending_confirmation');
 assert.equal((await start(c,order)).status,409);await confirm(c,order);
 await c.agent.post('/api/payments/attempts').set('X-Order-Token',order.trackingToken).set('Idempotency-Key',crypto.randomUUID()).send({orderId:order.id,provider:'payme'}).expect(403);
 assert.equal((await start(c,{...order,trackingToken:'x'.repeat(40)})).status,404);
 const key=crypto.randomUUID(),one=await start(c,order,'payme',key);assert.equal(one.status,201,JSON.stringify(one.body));
 const two=await start(c,order,'payme',key);assert.equal(two.body.attempt.id,one.body.attempt.id);assert.equal((await start(c,order,'click',key)).status,409);
 await request(c.app).get('/api/payments/attempts/'+one.body.attempt.id).expect(404);
 await request(c.app).patch('/api/orders/'+order.id+'/payment').set('Authorization','Bearer '+c.admin).send({}).expect(409);
 await request(c.app).patch('/api/orders/'+order.id+'/status').set('Authorization','Bearer '+c.admin).send({status:'paid'}).expect(409);
 await request(c.app).patch('/api/orders/'+order.id+'/status').set('Authorization','Bearer '+c.admin).send({status:'cancelled'}).expect(409);
 assert.equal((await c.pool.query('SELECT status FROM orders WHERE id=$1',[order.id])).rows[0].status,'awaiting_payment');
});
test('Payme protocol: forged auth, amount binding, duplicate creation/perform, cancel and replay',async t=>{
 const c=await setup(t),{order}=await place(c);await confirm(c,order);const a=(await start(c,order)).body.attempt,p=paymeParams(a);
 assert.equal((await rpc(c,'CreateTransaction',p,false)).body.error.code,-32504);
 assert.equal((await rpc(c,'CreateTransaction',{...p,amount:p.amount+1})).body.error.code,-31001);
 const created=await rpc(c,'CreateTransaction',p);assert.equal(created.body.result?.state,1,JSON.stringify(created.body));assert.equal((await rpc(c,'CreateTransaction',p)).body.result.transaction,a.id);
 assert.equal((await rpc(c,'CreateTransaction',{...p,id:crypto.randomBytes(12).toString('hex')})).body.error.code,-31008);
 assert.equal((await rpc(c,'PerformTransaction',{id:p.id})).body.result?.state,2);assert.equal((await rpc(c,'PerformTransaction',{id:p.id})).body.result.state,2);
 assert.equal((await c.pool.query('SELECT status,payment_status FROM orders WHERE id=$1',[order.id])).rows[0].status,'paid');
 assert.equal((await rpc(c,'CancelTransaction',{id:p.id,reason:1})).body.result.state,-2);
 assert.equal((await rpc(c,'CancelTransaction',{id:p.id,reason:1})).body.result.state,-2);
 assert.ok((await rpc(c,'PerformTransaction',{id:p.id})).body.error);
 assert.equal((await c.pool.query('SELECT payment_status FROM orders WHERE id=$1',[order.id])).rows[0].payment_status,'refunded');
 const statement=await rpc(c,'GetStatement',{from:p.time-1000,to:p.time+1000});assert.equal(statement.body.result.transactions.length,1);
});
test('Payme expired create never charges; cancelled attempt can be retried with a new key',async t=>{
 const c=await setup(t),{order}=await place(c);await confirm(c,order);const a=(await start(c,order)).body.attempt,p=paymeParams(a);p.time-=43200001;
 assert.equal((await rpc(c,'CreateTransaction',p)).body.error.code,-31008);
 const retry=await start(c,order);assert.equal(retry.status,201,JSON.stringify(retry.body));assert.notEqual(retry.body.attempt.id,a.id);
});
test('Click prepare/complete signatures, stale requests, binding and authoritative reconciliation',async t=>{
 const c=await setup(t),{order}=await place(c);await confirm(c,order);const a=(await start(c,order,'click')).body.attempt;
 const sign=b=>({...b,sign_string:crypto.createHash('md5').update([b.click_trans_id,b.service_id,c.env.CLICK_SECRET_KEY,b.merchant_trans_id,...(String(b.action)==='1'?[b.merchant_prepare_id]:[]),b.amount,b.action,b.sign_time].join('')).digest('hex')});
 const time=new Date(Date.now()+5*3600000).toISOString().slice(0,19).replace('T',' ');
 const p={click_trans_id:'101',click_paydoc_id:'202',service_id:'2',merchant_trans_id:a.id,amount:'100000.00',action:'0',error:'0',sign_time:time};
 const call=b=>request(c.app).post('/api/payments/webhooks/click').type('form').send(b);
 assert.equal((await call({...sign(p),sign_string:'0'.repeat(32)})).body.error,-1);
 assert.equal((await call(sign({...p,sign_time:'2000-01-01 00:00:00'}))).body.error,-1);
 const prepared=await call(sign(p));assert.equal(prepared.body.error,0,JSON.stringify(prepared.body));
 const complete={...p,action:'1',merchant_prepare_id:prepared.body.merchant_prepare_id};
 assert.equal((await call(sign({...complete,amount:'1.00'}))).body.error,-2);
 assert.equal((await call(sign(complete))).body.error,-7); // signed notification alone is insufficient
 c.external.clickPaid=true;c.external.clickPaymentId='999';assert.equal((await call(sign(complete))).body.error,-7);
 assert.equal((await c.pool.query('SELECT payment_status FROM orders WHERE id=$1',[order.id])).rows[0].payment_status,'pending');
 c.external.clickPaymentId='202';assert.equal((await call(sign(complete))).body.error,0);assert.equal((await call(sign(complete))).body.error,-4);
});
test('Uzum ignores spoofed success, reconciles amount/order, handles partial/full refunds',async t=>{
 const c=await setup(t),{order}=await place(c);await confirm(c,order);const a=(await start(c,order,'uzum')).body.attempt;
 const remote=[...c.external.uzum.values()][0];const hook=()=>request(c.app).post('/api/payments/webhooks/uzum').send({orderId:remote.orderId,orderNumber:a.id,operationState:'SUCCESS'});
 await hook().expect(200);assert.equal((await c.pool.query('SELECT payment_status FROM orders WHERE id=$1',[order.id])).rows[0].payment_status,'pending');
 remote.status='COMPLETED';remote.completedAmount=remote.amount;remote.merchantOrderId='wrong';await hook().expect(503);remote.merchantOrderId=a.id;await hook().expect(200);
 remote.refundedAmount=100;await hook().expect(200);assert.equal((await c.pool.query('SELECT payment_status FROM orders WHERE id=$1',[order.id])).rows[0].payment_status,'partially_refunded');
 remote.refundedAmount=remote.amount;remote.status='REFUNDED';await hook().expect(200);assert.equal((await c.pool.query('SELECT payment_status FROM orders WHERE id=$1',[order.id])).rows[0].payment_status,'refunded');
});
test('uncertain provider registration blocks a second charge, exposes no secrets/card fields',async t=>{
 const c=await setup(t),{order}=await place(c);await confirm(c,order);c.external.failRegister=true;
 assert.equal((await start(c,order,'uzum')).status,409);const retry=await start(c,order,'uzum');assert.equal(retry.body.attempt.status,'review');assert.equal(c.external.calls.length,1);
 const publicInfo=await request(c.app).get('/api/payments/methods').expect(200);assert.ok(!JSON.stringify(publicInfo.body).includes(c.env.PAYME_KEY));
 await request(c.app).get('/api/admin/payments/config').expect(401);await request(c.app).get('/.env').expect(404);
});

test('unconfigured providers fail closed and legacy unconfirmed orders remain unpaid',async t=>{
 const {createAdapters}=require('../utils/payments/adapters');assert.ok(Object.values(createAdapters({})).every(a=>!a.enabled));
 const c=await setup(t),{order}=await place(c);
 await c.pool.query("UPDATE orders SET status='payment_pending',confirmed_at=null WHERE id=$1",[order.id]);
 assert.equal((await start(c,order)).status,409);
 assert.equal((await c.pool.query('SELECT payment_status FROM orders WHERE id=$1',[order.id])).rows[0].payment_status,'pending');
 await request(c.app).get('/api/admin/payments').expect(401);
 await request(c.app).get('/api/admin/payments').set('Authorization','Bearer '+c.admin).expect(200);
});

test('Uzum refuses amount mismatch and permits retry only after authoritative failure',async t=>{
 const c=await setup(t),{order}=await place(c);await confirm(c,order);const a=(await start(c,order,'uzum')).body.attempt;
 const remote=[...c.external.uzum.values()][0];const hook=()=>request(c.app).post('/api/payments/webhooks/uzum').send({orderId:remote.orderId,orderNumber:a.id});
 remote.amount+=1;await hook().expect(503);remote.amount-=1;
 assert.equal((await start(c,order,'click')).status,409);
 remote.status='DECLINED';await hook().expect(200);
 assert.equal((await c.pool.query('SELECT payment_status FROM orders WHERE id=$1',[order.id])).rows[0].payment_status,'failed');
 const retry=await start(c,order,'uzum');assert.equal(retry.status,201);assert.notEqual(retry.body.attempt.id,a.id);
});

test('a delayed checkout error cannot demote a payment already settled by webhook',async t=>{
 const c=await setup(t),{order}=await place(c);await confirm(c,order);
 const {createAdapters}=require('../utils/payments/adapters'),{PaymentService}=require('../utils/payments/service');
 const adapters=createAdapters(c.env);adapters.payme.checkout=async a=>{const p=paymeParams({id:a.id,amount:Number(a.amount_minor)/100});assert.ok((await rpc(c,'CreateTransaction',p)).body.result);assert.equal((await rpc(c,'PerformTransaction',{id:p.id})).body.result.state,2);throw Error('Synthetic late transport failure');};
 await assert.rejects(new PaymentService(c.pool,adapters).start(order.id,'payme',crypto.randomUUID(),async()=>{}));
 assert.equal((await c.pool.query('SELECT status FROM payment_attempts WHERE order_id=$1',[order.id])).rows[0].status,'paid');
});
test('real PostgreSQL concurrent one-use promos and duplicate payment attempts serialize', {skip:!process.env.DODOLA_TEST_PG_PORT},async t=>{
 const c=await setup(t);const body={name:'Race test',phone:'+998900000001',delivery,items:[{productId:'p1',qty:1}],paymentType:'karta',promoCode:'ONCE10'};
 const results=await Promise.all(Array.from({length:6},()=>request(c.app).post('/api/orders').send({...body,submissionToken:crypto.randomUUID()})));
 assert.equal(results.filter(r=>r.status===201).length,1);assert.ok(results.every(r=>[201,400].includes(r.status)),results.map(r=>r.status).join(','));
 assert.equal(Number((await c.pool.query('SELECT count(*) AS n FROM promo_redemptions')).rows[0].n),1);
 const {order}=await place(c);await confirm(c,order);const key=crypto.randomUUID();const attempts=await Promise.all(Array.from({length:8},()=>start(c,order,'payme',key)));
 assert.ok(attempts.every(r=>r.status===201),attempts.map(r=>r.status).join(','));assert.equal(new Set(attempts.map(r=>r.body.attempt.id)).size,1);
 const sameOrder={...body,promoCode:'SAVE20',submissionToken:crypto.randomUUID()};
 const duplicateOrders=await Promise.all(Array.from({length:5},()=>request(c.app).post('/api/orders').send(sameOrder)));
 assert.ok(duplicateOrders.every(r=>r.status===201),duplicateOrders.map(r=>r.status).join(','));
 assert.equal(new Set(duplicateOrders.map(r=>r.body.order.id)).size,1);
 assert.ok(duplicateOrders.every(r=>r.body.order.trackingToken?.length>=32));
 assert.equal(new Set(duplicateOrders.map(r=>r.body.order.trackingToken)).size,1);
 assert.equal(Number((await c.pool.query("SELECT count(*) AS n FROM promo_redemptions WHERE promo_code='SAVE20'")).rows[0].n),1);
});
