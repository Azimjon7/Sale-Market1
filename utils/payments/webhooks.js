'use strict';
const rpcError=(code,message,data)=>({error:{code,message:{uz:message,ru:message,en:message},...(data?{data}:{})}});
const paymeState=a=>a.status==='paid'?2:a.status==='refunded'?-2:['cancelled','failed'].includes(a.status)?-1:1;
const paymeResult=a=>({transaction:a.id,state:paymeState(a),create_time:Number(a.created_at),perform_time:Number(a.paid_at||0),cancel_time:Number(a.cancelled_at||0),reason:a.cancel_reason??null});
function installWebhooks(app,service){
  const {adapters,pool}=service;
  app.post('/api/payments/webhooks/payme',async(req,res)=>{
    const rpc=req.body||{},p=rpc.params||{},adapter=adapters.payme;
    const reply=value=>res.json({id:rpc.id??null,...value});
    if(!adapter.enabled)return reply(rpcError(-32400,'To‘lov xizmati ulanmagan.'));
    if(!adapter.auth(req))return reply(rpcError(-32504,'Ruxsat yo‘q.'));
    try{
      if(rpc.method==='GetStatement'){
        if(!Number.isSafeInteger(p.from)||!Number.isSafeInteger(p.to)||p.to<p.from||p.to-p.from>31*86400000)return reply(rpcError(-32602,'Vaqt oralig‘i yaroqsiz.'));
        const rows=(await pool.query("SELECT * FROM payment_attempts WHERE provider='payme' AND mode=$1 AND provider_time >= $2 AND provider_time <= $3 ORDER BY provider_time",[adapter.mode,p.from,p.to])).rows;
        return reply({result:{transactions:rows.map(a=>({id:a.provider_id,time:Number(a.provider_time),amount:Number(a.amount_minor),account:{order_id:a.id},...paymeResult(a),receivers:null}))}});
      }
      if(!['CheckPerformTransaction','CreateTransaction','PerformTransaction','CancelTransaction','CheckTransaction'].includes(rpc.method))return reply(rpcError(-32601,'Metod topilmadi.'));
      let id;
      if(['CheckPerformTransaction','CreateTransaction'].includes(rpc.method))id=p.account?.order_id;
      else {const found=(await pool.query("SELECT id FROM payment_attempts WHERE provider='payme' AND mode=$1 AND provider_id=$2",[adapter.mode,String(p.id||'')])).rows[0];id=found?.id;}
      if(typeof id!=='string'||id.length>100)return reply(rpcError(-31003,'Tranzaksiya topilmadi.'));
      const result=await service.transaction(async c=>{
        const {a,order}=await service.locked(c,id);
        if(a.provider!=='payme'||a.mode!==adapter.mode)return rpcError(-31050,'Hisob topilmadi.','order_id');
        if(['CheckPerformTransaction','CreateTransaction'].includes(rpc.method)){
          if(!Number.isSafeInteger(p.amount)||p.amount!==Number(a.amount_minor))return rpcError(-31001,'Summa mos emas.');
          if(rpc.method==='CheckPerformTransaction'){service.payable(order,a);if(!['created','pending'].includes(a.status))return rpcError(-31008,'To‘lov yakunlangan.');return {result:{allow:true}};}
          if(!/^[a-f0-9]{24}$/i.test(String(p.id))||!Number.isSafeInteger(p.time)||p.time>Date.now()+300000)return rpcError(-32602,'Tranzaksiya parametrlari yaroqsiz.');
          if(a.provider_id&&(a.provider_id!==p.id||Number(a.provider_time)!==p.time))return rpcError(-31008,'Boshqa tranzaksiya mavjud.');
          if(a.provider_id===p.id&&a.status==='paid')return {result:paymeResult(a)};
          if(!['created','pending'].includes(a.status))return rpcError(-31008,'Tranzaksiya bekor qilingan.');
          service.payable(order,a);a.provider_id=p.id;a.provider_time=p.time;
          if(Date.now()-p.time>=43200000){a.cancelled_at=Date.now();a.cancel_reason=4;await service.settle(c,a,order,'cancelled');return rpcError(-31008,'To‘lov muddati tugagan.');}
          a.status='pending';await service.save(c,a);return {result:paymeResult(a)};
        }
        if(rpc.method==='CheckTransaction')return {result:paymeResult(a)};
        if(rpc.method==='PerformTransaction'){
          if(a.status==='paid')return {result:paymeResult(a)};
          if(a.status!=='pending'||!a.provider_id)return rpcError(-31008,'Tranzaksiyani bajarib bo‘lmaydi.');
          if(Date.now()-Number(a.provider_time)>=43200000){a.cancelled_at=Date.now();a.cancel_reason=4;await service.settle(c,a,order,'cancelled');return rpcError(-31008,'To‘lov muddati tugagan.');}
          await service.settle(c,a,order,'paid');return {result:paymeResult(a)};
        }
        if(!Number.isInteger(p.reason)||p.reason<1||p.reason>10)return rpcError(-32602,'Bekor qilish sababi yaroqsiz.');
        if(['cancelled','refunded','failed'].includes(a.status))return {result:paymeResult(a)};
        if(['production','shipped','delivered'].includes(order.status))return rpcError(-31007,'Buyurtma bajarilmoqda. Merchant bilan bog‘laning.');
        const wasPaid=a.status==='paid';a.cancel_reason=p.reason;a.cancelled_at=Date.now();await service.settle(c,a,order,wasPaid?'refunded':'cancelled',wasPaid?Number(a.amount_minor):0);return {result:paymeResult(a)};
      });return reply(result);
    }catch(e){return reply(rpcError(e.code==='PAYMENT_NOT_FOUND'?-31050:e.code==='ORDER_NOT_PAYABLE'?-31008:-32400,'To‘lov tekshiruvi yakunlanmadi.'));}
  });
  app.post('/api/payments/webhooks/click',async(req,res)=>{
    const b=req.body||{},adapter=adapters.click;
    const reply=(code,note,a)=>res.json({click_trans_id:b.click_trans_id,merchant_trans_id:b.merchant_trans_id,...(a?{[String(b.action)==='0'?'merchant_prepare_id':'merchant_confirm_id']:Number(a.sequence_id)}:{}),error:code,error_note:note});
    if(!adapter.enabled)return reply(-7,'Xizmat ulanmagan');
    if(!adapter.auth(req))return reply(-1,'Imzo yaroqsiz');
    try{
      const result=await service.transaction(async c=>{
        const {a,order}=await service.locked(c,String(b.merchant_trans_id));
        if(a.provider!=='click'||a.mode!==adapter.mode)return {code:-5,note:'Buyurtma topilmadi'};
        if(adapter.amount(b)!==Number(a.amount_minor))return {code:-2,note:'Summa mos emas'};
        if(a.provider_id&&(a.provider_id!==String(b.click_trans_id)||a.provider_doc_id!==String(b.click_paydoc_id)))return {code:-9,note:'Tranzaksiya mos emas'};
        if(String(b.action)==='1'&&String(a.sequence_id)!==String(b.merchant_prepare_id))return {code:-6,note:'Prepare topilmadi'};
        if(a.status==='paid')return {code:-4,note:'To‘langan',a};
        if(['failed','cancelled','refunded'].includes(a.status))return {code:-9,note:'Bekor qilingan',a};
        if(!adapter.fresh(b))return {code:-1,note:'Imzo vaqti eskirgan'};
        service.payable(order,a);
        if(String(b.action)==='0'){
          if(String(b.error)!=='0')return {code:-9,note:'To‘lov xatosi'};
          a.provider_id=String(b.click_trans_id);a.provider_doc_id=String(b.click_paydoc_id);a.provider_time=a.provider_time||Date.parse(b.sign_time.replace(' ','T')+'+05:00');a.status='pending';await service.save(c,a);return {code:0,note:'Success',a};
        }
        if(!a.provider_id)return {code:-6,note:'Prepare topilmadi'};
        // error is not covered by CLICK's signature. Verify the provider ledger before accepting success.
        const verified=await adapter.reconcile(a);
        if(verified.status!=='paid')return {code:-7,note:'Click tekshiruvi kutilmoqda',a};
        await service.settle(c,a,order,'paid');return {code:0,note:'Success',a};
      });return reply(result.code,result.note,result.a);
    }catch{return reply(-7,'To‘lov tekshiruvi yakunlanmadi');}
  });
  app.post('/api/payments/webhooks/uzum',async(req,res)=>{
    // This public notification is a hint only: never trust its claimed state or amount.
    // TLS-authenticated server-to-server lookup supplies every authoritative field.
    if(!adapters.uzum.enabled)return res.sendStatus(503);
    try{const id=String(req.body?.orderNumber||'');const a=(await pool.query("SELECT id,provider_id FROM payment_attempts WHERE id=$1 AND provider='uzum' AND mode=$2",[id,adapters.uzum.mode])).rows[0];
      if(!a||a.provider_id!==String(req.body?.orderId))return res.sendStatus(404);
      await service.reconcile(a.id,async()=>{});res.json({received:true});
    }catch{res.status(503).json({message:'Tekshiruvni qayta yuboring.'});}
  });
}
module.exports={installWebhooks,paymeResult};
