'use strict';

const { callOpenAI } = require('../cv-parser/openai-client');
const { parseJDMatcherOutput } = require('./parser');

/**
 * JD Matcher — mengevaluasi kecocokan kandidat terhadap Job Description menggunakan OpenAI.
 * Menghasilkan skor per dimensi dan status mandatory skills.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.6
 */

/**
 * System prompt untuk JD Matching.
 * Sesuai dengan Prompt 2 di design.md.
 */
const JD_MATCHING_SYSTEM_PROMPT = `Kamu adalah sistem evaluasi kandidat yang objektif. Evaluasi kecocokan kandidat terhadap Job Description.
Berikan skor 0-100 untuk setiap dimensi berdasarkan bukti konkret dari profil kandidat.
Kembalikan HANYA JSON valid tanpa markdown code block.`;

/**
 * Membangun user prompt untuk JD Matching.
 *
 * @param {string} jdText - Teks Job Description
 * @param {string} candidateProfileJson - JSON string profil kandidat
 * @returns {string} User prompt lengkap
 */
function buildJDMatchingPrompt(jdText, candidateProfileJson) {
  return `Evaluasi kecocokan kandidat berikut terhadap Job Description:

JOB DESCRIPTION:
${jdText}

PROFIL KANDIDAT:
${candidateProfileJson}

Berikan evaluasi dalam format JSON:
{
  "skill_match": {
    "score": number (0-100),
    "matched_skills": ["skill1"],
    "missing_skills": ["skill2"],
    "reasoning": "string"
  },
  "experience_relevance": {
    "score": number (0-100),
    "reasoning": "string"
  },
  "industry_relevance": {
    "score": number (0-100),
    "reasoning": "string"
  },
  "seniority_fit": {
    "score": number (0-100),
    "reasoning": "string"
  },
  "keyword_overlap": {
    "score": number (0-100),
    "matched_keywords": ["kw1"],
    "reasoning": "string"
  },
  "mandatory_skills_status": {
    "skill_name": "matched|missing"
  }
}`;
}

/**
 * Menyiapkan teks JD yang akan dikirim ke OpenAI.
 * Menggabungkan raw_jd_text dengan informasi terstruktur dari JD jika tersedia.
 *
 * @param {Object} jd - Job Description object dari database
 * @returns {string} Teks JD yang siap digunakan dalam prompt
 */
function prepareJDText(jd) {
  // Jika ada raw_jd_text, gunakan itu sebagai basis
  if (jd.raw_jd_text && jd.raw_jd_text.trim()) {
    return jd.raw_jd_text.trim();
  }

  // Fallback: bangun teks JD dari field terstruktur
  const parts = [];

  if (jd.title) parts.push(`Posisi: ${jd.title}`);
  if (jd.department) parts.push(`Departemen: ${jd.department}`);
  if (jd.seniority_level) parts.push(`Level: ${jd.seniority_level}`);
  if (jd.industry) parts.push(`Industri: ${jd.industry}`);
  if (jd.min_experience_years) parts.push(`Minimum Pengalaman: ${jd.min_experience_years} tahun`);

  if (Array.isArray(jd.mandatory_skills) && jd.mandatory_skills.length > 0) {
    parts.push(`Skill Wajib: ${jd.mandatory_skills.join(', ')}`);
  }

  if (Array.isArray(jd.preferred_skills) && jd.preferred_skills.length > 0) {
    parts.push(`Skill Disukai: ${jd.preferred_skills.join(', ')}`);
  }

  if (Array.isArray(jd.keywords) && jd.keywords.length > 0) {
    parts.push(`Keywords: ${jd.keywords.join(', ')}`);
  }

  return parts.join('\n');
}

/**
 * Menyiapkan profil kandidat sebagai JSON string untuk dikirim ke OpenAI.
 * Memfilter field yang relevan untuk evaluasi.
 *
 * @param {Object} candidateProfile - Profil kandidat dari Candidate_Record
 * @returns {string} JSON string profil kandidat
 */
