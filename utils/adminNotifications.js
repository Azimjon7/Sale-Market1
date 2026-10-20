'use strict';
const {createResendEmailService}=require('./resendEmail');
const {sendOrderNotification}=require('./telegram');
function createAdminNotifier({env=process.env,mailer,telegram=sendOrderNotification}={}) {
  const email=String(env.ADMIN_NOTIFICATION_EMAIL||'').trim();
  const hasTelegram=Boolean(env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_CHAT_ID);
  const service=mailer||createResendEmailService({apiKey:env.RESEND_API_KEY,from:env.EMAIL_FROM,baseUrl:env.AUTH_BASE_URL,testRecipient:env.RESEND_TEST_RECIPIENT});
  const emailReady=Boolean(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&service.status().configured);
  const status=()=>({configured:hasTelegram||emailReady,channel:hasTelegram?'telegram':emailReady?'email':null});
  const notify=async order=>{
    if(hasTelegram)return telegram(order);
    if(!emailReady)throw new Error('ADMIN_NOTIFICATION_NOT_CONFIGURED');
    const methods={click:'Click',payme:'Payme',uzum:'Uzum',card:'Bank kartasi'};
    const text=['Dodola — yangi buyurtma',order.orderNumber||order.id,'Holat: mavjudlik tasdig‘i kutilmoqda.',
      'Onlayn to‘lov olinmagan.',`Mijoz: ${order.name}`,`Telefon: ${order.phone}`,`Manzil: ${order.address}`,
      `To‘lov istagi: ${methods[order.paymentPreference]||'Belgilanmagan'}`,
      ...(order.items||[]).map(item=>`${item.sku||item.productId}: ${item.name} × ${item.qty} — ${item.price} so‘m`),
      `Jami: ${order.total} so‘m`,order.note?`Izoh: ${order.note}`:'','Admin panelda buyurtmani tekshiring.'].filter(Boolean).join('\n');
    return service.send({to:email,subject:'Dodola buyurtma: '+(order.orderNumber||order.id),text,idempotencyKey:'dodola-order-'+order.id});
  };
  return {notify,status};
}
module.exports={createAdminNotifier};
