'use strict';

/**
 * Certification Scorer — menghitung skor sertifikasi berdasarkan jumlah dan relevansi.
 * Requirements: 5.1
 */

/**
 * Menghitung skor sertifikasi kandidat.
 *
 * Dua mode perhitungan:
 * 1. Jika requiredCerts ada dan tidak kosong:
 *    Hitung berapa sertifikasi yang matched (case-insensitive includes),
 *    return Math.min(100, (matched / requiredCerts.length) * 100)
 *
 * 2. Jika requiredCerts kosong/null:
 *    Skor berdasarkan jumlah sertifikasi (max 5 = 100),
 *    return Math.min(100, certifications.length * 20)
 *
 * @param {Array<{name: string, issuer: string, year: number|null}>|null|undefined} certifications
 *   Array sertifikasi yang dimiliki kandidat
 * @param {string[]|null|undefined} requiredCerts
 *   Array nama sertifikasi yang dibutuhkan (dari JD)
 * @returns {number} Skor sertifikasi (0–100)
 *
 * @example
 * // Dengan required certs: 2 dari 3 matched → 66.67
 * calculateCertificationScore(
 *   [{ name: 'AWS Solutions Architect', issuer: 'Amazon', year: 2022 },
 *    { name: 'Google Cloud Professional', issuer: 'Google', year: 2023 }],
 *   ['AWS Solutions Architect', 'Google Cloud Professional', 'Azure Administrator']
 * );
 * // => Math.min(100, (2/3) * 100) = 66.67
 *
 * @example
 * // Tanpa required certs: 3 sertifikasi → 60
 * calculateCertificationScore(
 *   [{ name: 'AWS', issuer: 'Amazon', year: 2022 },
 *    { name: 'GCP', issuer: 'Google', year: 2023 },
 *    { name: 'Azure', issuer: 'Microsoft', year: 2021 }],
 *   null
 * );
 * // => Math.min(100, 3 * 20) = 60
 *
 * @example
 * calculateCertificationScore(null, null); // => 0
 * calculateCertificationScore([], ['AWS']); // => 0
 */
function calculateCertificationScore(certifications, requiredCerts) {
  // Return 0 jika certifications kosong atau null
  if (!certifications || certifications.length === 0) {
    return 0;
  }

  // Mode 1: Ada required certs — hitung berapa yang matched
  if (requiredCerts && requiredCerts.length > 0) {
    const matched = certifications.filter(cert =>
      requiredCerts.some(required =>
        cert.name && cert.name.toLowerCase().includes(required.toLowerCase())
      )
    ).length;

    return Math.min(100, (matched / requiredCerts.length) * 100);
  }

  // Mode 2: Tidak ada required certs — skor berdasarkan jumlah (max 5 = 100)
  return Math.min(100, certifications.length * 20);
}

module.exports = { calculateCertificationScore };
