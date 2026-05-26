'use strict';

/**
 * Recommendation Engine — menentukan klasifikasi kandidat berdasarkan skor akhir.
 * Requirements: 5.3
 */

/**
 * Menentukan rekomendasi berdasarkan skor akhir kandidat.
 *
 * Aturan threshold:
 * - skor >= 80 → 'Strong Fit'
 * - skor >= 60 dan < 80 → 'Moderate Fit'
 * - skor < 60 → 'Weak Fit'
 *
 * @param {number} score - Skor akhir kandidat (integer 0–100)
 * @returns {'Strong Fit' | 'Moderate Fit' | 'Weak Fit'} Rekomendasi kandidat
 *
 * @example
 * getRecommendation(85); // => 'Strong Fit'
 * getRecommendation(70); // => 'Moderate Fit'
 * getRecommendation(45); // => 'Weak Fit'
 */
function getRecommendation(score) {
  if (score >= 80) {
    return 'Strong Fit';
  } else if (score >= 60) {
    return 'Moderate Fit';
  } else {
    return 'Weak Fit';
  }
}

module.exports = { getRecommendation };
