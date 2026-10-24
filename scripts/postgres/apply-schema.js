'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
const { createPostgresPool } = require('../../utils/postgres/pool');
const { applySchema } = require('../../utils/postgres/schema');

(async () => {
  const pool = createPostgresPool(process.env);
  try {
    await applySchema(pool);
    const rows = await pool.query('SELECT version,applied_at FROM schema_migrations ORDER BY version');
    console.log(JSON.stringify({ ok: true, migrations: rows.rows.map(row => row.version) }));
  } finally {
    await pool.end();
  }
})().catch(error => {
  console.error(JSON.stringify({ ok: false, code: error.code || 'MIGRATION_FAILED' }));
  process.exitCode = 1;
});
