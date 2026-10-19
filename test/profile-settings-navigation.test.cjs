'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const {marketplaceFixture}=require('./marketplace-fixture.cjs');

test('profile gear and menu open the settings page and its allowed assets',async()=>{
 const c=await marketplaceFixture({readOnly:true});
 const server=c.app.listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  for(const url of ['/profile-settings.html','/js/profile-settings.js','/js/dodola-i18n.js','/favorites.html']){
   const response=await context.request.get(base+url);assert.equal(response.status(),200,url);
  }
  assert.equal((await context.request.get(base+'/utils/publicFiles.js')).status(),404);
  assert.equal((await(await context.request.get(base+'/api/health')).json()).publicWritesEnabled,false);
  const csrf=(await(await context.request.get(base+'/api/auth/session')).json()).csrfToken;
  assert.equal((await context.request.post(base+'/api/auth/login',{headers:{'X-CSRF-Token':csrf},data:c.credentials})).status(),200);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const out=path.resolve('.local-tests/profile-settings-fix');fs.mkdirSync(out,{recursive:true});
  for(const width of [390,1440]){
   await page.setViewportSize({width,height:844});
   for(const selector of ['.profile-settings-link','#overviewSection a[href="profile-settings.html"]']){
    await page.goto(base+'/account.html');await page.locator('#overviewOrderCount').waitFor();
    const navigation=page.waitForResponse(r=>r.url()===base+'/profile-settings.html'&&r.request().isNavigationRequest());
    await page.locator(selector).click();assert.equal((await navigation).status(),200);
    await page.locator('#profileSettingsForm').waitFor();
    await page.waitForFunction(()=>document.getElementById('firstName').value.length>0);
    assert.equal(await page.locator('h1').innerText(),'Profil sozlamalari');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   }
   await page.screenshot({path:path.join(out,`settings-${width}.png`),fullPage:true});
  }
  assert.deepEqual(errors,[]);
 }finally{
  if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));await c.close();
 }
});
