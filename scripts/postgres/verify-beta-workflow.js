'use strict';
// Writes synthetic accounts/orders only in the named isolated test database.
const assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto');
const {Pool}=require('pg');
async function run() {
  if(process.env.PGHOST!=='localhost'||process.env.PGDATABASE!=='dodola_pg15_test_20261020'||process.env.PGUSER!=='dodola_app'||process.env.BETA_WORKFLOW_TEST_APPROVED!=='yes') throw new Error('ISOLATED_TEST_TARGET_REQUIRED');
  const pool=new Pool({host:'localhost',database:process.env.PGDATABASE,user:process.env.PGUSER,max:3,connectionTimeoutMillis:8000});
  let server;const report={database:'dodola_pg15_test_20261020',checks:{},emailTransport:'stubbed; real email delivery not verified',adminNotification:'captured locally; real transport not verified'};
  try {
    const state=(await pool.query("SELECT current_database() AS name,current_setting('server_version_num')::integer AS version")).rows[0];
    assert.equal(state.name,'dodola_pg15_test_20261020');assert.ok(state.version>=150000&&state.version<160000);
    assert.equal(Number((await pool.query('SELECT count(*) AS n FROM products')).rows[0].n),1164);
    const product=(await pool.query('SELECT id,sku,price FROM products ORDER BY sku LIMIT 1')).rows[0];
    const files=fs.mkdtempSync(path.join(os.tmpdir(),'dodola-beta-pg15-'));
    const dataDir=path.join(files,'data'),uploadsDir=path.join(files,'uploads');fs.mkdirSync(dataDir);fs.mkdirSync(uploadsDir);
    Object.assign(process.env,{NODE_ENV:'test',PUBLIC_WRITES_ENABLED:'true',PAYMENT_MODE:'disabled',PAYMENT_LIVE_APPROVED:'no',FILE_STORAGE_BACKEND:'local',JWT_SECRET:crypto.randomBytes(40).toString('hex'),CUSTOMER_SESSION_SECRET:crypto.randomBytes(40).toString('hex'),ADMIN_USERNAME:'isolated-beta-admin',ADMIN_PASSWORD:crypto.randomBytes(24).toString('hex')});
    const messages=[],notifications=[];
    const app=require('../../server').createApp({dataDir,uploadsDir,storageBackend:'postgresql',postgresPool:pool,
      notifyOrder:async order=>notifications.push(order.id),emailService:{baseUrl:'http://localhost',status:()=>({configured:true,testMode:true}),send:async message=>{messages.push(message);return {accepted:true,id:'test-only'};}}});
    server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
    const base='http://127.0.0.1:'+server.address().port,cookies=new Map();
    async function call(url,{method='GET',body,auth,anonymous=false,expected=200}={}) {
      const headers={'Content-Type':'application/json'};if(!anonymous)headers.Cookie=[...cookies].map(([k,v])=>k+'='+v).join('; ');if(auth)headers.Authorization='Bearer '+auth;
      if(!anonymous&&call.csrf)headers['X-CSRF-Token']=call.csrf;
      const response=await fetch(base+url,{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
      if(!anonymous)for(const value of response.headers.getSetCookie()){const pair=value.split(';')[0],i=pair.indexOf('=');cookies.set(pair.slice(0,i),pair.slice(i+1));}
      assert.ok([].concat(expected).includes(response.status),`${method} ${url}: unexpected HTTP ${response.status}`);
      return response.json();
    }
    call.csrf=(await call('/api/auth/session')).csrfToken;
    const suffix=String(Date.now()).slice(-7),phone='+99800'+suffix,password=crypto.randomBytes(16).toString('hex');
    await call('/api/auth/register',{method:'POST',expected:201,body:{firstName:'Beta',lastName:'Test',phone,email:'beta-'+suffix+'@example.invalid',password,confirmPassword:password}});
    call.csrf=(await call('/api/auth/login',{method:'POST',body:{identifier:phone,password}})).csrfToken;
    report.checks.registrationAndLogin=true;
    const delivery={city:'tashkent-city',district:'Chilonzor',street:'Izolyatsiya sinov ko‘chasi',house:'1'};
    await call('/api/customer/addresses',{method:'PUT',body:{...delivery,label:'Test'}});report.checks.savedAddress=true;
    const results=await call('/api/products?search='+encodeURIComponent(product.sku));assert.ok(results.some(p=>p.id===product.id));report.checks.catalogSearch=true;
    const body={name:'Beta Test',phone,delivery,paymentType:'karta',paymentPreference:'click',submissionToken:crypto.randomUUID(),total:1,items:[{productId:product.id,qty:2,price:1}]};
    await call('/api/orders',{method:'POST',body:{...body,delivery:{...delivery,city:'tashkent-region'}},expected:400});report.checks.cityBoundary=true;
    const placed=await Promise.all([call('/api/orders',{method:'POST',body,expected:201}),call('/api/orders',{method:'POST',body,expected:[200,201]})]);
    const id=placed[0].order.id;assert.equal(placed[1].order.id,id);
    const stored=(await pool.query('SELECT customer_id,customer_phone,delivery_address,total,status,payment_status,legacy_payload FROM orders WHERE id=$1',[id])).rows[0];
    assert.equal(Number(stored.total),Number(product.price)*2);assert.equal(stored.customer_phone,phone);assert.equal(stored.legacy_payload.paymentPreference,'click');assert.ok(stored.delivery_address.includes('Chilonzor'));assert.equal(stored.status,'pending_confirmation');assert.notEqual(stored.payment_status,'collected');
    assert.equal(Number((await pool.query('SELECT count(*) AS n FROM orders WHERE submission_token=$1',[body.submissionToken])).rows[0].n),1);
    const item=(await pool.query('SELECT quantity,unit_price,product_id FROM order_items WHERE order_id=$1',[id])).rows[0];assert.equal(item.quantity,2);assert.equal(Number(item.unit_price),Number(product.price));assert.equal(item.product_id,product.id);
    report.checks.orderPersistenceAndContact=true;report.checks.serverAuthoritativePrices=true;report.checks.concurrentDoubleSubmit=true;
    await call('/api/orders',{anonymous:true,expected:401});await call('/api/customer/orders',{anonymous:true,expected:401});
    await call('/api/orders/'+id+'/confirm',{method:'PATCH',body:{},anonymous:true,expected:401});report.checks.authorization=true;
    const token=(await call('/api/admin/login',{method:'POST',anonymous:true,body:{username:process.env.ADMIN_USERNAME,password:process.env.ADMIN_PASSWORD}})).token;
    const listed=await call('/api/orders?filter=all&page=1&limit=50',{auth:token});assert.equal(listed.orders.find(o=>o.id===id).paymentPreference,'click');report.checks.adminOrderVisibility=true;
    await call('/api/orders/'+id+'/confirm',{method:'PATCH',auth:token,body:{}});
    await call('/api/orders/'+id+'/confirm',{method:'PATCH',auth:token,body:{}});
    await call('/api/orders/'+id+'/status',{method:'PATCH',auth:token,body:{status:'production'},expected:409});
    await call('/api/orders/'+id+'/status',{method:'PATCH',auth:token,body:{status:'paid'},expected:409});report.checks.confirmationAndPaymentGates=true;
    await call('/api/orders/'+id+'/status',{method:'PATCH',auth:token,body:{status:'payment_pending'}});
    await call('/api/orders/'+id+'/status',{method:'PATCH',auth:token,body:{status:'cancelled',reason:'Dedicated beta test cancellation'}});
    const mine=await call('/api/customer/orders');assert.equal(mine.orders.find(o=>o.id===id).status,'cancelled');report.checks.customerOrderTrackingAndCancellation=true;
    assert.equal(Number((await pool.query('SELECT count(*) AS n FROM payment_attempts')).rows[0].n),0);
    assert.equal((await pool.query('SELECT payment_status FROM orders WHERE id=$1',[id])).rows[0].payment_status,'pending');
    report.checks.noOnlineChargeOrFakeSuccess=true;
    assert.equal(notifications.filter(x=>x===id).length,1,'New order notification must be queued exactly once');assert.equal(messages.length,1,'Verification email must be queued');report.checks.notificationQueueOnce=true;
    report.ok=true;return report;
  } finally {if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await pool.end();}
}
if(require.main===module)run().then(report=>console.log(JSON.stringify(report,null,2))).catch(error=>{console.error(JSON.stringify({ok:false,code:error.code||'BETA_WORKFLOW_FAILED',message:error.message}));process.exitCode=1;});
module.exports={run};
