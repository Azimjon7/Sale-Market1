'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto');
const {newDb,DataType}=require('pg-mem');
process.env.NODE_ENV='test';process.env.PUBLIC_WRITES_ENABLED='true';
process.env.JWT_SECRET='checkout-isolated-synthetic-jwt-secret-32-characters';
process.env.CUSTOMER_SESSION_SECRET='checkout-isolated-synthetic-session-secret-32-characters';
process.env.ADMIN_USERNAME='test-admin';process.env.ADMIN_PASSWORD='synthetic-password';
const {createApp}=require('../server');
const {applySchema}=require('../utils/postgres/schema');
const delivery={city:'tashkent-city',district:'Chilonzor',street:'Sinov ko‘chasi',house:'24',apartment:'2'};
async function fixture(options={}){
 let pool,dbName,adminPool;
 if(process.env.DODOLA_TEST_PG_PORT){const {Pool}=require('pg');const port=Number(process.env.DODOLA_TEST_PG_PORT);if(port!==55439)throw Error('Only isolated localhost test port 55439 allowed');adminPool=new Pool({host:'127.0.0.1',port,user:'postgres',database:'postgres'});dbName='dodola_checkout_test_'+crypto.randomBytes(8).toString('hex');await adminPool.query('CREATE DATABASE '+dbName);pool=new Pool({host:'127.0.0.1',port,user:'postgres',database:dbName});}
 else{const db=newDb({noAstCoverageCheck:true});db.public.registerOperator({operator:'~',left:DataType.text,right:DataType.text,returns:DataType.bool,implementation:(a,b)=>new RegExp(b).test(a)});
  for(const [name,args,result,implementation] of [['hashtext',[DataType.text],DataType.integer,x=>x.length],['pg_advisory_xact_lock',[DataType.integer],DataType.integer,()=>1]])db.public.registerFunction({name,args,returns:result,implementation});
  pool=new(db.adapters.createPg().Pool)();const query=pool.query.bind(pool);
  // pg-mem gives inline CHECKs non-PostgreSQL names. Widen its original checks
  // in this fixture only; real PostgreSQL runs the exact immutable migrations.
  pool.query=(sql,...args)=>query(typeof sql==='string'&&sql.includes('CREATE TABLE IF NOT EXISTS orders (')?sql.replaceAll("'payment_pending','production'","'payment_pending','awaiting_payment','paid','production'").replaceAll("'pending','collected','failed'","'pending','collected','failed','refunded','partially_refunded'"):sql,...args);
 }
 await applySchema(pool);
 await pool.query(`INSERT INTO products(id,sku,name,description,price,inventory_mode,accepts_mto,image_paths,legacy_payload) VALUES('p1','DOD-9001','Yumshoq kreslo','Sinov mahsuloti',100000,'made-to-order',true,'[]','{}'),('p2','DOD-9002','Stol chirog‘i','Sinov mahsuloti',50000,'standard',false,'[]','{}')`);
 await pool.query(`INSERT INTO inventory_levels(product_id,available,reserved,sold,returned) VALUES('p1',100,0,0,0),('p2',100,0,0,0)`);
 await pool.query(`INSERT INTO promo_codes(code,discount_percent,legacy_payload,usage_limit) VALUES('ONCE10',10,'{"minSpend":100000,"maxDiscount":8000}',1),('SAVE20',20,'{}',null)`);
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'dodola-checkout-')),dataDir=path.join(root,'data'),uploadsDir=path.join(root,'uploads');fs.mkdirSync(dataDir);fs.mkdirSync(uploadsDir);
 const env={NODE_ENV:'test',FILE_STORAGE_BACKEND:'local',PAYMENT_MODE:'sandbox',PAYMENT_RETURN_ORIGIN:'http://127.0.0.1:4387',PAYME_MERCHANT_ID:'synthetic-merchant',PAYME_KEY:'synthetic-payme-key',CLICK_MERCHANT_ID:'1',CLICK_SERVICE_ID:'2',CLICK_SECRET_KEY:'synthetic-click-secret',CLICK_MERCHANT_USER_ID:'3',CLICK_TEST_SERVICE_CONFIRMED:'yes',UZUM_TERMINAL_ID:'synthetic-terminal',UZUM_API_KEY:'synthetic-uzum-key',UZUM_API_ORIGIN:'https://sandbox.uzumbank.uz',UZUM_CHECKOUT_HOST:'sandbox.uzumbank.uz',UZUM_FISCALIZATION_READY:'yes'};
 Object.assign(env,options.env||{});
 const external={uzum:new Map(),clickPaid:false,clickPaymentId:'202',calls:[],failRegister:false};
 const paymentFetch=async(url,options={})=>{external.calls.push(url);let result;
  if(url.includes('/status_by_mti/'))return {ok:true,json:async()=>({error_code:0,payment_id:external.clickPaymentId,merchant_trans_id:url.split('/').at(-2)})};
  if(url.includes('api.click.uz'))return {ok:true,json:async()=>({error_code:0,payment_id:url.split('/').at(-1),payment_status:external.clickPaid?1:0})};
  const b=JSON.parse(options.body);
  if(url.endsWith('/register')){if(external.failRegister)throw Error('Synthetic timeout');const id=crypto.randomUUID();external.uzum.set(id,{orderId:id,merchantOrderId:b.orderNumber,amount:b.amount,completedAmount:0,refundedAmount:0,reversedAmount:0,status:'REGISTERED'});result={orderId:id,paymentRedirectUrl:'https://sandbox.uzumbank.uz/pay/'+id};}
  else result=external.uzum.get(b.orderId);
  return {ok:true,json:async()=>({errorCode:0,result})};};
 const app=createApp({dataDir,uploadsDir,storageBackend:'postgresql',postgresPool:pool,postgresOrderOptions:{isolationLevel:process.env.DODOLA_TEST_PG_PORT?'SERIALIZABLE':null},env,paymentFetch,emailService:{status:()=>({configured:false}),send:async()=>({accepted:true})}});
 const close=async()=>{await pool.end();if(adminPool){await adminPool.query('DROP DATABASE '+dbName);await adminPool.end();}fs.rmSync(root,{recursive:true,force:true});};
 return {app,pool,env,external,close,root};
}
module.exports={fixture,delivery};