function prepareCandidateProfile(candidateProfile) {
  // Ambil field yang relevan untuk evaluasi JD matching
  const relevantFields = {
    name: candidateProfile.name,
    skills: candidateProfile.skills || [],
    experience_years: candidateProfile.experience_years,
    experience_detail: candidateProfile.experience_detail || [],
    education: candidateProfile.education || [],
    certifications: candidateProfile.certifications || [],
    languages: candidateProfile.languages || [],
    location: candidateProfile.location,
  };

  return JSON.stringify(relevantFields, null, 2);
}

/**
 * Mengevaluasi kecocokan kandidat terhadap Job Description menggunakan OpenAI.
 *
 * Requirements: 4.1 — evaluasi menggunakan OpenAI API
 * Requirements: 4.2 — evaluasi lima dimensi: skill match, relevansi pengalaman,
 *                      relevansi industri, kesesuaian seniority, keyword overlap
 * Requirements: 4.3 — skor per dimensi dalam rentang 0–100
 * Requirements: 4.4 — mandatory_skills_status: 'matched' atau 'missing'
 * Requirements: 4.6 — selesai dalam waktu < 60 detik
 *
 * @param {Object} candidateProfile - Profil kandidat (Candidate_Record)
 * @param {string|Object} jdText - Teks JD (string) atau JD object dari database
 * @returns {Promise<Object>} Hasil evaluasi:
 *   {
 *     skill_match: { score: number, matched_skills: string[], missing_skills: string[], reasoning: string },
 *     experience_relevance: { score: number, reasoning: string },
 *     industry_relevance: { score: number, reasoning: string },
 *     seniority_fit: { score: number, reasoning: string },
 *     keyword_overlap: { score: number, matched_keywords: string[], reasoning: string },
 *     mandatory_skills_status: { [skillName]: 'matched' | 'missing' },
 *     dimension_scores: { skill_match: number, experience_relevance: number, industry_relevance: number, seniority_fit: number, keyword_overlap: number }
 *   }
 * @throws {Error} Jika OpenAI gagal setelah semua retry atau output tidak valid
 *
 * @example
 * const result = await matchCandidateToJD(
 *   { name: 'John', skills: ['JavaScript', 'React'], experience_years: 3, ... },
 *   'We are looking for a Senior Frontend Developer with React experience...'
 * );
 * // => { skill_match: { score: 85, ... }, dimension_scores: { skill_match: 85, ... }, ... }
 */
async function matchCandidateToJD(candidateProfile, jdText) {
  if (!candidateProfile || typeof candidateProfile !== 'object') {
    throw new TypeError('matchCandidateToJD: candidateProfile harus berupa object');
  }

  // Tentukan teks JD yang akan digunakan
  let resolvedJDText;
  if (typeof jdText === 'string') {
    resolvedJDText = jdText.trim();
  } else if (jdText && typeof jdText === 'object') {
    // Jika diberikan JD object dari database
    resolvedJDText = prepareJDText(jdText);
  } else {
    throw new TypeError('matchCandidateToJD: jdText harus berupa string atau JD object');
  }

  if (!resolvedJDText) {
    throw new Error('matchCandidateToJD: Teks JD tidak boleh kosong');
  }

  // Siapkan profil kandidat sebagai JSON string
  const candidateProfileJson = prepareCandidateProfile(candidateProfile);

  // Bangun prompt
  const userPrompt = buildJDMatchingPrompt(resolvedJDText, candidateProfileJson);

  // Panggil OpenAI
  const rawResponse = await callOpenAI({
    systemPrompt: JD_MATCHING_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 2000,
  });

  // Parse dan validasi output
  const matchResult = parseJDMatcherOutput(rawResponse);

  return matchResult;
}

module.exports = {
  matchCandidateToJD,
  buildJDMatchingPrompt,
  prepareJDText,
  prepareCandidateProfile,
  JD_MATCHING_SYSTEM_PROMPT,
};
