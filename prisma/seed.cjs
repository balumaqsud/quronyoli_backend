'use strict';

/**
 * Idempotent seed: never wipes data.
 * If the database already has users or Quran catalog rows, exit successfully.
 * Catalog content is populated via `qf:sync-catalog` / `qf:sync-pages` (not here —
 * those require external Quran.Foundation credentials and network access).
 */

const { Pool } = require('pg');

async function count(pool, table) {
  const result = await pool.query(`SELECT COUNT(*)::int AS c FROM ${table}`);
  return result.rows[0].c;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for seeding');
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const [users, translations, mushafPages] = await Promise.all([
      count(pool, 'users'),
      count(pool, 'quran_translations'),
      count(pool, 'mushaf_pages'),
    ]);

    if (users > 0 || translations > 0 || mushafPages > 0) {
      console.log(
        `[seed] Database already has data (users=${users}, translations=${translations}, mushaf_pages=${mushafPages}); skipping seed.`,
      );
      return;
    }

    console.log(
      '[seed] Database is empty. No static product rows to insert. ' +
        'After startup, run catalog sync when ready: ' +
        '`npm run qf:sync-catalog:prod` and `npm run qf:sync-pages:prod`.',
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[seed] Failed:', error);
  process.exit(1);
});
