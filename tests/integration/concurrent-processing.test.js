'use strict';

/**
 * Integration Test: Concurrent Processing
 *
 * Submit N CVs to queue concurrently, verify all processed without race conditions.
 *
 * Requirements: 1.6, 11.3, 11.4
 */

const { enqueueCV } = require('../../src/cv-intake/queue-producer');
const redis = require('../../src/cache/redis-client');

describe('Concurrent Processing', () => {
  const QUEUE_KEY = 'cv_processing_queue';
  const TEST_CONCURRENT_COUNT = 10;

  beforeEach(async () => {
    // Clear queue before each test
    try {
      const client = redis.getClient();
      await client.del(QUEUE_KEY);
    } catch (err) {
      console.warn('Could not clear Redis queue:', err.message);
    }
  });

  afterEach(async () => {
    // Cleanup
    try {
      const client = redis.getClient();
      await client.del(QUEUE_KEY);
    } catch (err) {
      // Ignore
    }
  });

  it('enqueue CV job berhasil ke Redis queue', async () => {
    const job = {
      jobId: `concurrent-test-${Date.now()}`,
      fileKey: 'test/file.pdf',
      filename: 'test-cv.pdf',
      source: 'integration_test',
      enqueuedAt: new Date().toISOString(),
    };

    const queueLength = await enqueueCV(job);

    expect(queueLength).toBeGreaterThanOrEqual(1);
  });

  it('enqueue multiple CV jobs concurrently', async () => {
    const jobs = Array.from({ length: TEST_CONCURRENT_COUNT }, (_, i) => ({
      jobId: `concurrent-test-${Date.now()}-${i}`,
      fileKey: `test/file-${i}.pdf`,
      filename: `test-cv-${i}.pdf`,
      source: 'integration_test',
      enqueuedAt: new Date().toISOString(),
    }));

    // Enqueue all concurrently
    const results = await Promise.all(jobs.map(job => enqueueCV(job)));

    // All should succeed
    expect(results.every(len => len >= 1)).toBe(true);

    // Final queue length should equal number of jobs
    const client = redis.getClient();
    const finalLength = await client.llen(QUEUE_KEY);
    expect(finalLength).toBe(TEST_CONCURRENT_COUNT);
  });

  it('queue follows FIFO order (oldest first)', async () => {
    const jobs = Array.from({ length: 5 }, (_, i) => ({
      jobId: `fifo-test-${Date.now()}-${i}`,
      fileKey: `test/file-${i}.pdf`,
      filename: `test-cv-${i}.pdf`,
      source: 'integration_test',
      enqueuedAt: new Date().toISOString(),
    }));

    // Enqueue sequentially
    for (const job of jobs) {
      await enqueueCV(job);
    }

    // Verify order by peeking
    const client = redis.getClient();
    const items = await client.lrange(QUEUE_KEY, 0, -1);

    expect(items.length).toBe(5);

    // With LPUSH, the oldest item (job 0) is at the end of the list
    const oldestItem = JSON.parse(items[items.length - 1]);
    expect(oldestItem.filename).toBe('test-cv-0.pdf');
  });

  it('duplicate jobId tidak menyebabkan masalah', async () => {
    const duplicateJob = {
      jobId: 'duplicate-job-id',
      fileKey: 'test/file1.pdf',
      filename: 'test-cv-1.pdf',
      source: 'integration_test',
      enqueuedAt: new Date().toISOString(),
    };

    await enqueueCV(duplicateJob);
    await enqueueCV({ ...duplicateJob, filename: 'test-cv-2.pdf' });

    const client = redis.getClient();
    const length = await client.llen(QUEUE_KEY);
    expect(length).toBe(2);
  });

  it('queue length check via llen', async () => {
    const client = redis.getClient();

    // Should be empty initially
    let length = await client.llen(QUEUE_KEY);
    expect(length).toBe(0);

    // Add one
    await enqueueCV({
      jobId: 'length-test-1',
      fileKey: 'test/file.pdf',
      filename: 'test.pdf',
      source: 'integration_test',
      enqueuedAt: new Date().toISOString(),
    });

    length = await client.llen(QUEUE_KEY);
    expect(length).toBe(1);
  });
});