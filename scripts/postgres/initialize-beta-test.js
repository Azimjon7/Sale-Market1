'use strict';
// Deliberately cannot target dodola_db. Production initialization is a separate operation.
const path = require('path');
const { Pool } = require('pg');
const { loadSource, validateSource, rowChecksum } = require('./sourceSnapshot');
const { importSource } = require('./importer');
const { verifyPreservation } = require('./verify-preservation');

function validateTarget(env) {
  if (env.PGHOST !== 'localhost' || env.PGDATABASE !== 'dodola_pg15_test_20261020' ||
      env.PGUSER !== 'dodola_app' || env.BETA_TEST_IMPORT_APPROVED !== 'yes' || env.PUBLIC_WRITES_ENABLED !== 'false') {
    throw Object.assign(new Error('Isolated beta test target and closed public writes required.'), { code: 'UNSAFE_IMPORT_TARGET' });
  }
}
async function initialize(pool, directory) {
  const source = loadSource(directory);
  if (validateSource(source).length || source.products.length !== 1164 || source.customers.length || source.orders.length || source.tokens.length ||
      Object.keys(source.sessions).length || source.promoCodes.length || source.reviews.length) throw new Error('Not a clean complete beta catalog.');
  const manifest = require(path.join(path.resolve(directory), 'catalog-manifest.json'));
  if (!manifest.immutableCatalogFieldsVerified || manifest.catalogChecksum !== rowChecksum({ products:source.products, categories:source.categories })) throw new Error('Catalog manifest mismatch.');
  const state = (await pool.query("SELECT current_database() AS name,current_setting('server_version_num')::integer AS version")).rows[0];
  if (state.name !== 'dodola_pg15_test_20261020' || state.version < 150000 || state.version >= 160000) throw new Error('Expected isolated PostgreSQL 15 database.');
  const objects = await pool.query("SELECT count(*)::integer AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','S','v','m','f')");
  if (objects.rows[0].count !== 0) throw new Error('Test database is not empty; nothing was overwritten.');
  await importSource(pool, directory);
  const verification = await verifyPreservation(pool, directory);
  if (!verification.ok) throw new Error('Restored catalog verification failed; do not proceed.');
  const categories = (await pool.query('SELECT name FROM categories ORDER BY source_index')).rows.map(r=>r.name);
  if (rowChecksum(categories) !== rowChecksum(source.categories)) throw new Error('Category mismatch.');
  const changedPrices = await pool.query('SELECT count(*)::integer AS count FROM products WHERE price <> (legacy_payload->>\'price\')::numeric OR old_price IS DISTINCT FROM (legacy_payload->>\'oldPrice\')::numeric');
  if (changedPrices.rows[0].count !== 0) throw new Error('Price mismatch.');
  return { ok:true, database:state.name, postgresMajor:15, verification, categories:categories.length, cleanCatalogChecksum:manifest.catalogChecksum };
}
async function main() {
  validateTarget(process.env);
  const directory = process.argv[2];
  if (!directory) throw new Error('Catalog directory required.');
  const pool = new Pool({ host:process.env.PGHOST, database:process.env.PGDATABASE, user:process.env.PGUSER,
    port:5432, max:2, connectionTimeoutMillis:8000, application_name:'dodola-beta-test-import' });
  try { console.log(JSON.stringify(await initialize(pool, path.resolve(directory)), null, 2)); } finally { await pool.end(); }
}
if (require.main === module) main().catch(error => { console.error(JSON.stringify({ ok:false, code:error.code || 'BETA_IMPORT_FAILED' }));process.exitCode=1; });
module.exports={ validateTarget, initialize };
