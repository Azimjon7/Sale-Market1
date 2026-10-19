'use strict';
const {fixture,delivery}=require('./checkout-fixture.cjs'),request=require('supertest'),crypto=require('crypto');
async function customerUiFixture(options={}){
 const c=await fixture({env:{PAYMENT_MODE:'disabled'}}),agent=request.agent(c.app);
 if(options.prepare)await options.prepare(c);
 const csrf=(await agent.get('/api/auth/session')).body.csrfToken;
 const credentials={identifier:'+998900000032',password:'LocalPreview123'};
 await agent.post('/api/auth/register').set('X-CSRF-Token',csrf).send({firstName:'Dilnoza',lastName:'Karimova',phone:credentials.identifier,email:'preview@example.invalid',password:credentials.password,confirmPassword:credentials.password}).expect(201);
 const login=await agent.post('/api/auth/login').set('X-CSRF-Token',csrf).send(credentials).expect(200),token=login.body.csrfToken;
 let addresses=(await agent.put('/api/customer/addresses').set('X-CSRF-Token',token).send({...delivery,label:'Uy'}).expect(200)).body.addresses;
 await agent.patch('/api/customer/addresses/'+addresses[0].id+'/primary').set('X-CSRF-Token',token).send({}).expect(200);
 await agent.put('/api/customer/addresses').set('X-CSRF-Token',token).send({...delivery,label:'Ish joyim',district:'Mirobod',house:'18'}).expect(200);
 const orders=[];for(const items of [[{productId:'p1',qty:1},{productId:'p2',qty:1}],[{productId:'p2',qty:2}]]){const r=await agent.post('/api/orders').send({name:'Dilnoza Karimova',phone:credentials.identifier,delivery,items,paymentType:'karta',submissionToken:crypto.randomUUID()}).expect(201);orders.push(r.body.order);}
 const admin=(await request(c.app).post('/api/admin/login').send({username:'test-admin',password:'synthetic-password'}).expect(200)).body.token;
 await request(c.app).patch('/api/orders/'+orders[1].id+'/confirm').set('Authorization','Bearer '+admin).send({}).expect(200);
 return {...c,credentials,orders,agent,csrf:token};
}
module.exports={customerUiFixture};
