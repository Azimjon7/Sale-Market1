'use strict';
// Explicitly authorized synthetic workflow against the TCloud origin, with TLS validation.
const fs=require('fs'),https=require('https'),assert=require('node:assert/strict'),crypto=require('crypto');
async function run(){
 const env=require('dotenv').parse(fs.readFileSync(process.argv[2]));
 const url=new URL(env.DATABASE_URL);
 if(process.env.BETA_ORIGIN_TEST_APPROVED!=='yes'||url.pathname!=='/dodola_beta_20261020'||!['localhost','127.0.0.1'].includes(url.hostname)||env.PUBLIC_WRITES_ENABLED!=='true'||env.PAYMENT_MODE!=='disabled')throw Error('ORIGIN_TEST_GATE');
 const pool=new(require('pg').Pool)({connectionString:env.DATABASE_URL,max:2});
 const cookies=new Map(),checks={};let csrf;
 async function call(path,{method='GET',body,token,anonymous=false,expected=200}={}){
  const payload=body?JSON.stringify(body):null;
  const headers={host:'dodola.uz','content-type':'application/json',origin:'https://dodola.uz'};
  if(payload)headers['content-length']=Buffer.byteLength(payload);
  if(!anonymous){headers.cookie=[...cookies].map(([k,v])=>k+'='+v).join('; ');if(csrf)headers['x-csrf-token']=csrf;}
  if(token)headers.authorization='Bearer '+token;
  return new Promise((resolve,reject)=>{
   const req=https.request({hostname:'178.218.207.135',servername:'dodola.uz',port:443,path,method,headers,rejectUnauthorized:true,timeout:15000},res=>{
    let text='';res.on('data',x=>text+=x);res.on('end',()=>{try{assert.ok([].concat(expected).includes(res.statusCode),path+': HTTP '+res.statusCode);if(!anonymous)for(const v of res.headers['set-cookie']||[]){const p=v.split(';')[0],i=p.indexOf('=');cookies.set(p.slice(0,i),p.slice(i+1));}resolve(JSON.parse(text));}catch(e){reject(e);}});
   });req.on('error',()=>reject(Error('ORIGIN_NETWORK_ERROR')));req.on('timeout',()=>req.destroy());req.end(payload);
  });
 }
 try{
  assert.equal(Number((await pool.query('SELECT count(*) AS n FROM products')).rows[0].n),1164);
  const product=(await pool.query('SELECT id,price FROM products ORDER BY sku LIMIT 1')).rows[0];
  const health=await call('/api/health');assert.equal(health.storageBackend,'postgresql');assert.equal(health.publicWritesEnabled,true);checks.httpsPostgres=true;
  csrf=(await call('/api/auth/session')).csrfToken;
  const phone='+99800'+String(Date.now()).slice(-7),password=crypto.randomBytes(24).toString('hex');
  await call('/api/auth/register',{method:'POST',expected:201,body:{firstName:'Beta',lastName:'Origin Test',phone,email:env.RESEND_TEST_RECIPIENT,password,confirmPassword:password}});
  csrf=(await call('/api/auth/login',{method:'POST',body:{identifier:phone,password}})).csrfToken;checks.registrationAndLogin=true;
  const delivery={city:'tashkent-city',district:'Chilonzor',street:'BETA TEST - DO NOT FULFILL',house:'1'};
  await call('/api/customer/addresses',{method:'PUT',body:{...delivery,label:'Dedicated beta test'}});checks.savedAddress=true;
  const body={name:'BETA TEST - DO NOT FULFILL',phone,delivery,paymentType:'karta',paymentPreference:'click',submissionToken:crypto.randomUUID(),total:1,items:[{productId:product.id,qty:2,price:1}]};
  await call('/api/orders',{method:'POST',body:{...body,delivery:{...delivery,city:'tashkent-region'}},expected:400});checks.cityBoundary=true;
  const orders=await Promise.all([call('/api/orders',{method:'POST',body,expected:201}),call('/api/orders',{method:'POST',body,expected:[200,201]})]);
  const id=orders[0].order.id;assert.equal(orders[1].order.id,id);
  const stored=(await pool.query('SELECT total,status,payment_status,customer_phone,delivery_address,legacy_payload FROM orders WHERE id=$1',[id])).rows[0];
  assert.equal(Number(stored.total),Number(product.price)*2);assert.equal(stored.status,'pending_confirmation');assert.equal(stored.customer_phone,phone);assert.equal(stored.legacy_payload.paymentPreference,'click');assert.ok(stored.delivery_address.includes('Chilonzor'));
  assert.equal(Number((await pool.query('SELECT count(*) AS n FROM orders WHERE submission_token=$1',[body.submissionToken])).rows[0].n),1);checks.orderPersistencePricesAndIdempotency=true;
  await call('/api/orders',{anonymous:true,expected:401});await call('/api/orders/'+id+'/confirm',{method:'PATCH',anonymous:true,body:{},expected:401});checks.adminAuthorization=true;
  const token=(await call('/api/admin/login',{method:'POST',anonymous:true,body:{username:env.ADMIN_USERNAME,password:env.ADMIN_PASSWORD}})).token;
  const list=await call('/api/orders?filter=all&page=1&limit=50',{token});assert.ok(list.orders.some(o=>o.id===id));
  await call('/api/orders/'+id+'/confirm',{method:'PATCH',body:{},token});
  await call('/api/orders/'+id+'/status',{method:'PATCH',body:{status:'paid'},token,expected:409});
  await call('/api/orders/'+id+'/status',{method:'PATCH',body:{status:'payment_pending'},token});
  await call('/api/orders/'+id+'/status',{method:'PATCH',body:{status:'cancelled',reason:'Dedicated origin test, do not fulfill'},token});checks.adminConfirmationAndCancellation=true;
  const mine=await call('/api/customer/orders');assert.equal(mine.orders.find(o=>o.id===id).status,'cancelled');checks.customerTracking=true;
  assert.equal((await pool.query('SELECT payment_status FROM orders WHERE id=$1',[id])).rows[0].payment_status,'pending');assert.equal(Number((await pool.query('SELECT count(*) AS n FROM payment_attempts')).rows[0].n),0);checks.noFakePayment=true;
  return {ok:true,checks,testOrderId:id,testOrderCancelled:true,emailDelivery:'not independently verified'};
 }finally{await pool.end();}
}
run().then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(JSON.stringify({ok:false,code:error.code||'ORIGIN_WORKFLOW_FAILED',message:/^\/api\/[^:]+: HTTP \d+$/.test(error.message)?error.message:'Check private test results; no credentials logged'}));process.exitCode=1;});
