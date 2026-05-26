'use strict';

/**
 * Scoring Calculator — menghitung skor akhir kandidat menggunakan formula berbobot.
 *
 * Formula:
 *   rawScore = 0.4*skillMatch + 0.3*experience + 0.1*education + 0.1*industry + 0.1*certification
 *   finalScore = Math.min(100, Math.max(0, Math.round(rawScore)))
 *
 * Requirements: 5.1, 5.2, 5.3, 5.5, 5.6
 */

const { getRecommendation } = require('./recommendation');

/**
 * Bobot untuk setiap dimensi scoring.
 */
const WEIGHTS = {
  skillMatch: 0.40,
  experience: 0.30,
  education: 0.10,
  industry: 0.10,
  certification: 0.10,
};

/**
 * Memvalidasi bahwa sebuah nilai adalah skor dimensi yang valid (integer/float dalam [0, 100]).
 * Menolak: null, undefined, NaN, nilai di luar [0, 100].
 *
 * @param {*} value - Nilai yang akan divalidasi
 * @returns {boolean} true jika valid
 */
function isValidDimensionScore(value) {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'number') return false;
  if (Number.isNaN(value)) return false;
  if (value < 0 || value > 100) return false;
  return true;
}

/**
 * Menghitung skor akhir kandidat berdasarkan lima dimensi scoring.
 *
 * Requirements:
 * - 5.1: Formula berbobot Skill Match (40%) + Pengalaman (30%) + Pendidikan (10%) + Industry (10%) + Sertifikasi (10%)
 * - 5.2: Skor akhir integer dalam rentang [0, 100]
 * - 5.3: Recommendation berdasarkan threshold skor
 * - 5.5: Idempotent — input sama selalu menghasilkan output sama
 * - 5.6: Validasi input — tolak skor di luar [0, 100]
 *
 * @param {Object} params - Parameter scoring
 * @param {number} params.skillMatch - Skor skill match (0–100)
 * @param {number} params.experience - Skor relevansi pengalaman (0–100)
 * @param {number} params.education - Skor pendidikan (0–100)
 * @param {number} params.industry - Skor relevansi industri (0–100)
 * @param {number} params.certification - Skor sertifikasi (0–100)
 * @returns {{ score: number, recommendation: string }} Skor akhir dan rekomendasi
 * @throws {Error} Dengan message 'INVALID_DIMENSION_SCORE' jika ada skor di luar [0, 100]
 *
 * @example
 * calculateScore({ skillMatch: 80, experience: 70, education: 70, industry: 60, certification: 50 });
 * // => { score: 71, recommendation: 'Moderate Fit' }
 *
 * @example
 * calculateScore({ skillMatch: 100, experience: 100, education: 100, industry: 100, certification: 100 });
 * // => { score: 100, recommendation: 'Strong Fit' }
 *
 * @example
 * calculateScore({ skillMatch: -1, experience: 50, education: 50, industry: 50, certification: 50 });
 * // throws Error('INVALID_DIMENSION_SCORE')
 */
function calculateScore({ skillMatch, experience, education, industry, certification }) {
  // Req 5.6: Validasi semua dimensi — tolak jika ada yang di luar [0, 100]
  const dimensions = { skillMatch, experience, education, industry, certification };

  for (const [name, value] of Object.entries(dimensions)) {
    if (!isValidDimensionScore(value)) {
      throw new Error(`INVALID_DIMENSION_SCORE: ${name} = ${value}`);
    }
  }

  // Req 5.1: Formula berbobot
  const rawScore =
    (skillMatch * WEIGHTS.skillMatch) +
    (experience * WEIGHTS.experience) +
    (education * WEIGHTS.education) +
    (industry * WEIGHTS.industry) +
    (certification * WEIGHTS.certification);

  // Req 5.2: Clamp ke [0, 100] dan bulatkan ke integer
  const finalScore = Math.min(100, Math.max(0, Math.round(rawScore)));

  // Req 5.3: Tentukan recommendation berdasarkan threshold
  const recommendation = getRecommendation(finalScore);

  return { score: finalScore, recommendation };
}

module.exports = { calculateScore, isValidDimensionScore, WEIGHTS };
