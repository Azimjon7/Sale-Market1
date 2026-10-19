'use strict';
// Read-only visual preview: no application writes, database connection, secrets or remote services.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.local-tests/luxury-pilot');
const products=JSON.parse(fs.readFileSync(path.join(root,'data/products.json')));
function preview(){return http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),p=decodeURIComponent(url.pathname);
 const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
 if(!['GET','HEAD'].includes(req.method))return json({error:'Read-only design preview'},403);
 if(p==='/api/products')return json(products);
 if(p==='/api/health')return json({ok:true,publicWritesEnabled:false,preview:true});
 if(p==='/api/auth/session')return json({authenticated:false,customer:null});
 if(p.startsWith('/api/'))return json({error:'Not available in visual preview'},404);
 const relative=p==='/'?'index.html':p.slice(1),f=path.resolve(root,relative);
 if(!f.startsWith(root+path.sep)||!(/^(css|js|img|fonts|uploads)\//.test(relative)||/^[a-z0-9-]+\.html$/.test(relative))||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);return res.end();}
 const mime={'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf'}[path.extname(f)];
 if(!mime){res.writeHead(404);return res.end();}res.writeHead(200,{'Content-Type':mime});fs.createReadStream(f).pipe(res);
});}
async function run(){fs.mkdirSync(out,{recursive:true});const server=preview().listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;console.log(base);
 if(process.env.LUXURY_PREVIEW==='1'){process.on('SIGINT',()=>server.close(()=>process.exit(0)));return;}
 let browser;const results=[],errors=[];
 try{browser=await chromium.launch({channel:'msedge',headless:true});
 for(const width of [320,360,375,390,393,412,430,480,768,1024,1440]){
 const ctx=await browser.newContext({viewport:{width,height:width>1000?1000:844},reducedMotion:'reduce'});await ctx.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/index.html');await page.locator('.lx-photo-link img').waitFor();await page.locator('.product__item').first().waitFor();await page.evaluate(()=>document.fonts.ready);
 // Eager decoding here is screenshot preparation only; production cards retain lazy loading.
 await page.evaluate(async()=>{const images=[...document.images].filter(i=>i.checkVisibility());images.forEach(i=>i.loading='eager');await Promise.race([Promise.allSettled(images.map(i=>i.decode())),new Promise(r=>setTimeout(r,15000))]);scrollTo(0,0);});
 const check=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,products:document.querySelectorAll('.product__item').length,broken:[...document.images].filter(i=>i.checkVisibility()&&!i.naturalWidth).map(i=>i.src),outside:[...document.querySelectorAll('main a,main button')].filter(e=>{let b=e.getBoundingClientRect();return b.width&& (b.x<0||b.right>innerWidth+1)}).map(e=>e.className)}));results.push(check);assert.equal(check.overflow,false);assert.deepEqual(check.outside,[]);assert.deepEqual(check.broken,[]);assert.equal(check.products,8);
 if([320,390,430,768,1440].includes(width)){await page.screenshot({path:path.join(out,'home-'+width+'.png'),fullPage:true});await page.screenshot({path:path.join(out,'home-'+width+'-top.png')});}
 await page.locator('.js-add-card').first().click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mujskoy_cart')).reduce((n,r)=>n+r.qty,0)),1);await page.locator('#dodolaToast').waitFor({state:'visible'});
 assert.ok((await page.locator('.lx-photo-link').getAttribute('href')).includes('prd_1784614920759'));assert.equal(await page.locator('#category-grid a').count(),6);await ctx.close();console.log('Passed '+width);
 }assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,errors,publicWritesEnabled:false},null,2));
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
}
run().catch(e=>{console.error(e);process.exitCode=1});
