'use strict';

/**
 * Property Test P6: Weighted Score Calculation Invariant
 *
 * Property: skor akhir calculateScore selalu integer dalam [0, 100]
 * untuk semua kombinasi input valid (5 dimensi masing-masing dalam [0, 100]).
 *
 * Validates: Requirements 5.1, 5.2
 */

const fc = require('fast-check');
const { calculateScore } = require('../../src/scoring-engine/calculator');

describe('P6: Weighted Score Calculation Invariant', () => {
  /**
   * Validates: Requirements 5.1, 5.2
   *
   * Property: untuk semua kombinasi 5 dimensi valid (integer [0, 100]),
   * calculateScore menghasilkan integer dalam [0, 100].
   */
  it('skor akhir selalu integer dalam [0, 100] untuk semua input valid', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (skillMatch, experience, education, industry, certification) => {
          const result = calculateScore({ skillMatch, experience, education, industry, certification });

          // Skor harus integer
          if (!Number.isInteger(result.score)) return false;

          // Skor harus dalam [0, 100]
          if (result.score < 0 || result.score > 100) return false;

          return true;
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * Validates: Requirements 5.1
   *
   * Property: skor akhir tidak pernah melebihi nilai maksimum dimensi tertinggi
   * (karena bobot total = 1.0, skor tidak bisa melebihi 100).
   */
  it('skor akhir tidak pernah melebihi 100 meskipun semua dimensi = 100', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (skillMatch, experience, education, industry, certification) => {
          const result = calculateScore({ skillMatch, experience, education, industry, certification });
          return result.score <= 100;
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * Validates: Requirements 5.2
   *
   * Property: skor akhir tidak pernah negatif.
   */
  it('skor akhir tidak pernah negatif', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (skillMatch, experience, education, industry, certification) => {
          const result = calculateScore({ skillMatch, experience, education, industry, certification });
          return result.score >= 0;
        }
      ),
      { numRuns: 200 }
    );
  });
});
