'use strict';
const fs=require('fs'),{Resend}=require('resend');
const {createAdminNotifier}=require('../../utils/adminNotifications');
async function run(config,statusId) {
  if(process.env.BETA_EMAIL_CHECK_APPROVED!=='yes')throw new Error('EMAIL_TEST_APPROVAL_REQUIRED');
  const env=require('dotenv').parse(fs.readFileSync(config));
  if(!env.ADMIN_NOTIFICATION_EMAIL||env.ADMIN_NOTIFICATION_EMAIL!==env.RESEND_TEST_RECIPIENT)throw new Error('CONFIGURED_TEST_OWNER_REQUIRED');
  let id=statusId;
  if(!id) {
    const result=await createAdminNotifier({env}).notify({id:'beta-tcloud-delivery-check-20261020',orderNumber:'TEST-TCLOUD-20261020',
      name:'TCLOUD EMAIL TESTI — haqiqiy buyurtma emas',phone:'Test',address:'Test',total:0,items:[],note:'Faqat xabar yetkazilishini tekshirish. Mahsulot buyurtma qilinmadi, hech qanday to‘lov olinmadi.'});
    if(!result.accepted||!result.id)throw new Error('EMAIL_NOT_ACCEPTED');id=result.id;
  }
  const status=await new Resend(env.RESEND_API_KEY).emails.get(id);
  const deliveryStatus=status.data?.last_event||'not_available';
  return {accepted:true,id,deliveryStatus,deliveryVerified:['delivered','opened','clicked'].includes(deliveryStatus)};
}
if(require.main===module)run(process.argv[2],process.argv[3]).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(JSON.stringify({ok:false,code:error.code||'BETA_EMAIL_CHECK_FAILED',providerCode:error.providerCode||null,providerStatus:error.providerStatus||null}));process.exitCode=1;});
module.exports={run};
