'use strict';

/**
 * Property Test P11: JD Cache Round-Trip
 *
 * Property: data JD yang di-cache identik dengan data yang diambil kembali.
 * JSON.stringify(retrieved) === JSON.stringify(original)
 *
 * Validates: Requirements 11.6
 */

const fc = require('fast-check');
const { JDCache } = require('../../src/jd-cache/redis-cache');

/**
 * Mock Redis client yang menyimpan data di memory (Map).
 * Mensimulasikan perilaku Redis set/get/del dengan TTL.
 */
function createMockRedis() {
  const store = new Map();

  return {
    async set(key, value, _exFlag, _ttl) {
      store.set(key, value);
    },
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async del(key) {
      store.delete(key);
    },
    _store: store,
  };
}

describe('P11: JD Cache Round-Trip', () => {
  /**
   * Validates: Requirements 11.6
   *
   * Property: data JD yang di-set dan di-get kembali identik (JSON round-trip).
   */
  it('data JD yang di-cache identik dengan data yang diambil kembali', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.uuid(),
          title: fc.string({ minLength: 1, maxLength: 100 }),
          mandatory_skills: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1, maxLength: 20 }),
          preferred_skills: fc.array(fc.string({ minLength: 1, maxLength: 30 })),
          min_experience_years: fc.integer({ min: 0, max: 15 }),
          seniority_level: fc.constantFrom('Junior', 'Mid', 'Senior', 'Lead'),
        }),
        async (jdData) => {
          const mockRedis = createMockRedis();
          const cache = new JDCache(mockRedis);

          await cache.set(jdData.id, jdData);
          const retrieved = await cache.get(jdData.id);

          return JSON.stringify(retrieved) === JSON.stringify(jdData);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 11.6
   *
   * Property: get pada key yang tidak ada mengembalikan null.
   */
  it('get pada key yang tidak ada selalu mengembalikan null', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (jobId) => {
          const mockRedis = createMockRedis();
          const cache = new JDCache(mockRedis);

          const result = await cache.get(jobId);
          return result === null;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Validates: Requirements 11.6
   *
   * Property: setelah invalidate, get mengembalikan null.
   */
  it('setelah invalidate, get selalu mengembalikan null', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.uuid(),
          title: fc.string({ minLength: 1, maxLength: 50 }),
          mandatory_skills: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 10 }),
        }),
        async (jdData) => {
          const mockRedis = createMockRedis();
          const cache = new JDCache(mockRedis);

          // Set dulu
          await cache.set(jdData.id, jdData);

          // Verifikasi ada
          const beforeInvalidate = await cache.get(jdData.id);
          if (beforeInvalidate === null) return false;

          // Invalidate
          await cache.invalidate(jdData.id);

          // Setelah invalidate harus null
          const afterInvalidate = await cache.get(jdData.id);
          return afterInvalidate === null;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 11.6
   *
   * Property: data JD dengan struktur nested kompleks tetap identik setelah round-trip.
   */
  it('data JD dengan struktur nested kompleks tetap identik setelah round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.uuid(),
          title: fc.string({ minLength: 1, maxLength: 100 }),
          mandatory_skills: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 0, maxLength: 15 }),
          preferred_skills: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 0, maxLength: 10 }),
          min_experience_years: fc.integer({ min: 0, max: 15 }),
          seniority_level: fc.constantFrom('Junior', 'Mid', 'Senior', 'Lead'),
          keywords: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 20 }),
          industry: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
          is_active: fc.boolean(),
        }),
        async (jdData) => {
          const mockRedis = createMockRedis();
          const cache = new JDCache(mockRedis);

          await cache.set(jdData.id, jdData);
          const retrieved = await cache.get(jdData.id);

          // Verifikasi semua field identik
          return JSON.stringify(retrieved) === JSON.stringify(jdData);
        }
      ),
      { numRuns: 100 }
    );
  });
});
