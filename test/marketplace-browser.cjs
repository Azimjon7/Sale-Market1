'use strict';
const {chromium}=require('playwright'),{marketplaceFixture}=require('./marketplace-fixture.cjs');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{
 const c=await marketplaceFixture({readOnly:process.env.QA_READ_ONLY==='1'}),server=c.app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base='http://127.0.0.1:'+server.address().port,out=path.resolve(process.env.QA_OUTPUT||'.local-tests/dodola-marketplace');fs.mkdirSync(out,{recursive:true});
 const checks=[],issues=[],errors=[];let browser;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});const seed=await browser.newContext();
  if(process.env.QA_READ_ONLY==='1'){
   assert.equal((await(await seed.request.get(base+'/api/health')).json()).publicWritesEnabled,false);
   assert.equal((await seed.request.post(base+'/api/orders',{data:{}})).status(),503);
  }
  const csrf=(await(await seed.request.get(base+'/api/auth/session')).json()).csrfToken;
  assert.equal((await seed.request.post(base+'/api/auth/login',{headers:{'X-CSRF-Token':csrf},data:c.credentials})).status(),200);
  const state=await seed.storageState();await seed.close();
  for(const width of (process.env.QA_WIDTHS?process.env.QA_WIDTHS.split(',').map(Number):[320,360,375,390,393,412,430,480,768,1024,1440])){
   const context=await browser.newContext({storageState:state,viewport:{width,height:844},reducedMotion:'reduce'});
   await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
   const page=await context.newPage();page.on('pageerror',e=>errors.push({width,message:e.message}));
   await page.goto(base+'/account.html');await page.evaluate(()=>localStorage.setItem('mujskoy_cart',JSON.stringify([{productId:'p1',qty:1},{productId:'p2',qty:2}])));
   const category=encodeURIComponent(c.catalogSample.length?'Mebel':'');
   const pages=[['home','index.html','.lx-photo-link'],['catalog','shop.html','.product__item'],['category','shop.html?category='+category,'.product__item'],['offers','shop.html?sale=1','.product__item'],['product','product-details.html?id=p1','#pdMainImage'],['cart','shop-cart.html','.market-cart-card'],['checkout','checkout.html','#checkoutTotals .grand'],['profile','account.html','#recentOrders .order-row'],['orders','account.html#orders','#ordersList .order-row'],['addresses','account.html#addresses','#addressesList .account-row'],['settings','account.html#settings','#profileForm'],['payments','account.html#payments','#providerStatus p'],['order-details','payment.html?order='+c.orders[0].id,'.d-order-item'],['payment-status','payment.html?order='+c.orders[1].id,'#paymentMethods button'],['tracking','track-order.html','#orderNumber'],['receipt','success.html?orderNumber='+c.orders[0].orderNumber,'#successTitle'],['contact','contact.html','.dodola-header']];
   for(const [name,url,selector] of pages){
    if(process.env.QA_PAGES&&!process.env.QA_PAGES.split(',').includes(name))continue;
    await page.goto(base+'/'+url);await page.locator(selector).first().waitFor({timeout:30000});await page.evaluate(()=>document.fonts.ready);
    if(name==='home'||name==='catalog'||name==='category'||name==='offers')await page.locator('.d-catalog-image').first().waitFor();
    const metric=await page.evaluate(()=>{
     const rect=e=>{const b=e.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height};};
     const shown=e=>e&&e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&e.getBoundingClientRect().width>0;
     const controls=[...document.querySelectorAll('main input,main select,main button,main .product__item,main .checkout-card,main .account-row,main .pd-image-box,.market-cart-controls>*,.market-cart-title-row h4')].filter(shown);
     const outside=controls.filter(e=>{const b=rect(e);return b.left< -1||b.right>innerWidth+1;}).map(e=>({tag:e.tagName,cls:e.className,id:e.id,...rect(e)}));
     const bars=['mb-bottom-nav','pdStickyBar','mb-cart-checkout-bar'].map(id=>document.getElementById(id)).filter(shown).map(e=>({id:e.id,...rect(e)}));
     const images=[...document.querySelectorAll('.d-catalog-image')];
     const header=document.querySelector('.dodola-header'),logo=document.querySelector('.dodola-logo');
     return {headerHeight:header?.getBoundingClientRect().height,logoSize:parseFloat(getComputedStyle(logo).fontSize),paper:getComputedStyle(document.body).backgroundColor,overflow:document.documentElement.scrollWidth>innerWidth+1,outside,bars,imageFit:images.every(e=>getComputedStyle(e).objectFit==='contain'),lazy:images.every(e=>e.loading==='lazy'),oldBrand:/sale[ -]?market/i.test(document.body.innerText)};
    });
    if(metric.overflow||metric.outside.length||metric.oldBrand||!metric.imageFit||!metric.lazy)issues.push({width,name,...metric});
    if(process.env.QA_LUXURY==='1'&&(metric.paper!=='rgb(252, 250, 247)'||(width<=768&&(metric.headerHeight>65||metric.logoSize>26))))issues.push({width,name,type:'luxury-proportions',...metric});
    if(width<=768&&metric.bars.length>1)issues.push({width,name,type:'duplicate-fixed-bars',bars:metric.bars});
    checks.push({width,name,...metric});
    if([320,375,390,430,768,1440].includes(width)){
     // Walk the page to let native lazy images load; keep the final capture at the top.
     await page.evaluate(async()=>{const height=document.body.scrollHeight;for(let y=0;y<height;y+=650){scrollTo(0,y);await new Promise(r=>setTimeout(r,35));}scrollTo(0,0);});await page.evaluate(()=>Promise.race([Promise.allSettled([...document.images].filter(i=>i.checkVisibility()).map(i=>i.decode())),new Promise(r=>setTimeout(r,2000))]));await page.waitForTimeout(100);
     await page.screenshot({path:path.join(out,name+'-'+width+'.png'),fullPage:true});
     await page.evaluate(()=>scrollTo({top:document.body.scrollHeight,behavior:'instant'}));await page.waitForTimeout(50);
     await page.screenshot({path:path.join(out,name+'-'+width+'-bottom.png')});
     await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(50);
     await page.screenshot({path:path.join(out,name+'-'+width+'-top.png')});
    }
    if(name==='payment-status'||name==='order-details')assert.equal(await page.locator('#paymentMethods button:enabled').count(),0);
    if(name==='offers'){const prices=await page.locator('.product__oldprice').count();assert.equal(prices,await page.locator('.product__item').count());}
    if(name==='catalog'&&width===320){
     await page.click('#sct-cat-btn');await page.locator('#mhc-drawer').waitFor({state:'visible'});await page.screenshot({path:path.join(out,'category-modal-320.png')});await page.click('#mhc-close-btn');
     await page.click('#sct-sort-btn');await page.locator('#sct-sort-panel').waitFor({state:'visible'});await page.screenshot({path:path.join(out,'sort-modal-320.png')});assert.ok(await page.locator('#sct-sort-panel').evaluate(e=>e.contains(document.activeElement)));assert.equal(await page.locator('#mb-bottom-nav').isVisible(),false);await page.keyboard.press('Escape');await page.locator('#sct-sort-panel').waitFor({state:'hidden'});assert.equal(await page.locator('#sct-sort-btn').evaluate(e=>e===document.activeElement),true);
    }
    if(name==='addresses'&&width===320){await page.locator('[data-delete]').first().click();const dialog=page.locator('#addressDeleteDialog');await dialog.waitFor();const b=await dialog.boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width);await page.screenshot({path:path.join(out,'address-dialog-320.png')});await page.getByRole('button',{name:'Qaytish',exact:true}).click();}
   }
   await context.close();
   const guest=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});await guest.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());const auth=await guest.newPage();auth.on('pageerror',e=>errors.push({width,message:e.message}));
   for(const name of ['login','register','forgot','reset','verification']){
    if(process.env.QA_PAGES&&!process.env.QA_PAGES.split(',').includes(name))continue;
    await auth.goto(base+(name==='reset'?'/reset-password.html':name==='verification'?'/auth.html?verify=invalid-local-test-token':'/auth.html'));
    if(!['reset'].includes(name))await auth.waitForFunction(()=>document.getElementById('loginTab').onclick);
    if(name==='register')await auth.click('#registerTab');if(name==='forgot')await auth.click('#forgotBtn');if(name==='verification')await auth.locator('#authMessage').filter({hasText:/./}).waitFor();
    const overflow=await auth.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);if(overflow)issues.push({width,name,type:'overflow'});checks.push({width,name,overflow});
    if([320,375,390,430,768,1440].includes(width)){await auth.screenshot({path:path.join(out,name+'-'+width+'.png'),fullPage:true});await auth.screenshot({path:path.join(out,name+'-'+width+'-top.png')});}
   }
   await guest.close();console.log('Completed '+width+'px');
  }
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,issues,errors,catalogSample:c.catalogSample},null,2));
  console.log(JSON.stringify({checks:checks.length,issues,errors}));assert.deepEqual(issues,[]);assert.deepEqual(errors,[]);
 }finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,issues,errors,catalogSample:c.catalogSample},null,2));if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));await c.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
