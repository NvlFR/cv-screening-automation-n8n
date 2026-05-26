'use strict';

const db = require('../db/client');

/**
 * JD Fetcher — mengambil Job Description aktif dari database.
 * Mengimplementasikan fallback NO_JD_AVAILABLE jika JD tidak ditemukan atau tidak aktif.
 *
 * Requirements: 4.1, 4.5
 */

/**
 * Mengambil Job Description aktif berdasarkan jobId dari tabel job_descriptions.
 * JD dianggap aktif jika kolom `is_active = TRUE`.
 *
 * Requirements: 4.1 — JD aktif harus tersedia sebelum matching
 * Requirements: 4.5 — jika JD tidak tersedia, kembalikan status NO_JD_AVAILABLE
 *
 * @param {string} jobId - ID job position yang akan dicari
 * @returns {Promise<Object>} Salah satu dari:
 *   - JD object: { id, title, department, seniority_level, mandatory_skills, preferred_skills,
 *                  min_experience_years, industry, keywords, raw_jd_text, parsed_jd }
 *   - { status: 'NO_JD_AVAILABLE', reason: string } jika JD tidak ditemukan atau tidak aktif
 * @throws {Error} Jika terjadi error database yang tidak terduga
 *
 * @example
 * const jd = await getActiveJD('job-001');
 * if (jd.status === 'NO_JD_AVAILABLE') {
 *   // skip matching
 * } else {
 *   // lanjutkan matching dengan jd.raw_jd_text
 * }
 */
async function getActiveJD(jobId) {
  if (!jobId || typeof jobId !== 'string' || !jobId.trim()) {
    return {
      status: 'NO_JD_AVAILABLE',
      reason: 'jobId tidak valid atau kosong',
    };
  }

  const trimmedJobId = jobId.trim();

  try {
    const result = await db.query(
      `SELECT
        id,
        title,
        department,
        seniority_level,
        mandatory_skills,
        preferred_skills,
        min_experience_years,
        industry,
        keywords,
        raw_jd_text,
        parsed_jd,
        is_active
      FROM job_descriptions
      WHERE id = $1`,
      [trimmedJobId]
    );

    if (result.rows.length === 0) {
      return {
        status: 'NO_JD_AVAILABLE',
        reason: `Job Description dengan id '${trimmedJobId}' tidak ditemukan`,
      };
    }

    const jd = result.rows[0];

    // Cek apakah JD aktif
    if (!jd.is_active) {
      return {
        status: 'NO_JD_AVAILABLE',
        reason: `Job Description '${trimmedJobId}' tidak aktif (is_active = false)`,
      };
    }

    // Kembalikan JD tanpa field is_active (tidak diperlukan oleh consumer)
    const { is_active, ...jdData } = jd;

    // Pastikan array fields tidak null
    return {
      ...jdData,
      mandatory_skills: jdData.mandatory_skills || [],
      preferred_skills: jdData.preferred_skills || [],
      keywords: jdData.keywords || [],
      min_experience_years: jdData.min_experience_years || 0,
    };

  } catch (err) {
    console.error('[JD_Fetcher] Error mengambil JD:', err.message, '| jobId:', trimmedJobId);
    throw err;
  }
}

module.exports = { getActiveJD };
