'use strict';

/**
 * Shortlisting Evaluator — menentukan apakah kandidat masuk shortlist.
 *
 * Logika shortlist (semua kondisi harus terpenuhi):
 *   1. score >= 80
 *   2. Semua mandatory skills berstatus 'matched'
 *   3. experienceYears >= minExperienceYears
 *
 * Requirements: 7.1, 7.2, 7.3, 7.5
 */

/**
 * Mengevaluasi apakah kandidat memenuhi kriteria shortlist.
 *
 * @param {Object} params - Parameter evaluasi
 * @param {number} params.score - Skor akhir kandidat (0–100)
 * @param {Object} params.mandatorySkillsStatus - Map skill → 'matched' | 'missing'
 *   Contoh: { "JavaScript": "matched", "Python": "missing" }
 * @param {number} params.experienceYears - Total tahun pengalaman kandidat
 * @param {number} params.minExperienceYears - Minimum tahun pengalaman yang disyaratkan JD
 * @returns {{ isShortlisted: boolean, reason: string }} Hasil evaluasi dan alasan
 *
 * @example
 * // Shortlisted
 * evaluateShortlist({ score: 85, mandatorySkillsStatus: { JavaScript: 'matched' }, experienceYears: 5, minExperienceYears: 3 });
 * // => { isShortlisted: true, reason: 'Score 85 >= 80, all mandatory skills matched, experience 5y >= 3y required' }
 *
 * @example
 * // Not shortlisted — skor kurang
 * evaluateShortlist({ score: 75, mandatorySkillsStatus: { JavaScript: 'matched' }, experienceYears: 5, minExperienceYears: 3 });
 * // => { isShortlisted: false, reason: 'Score 75 < 80' }
 *
 * @example
 * // Not shortlisted — skill missing
 * evaluateShortlist({ score: 85, mandatorySkillsStatus: { JavaScript: 'matched', Python: 'missing' }, experienceYears: 5, minExperienceYears: 3 });
 * // => { isShortlisted: false, reason: 'Missing mandatory skills: Python' }
 */
function evaluateShortlist({ score, mandatorySkillsStatus, experienceYears, minExperienceYears }) {
  // Normalisasi nilai default
  const normalizedScore = score || 0;
  const normalizedExpYears = experienceYears || 0;
  const normalizedMinExp = minExperienceYears || 0;
  const skillsStatus = mandatorySkillsStatus || {};

  // Evaluasi ketiga kondisi shortlist
  const scoreOk = normalizedScore >= 80;

  const allMandatoryMatched = Object.values(skillsStatus).length === 0
    ? true // Jika tidak ada mandatory skills, kondisi dianggap terpenuhi
    : Object.values(skillsStatus).every(status => status === 'matched');

  const hasEnoughExperience = normalizedExpYears >= normalizedMinExp;

  const isShortlisted = scoreOk && allMandatoryMatched && hasEnoughExperience;

  // Bangun reason string yang deskriptif
  let reason;

  if (isShortlisted) {
    reason = `Score ${normalizedScore} >= 80, all mandatory skills matched, experience ${normalizedExpYears}y >= ${normalizedMinExp}y required`;
  } else {
    // Kumpulkan semua alasan penolakan
    const rejectionReasons = [];

    if (!scoreOk) {
      rejectionReasons.push(`Score ${normalizedScore} < 80`);
    }

    if (!allMandatoryMatched) {
      const missingSkills = Object.entries(skillsStatus)
        .filter(([, status]) => status === 'missing')
        .map(([skill]) => skill)
        .join(', ');
      rejectionReasons.push(`Missing mandatory skills: ${missingSkills}`);
    }

    if (!hasEnoughExperience) {
      rejectionReasons.push(`Experience ${normalizedExpYears}y < ${normalizedMinExp}y required`);
    }

    reason = rejectionReasons.join('; ');
  }

  return { isShortlisted, reason };
}

module.exports = { evaluateShortlist };
