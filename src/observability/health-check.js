'use strict';

/**
 * Health Check — mengembalikan status sistem secara keseluruhan.
 * Requirements: 12.1, 12.3
 */

const redis = require('../cache/redis-client');
const db = require('../db/client');

const QUEUE_KEY = 'cv_processing_queue';

/**
 * Mengecek koneksi PostgreSQL.
 * @returns {Promise<{ connected: boolean, latencyMs: number, error?: string }>}
 */
async function checkDatabase() {
  const start = Date.now();
  try {
    const result = await db.query('SELECT 1 as health_check');
    const latencyMs = Date.now() - start;

    return {
      connected: result.rows.length > 0,
      latencyMs,
    };
  } catch (err) {
    return {
      connected: false,
      latencyMs: Date.now() - start,
      error: err.message,
    };
  }
}

/**
 * Mengecek koneksi Redis.
 * @returns {Promise<{ connected: boolean, latencyMs: number, error?: string }>}
 */
async function checkRedis() {
  const start = Date.now();
  try {
    const client = redis.getClient();
    const pong = await client.ping();
    const latencyMs = Date.now() - start;

    return {
      connected: pong === 'PONG',
      latencyMs,
    };
  } catch (err) {
    return {
      connected: false,
      latencyMs: Date.now() - start,
      error: err.message,
    };
  }
}

/**
 * Mendapatkan jumlah item dalam queue Redis.
 * @returns {Promise<{ count: number, error?: string }>}
 */
async function getQueueLength() {
  try {
    const client = redis.getClient();
    const count = await client.llen(QUEUE_KEY);
    return { count };
  } catch (err) {
    return { count: -1, error: err.message };
  }
}

/**
 * Mendapatkan status kesehatan sistem secara keseluruhan.
 * Requirements: 12.1 — health check endpoint
 *
 * @returns {Promise<Object>} Status sistem lengkap
 *
 * @example
 * const status = await getHealthStatus();
 * // => {
 * //   status: 'healthy' | 'degraded' | 'unhealthy',
 * //   timestamp: '2024-01-01T00:00:00.000Z',
 * //   services: {
 * //     database: { connected: true, latencyMs: 5 },
 * //     redis: { connected: true, latencyMs: 2 },
 * //   },
 * //   queue: { length: 12 },
 * //   uptime: 3600
 * // }
 */
async function getHealthStatus() {
  const [dbHealth, redisHealth, queueInfo] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    getQueueLength(),
  ]);

  const allConnected = dbHealth.connected && redisHealth.connected;
  const hasErrors = dbHealth.error || redisHealth.error;

  let status = 'healthy';
  if (!allConnected) {
    status = 'unhealthy';
  } else if (hasErrors || (queueInfo.count > 100)) {
    status = 'degraded';
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    services: {
      database: {
        connected: dbHealth.connected,
        latencyMs: dbHealth.latencyMs,
        error: dbHealth.error,
      },
      redis: {
        connected: redisHealth.connected,
        latencyMs: redisHealth.latencyMs,
        error: redisHealth.error,
      },
    },
    queue: {
      length: queueInfo.count,
      error: queueInfo.error,
    },
  };
}

module.exports = {
  getHealthStatus,
  checkDatabase,
  checkRedis,
  getQueueLength,
};