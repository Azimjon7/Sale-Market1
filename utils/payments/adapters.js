'use strict';
const crypto=require('crypto');
const {minor}=require('../commerceRules');
const equal=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y);};
const error=(message,code='PAYMENT_UNAVAILABLE')=>Object.assign(new Error(message),{status:409,code});
function createAdapters(env={},fetcher=fetch){
  const mode=env.PAYMENT_MODE==='sandbox'?'sandbox':env.PAYMENT_MODE==='live'?'live':'disabled';
  // An explicit operational gate, separate from merely supplying credentials.
  const allowed=mode==='sandbox'||(mode==='live'&&env.PAYMENT_LIVE_APPROVED==='yes');
  const returnBase=env.PAYMENT_RETURN_ORIGIN||'';
  const validReturn=/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(returnBase)||(mode==='sandbox'&&/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(returnBase));
  const returnUrl=id=>`${returnBase}/payment.html?attempt=${encodeURIComponent(id)}`;
  const payme={id:'payme',label:'Payme',mode,enabled:!!(allowed&&validReturn&&env.PAYME_MERCHANT_ID&&env.PAYME_KEY),
    auth(req){return equal(req.get('authorization')||'', 'Basic '+Buffer.from('Paycom:'+env.PAYME_KEY).toString('base64'));},
    async checkout(a){const params=`m=${env.PAYME_MERCHANT_ID};ac.order_id=${a.id};a=${a.amount_minor};l=uz;c=${returnUrl(a.id)}`;
      return {url:`https://${mode==='sandbox'?'checkout.test.paycom.uz':'checkout.paycom.uz'}/${Buffer.from(params).toString('base64')}`};}};
  const click={id:'click',label:'Click',mode,
    enabled:!!(allowed&&validReturn&&env.CLICK_MERCHANT_ID&&env.CLICK_SERVICE_ID&&env.CLICK_SECRET_KEY&&env.CLICK_MERCHANT_USER_ID&&(mode!=='sandbox'||env.CLICK_TEST_SERVICE_CONFIRMED==='yes')),
    auth(req){const b=req.body||{};
      if(!['0','1'].includes(String(b.action))||String(b.service_id)!==String(env.CLICK_SERVICE_ID)||!/^\d+$/.test(String(b.click_trans_id))||!/^\d+$/.test(String(b.click_paydoc_id)))return false;
      const fields=[b.click_trans_id,b.service_id,env.CLICK_SECRET_KEY,b.merchant_trans_id,...(String(b.action)==='1'?[b.merchant_prepare_id]:[]),b.amount,b.action,b.sign_time];
      if(fields.some(v=>v==null||typeof v==='object'))return false;
      const signature=crypto.createHash('md5').update(fields.join('')).digest('hex');
      return /^[a-f0-9]{32}$/i.test(String(b.sign_string))&&equal(signature,String(b.sign_string).toLowerCase());},
    fresh(b){const t=/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(String(b.sign_time))?Date.parse(b.sign_time.replace(' ','T')+'+05:00'):NaN;return Number.isFinite(t)&&Math.abs(Date.now()-t)<10*60*1000;},
    amount:b=>minor(b.amount),
    async reconcile(a){
      if(!a.provider_doc_id)return {status:'pending',refunded:0};
      const timestamp=Math.floor(Date.now()/1000),digest=crypto.createHash('sha1').update(String(timestamp)+env.CLICK_SECRET_KEY).digest('hex');
      const headers={Accept:'application/json',Auth:`${env.CLICK_MERCHANT_USER_ID}:${digest}:${timestamp}`};
      const date=new Date(Number(a.provider_time||a.created_at)+5*3600000).toISOString().slice(0,10);
      // click_paydoc_id is unsigned. Bind it through the authenticated merchant ledger
      // before looking up its status; a valid signature alone cannot establish this link.
      const linked=await fetcher(`https://api.click.uz/v2/merchant/payment/status_by_mti/${encodeURIComponent(env.CLICK_SERVICE_ID)}/${encodeURIComponent(a.id)}/${date}`,{redirect:'error',signal:AbortSignal.timeout(15000),headers});
      const binding=await linked.json();
      if(!linked.ok||binding.error_code!==0||String(binding.merchant_trans_id)!==a.id||String(binding.payment_id)!==a.provider_doc_id)throw error('Click buyurtmasi to‘lovga mos emas.','PAYMENT_BINDING_MISMATCH');
      const r=await fetcher(`https://api.click.uz/v2/merchant/payment/status/${encodeURIComponent(env.CLICK_SERVICE_ID)}/${encodeURIComponent(a.provider_doc_id)}`,{redirect:'error',signal:AbortSignal.timeout(15000),headers:{Accept:'application/json',Auth:`${env.CLICK_MERCHANT_USER_ID}:${digest}:${timestamp}`}});
      const body=await r.json();if(!r.ok||body.error_code!==0||String(body.payment_id)!==a.provider_doc_id)throw error('Click to‘lovini tekshirish yakunlanmadi.','RECONCILIATION_REQUIRED');
      // Unknown status values never authorize fulfillment or a new charge.
      return {status:body.payment_status===1?'paid':'pending',refunded:0};
    },
    async checkout(a){const u=new URL('https://my.click.uz/services/pay');u.search=new URLSearchParams({service_id:env.CLICK_SERVICE_ID,merchant_id:env.CLICK_MERCHANT_ID,amount:(Number(a.amount_minor)/100).toFixed(2),transaction_param:a.id,return_url:returnUrl(a.id)});return {url:u.href};}};
  const uzumBase=env.UZUM_API_ORIGIN||'';
  // Terminal-specific sandbox endpoint and redirect host must be supplied by Uzum.
  const uzum={id:'uzum',label:'Uzum',mode,enabled:!!(allowed&&validReturn&&env.UZUM_TERMINAL_ID&&env.UZUM_API_KEY&&/^https:\/\/[a-z0-9.-]+\.uzumbank\.uz$/.test(uzumBase)&&env.UZUM_CHECKOUT_HOST&&env.UZUM_FISCALIZATION_READY==='yes'),
    async call(path,body){const r=await fetcher(uzumBase+path,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json','Content-Language':'uz-UZ','X-Terminal-Id':env.UZUM_TERMINAL_ID,'X-API-Key':env.UZUM_API_KEY},body:JSON.stringify(body)});
      const data=await r.json();if(!r.ok||data.errorCode!==0||!data.result)throw error('Provayder javobi aniqlashtirilmoqda. Qayta to‘lamang.','PROVIDER_UNCERTAIN');return data.result;},
    async checkout(a){const r=await this.call('/api/v1/payment/register',{clientId:a.order_id,currency:860,orderNumber:a.id,amount:Number(a.amount_minor),viewType:'REDIRECT',paymentParams:{payType:'ONE_STEP',operationType:'PAYMENT'},sessionTimeoutSecs:1800,successUrl:returnUrl(a.id),failureUrl:returnUrl(a.id)});
      const url=new URL(r.paymentRedirectUrl);if(url.protocol!=='https:'||url.hostname!==env.UZUM_CHECKOUT_HOST||url.username||url.password||!r.orderId)throw error('Provayder havolasi tekshiruvdan o‘tmadi.','PROVIDER_UNCERTAIN');return {url:url.href,providerId:String(r.orderId)};},
    async reconcile(a){if(!a.provider_id)throw error('Ro‘yxatdan o‘tkazish natijasi noaniq. Merchant kabinetida tekshirish kerak.','RECONCILIATION_REQUIRED');
      const r=await this.call('/api/v1/payment/getOrderStatus',{orderId:a.provider_id});
      if(r.orderId!==a.provider_id||r.merchantOrderId!==a.id||r.amount!==Number(a.amount_minor))throw error('Provayderdagi buyurtma yoki summa mos emas.','PAYMENT_BINDING_MISMATCH');
      const refunded=Number(r.refundedAmount)+Number(r.reversedAmount);
      if(!Number.isSafeInteger(refunded)||refunded<0||refunded>Number(a.amount_minor))throw error('Qaytarilgan summa mos emas.','PAYMENT_BINDING_MISMATCH');
      if(refunded>0) return {status:refunded===Number(a.amount_minor)?'refunded':'partially_refunded',refunded};
      if(r.status==='COMPLETED'&&r.completedAmount===Number(a.amount_minor))return {status:'paid',refunded:0};
      if(r.status==='DECLINED')return {status:'failed',refunded:0};
      return {status:'pending',refunded:0};}};
  return {payme,click,uzum};
}
module.exports={createAdapters,equal,error};
