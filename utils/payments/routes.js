'use strict';
const {createHash}=require('crypto');
const rateLimit=require('express-rate-limit');
const {createAdapters,equal,error}=require('./adapters');
const {PaymentService,publicAttempt}=require('./service');
const {installWebhooks}=require('./webhooks');
const {rejectCardData}=require('../commerceRules');
function installPayments(app,{pool,env,auth,verifyAdmin,publicWrites,fetcher,readOrder}){
  const adapters=createAdapters(env,fetcher),service=pool?new PaymentService(pool,adapters):null;
  const route=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(e=>e.status?res.status(e.status).json({message:e.message,code:e.code}):next(e));
  const ready=async()=>{if(!pool)return false;try{await pool.query('SELECT id FROM payment_attempts LIMIT 0');return true;}catch{return false;}};
  const statuses=async()=>{const storageReady=await ready();return Object.values(adapters).map(a=>({id:a.id,label:a.label,mode:a.mode,enabled:publicWrites&&storageReady&&a.enabled,status:publicWrites&&storageReady&&a.enabled?(a.mode==='sandbox'?'sandbox-configured':'live-configured'):'ui-only',savedCardsSupported:false}));};
  app.get('/api/payments/methods',route(async(req,res)=>res.json({methods:await statuses(),savedCardsSupported:false})));
  app.get('/api/admin/payments/config',verifyAdmin,route(async(req,res)=>res.json({methods:await statuses(),storageReady:await ready(),publicWrites,cardDataStored:false,liveReadiness:'Merchant tasdig‘i, sandbox sinovlari va fiskalizatsiya tekshiruvi zarur.'})));
  app.get('/api/admin/payments',verifyAdmin,route(async(req,res)=>{
    const rows=await ready()?(await pool.query('SELECT * FROM payment_attempts ORDER BY created_at DESC LIMIT 100')).rows:[];
    res.json({attempts:rows.map(publicAttempt)});
  }));
  const authorize=req=>async order=>{
    if(!order)throw Object.assign(error('Buyurtma topilmadi.'),{status:404});
    if(order.customer_id&&order.customer_id===req.customer?.id)return;
    const token=req.get('X-Order-Token')||'';
    if(!order.customer_id&&token.length>=32&&token.length<=128&&order.guest_tracking_token_hash&&equal(createHash('sha256').update(token).digest('hex'),order.guest_tracking_token_hash))return;
    throw Object.assign(error('Buyurtma topilmadi.'),{status:404});};
  const customerIfPresent=(req,res,next)=>req.session?.customerId?auth.requireCustomer(req,res,next):next();
  app.get('/api/checkout/orders/:id',customerIfPresent,route(async(req,res)=>{
    const order=await readOrder(req.params.id);
    await authorize(req)(order?{customer_id:order.customerId,guest_tracking_token_hash:order.guestTrackingTokenHash}:null);
    const attempts=await ready()?(await pool.query('SELECT * FROM payment_attempts WHERE order_id=$1 ORDER BY created_at DESC',[order.id])).rows.map(publicAttempt):[];
    res.json({order:{id:order.id,orderNumber:order.orderNumber,total:order.total,subtotal:order.subtotal,discountAmount:order.discountAmount,promoCode:order.promoCode,status:order.status,paymentStatus:order.paymentStatus,confirmedAt:order.confirmedAt,createdAt:order.createdAt,address:order.address,items:(order.items||[]).map(i=>({productId:i.productId,name:i.name,qty:i.qty,price:i.price,image:i.image,color:i.color,size:i.size})),history:(order.statusHistory||[]).map(h=>({status:h.status,changedAt:h.changedAt}))},attempts});
  }));
  const available=async(req,res,next)=>{if(!publicWrites)return res.status(503).json({message:'To‘lov hozircha ochilmagan.'});if(!await ready())return res.status(503).json({message:'To‘lov infratuzilmasi hali tayyor emas.'});next();};
  const limiter=rateLimit({windowMs:60000,max:40,standardHeaders:true,legacyHeaders:false});
  app.post('/api/payments/attempts',limiter,available,customerIfPresent,auth.csrf,route(async(req,res)=>{rejectCardData(req.body);res.status(201).json({attempt:await service.start(String(req.body.orderId||''),String(req.body.provider||''),req.get('Idempotency-Key'),authorize(req))});}));
  app.get('/api/payments/attempts/:id',limiter,customerIfPresent,route(async(req,res)=>{
    if(!await ready())return res.sendStatus(503);const a=(await pool.query('SELECT * FROM payment_attempts WHERE id=$1',[req.params.id])).rows[0];if(!a)return res.sendStatus(404);
    await authorize(req)((await pool.query('SELECT * FROM orders WHERE id=$1',[a.order_id])).rows[0]);res.json({attempt:publicAttempt(a)});}));
  app.post('/api/payments/attempts/:id/reconcile',limiter,available,customerIfPresent,auth.csrf,route(async(req,res)=>res.json({attempt:await service.reconcile(req.params.id,authorize(req))})));
  app.post('/api/admin/payments/:id/reconcile',verifyAdmin,available,route(async(req,res)=>res.json({attempt:await service.reconcile(req.params.id,async()=>{})})));
  app.get('/api/customer/payments',auth.requireCustomer,route(async(req,res)=>{
    if(!await ready())return res.json({attempts:[],methods:await statuses()});
    const rows=(await pool.query('SELECT payment_attempts.* FROM payment_attempts JOIN orders ON orders.id=payment_attempts.order_id WHERE orders.customer_id=$1 ORDER BY payment_attempts.created_at DESC',[req.customer.id])).rows;
    res.json({attempts:rows.map(publicAttempt),methods:await statuses()});}));
  if(service){app.use('/api/payments/webhooks',rateLimit({windowMs:60000,max:180,standardHeaders:true,legacyHeaders:false}),available);installWebhooks(app,service);}
  return {service,ready};
}
module.exports={installPayments};
