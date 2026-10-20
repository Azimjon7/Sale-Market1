const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
for(const [file,name,end] of [['js/cart-page.js','validateItemStock','// ── get inventory mode badge'],['js/checkout-page.js','validateProductStock','// Helper to get inventory badge']]) {
 const src=fs.readFileSync(file,'utf8'),start=src.indexOf('function '+name),stop=src.indexOf(end,start),fn=vm.runInNewContext('('+src.slice(start,stop).trim()+')');
 test(file+' respects managed made-to-order limits',async()=>{const p={_inventoryMode:'made-to-order',inventoryManaged:true,stock:15};assert.equal((await fn(p,2)).valid,true);assert.equal((await fn(p,16)).valid,false);assert.equal((await fn({...p,stock:0},1)).valid,false);assert.equal((await fn({...p,inventoryManaged:false},16)).valid,true);assert.equal((await fn({_inventoryMode:'standard',stock:1},2)).valid,false);});
}
