'use strict';

/**
 * Unit tests untuk rate-limiter.js
 * Memverifikasi fungsi checkRateLimit, resetRateLimit, getCurrentCount
 */

// Mock redis-client sebelum require module yang diuji
jest.mock('../../../src/cache/redis-client', () => ({
  incrWithTTL: jest.fn(),
  del: jest.fn(),
  get: jest.fn(),
  getClient: jest.fn(() => ({
    ttl: jest.fn(),
  })),
}));

const redis = require('../../../src/cache/redis-client');
const { checkRateLimit, resetRateLimit, getCurrentCount } = require('../../../src/cv-intake/rate-limiter');

describe('rate-limiter', () => {
  let mockRedisClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisClient = { ttl: jest.fn() };
    redis.getClient.mockReturnValue(mockRedisClient);
  });

  // ─── checkRateLimit ───────────────────────────────────────────────────────────

  describe('checkRateLimit', () => {
    it('harus mengembalikan { allowed: true } jika counter di bawah batas', async () => {
      redis.incrWithTTL.mockResolvedValue(1);

      const result = await checkRateLimit(50);

      expect(result).toEqual({ allowed: true });
    });

    it('harus mengembalikan { allowed: true } jika counter tepat sama dengan batas', async () => {
      redis.incrWithTTL.mockResolvedValue(50);

      const result = await checkRateLimit(50);

      expect(result).toEqual({ allowed: true });
    });

    it('harus mengembalikan { allowed: false, retryAfter } jika counter melebihi batas', async () => {
      redis.incrWithTTL.mockResolvedValue(51);
      mockRedisClient.ttl.mockResolvedValue(45);

      const result = await checkRateLimit(50);

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBe(45);
    });

    it('harus menggunakan TTL default 60 jika TTL Redis tidak tersedia', async () => {
      redis.incrWithTTL.mockResolvedValue(51);
      mockRedisClient.ttl.mockResolvedValue(-1); // no expiry

      const result = await checkRateLimit(50);

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBe(60); // default TTL
    });

    it('harus menggunakan TTL default jika TTL query gagal', async () => {
      redis.incrWithTTL.mockResolvedValue(51);
      mockRedisClient.ttl.mockRejectedValue(new Error('TTL query failed'));

      const result = await checkRateLimit(50);

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBe(60); // default fallback
    });

    it('harus memanggil incrWithTTL dengan key dan TTL yang benar', async () => {
      redis.incrWithTTL.mockResolvedValue(1);

      await checkRateLimit(50);

      expect(redis.incrWithTTL).toHaveBeenCalledWith('rate_limit:cv_intake', 60);
    });

    it('harus menggunakan maxRequests default dari config jika tidak diberikan', async () => {
      redis.incrWithTTL.mockResolvedValue(1);

      const result = await checkRateLimit(); // tanpa parameter

      expect(result.allowed).toBe(true);
      expect(redis.incrWithTTL).toHaveBeenCalledTimes(1);
    });

    it('harus meneruskan error Redis ke caller', async () => {
      redis.incrWithTTL.mockRejectedValue(new Error('Redis connection refused'));

      await expect(checkRateLimit(50)).rejects.toThrow('Redis connection refused');
    });

    it('harus mengembalikan retryAfter dari TTL Redis yang tersisa', async () => {
      redis.incrWithTTL.mockResolvedValue(100);
      mockRedisClient.ttl.mockResolvedValue(30);

      const result = await checkRateLimit(50);

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBe(30);
    });
  });

  // ─── resetRateLimit ───────────────────────────────────────────────────────────

  describe('resetRateLimit', () => {
    it('harus memanggil DEL pada key rate_limit:cv_intake', async () => {
      redis.del.mockResolvedValue(1);

      await resetRateLimit();

      expect(redis.del).toHaveBeenCalledWith('rate_limit:cv_intake');
    });

    it('harus meneruskan error Redis ke caller', async () => {
      redis.del.mockRejectedValue(new Error('Redis error'));

      await expect(resetRateLimit()).rejects.toThrow('Redis error');
    });
  });

  // ─── getCurrentCount ──────────────────────────────────────────────────────────

  describe('getCurrentCount', () => {
    it('harus mengembalikan nilai counter saat ini', async () => {
      redis.get.mockResolvedValue('25');

      const result = await getCurrentCount();

      expect(result).toBe(25);
    });

    it('harus mengembalikan 0 jika key tidak ada', async () => {
      redis.get.mockResolvedValue(null);

      const result = await getCurrentCount();

      expect(result).toBe(0);
    });

    it('harus memanggil GET pada key rate_limit:cv_intake', async () => {
      redis.get.mockResolvedValue('10');

      await getCurrentCount();

      expect(redis.get).toHaveBeenCalledWith('rate_limit:cv_intake');
    });
  });
});
