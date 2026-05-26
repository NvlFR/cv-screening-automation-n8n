'use strict';

/**
 * Education Scorer — menghitung skor pendidikan berdasarkan tingkat degree tertinggi.
 * Requirements: 5.1
 */

/**
 * Tabel skor berdasarkan tingkat pendidikan.
 * Degree yang tidak dikenal mendapat skor default 50.
 */
const DEGREE_SCORES = {
  'S3': 100,
  'PhD': 100,
  'S2': 85,
  'Master': 85,
  'S1': 70,
  'Bachelor': 70,
  'D4': 60,
  'D3': 50,
  'SMA': 30,
};

/**
 * Menghitung skor pendidikan berdasarkan tingkat degree tertinggi dari semua entri pendidikan.
 *
 * @param {Array<{degree: string, institution: string, year: number|null}>|null|undefined} education
 *   Array entri pendidikan kandidat
 * @returns {number} Skor pendidikan (0–100):
 *   - 0 jika array kosong atau null/undefined
 *   - Skor degree tertinggi dari semua entri
 *
 * @example
 * calculateEducationScore([{ degree: 'S2', institution: 'UI', year: 2020 }]);
 * // => 85
 *
 * @example
 * calculateEducationScore([
 *   { degree: 'S1', institution: 'ITB', year: 2015 },
 *   { degree: 'S2', institution: 'UI', year: 2018 },
 * ]);
 * // => 85 (ambil yang tertinggi)
 *
 * @example
 * calculateEducationScore([]); // => 0
 * calculateEducationScore(null); // => 0
 */
function calculateEducationScore(education) {
  if (!education || education.length === 0) {
    return 0;
  }

  const topScore = education.reduce((max, edu) => {
    const score = DEGREE_SCORES[edu.degree] !== undefined
      ? DEGREE_SCORES[edu.degree]
      : 50; // default untuk degree yang tidak dikenal
    return score > max ? score : max;
  }, 0);

  return topScore;
}

module.exports = { calculateEducationScore, DEGREE_SCORES };
