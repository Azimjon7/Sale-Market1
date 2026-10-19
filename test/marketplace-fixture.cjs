'use strict';
const fs=require('fs'),path=require('path');
const {customerUiFixture}=require('./customer-ui-fixture.cjs');
// Public catalog is read-only. Selected records/images are COPIED into an isolated fixture.
async function marketplaceFixture(options={}){
 const root=path.resolve(__dirname,'..');
 const catalogFile=path.join(root,'data/products.json'),hasLocalCatalog=fs.existsSync(catalogFile);
 // A clean deployment checkout deliberately contains no private database or
 // uploads. Generate a public synthetic fixture for reproducible test runs.
 const syntheticCategories=['Mebel','Mebel','Sumkalar','Shimlar','Ustki kiyimlar','Oyoq kiyimlar','Aksesuarlar','Jihozlar','Sumkalar','Ustki kiyimlar','Oyoq kiyimlar','Aksesuarlar'];
 const catalog=hasLocalCatalog?JSON.parse(fs.readFileSync(catalogFile)):syntheticCategories.map((category,i)=>({id:'synthetic-'+i,sku:'DOD-'+String(i+1).padStart(4,'0'),name:category==='Shimlar'?'Sinov shim':category==='Sumkalar'?'Sinov sumka':'Synthetic product '+i,category,price:199000,oldPrice:249000,image:'img/hero/look-1.jpg',colors:[],sizes:[]}));
 const publicFixtureImage=f=>typeof f==='string'&&(f.startsWith('uploads/')||(!hasLocalCatalog&&f.startsWith('img/hero/')))&&fs.existsSync(path.join(root,f));
 const candidates=catalog.filter(p=>p.price>0&&publicFixtureImage(p.image));
 const selected=[],counts=new Map();
 for(const p of candidates){const cat=p.category||'Mahsulotlar';if((counts.get(cat)||0)>=2)continue;selected.push(p);counts.set(cat,(counts.get(cat)||0)+1);if(selected.length===12)break;}
 if(selected.length<2)throw Error('Local catalog images are unavailable');
 const c=await customerUiFixture({prepare:async c=>{
  for(let i=0;i<selected.length;i++){
   const p=selected[i],id=i<2?'p'+(i+1):'visual-'+i;
   const images=[...new Set([p.image,...(p.images||[])])].filter(publicFixtureImage);
   for(const f of images){const source=path.resolve(root,f),target=path.resolve(c.root,f);if(!source.startsWith(root+path.sep)||!target.startsWith(c.root+path.sep))throw Error('Invalid fixture asset path');fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);}
   if(i<2)await c.pool.query('UPDATE products SET name=$2,description=$3,category=$4,price=$5,old_price=$6,primary_image=$7,image_paths=$8,legacy_payload=$9 WHERE id=$1',[id,p.name,p.desc||p.description||'',p.category,p.price,p.oldPrice||null,p.image,JSON.stringify(images),JSON.stringify({colors:p.colors,sizes:p.sizes})]);
   else{await c.pool.query("INSERT INTO products(id,sku,name,description,category,price,old_price,primary_image,image_paths,legacy_payload,inventory_mode) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'standard')",[id,p.sku||'VIS-'+i,p.name,p.desc||p.description||'',p.category,p.price,p.oldPrice||null,p.image,JSON.stringify(images),JSON.stringify({colors:p.colors,sizes:p.sizes})]);await c.pool.query('INSERT INTO inventory_levels(product_id,available,reserved,sold,returned) VALUES($1,100,0,0,0)',[id]);}
  }
 }});
 if(options.readOnly){
  // Seeded synthetic records above are test-only. The browser-facing app remains launch-locked.
  const old=process.env.PUBLIC_WRITES_ENABLED;process.env.PUBLIC_WRITES_ENABLED='false';
  try{c.app=require('../server').createApp({dataDir:path.join(c.root,'data'),uploadsDir:path.join(c.root,'uploads'),storageBackend:'postgresql',postgresPool:c.pool,env:{...c.env,PAYMENT_MODE:'disabled'},emailService:{status:()=>({configured:false}),send:async()=>{throw Error('Email disabled in preview');}}});}
  finally{if(old===undefined)delete process.env.PUBLIC_WRITES_ENABLED;else process.env.PUBLIC_WRITES_ENABLED=old;}
 }
 return {...c,catalogSample:selected.map(p=>({id:p.id,name:p.name,price:p.price,oldPrice:p.oldPrice,image:p.image}))};
}
module.exports={marketplaceFixture};
