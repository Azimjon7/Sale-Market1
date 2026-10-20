'use strict';
// Private read-only staging server. It never binds a public interface or enables orders.
const fs=require('fs'),path=require('path');
const config=path.resolve(process.argv[2]||'');
const env=require('dotenv').parse(fs.readFileSync(config));
const url=new URL(env.DATABASE_URL);
if(env.PUBLIC_WRITES_ENABLED!=='false'||env.PAYMENT_MODE!=='disabled'||!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/dodola_beta_20261020')throw new Error('READ_ONLY_BETA_CONFIGURATION_REQUIRED');
Object.assign(process.env,env);
const privateDir=path.dirname(config),dataDir=path.join(privateDir,'staging-runtime-data'),uploadsDir=path.join(privateDir,'staging-runtime-uploads');
fs.mkdirSync(dataDir,{recursive:true,mode:0o700});fs.mkdirSync(uploadsDir,{recursive:true,mode:0o700});
const pool=require('../../utils/postgres/pool').createPostgresPool();
const app=require('../../server').createApp({dataDir,uploadsDir,postgresPool:pool,storageBackend:'postgresql',notifyOrder:require('../../utils/adminNotifications').createAdminNotifier().notify});
const server=app.listen(0,'127.0.0.1',()=>{
  const status={url:'http://127.0.0.1:'+server.address().port,publicWritesEnabled:false,paymentMode:'disabled'};
  fs.writeFileSync(path.join(privateDir,'beta-staging-address.json'),JSON.stringify(status),{mode:0o600});
  console.log(JSON.stringify({started:true,privateBinding:true,publicWritesEnabled:false}));
});
let stopping=false;
async function stop(){if(stopping)return;stopping=true;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await pool.end();process.exit(0);}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
