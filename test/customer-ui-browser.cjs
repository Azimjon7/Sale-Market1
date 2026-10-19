'use strict';
const {chromium}=require('playwright'),{customerUiFixture}=require('./customer-ui-fixture.cjs'),assert=require('assert/strict'),fs=require('fs'),path=require('path');
(async()=>{const c=await customerUiFixture();const server=c.app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port,out=path.resolve('.local-tests/dodola-v3');fs.mkdirSync(out,{recursive:true});let browser;const errors=[],checks=[],issues=[];
 try{browser=await chromium.launch({headless:true,channel:'msedge'});
 for(const width of [375,430,768,1024,1440]){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const csrf=(await(await page.request.get(base+'/api/auth/session')).json()).csrfToken;
  const login=await page.request.post(base+'/api/auth/login',{headers:{'X-CSRF-Token':csrf},data:c.credentials});assert.equal(login.status(),200);
  await page.goto(base+'/account.html');await page.locator('#recentOrders .order-row').first().waitFor();
  await page.evaluate(()=>localStorage.setItem('mujskoy_cart',JSON.stringify([{productId:'p1',qty:1}])));
  const pages=[['profile','account.html','#recentOrders .order-row'],['orders','account.html#orders','#ordersList .order-row'],['addresses','account.html#addresses','#addressesList .account-row'],['profile-payments','account.html#payments','#providerStatus p'],['order-details','payment.html?order='+c.orders[0].id,'.d-order-item'],['payment-status','payment.html?order='+c.orders[1].id,'#paymentMethods button'],['checkout','checkout.html','#checkoutTotals .grand'],['cart','shop-cart.html','.market-cart-card'],['catalog','shop.html','.product__item'],['home','index.html','.dodola-header'],['product','product-details.html?id=p1','#productDetailApp h2'],['tracking','track-order.html','#orderNumber'],['contact','contact.html','.dodola-header'],['receipt','success.html?orderNumber='+c.orders[0].orderNumber+'&total=999999999&date=2000-01-01','#successTitle'],['reset','reset-password.html','.auth-card']];
  for(const [name,url,selector] of pages){await page.goto(base+'/'+url);try{await page.locator(selector).first().waitFor({timeout:30000});}catch(error){console.error(JSON.stringify({name,width,url:page.url(),body:(await page.locator('body').innerText()).slice(0,2000)}));throw error;}await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(150);
   const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,bg:getComputedStyle(document.body).backgroundColor,old:/sale[ -]?market/i.test(document.body.innerText),header:document.querySelector('.dodola-header').getBoundingClientRect().height}));
   if(metrics.overflow)issues.push({name,width,type:'overflow',elements:await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>{const b=e.getBoundingClientRect();return b.width&&b.right>innerWidth+2&&getComputedStyle(e).position!=='fixed';}).slice(0,8).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width})))});
   if(metrics.old)issues.push({name,width,type:'old-brand'});
   if(metrics.bg!=='rgb(252, 250, 247)')issues.push({name,width,type:'background',value:metrics.bg});
   checks.push({name,width,...metrics});
   if([375,1440].includes(width))await page.screenshot({path:path.join(out,name+'-'+width+'.png'),fullPage:true});
   if(name==='receipt'){assert.equal(await page.locator('#successTotal').innerText(),'Shaxsiy kabinetda');assert.ok(!(await page.locator('#successDate').innerText()).includes('2000'));}
   if(name==='payment-status'||name==='order-details'){assert.equal(await page.locator('#paymentMethods button:enabled').count(),0);assert.ok(!(await page.locator('#paymentTitle').innerText()).includes('To‘landi'));}
  }
  // Address ownership and mutation flow use the real local API, including confirmation dialog.
  if(width===375){await page.goto(base+'/account.html#addresses');await page.locator('[data-primary]').first().click();await page.getByText('Asosiy manzil tanlandi.',{exact:true}).waitFor();await page.reload();assert.equal(await page.locator('#addressesList .d-badge').count(),1);
   await page.locator('[data-delete]').last().click();await page.locator('#addressDeleteDialog').waitFor();await page.getByRole('button',{name:'Qaytish',exact:true}).click();assert.equal(await page.locator('#addressesList .account-row').count(),2);
   await page.goto(base+'/account.html#settings');await page.fill('#profileForm [name=firstName]','Dilnoza');await page.locator('#profileForm button').click();await page.getByText('Ma’lumotlar saqlandi.',{exact:true}).waitFor();}
  await context.close();
  const guest=await browser.newContext({viewport:{width,height:1000}});await guest.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());const auth=await guest.newPage();auth.on('pageerror',e=>errors.push(e.message));
  for(const mode of ['login','register','forgot']){await auth.goto(base+'/auth.html');await auth.waitForFunction(()=>document.getElementById('loginTab').onclick);if(mode==='register')await auth.click('#registerTab');if(mode==='forgot')await auth.click('#forgotBtn');assert.equal(await auth.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);checks.push({name:mode,width});if([375,1440].includes(width))await auth.screenshot({path:path.join(out,mode+'-'+width+'.png'),fullPage:true});}
  if(width===375){await auth.goto(base+'/auth.html');await auth.waitForFunction(()=>document.getElementById('loginTab').onclick);await auth.fill('#identifier',c.credentials.identifier);await auth.fill('#loginPassword',c.credentials.password);await auth.locator('#loginForm').getByRole('button',{name:'Kirish',exact:true}).click();await auth.waitForURL('**/account.html');await auth.locator('#recentOrders .order-row').first().waitFor();}
  await guest.close();
 }
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,issues,pageErrors:errors},null,2));console.log(JSON.stringify({checks:checks.length,issues,pageErrors:errors,screenshots:out}));assert.deepEqual(errors,[]);assert.deepEqual(issues,[]);
 }finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,issues,pageErrors:errors},null,2));if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));await c.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
