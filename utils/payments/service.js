'use strict';
const {randomUUID}=require('crypto');
const {withTransaction}=require('../postgres/pool');
const {minor}=require('../commerceRules');
const {error}=require('./adapters');
const OPEN=['created','pending','paid','review','partially_refunded'];
const publicAttempt=a=>({id:a.id,orderId:a.order_id,provider:a.provider,mode:a.mode,status:a.status,amount:Number(a.amount_minor)/100,currency:a.currency,refundedAmount:Number(a.refunded_minor)/100,createdAt:new Date(Number(a.created_at)).toISOString(),checkoutUrl:['created','pending'].includes(a.status)?a.checkout_url:null});
class PaymentService{
  constructor(pool,adapters){this.pool=pool;this.adapters=adapters;}
  async transaction(fn){return withTransaction(this.pool,fn);}
  async locked(c,id){const initial=(await c.query('SELECT order_id FROM payment_attempts WHERE id=$1',[id])).rows[0];if(!initial)throw error('To‘lov topilmadi.','PAYMENT_NOT_FOUND');
    const order=(await c.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[initial.order_id])).rows[0];
    const a=(await c.query('SELECT * FROM payment_attempts WHERE id=$1 FOR UPDATE',[id])).rows[0];return {a,order};}
  payable(order,a){if(!order||!order.confirmed_at||!['confirmed','payment_pending','awaiting_payment'].includes(order.status)||order.payment_status==='collected')throw error('Avval administrator mahsulotlar mavjudligini tasdiqlashi kerak.','ORDER_NOT_PAYABLE');
    if(a&&minor(order.total)!==Number(a.amount_minor))throw error('Buyurtma summasi o‘zgargan.','PAYMENT_BINDING_MISMATCH');}
  async save(c,a){a.updated_at=Date.now();await c.query(`UPDATE payment_attempts SET status=$2,provider_id=$3,checkout_url=$4,provider_time=$5,paid_at=$6,cancelled_at=$7,cancel_reason=$8,refunded_minor=$9,updated_at=$10,provider_doc_id=$11 WHERE id=$1`,[a.id,a.status,a.provider_id||null,a.checkout_url||null,a.provider_time||null,a.paid_at||null,a.cancelled_at||null,a.cancel_reason??null,a.refunded_minor||0,a.updated_at,a.provider_doc_id||null]);}
  async settle(c,a,order,status,refunded=0){
    if(a.status===status&&Number(a.refunded_minor)===refunded)return;
    if(status==='paid'){if(['refunded','partially_refunded','cancelled','failed'].includes(a.status))throw error('Yakunlangan to‘lovni qayta tasdiqlab bo‘lmaydi.');this.payable(order,a);a.paid_at=Date.now();}
    if(['paid','refunded','partially_refunded'].includes(a.status)&&['pending','failed','cancelled'].includes(status))return;
    a.status=status;a.refunded_minor=refunded;await this.save(c,a);
    const paymentStatus=status==='paid'?'collected':['refunded','partially_refunded'].includes(status)?status:['failed','cancelled'].includes(status)?'failed':'pending';
    await c.query(`UPDATE orders SET payment_status=$2,status=CASE WHEN $2='collected' THEN 'paid' ELSE status END,payment_collected_at=CASE WHEN $2='collected' THEN now() ELSE payment_collected_at END,updated_at=now() WHERE id=$1`,[order.id,paymentStatus]);
    await c.query(`UPDATE order_payments SET status=$2,provider_verified=$3,provider_reference=$4,collected_at=CASE WHEN $2='collected' THEN now() ELSE collected_at END WHERE order_id=$1`,[order.id,paymentStatus,['collected','refunded','partially_refunded'].includes(paymentStatus),`${a.provider}:${a.mode}:${a.provider_id||a.id}`]);
    const idx=Number((await c.query('SELECT coalesce(max(source_index),-1)+1 AS value FROM order_status_history WHERE order_id=$1',[order.id])).rows[0].value);
    await c.query(`INSERT INTO order_status_history(order_id,source_index,status,changed_by,reason,changed_at) VALUES($1,$2,$3,$4,$5,now())`,[order.id,idx,status==='paid'?'paid':order.status,`provider:${a.provider}`,`To‘lov: ${status}; urinish: ${a.id}`]);
  }
  async start(orderId,provider,key,authorize){
    const adapter=this.adapters[provider];if(!adapter?.enabled)throw error('Bu to‘lov xizmati hali ulanmagan. Hozir pul olinmaydi.');
    if(!/^[\w-]{16,100}$/.test(String(key)))throw error('To‘lov so‘rovi identifikatori yaroqsiz.');
    const created=await this.transaction(async c=>{const order=(await c.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[orderId])).rows[0];await authorize(order);
      const prior=(await c.query('SELECT * FROM payment_attempts WHERE order_id=$1 AND idempotency_key=$2',[orderId,key])).rows[0];
      if(prior){if(prior.provider!==provider)throw error('Ayni so‘rov boshqa to‘lov usuliga tegishli.','IDEMPOTENCY_CONFLICT');return {a:prior,fresh:false};}
      this.payable(order);
      const active=(await c.query('SELECT * FROM payment_attempts WHERE order_id=$1',[orderId])).rows.find(a=>OPEN.includes(a.status));
      if(active){if(active.provider!==provider)throw error('Avvalgi to‘lov hali yakunlanmagan. Uning holatini tekshiring.','PAYMENT_IN_PROGRESS');return {a:active,fresh:false};}
      const a={id:randomUUID(),order_id:orderId,provider,mode:adapter.mode,idempotency_key:key,amount_minor:minor(order.total),currency:'UZS',status:'created',created_at:Date.now(),updated_at:Date.now(),refunded_minor:0};
      await c.query(`INSERT INTO payment_attempts(id,order_id,provider,mode,idempotency_key,amount_minor,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[a.id,orderId,provider,a.mode,key,a.amount_minor,a.status,a.created_at,a.updated_at]);
      await c.query("UPDATE orders SET status='awaiting_payment',payment_type='karta',updated_at=now() WHERE id=$1",[orderId]);return {a,fresh:true};});
    if(!created.fresh)return publicAttempt(created.a);
    let checkout;try{checkout=await adapter.checkout(created.a);}catch {await this.transaction(async c=>{const {a}=await this.locked(c,created.a.id);if(['created','pending'].includes(a.status)){a.status='review';await this.save(c,a);}});throw error('Provayder javobi noaniq. Qayta to‘lamang; holatini tekshirish kerak.','RECONCILIATION_REQUIRED');}
    return this.transaction(async c=>{const {a}=await this.locked(c,created.a.id);a.checkout_url=checkout.url;a.provider_id=checkout.providerId||a.provider_id;if(a.status==='created')a.status='pending';await this.save(c,a);return publicAttempt(a);});
  }
  async reconcile(id,authorize){const initial=(await this.pool.query('SELECT * FROM payment_attempts WHERE id=$1',[id])).rows[0];if(!initial)throw error('To‘lov topilmadi.');
    const order=(await this.pool.query('SELECT * FROM orders WHERE id=$1',[initial.order_id])).rows[0];await authorize(order);
    const adapter=this.adapters[initial.provider];if(!adapter.enabled||adapter.mode!==initial.mode)throw error('Provayder muhiti mos emas.');
    if(!adapter.reconcile)return publicAttempt(initial); // Merchant API is provider-driven; CheckTransaction/GetStatement reconcile its ledger.
    const result=await adapter.reconcile(initial);
    return this.transaction(async c=>{const {a,order:o}=await this.locked(c,id);if(Number(result.refunded)<Number(a.refunded_minor))return publicAttempt(a);await this.settle(c,a,o,result.status,result.refunded);return publicAttempt(a);});
  }
}
module.exports={PaymentService,publicAttempt};
