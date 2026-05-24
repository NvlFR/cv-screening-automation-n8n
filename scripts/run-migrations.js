'use strict';

/**
 * Script untuk menjalankan database migrations secara berurutan.
 * Menjalankan 001_initial_schema.sql terlebih dahulu, kemudian 002_indexes.sql.
 * Requirements: 9.1, 9.2
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Load config langsung (tidak pakai src/config.js agar script bisa dijalankan standalone)
const dbConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/cv_screening',
};

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

// Daftar migration files dalam urutan yang benar
const MIGRATION_FILES = [
  '001_initial_schema.sql',
  '002_indexes.sql',
];

/**
 * Membuat tabel migration_history jika belum ada.
 * Digunakan untuk tracking migration yang sudah dijalankan.
 * @param {import('pg').PoolClient} client
 */
async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS migration_history (
      id          SERIAL PRIMARY KEY,
      filename    VARCHAR(255) NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

/**
 * Mengecek apakah migration sudah pernah dijalankan.
 * @param {import('pg').PoolClient} client
 * @param {string} filename
 * @returns {Promise<boolean>}
 */
async function isMigrationApplied(client, filename) {
  const result = await client.query(
    'SELECT id FROM migration_history WHERE filename = $1',
    [filename]
  );
  return result.rows.length > 0;
}

/**
 * Menandai migration sebagai sudah dijalankan.
 * @param {import('pg').PoolClient} client
 * @param {string} filename
 */
async function markMigrationApplied(client, filename) {
  await client.query(
    'INSERT INTO migration_history (filename) VALUES ($1)',
    [filename]
  );
}

/**
 * Menjalankan satu file migration SQL.
 * @param {import('pg').PoolClient} client
 * @param {string} filename
 */
async function runMigration(client, filename) {
  const filePath = path.join(MIGRATIONS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Migration file tidak ditemukan: ${filePath}`);
  }

  const sql = fs.readFileSync(filePath, 'utf8');
  console.log(`[Migration] Menjalankan: ${filename}`);

  await client.query(sql);
  await markMigrationApplied(client, filename);

  console.log(`[Migration] Selesai: ${filename}`);
}

/**
 * Fungsi utama: menjalankan semua migration yang belum diaplikasikan.
 */
async function runMigrations() {
  const pool = new Pool(dbConfig);
  const client = await pool.connect();

  try {
    console.log('[Migration] Memulai proses migration...');
    console.log(`[Migration] Database: ${dbConfig.connectionString.replace(/:[^:@]*@/, ':***@')}`);

    // Pastikan tabel tracking ada
    await ensureMigrationTable(client);

    let appliedCount = 0;
    let skippedCount = 0;

    for (const filename of MIGRATION_FILES) {
      const alreadyApplied = await isMigrationApplied(client, filename);

      if (alreadyApplied) {
        console.log(`[Migration] Skip (sudah dijalankan): ${filename}`);
        skippedCount++;
        continue;
      }

      await runMigration(client, filename);
      appliedCount++;
    }

    console.log(`\n[Migration] Selesai!`);
    console.log(`  - Dijalankan: ${appliedCount} migration`);
    console.log(`  - Dilewati:   ${skippedCount} migration (sudah ada)`);

  } catch (err) {
    console.error('[Migration] ERROR:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Jalankan jika dipanggil langsung
if (require.main === module) {
  runMigrations().catch((err) => {
    console.error('[Migration] Fatal error:', err.message);
    process.exit(1);
  });
}

module.exports = { runMigrations };
