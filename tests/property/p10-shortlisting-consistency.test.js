'use strict';

/**
 * Property Test P10: Shortlisting Rule Consistency
 *
 * Property: keputusan Shortlisting_Engine selalu konsisten dengan aturan:
 * kandidat di-shortlist jika dan hanya jika:
 *   (score >= 80) AND (semua mandatory skills = matched) AND (experience_years >= min_experience_years)
 *
 * Validates: Requirements 7.2, 7.3
 */

const fc = require('fast-check');
const { evaluateShortlist } = require('../../src/shortlisting-engine/evaluator');

describe('P10: Shortlisting Rule Consistency', () => {
  /**
   * Validates: Requirements 7.2, 7.3
   *
   * Property: keputusan shortlist selalu konsisten dengan ketiga kondisi.
   */
  it('keputusan shortlist selalu konsisten dengan (score>=80 AND allMatched AND expOk)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 30 }),
          fc.constantFrom('matched', 'missing')
        ),
        fc.integer({ min: 0, max: 30 }),
        fc.integer({ min: 0, max: 15 }),
        (score, mandatorySkillsStatus, experienceYears, minExperienceYears) => {
          const result = evaluateShortlist({
            score,
            mandatorySkillsStatus,
            experienceYears,
            minExperienceYears,
          });

          // Hitung expected shortlist berdasarkan aturan
          const skillValues = Object.values(mandatorySkillsStatus);
          const allMandatoryMatched = skillValues.length === 0
            ? true
            : skillValues.every(s => s === 'matched');
          const hasEnoughExp = experienceYears >= minExperienceYears;
          const expectedShortlisted = score >= 80 && allMandatoryMatched && hasEnoughExp;

          return result.isShortlisted === expectedShortlisted;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 7.2
   *
   * Property: kandidat yang memenuhi semua kondisi SELALU di-shortlist.
   */
  it('kandidat yang memenuhi semua kondisi selalu di-shortlist', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 80, max: 100 }),
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.constant('matched')
        ),
        fc.integer({ min: 0, max: 30 }),
        (score, mandatorySkillsStatus, minExperienceYears) => {
          // experienceYears >= minExperienceYears
          const experienceYears = minExperienceYears + fc.sample(fc.integer({ min: 0, max: 10 }), 1)[0];

          const result = evaluateShortlist({
            score,
            mandatorySkillsStatus,
            experienceYears,
            minExperienceYears,
          });

          return result.isShortlisted === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 7.3
   *
   * Property: kandidat dengan score < 80 TIDAK PERNAH di-shortlist.
   */
  it('kandidat dengan score < 80 tidak pernah di-shortlist', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 79 }),
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.constantFrom('matched', 'missing')
        ),
        fc.integer({ min: 0, max: 30 }),
        fc.integer({ min: 0, max: 15 }),
        (score, mandatorySkillsStatus, experienceYears, minExperienceYears) => {
          const result = evaluateShortlist({
            score,
            mandatorySkillsStatus,
            experienceYears,
            minExperienceYears,
          });

          return result.isShortlisted === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 7.3
   *
   * Property: kandidat dengan mandatory skill missing TIDAK PERNAH di-shortlist.
   */
  it('kandidat dengan mandatory skill missing tidak pernah di-shortlist', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 80, max: 100 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 0, max: 30 }),
        fc.integer({ min: 0, max: 15 }),
        (score, missingSkill, experienceYears, minExperienceYears) => {
          // Pastikan ada setidaknya satu skill yang missing
          const mandatorySkillsStatus = {
            [missingSkill]: 'missing',
          };

          const result = evaluateShortlist({
            score,
            mandatorySkillsStatus,
            experienceYears,
            minExperienceYears,
          });

          return result.isShortlisted === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 7.3
   *
   * Property: kandidat dengan experience kurang TIDAK PERNAH di-shortlist.
   */
  it('kandidat dengan experience kurang tidak pernah di-shortlist', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 80, max: 100 }),
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.constant('matched')
        ),
        fc.integer({ min: 1, max: 15 }),
        (score, mandatorySkillsStatus, minExperienceYears) => {
          // experienceYears < minExperienceYears
          const experienceYears = minExperienceYears - 1;

          const result = evaluateShortlist({
            score,
            mandatorySkillsStatus,
            experienceYears,
            minExperienceYears,
          });

          return result.isShortlisted === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 7.2, 7.3
   *
   * Property: reason selalu non-kosong untuk semua kasus.
   */
  it('reason selalu non-kosong untuk semua kasus', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.constantFrom('matched', 'missing')
        ),
        fc.integer({ min: 0, max: 30 }),
        fc.integer({ min: 0, max: 15 }),
        (score, mandatorySkillsStatus, experienceYears, minExperienceYears) => {
          const result = evaluateShortlist({
            score,
            mandatorySkillsStatus,
            experienceYears,
            minExperienceYears,
          });

          return typeof result.reason === 'string' && result.reason.length > 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});
