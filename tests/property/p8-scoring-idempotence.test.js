'use strict';

/**
 * Property Test P8: Scoring Idempotence
 *
 * Property: memanggil calculateScore dua kali dengan input yang identik
 * SHALL selalu menghasilkan skor akhir yang identik — tidak ada randomness
 * atau side effect yang mempengaruhi hasil kalkulasi.
 *
 * Validates: Requirements 5.5
 */

const fc = require('fast-check');
const { calculateScore } = require('../../src/scoring-engine/calculator');

describe('P8: Scoring Idempotence', () => {
  /**
   * Validates: Requirements 5.5
   *
   * Property: calculateScore dengan input identik selalu menghasilkan skor yang sama.
   */
  it('calculateScore menghasilkan skor identik untuk input yang sama (2 kali pemanggilan)', () => {
    fc.assert(
      fc.property(
        fc.record({
          skillMatch: fc.integer({ min: 0, max: 100 }),
          experience: fc.integer({ min: 0, max: 100 }),
          education: fc.integer({ min: 0, max: 100 }),
          industry: fc.integer({ min: 0, max: 100 }),
          certification: fc.integer({ min: 0, max: 100 }),
        }),
        (dimensionScores) => {
          const result1 = calculateScore(dimensionScores);
          const result2 = calculateScore(dimensionScores);

          return result1.score === result2.score &&
                 result1.recommendation === result2.recommendation;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 5.5
   *
   * Property: calculateScore dengan input identik menghasilkan hasil yang sama
   * meskipun dipanggil 5 kali berturut-turut.
   */
  it('calculateScore menghasilkan hasil identik untuk 5 kali pemanggilan berturut-turut', () => {
    fc.assert(
      fc.property(
        fc.record({
          skillMatch: fc.integer({ min: 0, max: 100 }),
          experience: fc.integer({ min: 0, max: 100 }),
          education: fc.integer({ min: 0, max: 100 }),
          industry: fc.integer({ min: 0, max: 100 }),
          certification: fc.integer({ min: 0, max: 100 }),
        }),
        (dimensionScores) => {
          const results = Array.from({ length: 5 }, () => calculateScore(dimensionScores));

          const firstScore = results[0].score;
          const firstRec = results[0].recommendation;

          return results.every(r => r.score === firstScore && r.recommendation === firstRec);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 5.5
   *
   * Property: input tidak dimodifikasi setelah calculateScore dipanggil
   * (tidak ada side effect pada objek input).
   */
  it('calculateScore tidak memodifikasi objek input (no side effects)', () => {
    fc.assert(
      fc.property(
        fc.record({
          skillMatch: fc.integer({ min: 0, max: 100 }),
          experience: fc.integer({ min: 0, max: 100 }),
          education: fc.integer({ min: 0, max: 100 }),
          industry: fc.integer({ min: 0, max: 100 }),
          certification: fc.integer({ min: 0, max: 100 }),
        }),
        (dimensionScores) => {
          // Simpan nilai asli
          const originalValues = { ...dimensionScores };

          // Panggil calculateScore
          calculateScore(dimensionScores);

          // Verifikasi input tidak berubah
          return dimensionScores.skillMatch === originalValues.skillMatch &&
                 dimensionScores.experience === originalValues.experience &&
                 dimensionScores.education === originalValues.education &&
                 dimensionScores.industry === originalValues.industry &&
                 dimensionScores.certification === originalValues.certification;
        }
      ),
      { numRuns: 100 }
    );
  });
});
