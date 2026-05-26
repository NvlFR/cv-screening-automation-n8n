'use strict';

const { callOpenAI } = require('../cv-parser/openai-client');

/**
 * Summary Generator — menghasilkan ringkasan naratif evaluasi kandidat menggunakan OpenAI.
 * Ringkasan ditulis dalam bahasa Indonesia, mencakup kekuatan, gap skill, pengalaman relevan,
 * dan rekomendasi tindak lanjut.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

/**
 * System prompt untuk summary generation.
 */
const SUMMARY_SYSTEM_PROMPT = `Kamu adalah HR analyst yang menulis ringkasan evaluasi kandidat dalam bahasa Indonesia.
Tulis ringkasan yang informatif, objektif, dan actionable untuk recruiter.
Panjang ringkasan: 100-300 kata.`;

/**
 * Membuat user prompt untuk summary generation.
 *
 * @param {Object} params
 * @param {string} params.candidateName - Nama kandidat
 * @param {string} params.jobTitle - Judul posisi pekerjaan
 * @param {number} params.score - Skor akhir kandidat (0-100)
 * @param {string} params.recommendation - Rekomendasi (Strong Fit / Moderate Fit / Weak Fit)
 * @param {Object} params.candidateProfile - Profil kandidat (JSON object)
 * @param {Object} params.jdMatchDetails - Detail hasil evaluasi JD (JSON object)
 * @returns {string} User prompt lengkap
 */
function buildSummaryPrompt({ candidateName, jobTitle, score, recommendation, candidateProfile, jdMatchDetails }) {
  return `Buat ringkasan evaluasi untuk kandidat berikut:

NAMA: ${candidateName}
POSISI: ${jobTitle}
SKOR AKHIR: ${score}/100 (${recommendation})

PROFIL KANDIDAT:
${JSON.stringify(candidateProfile, null, 2)}

HASIL EVALUASI JD:
${JSON.stringify(jdMatchDetails, null, 2)}

Ringkasan harus mencakup:
1. Kekuatan utama kandidat (2-3 poin)
2. Gap skill terhadap JD (jika ada)
3. Highlight pengalaman paling relevan
4. Rekomendasi tindak lanjut yang spesifik`;
}

/**
 * Menghitung jumlah kata dalam sebuah teks.
 *
 * @param {string} text - Teks yang akan dihitung kata-katanya
 * @returns {number} Jumlah kata
 */
function countWords(text) {
  if (!text || typeof text !== 'string') return 0;
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Menghasilkan ringkasan naratif evaluasi kandidat menggunakan OpenAI.
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 *
 * @param {Object} params
 * @param {string} params.candidateName - Nama kandidat
 * @param {string} params.jobTitle - Judul posisi pekerjaan
 * @param {number} params.score - Skor akhir kandidat (0-100)
 * @param {string} params.recommendation - Rekomendasi (Strong Fit / Moderate Fit / Weak Fit)
 * @param {Object} params.candidateProfile - Profil kandidat (JSON object)
 * @param {Object} params.jdMatchDetails - Detail hasil evaluasi JD (JSON object)
 * @returns {Promise<{ summary: string, error?: string }>}
 *   - Jika berhasil: `{ summary: '<teks ringkasan>' }`
 *   - Jika gagal setelah 3x retry: `{ summary: 'GENERATION_FAILED', error: '<pesan error>' }`
 *
 * @example
 * const result = await generateSummary({
 *   candidateName: 'John Doe',
 *   jobTitle: 'Software Engineer',
 *   score: 85,
 *   recommendation: 'Strong Fit',
 *   candidateProfile: { skills: ['JavaScript', 'Node.js'], experience_years: 5 },
 *   jdMatchDetails: { skill_match: { score: 90 }, experience_relevance: { score: 80 } }
 * });
 * // => { summary: 'John Doe adalah kandidat yang sangat sesuai...' }
 */
async function generateSummary({ candidateName, jobTitle, score, recommendation, candidateProfile, jdMatchDetails }) {
  const userPrompt = buildSummaryPrompt({
    candidateName,
    jobTitle,
    score,
    recommendation,
    candidateProfile,
    jdMatchDetails,
  });

  let summaryText;

  try {
    // Req 6.1: Gunakan OpenAI API untuk menghasilkan ringkasan
    // openai-client.js sudah memiliki retry logic 3x dengan exponential backoff (30s, 60s, 120s)
    summaryText = await callOpenAI({
      systemPrompt: SUMMARY_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 600, // cukup untuk 300 kata
    });
  } catch (error) {
    // Req 6.4: Jika OpenAI error setelah 3x retry, kembalikan GENERATION_FAILED
    const errorMessage = error?.message || 'Unknown error';
    console.error(`[SummaryGenerator] OpenAI gagal setelah semua retry: ${errorMessage}`);
    return {
      summary: 'GENERATION_FAILED',
      error: errorMessage,
    };
  }

  // Req 6.3: Validasi panjang output (100-300 kata)
  const wordCount = countWords(summaryText);
  if (wordCount < 100) {
    console.warn(`[SummaryGenerator] Ringkasan terlalu pendek: ${wordCount} kata (minimum 100 kata)`);
  } else if (wordCount > 300) {
    console.warn(`[SummaryGenerator] Ringkasan terlalu panjang: ${wordCount} kata (maksimum 300 kata)`);
  }

  // Req 6.5: Simpan ringkasan ke field summary (tetap simpan meskipun di luar range)
  return { summary: summaryText };
}

module.exports = {
  generateSummary,
  buildSummaryPrompt,
  countWords,
  SUMMARY_SYSTEM_PROMPT,
};
