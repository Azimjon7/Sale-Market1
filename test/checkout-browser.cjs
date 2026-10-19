'use strict';
const {fixture}=require('./checkout-fixture.cjs');
const {chromium}=require('playwright');const assert=require('assert/strict'),fs=require('fs'),path=require('path');
(async()=>{
 const c=await fixture();const server=c.app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 const out=path.resolve('.local-tests/checkout-browser');fs.mkdirSync(out,{recursive:true});
 let browser;let count=0;const errors=[];
 try{browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
  for(const width of [1440,390,320]){
   const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/checkout.html');await page.evaluate(()=>localStorage.setItem('mujskoy_cart',JSON.stringify([{productId:'p1',qty:1}])));await page.reload();
   await page.locator('#checkoutTotals .grand').waitFor();assert.match(await page.locator('#checkoutTotals').innerText(),/100/);
   assert.equal(await page.locator('input[autocomplete="cc-number"], input[name="cvv"], input[type="file"]').count(),0);
   await page.selectOption('#city','outside');assert.equal(await page.locator('#placeOrder').isDisabled(),true);await page.selectOption('#city','tashkent-city');
   await page.fill('#promoCode','SAVE20');await page.locator('#promoForm button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#checkoutTotals').innerText.includes('80'));assert.match(await page.locator('#checkoutTotals').innerText(),/80/);
   await page.fill('#name','Sinov Mijoz');await page.fill('#phone','+998900000001');await page.selectOption('#district','Chilonzor');await page.fill('#street','Sinov ko‘chasi');await page.fill('#house','24');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal overflow at '+width);
   await page.screenshot({path:path.join(out,'checkout-'+width+'.png'),fullPage:true});
   if(width===390){
    const failures=[{status:400,body:'{"error":"Manzil xatosi"}'},{status:500,body:'{"error":"Server xatosi"}'},{status:200,body:'{"success":true}'},{status:200,body:'{"success":false,"order":{"id":"fake"}}'},{status:200,body:'not json'}];
    for(const fail of failures){await page.route('**/api/orders',r=>r.fulfill({...fail,contentType:'application/json'}));await page.click('#placeOrder');await page.waitForFunction(()=>!document.querySelector('#placeOrder').disabled);assert.equal(await page.evaluate(()=>MBStore.getCart().length),1);await page.unroute('**/api/orders');count++;}
    await page.route('**/api/orders',r=>r.abort());await page.click('#placeOrder');await page.waitForFunction(()=>!document.querySelector('#placeOrder').disabled);assert.equal(await page.evaluate(()=>MBStore.getCart().length),1);await page.unroute('**/api/orders');count++;
   }
   await page.click('#placeOrder');await page.waitForURL('**/payment.html?order=*');await page.locator('.payment-state').waitFor();assert.match(await page.locator('#paymentTitle').innerText(),/tasdig‘i/);assert.equal(await page.locator('#paymentMethods button').count(),4);assert.equal(await page.locator('#paymentMethods button:enabled').count(),0);
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mujskoy_cart')).length),0);
   await page.screenshot({path:path.join(out,'confirmation-'+width+'.png'),fullPage:true});count+=5;await context.close();
  }
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/auth.html');
  const token=(await(await page.request.get(base+'/api/auth/session')).json()).csrfToken;
  let r=await page.request.post(base+'/api/auth/register',{headers:{'X-CSRF-Token':token},data:{firstName:'Sinov',lastName:'Mijoz',phone:'+998900000002',email:'browser@example.invalid',password:'SyntheticPass123',confirmPassword:'SyntheticPass123'}});assert.equal(r.status(),201);
  r=await page.request.post(base+'/api/auth/login',{headers:{'X-CSRF-Token':token},data:{identifier:'+998900000002',password:'SyntheticPass123'}});assert.equal(r.status(),200);
  await page.goto(base+'/account.html#addresses');await page.locator('#addressDistrict option').nth(1).waitFor({state:'attached'});await page.fill('#addressForm [name=label]','Uy');await page.selectOption('#addressDistrict','Chilonzor');await page.fill('#addressStreet','Sinov ko‘chasi');await page.fill('#addressHouse','24');await page.click('#addressForm button');await page.waitForFunction(()=>document.querySelector('#addressesList').innerText.includes('24-uy'));
  await page.click('[data-section=payments]');await page.locator('#providerStatus').getByText('Payme',{exact:false}).waitFor();await page.selectOption('#paymentPreference','uzum');assert.equal(await page.evaluate(()=>localStorage.getItem('dodola_payment_preference')),'uzum');
  await page.screenshot({path:path.join(out,'profile-payments-390.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);count+=4;await context.close();
  const adminContext=await browser.newContext({viewport:{width:1440,height:1000}}),admin=await adminContext.newPage();admin.on('pageerror',e=>errors.push(e.message));
  const login=await admin.request.post(base+'/api/admin/login',{data:{username:'test-admin',password:'synthetic-password'}});const adminToken=(await login.json()).token;
  await adminContext.addInitScript(token=>localStorage.setItem('mb_admin_token',token),adminToken);
  await admin.goto(base+'/admin.html');await admin.click('#menuPromocodes');await admin.locator('.js-edit-promo[data-code=ONCE10]').click();
  assert.equal(await admin.locator('#promoLimit').inputValue(),'1');assert.equal(await admin.locator('#promoMax').inputValue(),'8000');
  await admin.fill('#promoCodeInput','BROWSER15');await admin.fill('#promoDiscountInput','15');await admin.locator('#sectionPromocodes').getByRole('button',{name:'Saqlash',exact:true}).click();await admin.locator('.js-edit-promo[data-code=BROWSER15]').waitFor();
  await admin.getByRole('button',{name:'Ulanish holatini tekshirish',exact:true}).click();await admin.locator('#paymentConfiguration').getByText('Oxirgi 100 to‘lov urinishi',{exact:true}).waitFor();assert.match(await admin.locator('#paymentConfiguration').innerText(),/Sinov muhiti/);
  await admin.screenshot({path:path.join(out,'admin-promos-payments-1440.png'),fullPage:true});count+=4;await adminContext.close();
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:count,pageErrors:errors,screenshots:out}));
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));await c.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

