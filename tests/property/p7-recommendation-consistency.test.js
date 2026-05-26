'use strict';

/**
 * Property Test P7: Recommendation Consistency
 *
 * Property: recommendation yang ditetapkan Scoring_Engine selalu konsisten
 * dengan aturan threshold:
 *   - skor >= 80 → 'Strong Fit'
 *   - 60 <= skor < 80 → 'Moderate Fit'
 *   - skor < 60 → 'Weak Fit'
 *
 * Validates: Requirements 5.3
 */

const fc = require('fast-check');
const { getRecommendation } = require('../../src/scoring-engine/recommendation');
const { calculateScore } = require('../../src/scoring-engine/calculator');

describe('P7: Recommendation Consistency', () => {
  /**
   * Validates: Requirements 5.3
   *
   * Property: getRecommendation selalu konsisten dengan threshold skor.
   */
  it('getRecommendation selalu konsisten dengan threshold untuk semua skor [0, 100]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (score) => {
          const recommendation = getRecommendation(score);

          if (score >= 80) {
            return recommendation === 'Strong Fit';
          } else if (score >= 60) {
            return recommendation === 'Moderate Fit';
          } else {
            return recommendation === 'Weak Fit';
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 5.3
   *
   * Property: recommendation dari calculateScore juga konsisten dengan threshold.
   */
  it('recommendation dari calculateScore konsisten dengan threshold skor akhir', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (skillMatch, experience, education, industry, certification) => {
          const result = calculateScore({ skillMatch, experience, education, industry, certification });
          const { score, recommendation } = result;

          if (score >= 80) {
            return recommendation === 'Strong Fit';
          } else if (score >= 60) {
            return recommendation === 'Moderate Fit';
          } else {
            return recommendation === 'Weak Fit';
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 5.3
   *
   * Property: recommendation hanya menghasilkan salah satu dari tiga nilai valid.
   */
  it('recommendation selalu salah satu dari: Strong Fit, Moderate Fit, Weak Fit', () => {
    const validRecommendations = new Set(['Strong Fit', 'Moderate Fit', 'Weak Fit']);

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (score) => {
          const recommendation = getRecommendation(score);
          return validRecommendations.has(recommendation);
        }
      ),
      { numRuns: 100 }
    );
  });
});
