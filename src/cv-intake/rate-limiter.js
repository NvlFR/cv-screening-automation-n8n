'use strict';

const redis = require('../cache/redis-client');
const config = require('../config');

/**
 * Rate Limiter untuk CV_Intake_Workflow.
 * Membatasi jumlah CV yang dapat diterima dalam window 60 detik menggunakan Redis counter.
 *
 * Requirements: 1.7, 11.5
 */

/**
 * Mengecek apakah request saat ini diizinkan berdasarkan rate limit.
 * Menggunakan Redis counter dengan TTL 60 detik (sliding window per menit).
 *
 * Algoritma:
 * 1. INCR counter di key `rate_limit:cv_intake`
 * 2. Jika key baru (counter = 1), set TTL 60 detik
 * 3. Jika counter > maxRequests, kembalikan { allowed: false, retryAfter: <TTL sisa> }
 * 4. Jika counter <= maxRequests, kembalikan { allowed: true }
 *
 * @param {number} [maxRequests=50] - Jumlah maksimum request per 60 detik
 * @returns {Promise<{ allowed: boolean, retryAfter?: number }>} Hasil pengecekan rate limit
 *   - `allowed`: true jika request diizinkan, false jika melebihi limit
 *   - `retryAfter`: jumlah detik yang harus ditunggu sebelum retry (hanya ada jika allowed=false)
 * @throws {Error} Jika Redis gagal
 *
 * @example
 * // Request dalam batas
 * const result = await checkRateLimit(50);
 * // => { allowed: true }
 *
 * // Request melebihi batas
 * const result = await checkRateLimit(50);
 * // => { allowed: false, retryAfter: 45 }
 */
async function checkRateLimit(maxRequests = config.app.maxConcurrentCV) {
  const rateLimitKey = config.queue.rateLimitKey;       // 'rate_limit:cv_intake'
  const ttlSeconds = config.queue.rateLimitTtlSeconds;  // 60

  try {
    const redisClient = redis.getClient();

    // Gunakan pipeline untuk atomicity: INCR + EXPIRE dalam satu round-trip
    // Namun EXPIRE hanya di-set jika key baru (counter = 1) untuk menghindari
    // reset TTL pada setiap request
    const currentCount = await redis.incrWithTTL(rateLimitKey, ttlSeconds);

    if (currentCount > maxRequests) {
      // Dapatkan TTL sisa untuk header Retry-After
      let retryAfter = ttlSeconds; // default fallback
      try {
        const ttl = await redisClient.ttl(rateLimitKey);
        // ttl bisa -1 (no expiry) atau -2 (key tidak ada) — gunakan default jika demikian
        if (ttl > 0) {
          retryAfter = ttl;
        }
      } catch (ttlErr) {
        // Jika gagal mendapatkan TTL, gunakan nilai default
        console.warn('[RateLimiter] Gagal mendapatkan TTL, menggunakan default:', ttlErr.message);
      }

      return { allowed: false, retryAfter };
    }

    return { allowed: true };
  } catch (err) {
    console.error('[RateLimiter] Gagal mengecek rate limit:', err.message);
    throw err;
  }
}

/**
 * Mereset counter rate limit (untuk keperluan testing atau admin reset).
 *
 * @returns {Promise<void>}
 */
async function resetRateLimit() {
  const rateLimitKey = config.queue.rateLimitKey;
  try {
    await redis.del(rateLimitKey);
  } catch (err) {
    console.error('[RateLimiter] Gagal mereset rate limit:', err.message);
    throw err;
  }
}

/**
 * Mendapatkan jumlah request saat ini dalam window aktif.
 *
 * @returns {Promise<number>} Jumlah request dalam window saat ini (0 jika window belum ada)
 */
async function getCurrentCount() {
  const rateLimitKey = config.queue.rateLimitKey;
  try {
    const value = await redis.get(rateLimitKey);
    return value ? parseInt(value, 10) : 0;
  } catch (err) {
    console.error('[RateLimiter] Gagal mendapatkan current count:', err.message);
    throw err;
  }
}

module.exports = { checkRateLimit, resetRateLimit, getCurrentCount };
