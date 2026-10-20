'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('crypto');
const {encrypt,decrypt,backup}=require('../scripts/postgres/private-backup');
test('backup encryption authenticates data and uses a fresh nonce for each backup',()=>{
  const key=crypto.randomBytes(32),plain=Buffer.from('PGDMP: synthetic backup bytes'),a=encrypt(plain,key),b=encrypt(plain,key);
  assert.notDeepEqual(a,b);assert.deepEqual(decrypt(a,key),plain);assert.ok(!a.includes(plain));
  const damaged=Buffer.from(a);damaged[damaged.length-1]^=1;assert.throws(()=>decrypt(damaged,key));
  assert.throws(()=>decrypt(a,crypto.randomBytes(32)));assert.throws(()=>decrypt(Buffer.from('invalid'),key));
});
test('backup refuses public or unverified object storage before reading any secrets',async()=>{
  await assert.rejects(backup({R2_BUCKET_NAME:'public',R2_PRIVATE_BUCKET_NAME:'public',BACKUP_PRIVATE_STORAGE_VERIFIED:'yes'}),/VERIFIED_PRIVATE_BUCKET_REQUIRED/);
  await assert.rejects(backup({R2_PRIVATE_BUCKET_NAME:'private'}),/VERIFIED_PRIVATE_BUCKET_REQUIRED/);
});
