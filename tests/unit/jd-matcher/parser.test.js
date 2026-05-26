'use strict';

/**
 * Unit tests untuk src/jd-matcher/parser.js
 * Memvalidasi parsing, validasi skor dimensi, dan ekstraksi mandatory_skills_status.
 * Requirements: 4.2, 4.3, 4.4
 */

const {
  parseJDMatcherOutput,
  isValidDimensionScore,
  normalizeScore,
  REQUIRED_DIMENSIONS,
} = require('../../../src/jd-matcher/parser');

// ─── Helper: buat output JD Matching yang valid ───────────────────────────────

function makeValidOutput(overrides = {}) {
  const base = {
    skill_match: {
      score: 80,
      matched_skills: ['JavaScript', 'React'],
      missing_skills: ['TypeScript'],
      reasoning: 'Kandidat memiliki skill utama yang dibutuhkan',
    },
    experience_relevance: {
      score: 75,
      reasoning: 'Pengalaman 3 tahun relevan dengan posisi',
    },
    industry_relevance: {
      score: 70,
      reasoning: 'Industri sebelumnya serupa',
    },
    seniority_fit: {
      score: 85,
      reasoning: 'Level sesuai dengan posisi Mid',
    },
    keyword_overlap: {
      score: 60,
      matched_keywords: ['frontend', 'web'],
      reasoning: 'Beberapa keyword cocok',
    },
    mandatory_skills_status: {
      JavaScript: 'matched',
      React: 'matched',
      TypeScript: 'missing',
    },
  };

  return JSON.stringify({ ...base, ...overrides });
}

// ─── isValidDimensionScore ────────────────────────────────────────────────────

describe('isValidDimensionScore', () => {
  test('mengembalikan true untuk integer 0', () => {
    expect(isValidDimensionScore(0)).toBe(true);
  });

  test('mengembalikan true untuk integer 100', () => {
    expect(isValidDimensionScore(100)).toBe(true);
  });

  test('mengembalikan true untuk integer di tengah range', () => {
    expect(isValidDimensionScore(50)).toBe(true);
    expect(isValidDimensionScore(75)).toBe(true);
  });

  test('mengembalikan true untuk float yang dibulatkan ke dalam range', () => {
    expect(isValidDimensionScore(99.4)).toBe(true);
    expect(isValidDimensionScore(0.4)).toBe(true);
  });

  test('mengembalikan false untuk nilai negatif', () => {
    expect(isValidDimensionScore(-1)).toBe(false);
  });

  test('mengembalikan false untuk nilai > 100', () => {
    expect(isValidDimensionScore(101)).toBe(false);
  });

  test('mengembalikan false untuk NaN', () => {
    expect(isValidDimensionScore(NaN)).toBe(false);
  });

  test('mengembalikan false untuk Infinity', () => {
    expect(isValidDimensionScore(Infinity)).toBe(false);
  });

  test('mengembalikan false untuk string', () => {
    expect(isValidDimensionScore('80')).toBe(false);
  });

  test('mengembalikan false untuk null', () => {
    expect(isValidDimensionScore(null)).toBe(false);
  });

  test('mengembalikan false untuk undefined', () => {
    expect(isValidDimensionScore(undefined)).toBe(false);
  });
});

// ─── normalizeScore ───────────────────────────────────────────────────────────

describe('normalizeScore', () => {
  test('mengembalikan integer untuk nilai valid', () => {
    expect(normalizeScore(80)).toBe(80);
    expect(normalizeScore(0)).toBe(0);
    expect(normalizeScore(100)).toBe(100);
  });

  test('membulatkan float ke integer terdekat', () => {
    expect(normalizeScore(80.4)).toBe(80);
    expect(normalizeScore(80.5)).toBe(81);
    expect(normalizeScore(80.6)).toBe(81);
  });

  test('clamp nilai di bawah 0 ke 0', () => {
    expect(normalizeScore(-5)).toBe(0);
    expect(normalizeScore(-100)).toBe(0);
  });

  test('clamp nilai di atas 100 ke 100', () => {
    expect(normalizeScore(105)).toBe(100);
    expect(normalizeScore(200)).toBe(100);
  });

  test('melempar error untuk NaN', () => {
    expect(() => normalizeScore(NaN)).toThrow();
  });

  test('melempar error untuk Infinity', () => {
    expect(() => normalizeScore(Infinity)).toThrow();
  });
});

// ─── parseJDMatcherOutput: sukses ────────────────────────────────────────────

