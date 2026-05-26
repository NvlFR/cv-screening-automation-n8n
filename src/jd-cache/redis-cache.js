'use strict';

/**
 * JD Cache — menyimpan hasil parsing Job Description di Redis.
 *
 * Key format : jd_parsed:{jobId}
 * TTL        : 86400 detik (24 jam)
 *
 * Requirements: 11.6
 */

const KEY_PREFIX = 'jd_parsed:';
const DEFAULT_TTL = 86400; // 24 jam dalam detik

class JDCache {
  /**
   * @param {import('ioredis').Redis} redisClient - Instance ioredis yang sudah terhubung
   */
  constructor(redisClient) {
    if (!redisClient) {
      throw new Error('JDCache membutuhkan Redis client');
    }
    this.redis = redisClient;
  }

  /**
   * Membuat Redis key dari jobId.
   * @param {string} jobId
   * @returns {string}
   */
  _buildKey(jobId) {
    return `${KEY_PREFIX}${jobId}`;
  }

  /**
   * Menyimpan parsed JD ke Redis dengan TTL 86400 detik.
   *
   * @param {string} jobId - ID job position
   * @param {Object} parsedJD - Objek parsed JD yang akan di-cache
   * @returns {Promise<void>}
   */
  async set(jobId, parsedJD) {
    const key = this._buildKey(jobId);
    const value = JSON.stringify(parsedJD);
    await this.redis.set(key, value, 'EX', DEFAULT_TTL);
  }

  /**
   * Mengambil parsed JD dari Redis.
   * Mengembalikan null jika key tidak ada atau sudah expired.
   *
   * @param {string} jobId - ID job position
   * @returns {Promise<Object|null>} Parsed JD object atau null
   */
  async get(jobId) {
    const key = this._buildKey(jobId);
    const value = await this.redis.get(key);

    if (value === null || value === undefined) {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch {
      // Nilai di Redis rusak / bukan JSON valid — anggap cache miss
      return null;
    }
  }

  /**
   * Menghapus cache JD ketika JD diupdate.
   *
   * @param {string} jobId - ID job position
   * @returns {Promise<void>}
   */
  async invalidate(jobId) {
    const key = this._buildKey(jobId);
    await this.redis.del(key);
  }
}

module.exports = { JDCache };
