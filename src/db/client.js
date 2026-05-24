'use strict';

const { Pool } = require('pg');
const config = require('../config');

/**
 * PostgreSQL connection pool wrapper.
 * Menggunakan pg Pool untuk connection pooling yang efisien.
 * Requirements: 9.1, 9.2, 11.1
 */

let pool = null;

/**
 * Membuat atau mengembalikan instance Pool yang sudah ada (singleton).
 * @returns {Pool} pg Pool instance
 */
function getPool() {
  if (!pool) {
    const poolConfig = config.db.connectionString
      ? {
          connectionString: config.db.connectionString,
          ...config.db.pool,
        }
      : {
          host: config.db.host,
          port: config.db.port,
          database: config.db.database,
          user: config.db.user,
          password: config.db.password,
          ...config.db.pool,
        };

    pool = new Pool(poolConfig);

    // Log error koneksi tanpa crash aplikasi
    pool.on('error', (err) => {
      console.error('[DB] Unexpected error on idle client:', err.message);
    });

    pool.on('connect', () => {
      if (config.app.env === 'development') {
        console.log('[DB] New client connected to PostgreSQL');
      }
    });
  }

  return pool;
}

/**
 * Menjalankan query SQL dengan parameter.
 * @param {string} text - SQL query string
 * @param {Array} params - Query parameters (untuk parameterized query)
 * @returns {Promise<import('pg').QueryResult>} Query result
 */
async function query(text, params) {
  const client = getPool();
  try {
    const result = await client.query(text, params);
    return result;
  } catch (err) {
    console.error('[DB] Query error:', err.message, '| Query:', text);
    throw err;
  }
}

/**
 * Mendapatkan client dari pool untuk transaksi manual.
 * PENTING: Selalu panggil client.release() setelah selesai.
 * @returns {Promise<import('pg').PoolClient>} Pool client
 */
async function getClient() {
  return getPool().connect();
}

/**
 * Menjalankan fungsi dalam transaksi database.
 * Otomatis commit jika sukses, rollback jika error.
 * @param {Function} fn - Async function yang menerima client sebagai parameter
 * @returns {Promise<any>} Return value dari fn
 */
async function withTransaction(fn) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Menutup semua koneksi pool (untuk graceful shutdown).
 * @returns {Promise<void>}
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[DB] Connection pool closed');
  }
}

/**
 * Mengecek apakah koneksi database aktif.
 * @returns {Promise<boolean>} true jika koneksi berhasil
 */
async function healthCheck() {
  try {
    const result = await query('SELECT 1 AS ok');
    return result.rows[0].ok === 1;
  } catch (err) {
    console.error('[DB] Health check failed:', err.message);
    return false;
  }
}

module.exports = {
  query,
  getClient,
  withTransaction,
  closePool,
  healthCheck,
  getPool,
};