describe('parseJDMatcherOutput — sukses', () => {
  test('mem-parse output valid dan mengembalikan semua dimensi', () => {
    const result = parseJDMatcherOutput(makeValidOutput());

    expect(result).toHaveProperty('skill_match');
    expect(result).toHaveProperty('experience_relevance');
    expect(result).toHaveProperty('industry_relevance');
    expect(result).toHaveProperty('seniority_fit');
    expect(result).toHaveProperty('keyword_overlap');
    expect(result).toHaveProperty('mandatory_skills_status');
    expect(result).toHaveProperty('dimension_scores');
  });

  test('skor dimensi adalah integer dalam [0, 100]', () => {
    const result = parseJDMatcherOutput(makeValidOutput());

    for (const dim of REQUIRED_DIMENSIONS) {
      const score = result[dim].score;
      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  test('dimension_scores berisi skor numerik untuk semua dimensi', () => {
    const result = parseJDMatcherOutput(makeValidOutput());

    expect(result.dimension_scores).toEqual({
      skill_match: 80,
      experience_relevance: 75,
      industry_relevance: 70,
      seniority_fit: 85,
      keyword_overlap: 60,
    });
  });

  test('skill_match memiliki matched_skills dan missing_skills', () => {
    const result = parseJDMatcherOutput(makeValidOutput());

    expect(result.skill_match.matched_skills).toEqual(['JavaScript', 'React']);
    expect(result.skill_match.missing_skills).toEqual(['TypeScript']);
  });

  test('keyword_overlap memiliki matched_keywords', () => {
    const result = parseJDMatcherOutput(makeValidOutput());

    expect(result.keyword_overlap.matched_keywords).toEqual(['frontend', 'web']);
  });

  test('mandatory_skills_status berisi matched dan missing', () => {
    const result = parseJDMatcherOutput(makeValidOutput());

    expect(result.mandatory_skills_status).toEqual({
      JavaScript: 'matched',
      React: 'matched',
      TypeScript: 'missing',
    });
  });

  test('mandatory_skills_status kosong jika tidak ada di output', () => {
    const output = JSON.stringify({
      skill_match: { score: 80, matched_skills: [], missing_skills: [], reasoning: '' },
      experience_relevance: { score: 75, reasoning: '' },
      industry_relevance: { score: 70, reasoning: '' },
      seniority_fit: { score: 85, reasoning: '' },
      keyword_overlap: { score: 60, matched_keywords: [], reasoning: '' },
      // mandatory_skills_status tidak ada
    });

    const result = parseJDMatcherOutput(output);
    expect(result.mandatory_skills_status).toEqual({});
  });

  test('menangani output dengan markdown code block (defensive)', () => {
    const jsonContent = makeValidOutput();
    const withMarkdown = '```json\n' + jsonContent + '\n```';

    const result = parseJDMatcherOutput(withMarkdown);
    expect(result.skill_match.score).toBe(80);
  });

  test('menormalisasi status mandatory skill yang tidak dikenali ke missing', () => {
    const output = JSON.stringify({
      skill_match: { score: 80, matched_skills: [], missing_skills: [], reasoning: '' },
      experience_relevance: { score: 75, reasoning: '' },
      industry_relevance: { score: 70, reasoning: '' },
      seniority_fit: { score: 85, reasoning: '' },
      keyword_overlap: { score: 60, matched_keywords: [], reasoning: '' },
      mandatory_skills_status: {
        JavaScript: 'MATCHED', // uppercase — harus dinormalisasi
        Python: 'unknown_status', // tidak dikenali — default ke missing
      },
    });

    const result = parseJDMatcherOutput(output);
    expect(result.mandatory_skills_status.JavaScript).toBe('matched');
    expect(result.mandatory_skills_status.Python).toBe('missing');
  });

  test('reasoning bisa berupa string kosong', () => {
    const output = JSON.stringify({
      skill_match: { score: 80, matched_skills: [], missing_skills: [], reasoning: '' },
      experience_relevance: { score: 75, reasoning: '' },
      industry_relevance: { score: 70, reasoning: '' },
      seniority_fit: { score: 85, reasoning: '' },
      keyword_overlap: { score: 60, matched_keywords: [], reasoning: '' },
      mandatory_skills_status: {},
    });

    const result = parseJDMatcherOutput(output);
    expect(result.skill_match.reasoning).toBe('');
  });

  test('matched_skills default ke array kosong jika tidak ada', () => {
    const output = JSON.stringify({
      skill_match: { score: 80, reasoning: 'test' }, // tanpa matched_skills
      experience_relevance: { score: 75, reasoning: '' },
      industry_relevance: { score: 70, reasoning: '' },
      seniority_fit: { score: 85, reasoning: '' },
      keyword_overlap: { score: 60, reasoning: '' },
      mandatory_skills_status: {},
    });

    const result = parseJDMatcherOutput(output);
    expect(result.skill_match.matched_skills).toEqual([]);
    expect(result.skill_match.missing_skills).toEqual([]);
  });
});

// ─── parseJDMatcherOutput: error handling ────────────────────────────────────

describe('parseJDMatcherOutput — error handling', () => {
  test('melempar TypeError jika rawOutput bukan string', () => {
    expect(() => parseJDMatcherOutput(null)).toThrow(TypeError);
    expect(() => parseJDMatcherOutput(123)).toThrow(TypeError);
    expect(() => parseJDMatcherOutput({})).toThrow(TypeError);
  });

  test('melempar error jika rawOutput kosong', () => {
    expect(() => parseJDMatcherOutput('')).toThrow('JD_MATCHER_PARSE_ERROR');
  });

  test('melempar error jika JSON tidak valid', () => {
    expect(() => parseJDMatcherOutput('bukan json')).toThrow('JD_MATCHER_PARSE_ERROR');
    expect(() => parseJDMatcherOutput('{invalid}')).toThrow('JD_MATCHER_PARSE_ERROR');
  });

  test('melempar error jika output adalah array bukan object', () => {
    expect(() => parseJDMatcherOutput('[]')).toThrow('JD_MATCHER_PARSE_ERROR');
  });

  test('melempar error jika dimensi wajib tidak ada', () => {
    const output = JSON.stringify({
      skill_match: { score: 80, matched_skills: [], missing_skills: [], reasoning: '' },
      // experience_relevance tidak ada
      industry_relevance: { score: 70, reasoning: '' },
      seniority_fit: { score: 85, reasoning: '' },
      keyword_overlap: { score: 60, matched_keywords: [], reasoning: '' },
      mandatory_skills_status: {},
    });

    expect(() => parseJDMatcherOutput(output)).toThrow('JD_MATCHER_PARSE_ERROR');
  });

  test('melempar INVALID_DIMENSION_SCORE jika skor negatif', () => {
    const output = JSON.stringify({
      skill_match: { score: -1, matched_skills: [], missing_skills: [], reasoning: '' },
      experience_relevance: { score: 75, reasoning: '' },
      industry_relevance: { score: 70, reasoning: '' },
      seniority_fit: { score: 85, reasoning: '' },
      keyword_overlap: { score: 60, matched_keywords: [], reasoning: '' },
      mandatory_skills_status: {},
    });

    expect(() => parseJDMatcherOutput(output)).toThrow('INVALID_DIMENSION_SCORE');
  });

  test('melempar INVALID_DIMENSION_SCORE jika skor > 100', () => {
    const output = JSON.stringify({
      skill_match: { score: 80, matched_skills: [], missing_skills: [], reasoning: '' },
      experience_relevance: { score: 101, reasoning: '' },
      industry_relevance: { score: 70, reasoning: '' },
      seniority_fit: { score: 85, reasoning: '' },
      keyword_overlap: { score: 60, matched_keywords: [], reasoning: '' },
      mandatory_skills_status: {},
    });

    expect(() => parseJDMatcherOutput(output)).toThrow('INVALID_DIMENSION_SCORE');
  });

  test('melempar error jika skor adalah null', () => {
    const output = JSON.stringify({
      skill_match: { score: null, matched_skills: [], missing_skills: [], reasoning: '' },
      experience_relevance: { score: 75, reasoning: '' },
      industry_relevance: { score: 70, reasoning: '' },
      seniority_fit: { score: 85, reasoning: '' },
      keyword_overlap: { score: 60, matched_keywords: [], reasoning: '' },
      mandatory_skills_status: {},
    });

    expect(() => parseJDMatcherOutput(output)).toThrow('JD_MATCHER_PARSE_ERROR');
  });

  test('melempar INVALID_DIMENSION_SCORE jika skor adalah string bukan angka', () => {
    // Buat JSON dengan score berupa string non-numerik
    const output = JSON.stringify({
      skill_match: { score: 'tidak-valid', matched_skills: [], missing_skills: [], reasoning: '' },
      experience_relevance: { score: 75, reasoning: '' },
      industry_relevance: { score: 70, reasoning: '' },
      seniority_fit: { score: 85, reasoning: '' },
      keyword_overlap: { score: 60, matched_keywords: [], reasoning: '' },
      mandatory_skills_status: {},
    });

    expect(() => parseJDMatcherOutput(output)).toThrow('INVALID_DIMENSION_SCORE');
  });
});
