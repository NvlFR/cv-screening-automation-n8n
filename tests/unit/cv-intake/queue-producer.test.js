'use strict';

/**
 * Unit tests untuk queue-producer.js
 * Memverifikasi fungsi enqueueCV dan getQueueLength
 */

// Mock redis-client sebelum require module yang diuji
jest.mock('../../../src/cache/redis-client', () => ({
  lpush: jest.fn(),
  llen: jest.fn(),
  getClient: jest.fn(),
}));

const redis = require('../../../src/cache/redis-client');
const { enqueueCV, getQueueLength } = require('../../../src/cv-intake/queue-producer');

describe('queue-producer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── enqueueCV ───────────────────────────────────────────────────────────────

  describe('enqueueCV', () => {
    const validJob = {
      jobId: '550e8400-e29b-41d4-a716-446655440000',
      fileKey: 'cv/encrypted/2024-01-01/550e8400.enc',
      filename: 'john_doe_cv.pdf',
      source: 'webhook',
      enqueuedAt: '2024-01-01T00:00:00.000Z',
    };

    it('harus memanggil LPUSH ke key cv_processing_queue dengan payload JSON', async () => {
      redis.lpush.mockResolvedValue(1);

      const result = await enqueueCV(validJob);

      expect(redis.lpush).toHaveBeenCalledTimes(1);
      expect(redis.lpush).toHaveBeenCalledWith(
        'cv_processing_queue',
        JSON.stringify(validJob)
      );
      expect(result).toBe(1);
    });

    it('harus mengembalikan panjang queue setelah push', async () => {
      redis.lpush.mockResolvedValue(5);

      const result = await enqueueCV(validJob);

      expect(result).toBe(5);
    });

    it('harus menyertakan positionId jika ada', async () => {
      redis.lpush.mockResolvedValue(1);
      const jobWithPosition = { ...validJob, positionId: 'pos-001' };

      await enqueueCV(jobWithPosition);

      const calledPayload = JSON.parse(redis.lpush.mock.calls[0][1]);
      expect(calledPayload.positionId).toBe('pos-001');
    });

    it('harus melempar error jika cvQueueJob bukan object', async () => {
      await expect(enqueueCV(null)).rejects.toThrow('parameter cvQueueJob wajib berupa object');
      await expect(enqueueCV('string')).rejects.toThrow('parameter cvQueueJob wajib berupa object');
      await expect(enqueueCV(123)).rejects.toThrow('parameter cvQueueJob wajib berupa object');
    });

    it('harus melempar error jika jobId kosong', async () => {
      await expect(enqueueCV({ ...validJob, jobId: '' })).rejects.toThrow('"jobId" wajib diisi');
      await expect(enqueueCV({ ...validJob, jobId: null })).rejects.toThrow('"jobId" wajib diisi');
    });

    it('harus melempar error jika fileKey kosong', async () => {
      await expect(enqueueCV({ ...validJob, fileKey: '' })).rejects.toThrow('"fileKey" wajib diisi');
    });

    it('harus melempar error jika filename kosong', async () => {
      await expect(enqueueCV({ ...validJob, filename: '' })).rejects.toThrow('"filename" wajib diisi');
    });

    it('harus melempar error jika source kosong', async () => {
      await expect(enqueueCV({ ...validJob, source: '' })).rejects.toThrow('"source" wajib diisi');
    });

    it('harus melempar error jika enqueuedAt kosong', async () => {
      await expect(enqueueCV({ ...validJob, enqueuedAt: '' })).rejects.toThrow('"enqueuedAt" wajib diisi');
    });

    it('harus meneruskan error Redis ke caller', async () => {
      redis.lpush.mockRejectedValue(new Error('Redis connection refused'));

      await expect(enqueueCV(validJob)).rejects.toThrow('Redis connection refused');
    });

    it('harus menyimpan payload sebagai JSON string yang valid', async () => {
      redis.lpush.mockResolvedValue(1);

      await enqueueCV(validJob);

      const rawPayload = redis.lpush.mock.calls[0][1];
      expect(() => JSON.parse(rawPayload)).not.toThrow();

      const parsed = JSON.parse(rawPayload);
      expect(parsed.jobId).toBe(validJob.jobId);
      expect(parsed.fileKey).toBe(validJob.fileKey);
      expect(parsed.filename).toBe(validJob.filename);
      expect(parsed.source).toBe(validJob.source);
      expect(parsed.enqueuedAt).toBe(validJob.enqueuedAt);
    });
  });

  // ─── getQueueLength ───────────────────────────────────────────────────────────

  describe('getQueueLength', () => {
    it('harus memanggil LLEN pada key cv_processing_queue', async () => {
      redis.llen.mockResolvedValue(10);

      const result = await getQueueLength();

      expect(redis.llen).toHaveBeenCalledWith('cv_processing_queue');
      expect(result).toBe(10);
    });

    it('harus mengembalikan 0 jika queue kosong', async () => {
      redis.llen.mockResolvedValue(0);

      const result = await getQueueLength();

      expect(result).toBe(0);
    });

    it('harus meneruskan error Redis ke caller', async () => {
      redis.llen.mockRejectedValue(new Error('Redis timeout'));

      await expect(getQueueLength()).rejects.toThrow('Redis timeout');
    });
  });
});
