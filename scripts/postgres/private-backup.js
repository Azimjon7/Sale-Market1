'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFileSync}=require('child_process');
const {S3Client,PutObjectCommand,GetObjectCommand}=require('@aws-sdk/client-s3');
const MAGIC=Buffer.from('DODOLA-PG15-1\n');
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
function encrypt(bytes,key) {
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  const encrypted=Buffer.concat([cipher.update(bytes),cipher.final()]);
  return Buffer.concat([MAGIC,iv,cipher.getAuthTag(),encrypted]);
}
function decrypt(bytes,key) {
  if(bytes.length<=MAGIC.length+28||!bytes.subarray(0,MAGIC.length).equals(MAGIC))throw new Error('INVALID_BACKUP_FORMAT');
  const decipher=crypto.createDecipheriv('aes-256-gcm',key,bytes.subarray(MAGIC.length,MAGIC.length+12));
  decipher.setAuthTag(bytes.subarray(MAGIC.length+12,MAGIC.length+28));
  return Buffer.concat([decipher.update(bytes.subarray(MAGIC.length+28)),decipher.final()]);
}
async function backup(env,existingDump) {
  if(env.BACKUP_PRIVATE_STORAGE_VERIFIED!=='yes'||!env.R2_PRIVATE_BUCKET_NAME||env.R2_PRIVATE_BUCKET_NAME===env.R2_BUCKET_NAME)throw new Error('VERIFIED_PRIVATE_BUCKET_REQUIRED');
  const keyText=fs.readFileSync(env.BACKUP_ENCRYPTION_KEY_FILE,'utf8').trim();
  if(!/^[a-f0-9]{64}$/i.test(keyText))throw new Error('BACKUP_KEY_REQUIRED');
  const key=Buffer.from(keyText,'hex'),base=path.resolve(env.BACKUP_LOCAL_DIRECTORY);
  fs.mkdirSync(base,{recursive:true,mode:0o700});
  const work=fs.mkdtempSync(path.join(base,'run-')),dumpFile=path.join(work,'database.dump');
  if(existingDump) {
    fs.copyFileSync(path.resolve(existingDump),dumpFile,fs.constants.COPYFILE_EXCL);fs.chmodSync(dumpFile,0o600);
  } else {
    const url=new URL(env.DATABASE_URL);
    if(!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/dodola_beta_20261020')throw new Error('BETA_DATABASE_REQUIRED');
    const pgEnv={...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:url.pathname.slice(1),PGCONNECT_TIMEOUT:'8'};
    execFileSync('/usr/lib/postgresql/15/bin/pg_dump',['--no-password','--format=custom','--no-owner','--no-acl','--file',dumpFile],{env:pgEnv,stdio:['ignore','ignore','pipe'],timeout:180000});
    fs.chmodSync(dumpFile,0o600);
  }
  execFileSync('/usr/lib/postgresql/15/bin/pg_restore',['--list',dumpFile],{stdio:'ignore',timeout:30000});
  if(fs.statSync(dumpFile).size>64*1024*1024)throw new Error('BACKUP_SIZE_REQUIRES_STREAMING');
  const plain=fs.readFileSync(dumpFile),encrypted=encrypt(plain,key),now=new Date().toISOString().replace(/[:.]/g,'-');
  const objectKey='dodola/postgres/'+now.slice(0,10)+'/'+now+'-'+crypto.randomBytes(4).toString('hex')+'.dump.aes256gcm';
  const encryptedFile=path.join(work,'database.dump.aes256gcm');fs.writeFileSync(encryptedFile,encrypted,{flag:'wx',mode:0o600});
  const client=new S3Client({region:'auto',endpoint:env.R2_ENDPOINT||`https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,credentials:{accessKeyId:env.R2_ACCESS_KEY_ID,secretAccessKey:env.R2_SECRET_ACCESS_KEY},maxAttempts:2});
  try {
    await client.send(new PutObjectCommand({Bucket:env.R2_PRIVATE_BUCKET_NAME,Key:objectKey,Body:encrypted,ContentType:'application/octet-stream',CacheControl:'private, no-store'}));
    const fetched=await client.send(new GetObjectCommand({Bucket:env.R2_PRIVATE_BUCKET_NAME,Key:objectKey}));
    const recovered=Buffer.from(await fetched.Body.transformToByteArray());
    if(digest(recovered)!==digest(encrypted)||digest(decrypt(recovered,key))!==digest(plain))throw new Error('OFFSERVER_READBACK_FAILED');
    const report={ok:true,objectKey,plainSha256:digest(plain),encryptedSha256:digest(encrypted),bytes:plain.length,authenticatedEncryption:true,offServerReadbackVerified:true};
    fs.writeFileSync(path.join(work,'manifest.json'),JSON.stringify(report,null,2),{flag:'wx',mode:0o600});
    // Remove only this run's temporary plaintext, preserving source dumps and encrypted backups.
    fs.unlinkSync(dumpFile);return report;
  } finally {client.destroy();}
}
if(require.main===module) {
  const config=process.argv[2];if(!config)throw new Error('PRIVATE_ENV_FILE_REQUIRED');
  const env=require('dotenv').parse(fs.readFileSync(config));
  backup(env,process.argv[3]).then(report=>console.log(JSON.stringify(report))).catch(()=>{console.error(JSON.stringify({ok:false,code:'PRIVATE_DATABASE_BACKUP_FAILED'}));process.exitCode=1;});
}
module.exports={encrypt,decrypt,backup};
