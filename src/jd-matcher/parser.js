'use strict';

/**
 * Parser dan validator untuk output OpenAI dari JD Matching.
 * Memastikan setiap skor dimensi adalah integer dalam [0, 100]
 * dan mandatory_skills_status berisi hanya 'matched' atau 'missing'.
 *
 * Requirements: 4.2, 4.3, 4.4
 */

/**
 * Lima dimensi yang wajib ada di output JD Matching.
 */
const REQUIRED_DIMENSIONS = [
  'skill_match',
  'experience_relevance',
  'industry_relevance',
  'seniority_fit',
  'keyword_overlap',
];

/**
 * Nilai yang valid untuk mandatory_skills_status.
 */
const VALID_SKILL_STATUSES = new Set(['matched', 'missing']);

/**
 * Memvalidasi bahwa nilai adalah integer dalam rentang [0, 100].
 *
 * @param {*} value - Nilai yang akan divalidasi
 * @returns {boolean} true jika valid
 */
function isValidDimensionScore(value) {
  if (typeof value !== 'number') return false;
  if (!Number.isFinite(value)) return false;
  const rounded = Math.round(value);
  return rounded >= 0 && rounded <= 100;
}

/**
 * Mengkonversi nilai skor ke integer yang valid dalam [0, 100].
 * Melakukan clamp dan pembulatan.
 *
 * @param {*} value - Nilai skor dari OpenAI
 * @returns {number} Integer dalam [0, 100]
 * @throws {Error} Jika nilai tidak bisa dikonversi ke angka
 */
function normalizeScore(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new Error(`Skor tidak valid: ${value}`);
  }
  return Math.min(100, Math.max(0, Math.round(num)));
}

/**
 * Mem-parse dan memvalidasi raw output string dari OpenAI untuk JD Matching.
 * Mengekstrak skor per dimensi dan mandatory_skills_status.
 *
 * Requirements: 4.2 — evaluasi lima dimensi kecocokan
 * Requirements: 4.3 — skor per dimensi dalam rentang 0–100
 * Requirements: 4.4 — mandatory_skills_status: 'matched' atau 'missing'
 *
 * @param {string} rawOutput - String JSON dari OpenAI
 * @returns {Object} Parsed dan validated JD match result:
 *   {
 *     skill_match: { score: number, matched_skills: string[], missing_skills: string[], reasoning: string },
 *     experience_relevance: { score: number, reasoning: string },
 *     industry_relevance: { score: number, reasoning: string },
 *     seniority_fit: { score: number, reasoning: string },
 *     keyword_overlap: { score: number, matched_keywords: string[], reasoning: string },
 *     mandatory_skills_status: { [skillName]: 'matched' | 'missing' },
 *     dimension_scores: { skill_match: number, experience_relevance: number, industry_relevance: number, seniority_fit: number, keyword_overlap: number }
 *   }
 * @throws {Error} Jika output tidak valid atau skor di luar rentang
 *
 * @example
 * const result = parseJDMatcherOutput('{"skill_match": {"score": 85, ...}, ...}');
 * // => { skill_match: { score: 85, ... }, dimension_scores: { skill_match: 85, ... }, ... }
 */
function parseJDMatcherOutput(rawOutput) {
  if (typeof rawOutput !== 'string') {
    throw new TypeError('parseJDMatcherOutput: rawOutput harus berupa string');
  }

  // Bersihkan markdown code block jika ada (defensive)
  const jsonStr = rawOutput
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (!jsonStr) {
    throw new Error('JD_MATCHER_PARSE_ERROR: Output OpenAI kosong');
  }

  // Parse JSON
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (parseError) {
    throw new Error(`JD_MATCHER_PARSE_ERROR: Response OpenAI bukan JSON valid: ${parseError.message}`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('JD_MATCHER_PARSE_ERROR: Output harus berupa JSON object');
  }

  // Validasi dan ekstrak setiap dimensi
  const result = {};
  const dimensionScores = {};

  for (const dimension of REQUIRED_DIMENSIONS) {
    const dimData = parsed[dimension];

    if (!dimData || typeof dimData !== 'object') {
      throw new Error(`JD_MATCHER_PARSE_ERROR: Dimensi '${dimension}' tidak ditemukan atau tidak valid`);
    }

    if (dimData.score === undefined || dimData.score === null) {
      throw new Error(`JD_MATCHER_PARSE_ERROR: Skor untuk dimensi '${dimension}' tidak ditemukan`);
    }

    // Validasi skor
    if (!isValidDimensionScore(dimData.score)) {
      throw new Error(
        `INVALID_DIMENSION_SCORE: Skor dimensi '${dimension}' = ${dimData.score} tidak valid (harus integer 0–100)`
      );
    }

    const normalizedScore = normalizeScore(dimData.score);

    // Bangun objek dimensi dengan field yang relevan
    result[dimension] = {
      score: normalizedScore,
      reasoning: typeof dimData.reasoning === 'string' ? dimData.reasoning : '',
    };

    // Field tambahan per dimensi
    if (dimension === 'skill_match') {
      result[dimension].matched_skills = Array.isArray(dimData.matched_skills)
        ? dimData.matched_skills.filter(s => typeof s === 'string')
        : [];
      result[dimension].missing_skills = Array.isArray(dimData.missing_skills)
        ? dimData.missing_skills.filter(s => typeof s === 'string')
        : [];
    }

    if (dimension === 'keyword_overlap') {
      result[dimension].matched_keywords = Array.isArray(dimData.matched_keywords)
        ? dimData.matched_keywords.filter(k => typeof k === 'string')
        : [];
    }

    dimensionScores[dimension] = normalizedScore;
  }

  // Ekstrak dan validasi mandatory_skills_status
  const mandatorySkillsStatus = {};
  const rawMandatoryStatus = parsed.mandatory_skills_status;

  if (rawMandatoryStatus && typeof rawMandatoryStatus === 'object' && !Array.isArray(rawMandatoryStatus)) {
    for (const [skillName, status] of Object.entries(rawMandatoryStatus)) {
      if (typeof skillName !== 'string' || !skillName.trim()) {
        continue; // Skip key yang tidak valid
      }

      // Normalisasi status ke lowercase
      const normalizedStatus = typeof status === 'string' ? status.toLowerCase().trim() : '';

      if (VALID_SKILL_STATUSES.has(normalizedStatus)) {
        mandatorySkillsStatus[skillName] = normalizedStatus;
      } else {
        // Default ke 'missing' jika status tidak dikenali
        mandatorySkillsStatus[skillName] = 'missing';
      }
    }
  }

  return {
    ...result,
    mandatory_skills_status: mandatorySkillsStatus,
    dimension_scores: dimensionScores,
  };
}

module.exports = {
  parseJDMatcherOutput,
  isValidDimensionScore,
  normalizeScore,
  REQUIRED_DIMENSIONS,
  VALID_SKILL_STATUSES,
};
