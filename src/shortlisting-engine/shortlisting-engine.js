'use strict';

/**
 * Shortlisting_Engine — n8n Code Node wrapper untuk evaluasi shortlist kandidat.
 *
 * Memproses semua item dari $input.all() dan mengembalikan array results
 * dengan field tambahan: status ('Shortlisted' | 'Not Shortlisted') dan shortlistReason.
 *
 * Cara penggunaan di n8n Code Node:
 *   const { runShortlistingEngine } = require('./shortlisting-engine');
 *   return runShortlistingEngine($input.all());
 *
 * Requirements: 7.1, 7.2, 7.3, 7.5
 */

const { evaluateShortlist } = require('./evaluator');

/**
 * Memproses array items dari n8n dan mengevaluasi shortlist setiap kandidat.
 *
 * @param {Array<{ json: Object }>} items - Array items dari $input.all()
 * @returns {Array<{ json: Object }>} Array results dengan field status dan shortlistReason
 *
 * @example
 * const items = [
 *   {
 *     json: {
 *       candidateId: 'abc-123',
 *       score: 85,
 *       mandatorySkillsStatus: { JavaScript: 'matched', React: 'matched' },
 *       experience_years: 5,
 *       minExperienceYears: 3
 *     }
 *   }
 * ];
 * const results = runShortlistingEngine(items);
 * // results[0].json.status === 'Shortlisted'
 * // results[0].json.shortlistReason === 'Score 85 >= 80, all mandatory skills matched, experience 5y >= 3y required'
 */
function runShortlistingEngine(items) {
  const results = [];

  for (const item of items) {
    const {
      score,
      mandatorySkillsStatus,
      experience_years,
      minExperienceYears,
    } = item.json;

    const { isShortlisted, reason } = evaluateShortlist({
      score,
      mandatorySkillsStatus,
      experienceYears: experience_years,
      minExperienceYears,
    });

    results.push({
      json: {
        ...item.json,
        status: isShortlisted ? 'Shortlisted' : 'Not Shortlisted',
        shortlistReason: reason,
      },
    });
  }

  return results;
}

module.exports = { runShortlistingEngine };

// ─── n8n Code Node entry point ────────────────────────────────────────────────
// Kode di bawah ini dieksekusi langsung saat dijalankan sebagai n8n Code Node.
// Dalam konteks n8n, $input tersedia secara global.
//
// Uncomment baris berikut saat digunakan sebagai n8n Code Node:
//
// const items = $input.all();
// return runShortlistingEngine(items);
