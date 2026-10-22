'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createAdminNotifier}=require('../utils/adminNotifications');
const {buildMessage}=require('../utils/telegram');
test('configured owner receives clear unpaid order email when Telegram is absent',async()=>{
 const sent=[],service={status:()=>({configured:true}),send:async message=>sent.push(message)};
 const notifier=createAdminNotifier({env:{ADMIN_NOTIFICATION_EMAIL:'owner@example.invalid'},mailer:service});
 assert.deepEqual(notifier.status(),{configured:true,channel:'email'});
 await notifier.notify({id:'synthetic-order',orderNumber:'DOD-ORD-1001',name:'Test',phone:'+998008000001',address:'Test address',paymentPreference:'click',total:1000,items:[{sku:'DOD-0001',name:'Test',qty:1,price:1000}]});
 assert.equal(sent.length,1);assert.equal(sent[0].to,'owner@example.invalid');assert.equal(sent[0].idempotencyKey,'dodola-order-synthetic-order');
 assert.ok(sent[0].text.includes('Onlayn to‘lov olinmagan'));assert.ok(sent[0].text.includes('Click'));
});
test('unconfigured notifications fail explicitly and Telegram keeps its existing route',async()=>{
 const mailer={status:()=>({configured:false})};
 await assert.rejects(createAdminNotifier({env:{},mailer}).notify({}),/NOT_CONFIGURED/);
 let calls=0;const notifier=createAdminNotifier({env:{TELEGRAM_BOT_TOKEN:'synthetic',TELEGRAM_CHAT_ID:'synthetic'},mailer,telegram:async()=>calls++});
 await notifier.notify({});assert.equal(calls,1);assert.equal(notifier.status().channel,'telegram');
});
test('Telegram order notice is privacy-minimized and never claims payment success',()=>{
 const message=buildMessage({id:'secret-id',orderNumber:'DOD-ORD-1002',name:'Private Person',phone:'+998901234567',address:'Private address',note:'Private note',paymentPreference:'payme',total:123000,items:[{name:'Private product',qty:2,price:61500}]});
 assert.ok(message.includes('DOD-ORD-1002'));assert.ok(message.includes('123 000 UZS'));assert.ok(message.includes('Payme'));
 assert.ok(message.includes('Onlayn to‘lov olinmagan'));
 for(const secret of ['Private Person','+998901234567','Private address','Private note','Private product']) assert.ok(!message.includes(secret));
});
