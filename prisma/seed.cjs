'use strict';

/**
 * Idempotent seed:
 * 1) Bootstrap SUPER_ADMIN from SUPER_ADMIN_TELEGRAM_ID / SUPER_ADMIN_USERNAME
 * 2) If the database has no product data, remind operators to run QF catalog sync
 */

const { Pool } = require('pg');
const { randomUUID } = require('crypto');

async function count(pool, table) {
  const result = await pool.query(`SELECT COUNT(*)::int AS c FROM ${table}`);
  return result.rows[0].c;
}

async function seedSuperAdmin(pool) {
  const telegramId = process.env.SUPER_ADMIN_TELEGRAM_ID?.trim();
  const username = process.env.SUPER_ADMIN_USERNAME?.trim() || null;

  if (!telegramId) {
    console.log(
      '[seed] SUPER_ADMIN_TELEGRAM_ID not set; skipping SUPER_ADMIN bootstrap.',
    );
    return;
  }

  const existingUser = await pool.query(
    `SELECT id FROM users WHERE telegram_id = $1 LIMIT 1`,
    [telegramId],
  );

  let userId;
  if (existingUser.rows.length > 0) {
    userId = existingUser.rows[0].id;
    await pool.query(
      `UPDATE users
       SET username = COALESCE($2, username),
           is_active = true,
           is_banned = false,
           deleted_at = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [userId, username],
    );
  } else {
    userId = randomUUID();
    await pool.query(
      `INSERT INTO users (
         id, telegram_id, username, first_name, last_name,
         is_active, is_banned, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, NULL,
         true, false, NOW(), NOW()
       )`,
      [userId, telegramId, username, username || 'Super Admin'],
    );
  }

  const existingAdmin = await pool.query(
    `SELECT id, role FROM admins WHERE user_id = $1 LIMIT 1`,
    [userId],
  );

  if (existingAdmin.rows.length > 0) {
    if (existingAdmin.rows[0].role !== 'SUPER_ADMIN') {
      await pool.query(
        `UPDATE admins SET role = 'SUPER_ADMIN', updated_at = NOW() WHERE id = $1`,
        [existingAdmin.rows[0].id],
      );
      console.log(
        `[seed] Promoted existing admin to SUPER_ADMIN for telegram_id=${telegramId}`,
      );
    } else {
      console.log(
        `[seed] SUPER_ADMIN already exists for telegram_id=${telegramId}`,
      );
    }
    return;
  }

  const adminId = randomUUID();
  await pool.query(
    `INSERT INTO admins (id, user_id, role, created_by, created_at, updated_at)
     VALUES ($1, $2, 'SUPER_ADMIN', NULL, NOW(), NOW())`,
    [adminId, userId],
  );

  console.log(
    `[seed] Created SUPER_ADMIN for telegram_id=${telegramId} (user_id=${userId})`,
  );
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for seeding');
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    await seedSuperAdmin(pool);

    const [users, translations, mushafPages] = await Promise.all([
      count(pool, 'users'),
      count(pool, 'quran_translations'),
      count(pool, 'mushaf_pages'),
    ]);

    if (users > 0 || translations > 0 || mushafPages > 0) {
      console.log(
        `[seed] Database has data (users=${users}, translations=${translations}, mushaf_pages=${mushafPages}).`,
      );
      return;
    }

    console.log(
      '[seed] Database catalog is empty. After startup, run: ' +
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
