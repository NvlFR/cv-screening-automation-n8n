'use strict';

/**
 * Property Test P9: Invalid Dimension Score Rejection
 *
 * Property: input ke Scoring_Engine yang mengandung setidaknya satu skor dimensi
 * di luar rentang [0, 100] (misalnya -1, 101, NaN, null) SHALL selalu ditolak
 * dengan error 'INVALID_DIMENSION_SCORE'.
 *
 * Validates: Requirements 5.6
 */

const fc = require('fast-check');
const { calculateScore } = require('../../src/scoring-engine/calculator');

describe('P9: Invalid Dimension Score Rejection', () => {
  /**
   * Validates: Requirements 5.6
   *
   * Property: skor dimensi yang terlalu besar (> 100) selalu ditolak.
   */
  it('skor dimensi > 100 selalu menghasilkan error INVALID_DIMENSION_SCORE', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('skillMatch', 'experience', 'education', 'industry', 'certification'),
        fc.integer({ min: 101, max: 10000 }),
        (invalidDimension, badScore) => {
          const input = {
            skillMatch: 50,
            experience: 50,
            education: 50,
            industry: 50,
            certification: 50,
            [invalidDimension]: badScore,
          };

          let threw = false;
          try {
            calculateScore(input);
          } catch (err) {
            threw = err.message.includes('INVALID_DIMENSION_SCORE');
          }

          return threw;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 5.6
   *
   * Property: skor dimensi negatif (< 0) selalu ditolak.
   */
  it('skor dimensi negatif selalu menghasilkan error INVALID_DIMENSION_SCORE', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('skillMatch', 'experience', 'education', 'industry', 'certification'),
        fc.integer({ min: -10000, max: -1 }),
        (invalidDimension, badScore) => {
          const input = {
            skillMatch: 50,
            experience: 50,
            education: 50,
            industry: 50,
            certification: 50,
            [invalidDimension]: badScore,
          };

          let threw = false;
          try {
            calculateScore(input);
          } catch (err) {
            threw = err.message.includes('INVALID_DIMENSION_SCORE');
          }

          return threw;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 5.6
   *
   * Property: skor dimensi null selalu ditolak.
   */
  it('skor dimensi null selalu menghasilkan error INVALID_DIMENSION_SCORE', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('skillMatch', 'experience', 'education', 'industry', 'certification'),
        (invalidDimension) => {
          const input = {
            skillMatch: 50,
            experience: 50,
            education: 50,
            industry: 50,
            certification: 50,
            [invalidDimension]: null,
          };

          let threw = false;
          try {
            calculateScore(input);
          } catch (err) {
            threw = err.message.includes('INVALID_DIMENSION_SCORE');
          }

          return threw;
        }
      ),
      { numRuns: 5 } // Hanya 5 dimensi, cukup 5 runs
    );
  });

  /**
   * Validates: Requirements 5.6
   *
   * Property: skor dimensi NaN selalu ditolak.
   */
  it('skor dimensi NaN selalu menghasilkan error INVALID_DIMENSION_SCORE', () => {
    const dimensions = ['skillMatch', 'experience', 'education', 'industry', 'certification'];

    for (const dim of dimensions) {
      const input = {
        skillMatch: 50,
        experience: 50,
        education: 50,
        industry: 50,
        certification: 50,
        [dim]: NaN,
      };

      expect(() => calculateScore(input)).toThrow('INVALID_DIMENSION_SCORE');
    }
  });

  /**
   * Validates: Requirements 5.6
   *
   * Property: skor dimensi undefined selalu ditolak.
   */
  it('skor dimensi undefined selalu menghasilkan error INVALID_DIMENSION_SCORE', () => {
    const dimensions = ['skillMatch', 'experience', 'education', 'industry', 'certification'];

    for (const dim of dimensions) {
      const input = {
        skillMatch: 50,
        experience: 50,
        education: 50,
        industry: 50,
        certification: 50,
        [dim]: undefined,
      };

      expect(() => calculateScore(input)).toThrow('INVALID_DIMENSION_SCORE');
    }
  });

  /**
   * Validates: Requirements 5.6
   *
   * Property: input valid (semua dimensi dalam [0, 100]) tidak pernah melempar error.
   */
  it('input valid tidak pernah melempar error INVALID_DIMENSION_SCORE', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (skillMatch, experience, education, industry, certification) => {
          let threw = false;
          try {
            calculateScore({ skillMatch, experience, education, industry, certification });
          } catch {
            threw = true;
          }
          return !threw;
        }
      ),
      { numRuns: 100 }
    );
  });
});
