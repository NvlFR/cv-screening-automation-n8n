'use strict';

/**
 * Property Test P5: JD Matching Dimension Scores Range
 *
 * Property: setiap skor dimensi yang dihasilkan parseJDMatcherOutput
 * (skill_match, experience_relevance, industry_relevance, seniority_fit, keyword_overlap)
 * selalu berada dalam rentang integer [0, 100].
 *
 * Validates: Requirements 4.2, 4.3
 */

const fc = require('fast-check');
const { parseJDMatcherOutput, REQUIRED_DIMENSIONS } = require('../../src/jd-matcher/parser');

/**
 * Membuat raw JSON string yang valid untuk parseJDMatcherOutput
 * dengan skor yang diberikan untuk setiap dimensi.
 */
function buildRawOutput(scores) {
  const obj = {};
  for (const dim of REQUIRED_DIMENSIONS) {
    obj[dim] = {
      score: scores[dim],
      reasoning: 'test reasoning',
      matched_skills: [],
      missing_skills: [],
      matched_keywords: [],
    };
  }
  obj.mandatory_skills_status = {};
  return JSON.stringify(obj);
}

describe('P5: JD Matching Dimension Scores Range', () => {
  /**
   * Validates: Requirements 4.2, 4.3
   *
   * Property: untuk semua kombinasi skor dimensi valid (integer [0, 100]),
   * parseJDMatcherOutput menghasilkan skor yang tetap dalam [0, 100].
   */
  it('semua skor dimensi selalu dalam rentang [0, 100] untuk input valid', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (skillMatch, experienceRelevance, industryRelevance, seniority, keywordOverlap) => {
          const scores = {
            skill_match: skillMatch,
            experience_relevance: experienceRelevance,
            industry_relevance: industryRelevance,
            seniority_fit: seniority,
            keyword_overlap: keywordOverlap,
          };

          const rawOutput = buildRawOutput(scores);
          const result = parseJDMatcherOutput(rawOutput);

          // Setiap dimensi harus ada dan skornya dalam [0, 100]
          for (const dim of REQUIRED_DIMENSIONS) {
            const score = result[dim]?.score;
            if (typeof score !== 'number') return false;
            if (!Number.isFinite(score)) return false;
            if (score < 0 || score > 100) return false;
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 4.3
   *
   * Property: skor dimensi selalu integer (setelah normalisasi).
   */
  it('skor dimensi selalu integer setelah normalisasi', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (skillMatch, experienceRelevance, industryRelevance, seniority, keywordOverlap) => {
          const scores = {
            skill_match: skillMatch,
            experience_relevance: experienceRelevance,
            industry_relevance: industryRelevance,
            seniority_fit: seniority,
            keyword_overlap: keywordOverlap,
          };

          const rawOutput = buildRawOutput(scores);
          const result = parseJDMatcherOutput(rawOutput);

          for (const dim of REQUIRED_DIMENSIONS) {
            if (!Number.isInteger(result[dim]?.score)) return false;
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 4.2
   *
   * Property: semua 5 dimensi wajib selalu ada di output.
   */
  it('semua 5 dimensi wajib selalu ada di output', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (skillMatch, experienceRelevance, industryRelevance, seniority, keywordOverlap) => {
          const scores = {
            skill_match: skillMatch,
            experience_relevance: experienceRelevance,
            industry_relevance: industryRelevance,
            seniority_fit: seniority,
            keyword_overlap: keywordOverlap,
          };

          const rawOutput = buildRawOutput(scores);
          const result = parseJDMatcherOutput(rawOutput);

          // Semua dimensi wajib harus ada
          return REQUIRED_DIMENSIONS.every(dim => dim in result && result[dim] !== null);
        }
      ),
      { numRuns: 100 }
    );
  });
});
