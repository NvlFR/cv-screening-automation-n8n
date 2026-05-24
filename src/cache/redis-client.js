'use strict';

const Redis = require('ioredis');
const config = require('../config');

/**
 * Redis connection wrapper menggunakan ioredis.
 * Menangani reconnection dan error secara graceful.
 * Requirements: 11.1, 11.6
 */

let client = null;

/**
 * Membuat konfigurasi ioredis dari config.
 * @returns {Object} ioredis configuration object
 */
function buildRedisConfig() {
  const baseConfig = {
    maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
    connectTimeout: config.redis.connectTimeoutMs,
    lazyConnect: true,
    // Retry strategy: exponential backoff dengan max 10 detik
    retryStrategy(times) {
      if (times > 10) {
        console.error('[Redis] Max reconnection attempts reached. Giving up.');
        return null; // stop retrying
      }
      const delay = Math.min(times * config.redis.retryDelayMs, 10000);
      console.warn(`[Redis] Reconnecting in ${delay}ms (attempt ${times})`);
      return delay;
    },
    // Reconnect on error untuk error tertentu
    reconnectOnError(err) {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ECONNREFUSED'];
      return targetErrors.some((e) => err.message.includes(e));
    },
  };

  // Gunakan URL jika tersedia, fallback ke host/port
  if (config.redis.url && config.redis.url !== 'redis://localhost:6379') {
    return { ...baseConfig };
  }

  return {
    ...baseConfig,
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db,
  };
}

/**
 * Membuat atau mengembalikan instance Redis yang sudah ada (singleton).
 * @returns {Redis} ioredis client instance
 */
function getClient() {
  if (!client) {
    const redisConfig = buildRedisConfig();

    // Gunakan URL jika tersedia
    if (config.redis.url && config.redis.url !== 'redis://localhost:6379') {
      client = new Redis(config.redis.url, redisConfig);
    } else {
      client = new Redis(redisConfig);
    }

    // Event handlers untuk observabilitas
    client.on('connect', () => {
      console.log('[Redis] Connected to Redis server');
    });

    client.on('ready', () => {
      if (config.app.env === 'development') {
        console.log('[Redis] Client ready');
      }
    });

    client.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });

    client.on('close', () => {
      console.warn('[Redis] Connection closed');
    });

    client.on('reconnecting', (delay) => {
      console.warn(`[Redis] Reconnecting in ${delay}ms`);
    });

    client.on('end', () => {
      console.warn('[Redis] Connection ended');
    });
  }

  return client;
}

/**
 * Menyimpan nilai ke Redis dengan TTL opsional.
 * @param {string} key - Redis key
 * @param {string} value - Nilai string
 * @param {number} [ttlSeconds] - TTL dalam detik (opsional)
 * @returns {Promise<string>} 'OK' jika berhasil
 */
async function set(key, value, ttlSeconds) {
  const redis = getClient();
  if (ttlSeconds) {
    return redis.set(key, value, 'EX', ttlSeconds);
  }
  return redis.set(key, value);
}

/**
 * Mengambil nilai dari Redis.
 * @param {string} key - Redis key
 * @returns {Promise<string|null>} Nilai atau null jika tidak ada
 */
async function get(key) {
  return getClient().get(key);
}

/**
 * Menghapus key dari Redis.
 * @param {string} key - Redis key
 * @returns {Promise<number>} Jumlah key yang dihapus
 */
async function del(key) {
  return getClient().del(key);
}

/**
 * Push item ke kiri list (LPUSH) — untuk queue producer.
 * @param {string} key - Redis list key
 * @param {string} value - Nilai yang di-push
 * @returns {Promise<number>} Panjang list setelah push
 */
async function lpush(key, value) {
  return getClient().lpush(key, value);
}

/**
 * Pop item dari kanan list dengan blocking (BRPOP) — untuk queue consumer.
 * @param {string} key - Redis list key
 * @param {number} timeoutSeconds - Timeout dalam detik (0 = block selamanya)
 * @returns {Promise<[string, string]|null>} [key, value] atau null jika timeout
 */
async function brpop(key, timeoutSeconds = 30) {
  return getClient().brpop(key, timeoutSeconds);
}

/**
 * Mendapatkan panjang list.
 * @param {string} key - Redis list key
 * @returns {Promise<number>} Panjang list
 */
async function llen(key) {
  return getClient().llen(key);
}

/**
 * Increment counter dengan TTL (untuk rate limiting).
 * @param {string} key - Redis key
 * @param {number} ttlSeconds - TTL dalam detik
 * @returns {Promise<number>} Nilai counter setelah increment
 */
async function incrWithTTL(key, ttlSeconds) {
  const redis = getClient();
  const pipeline = redis.pipeline();
  pipeline.incr(key);
  pipeline.expire(key, ttlSeconds);
  const results = await pipeline.exec();
  return results[0][1]; // nilai dari INCR
}

/**
 * Mengecek apakah koneksi Redis aktif.
 * @returns {Promise<boolean>} true jika koneksi berhasil
 */
async function healthCheck() {
  try {
    const result = await getClient().ping();
    return result === 'PONG';
  } catch (err) {
    console.error('[Redis] Health check failed:', err.message);
    return false;
  }
}

/**
 * Menutup koneksi Redis (untuk graceful shutdown).
 * @returns {Promise<void>}
 */
async function closeConnection() {
  if (client) {
    await client.quit();
    client = null;
    console.log('[Redis] Connection closed');
  }
}

module.exports = {
  getClient,
  set,
  get,
  del,
  lpush,
  brpop,
  llen,
  incrWithTTL,
  healthCheck,
  closeConnection,
};
