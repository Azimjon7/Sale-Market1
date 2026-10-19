'use strict';
const {marketplaceFixture}=require('./marketplace-fixture.cjs');
const {chromium}=require('playwright'),assert=require('assert/strict'),fs=require('fs'),path=require('path');
(async()=>{
 const c=await marketplaceFixture({readOnly:true}),server=c.app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base='http://127.0.0.1:'+server.address().port,out=path.resolve('.local-tests/final-polish-interactions');fs.mkdirSync(out,{recursive:true});
 let browser,count=0;const errors=[],measurements=[];
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  for(const width of [320,360,375,390,430,768,1024,1440]){
   const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   assert.equal((await(await context.request.get(base+'/api/health')).json()).publicWritesEnabled,false);
   const csrf=(await(await context.request.get(base+'/api/auth/session')).json()).csrfToken;
   assert.equal((await context.request.post(base+'/api/auth/login',{headers:{'X-CSRF-Token':csrf},data:c.credentials})).status(),200);
   await page.goto(base+'/account.html');await page.evaluate(()=>localStorage.setItem('mujskoy_cart',JSON.stringify([{productId:'p1',qty:1},{productId:'p2',qty:2}])));
   await page.goto(base+'/checkout.html');await page.locator('#checkoutTotals .grand').waitFor();await page.waitForFunction(()=>document.querySelector('#house').value==='24');
   assert.equal(await page.locator('#orderSummary').evaluate(e=>e.open),width>760);assert.equal(await page.locator('#summaryCount').innerText(),'3 ta mahsulot');count+=2;
   if(width<=760){await page.locator('#orderSummary summary').click();assert.equal(await page.locator('#checkoutItems').isVisible(),true);await page.locator('#orderSummary summary').press('Enter');assert.equal(await page.locator('#checkoutItems').isVisible(),false);count+=2;}
   for(const id of ['payme','click','uzum','card']){await page.locator('input[value="'+id+'"]').check();assert.equal(await page.locator('input[value="'+id+'"]').isChecked(),true);count++;}
   assert.equal(await page.locator('input[autocomplete="cc-number"],input[name="cvv"]').count(),0);count++;
   await page.selectOption('#city','outside');assert.equal(await page.locator('#placeOrder').isDisabled(),true);await page.selectOption('#city','tashkent-city');count++;
   await page.fill('#promoCode','SAVE20');await page.locator('#promoForm button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#checkoutTotals').innerText.includes('Chegirma'));
   assert.equal(await page.locator('#summaryTotal').innerText(),await page.locator('#checkoutActionTotal').innerText());
   const quote=await(await context.request.post(base+'/api/checkout/quote',{data:{items:[{productId:'p1',qty:1},{productId:'p2',qty:2}],promoCode:'SAVE20'}})).json();assert.equal(Number((await page.locator('#checkoutActionTotal').innerText()).replace(/\D/g,'')),quote.total);count+=2;
   await page.locator('#removePromo').click();await page.waitForFunction(()=>!document.querySelector('#checkoutTotals').innerText.includes('Chegirma'));count++;
   await page.fill('#promoCode','DOESNOTEXIST');await page.locator('#promoForm button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#promoMessage').innerText.length>0&&!document.querySelector('#promoForm button[type=submit]').disabled);assert.equal(await page.locator('#removePromo').isVisible(),false);count++;
   await page.selectOption('#savedAddress','');assert.equal(await page.locator('#street').inputValue(),'');assert.equal(await page.locator('#district').inputValue(),'');assert.equal(await page.locator('#checkoutForm').evaluate(e=>e.checkValidity()),false);count+=3;
   await page.selectOption('#savedAddress',{index:1});assert.equal(await page.locator('#street').inputValue(),'Sinov ko‘chasi');count++;
   await page.locator('#phone').focus();if(width<=760)assert.equal(await page.locator('.checkout-submit').evaluate(e=>getComputedStyle(e).position),'static');
   await page.locator('#phone').evaluate(e=>e.blur());await page.waitForTimeout(50);if(width<=760)assert.equal(await page.locator('.checkout-submit').evaluate(e=>getComputedStyle(e).position),'fixed');count+=2;
   const blocked=page.waitForResponse(r=>r.url()===base+'/api/orders');await page.click('#placeOrder');assert.equal((await blocked).status(),503);await page.waitForFunction(()=>!document.querySelector('#placeOrder').disabled);assert.equal(await page.evaluate(()=>MBStore.getCart().length),2);assert.equal(page.url(),base+'/checkout.html');count+=3;
   await page.locator('.checkout-optional summary').click();await page.fill('#note','Mahalla darvozasi');assert.equal(await page.locator('#note').inputValue(),'Mahalla darvozasi');count++;
   await page.evaluate(()=>document.activeElement.blur());await page.waitForTimeout(50);
   const m=await page.evaluate(()=>({width:innerWidth,height:document.body.scrollHeight,overflow:document.documentElement.scrollWidth>innerWidth,bar:getComputedStyle(document.querySelector('.checkout-submit')).position,cardHeights:[...document.querySelectorAll('.payment-choice')].map(e=>e.getBoundingClientRect().height)}));assert.equal(m.overflow,false);assert.ok(m.cardHeights.every(h=>h>=44));measurements.push(m);count+=2;
   if(width===390){await page.screenshot({path:path.join(out,'checkout-validation-390.png'),fullPage:true});await page.locator('.checkout-optional summary').click();await page.locator('#orderSummary summary').click();await page.screenshot({path:path.join(out,'checkout-expanded-390.png'),fullPage:true});}
   await context.close();
  }
  assert.deepEqual(errors,[]);const result={passed:count,errors,measurements};fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));await c.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
