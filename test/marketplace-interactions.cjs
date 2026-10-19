'use strict';
const {chromium}=require('playwright'),{marketplaceFixture}=require('./marketplace-fixture.cjs');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{const c=await marketplaceFixture(),server=c.app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port,out=path.resolve('.local-tests/dodola-marketplace');let browser;const checks=[];
 try{browser=await chromium.launch({channel:'msedge',headless:true});
  for(const width of [320,375,390,430,768,1440]){const ctx=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});await ctx.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());const p=await ctx.newPage();
   const shot=async name=>{assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,name);await p.screenshot({path:path.join(out,name+'-'+width+'.png'),fullPage:true});checks.push({name,width});};
   await p.goto(base+'/shop.html');await p.locator('.product__item').first().waitFor();
   await p.click('#sct-filter-btn');await p.locator('#sct-filter-panel').waitFor();await p.fill('#sct-price-max','160000');await shot('filter-modal');await p.click('#sct-apply-btn');await p.waitForTimeout(400);
   const prices=await p.locator('.product__price').allTextContents();assert.ok(prices.length>0&&prices.length<12);assert.ok(prices.every(t=>Number(t.split("so'm")[0].replace(/\D/g,''))<=160000));
   await p.click('#sct-filter-btn');await p.click('#sct-reset-btn');await p.locator('#sct-filter-panel').waitFor({state:'hidden'});await p.waitForTimeout(400);
   await p.locator('.js-add-card').first().click();await p.locator('#dodolaToast').waitFor();assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('mujskoy_cart')).reduce((n,x)=>n+x.qty,0)),1);await shot('cart-feedback');
   await p.goto(base+'/shop.html?search=no-such-product-987654321');await p.locator('#shop-grid .shop-empty').waitFor();await shot('empty-search');await p.click('#shop-empty-clear');await p.locator('.product__item').first().waitFor();
   await p.evaluate(()=>localStorage.removeItem('mujskoy_cart'));await p.goto(base+'/shop-cart.html');await p.locator('.market-empty-state').waitFor();assert.equal(await p.locator('#mb-cart-checkout-bar').isVisible(),false);await shot('empty-cart');
   await p.goto(base+'/product-details.html?id=missing-local-product');await p.locator('.pd-error').waitFor();await shot('missing-product');
   await p.goto(base+'/checkout.html');await p.locator('#checkoutEmpty').waitFor();assert.equal(await p.locator('#placeOrder').count(),0);await shot('empty-checkout');
   await ctx.close();
  }
  fs.writeFileSync(path.join(out,'interactions.json'),JSON.stringify({checks},null,2));console.log(JSON.stringify({passed:checks.length}));
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));await c.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
