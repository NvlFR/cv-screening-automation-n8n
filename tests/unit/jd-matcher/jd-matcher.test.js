'use strict';

/**
 * Unit tests untuk src/jd-matcher/jd-matcher.js
 * Memvalidasi matchCandidateToJD, prompt building, dan integrasi dengan parser.
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.6
 */

// Mock openai-client
jest.mock('../../../src/cv-parser/openai-client', () => ({
  callOpenAI: jest.fn(),
}));

// Mock config
jest.mock('../../../src/config', () => ({
  openai: {
    apiKey: 'test-api-key',
    model: 'gpt-4o-mini',
    maxRetries: 3,
    retryDelays: [100, 200, 400],
    timeoutMs: 60000,
  },
}));

const {
  matchCandidateToJD,
  buildJDMatchingPrompt,
  prepareJDText,
  prepareCandidateProfile,
} = require('../../../src/jd-matcher/jd-matcher');
const { callOpenAI } = require('../../../src/cv-parser/openai-client');

// ─── Helper: buat profil kandidat ────────────────────────────────────────────

function makeCandidateProfile(overrides = {}) {
  return {
    name: 'John Doe',
    email: 'john@example.com',
    skills: ['JavaScript', 'React', 'Node.js'],
    experience_years: 4,
    experience_detail: [
      { company: 'Tech Corp', title: 'Frontend Developer', duration_months: 24, industry: 'Technology' },
    ],
    education: [{ degree: 'S1', institution: 'Universitas Indonesia', year: 2018 }],
    certifications: [],
    languages: [{ language: 'Indonesian', proficiency: 'Native' }],
    location: 'Jakarta',
    ...overrides,
  };
}

// ─── Helper: buat valid OpenAI response ──────────────────────────────────────

function makeValidOpenAIResponse(overrides = {}) {
  const base = {
    skill_match: {
      score: 80,
      matched_skills: ['JavaScript', 'React'],
      missing_skills: ['TypeScript'],
      reasoning: 'Kandidat memiliki skill utama',
    },
    experience_relevance: { score: 75, reasoning: 'Pengalaman relevan' },
    industry_relevance: { score: 70, reasoning: 'Industri serupa' },
    seniority_fit: { score: 85, reasoning: 'Level sesuai' },
    keyword_overlap: { score: 60, matched_keywords: ['frontend'], reasoning: 'Beberapa keyword cocok' },
    mandatory_skills_status: {
      JavaScript: 'matched',
      TypeScript: 'missing',
    },
  };

  return JSON.stringify({ ...base, ...overrides });
}

// ─── buildJDMatchingPrompt ────────────────────────────────────────────────────

describe('buildJDMatchingPrompt', () => {
  test('menyertakan teks JD dalam prompt', () => {
    const prompt = buildJDMatchingPrompt('We need a React developer', '{"skills": ["React"]}');
    expect(prompt).toContain('We need a React developer');
  });

  test('menyertakan profil kandidat dalam prompt', () => {
    const prompt = buildJDMatchingPrompt('JD text', '{"name": "John"}');
    expect(prompt).toContain('{"name": "John"}');
  });

  test('menyertakan format output JSON yang diharapkan', () => {
    const prompt = buildJDMatchingPrompt('JD', 'profile');
    expect(prompt).toContain('skill_match');
    expect(prompt).toContain('experience_relevance');
    expect(prompt).toContain('industry_relevance');
    expect(prompt).toContain('seniority_fit');
    expect(prompt).toContain('keyword_overlap');
    expect(prompt).toContain('mandatory_skills_status');
  });
});

// ─── prepareJDText ────────────────────────────────────────────────────────────

describe('prepareJDText', () => {
  test('menggunakan raw_jd_text jika tersedia', () => {
    const jd = {
      raw_jd_text: 'We are looking for a Senior Developer...',
      title: 'Senior Developer',
    };

    const text = prepareJDText(jd);
    expect(text).toBe('We are looking for a Senior Developer...');
  });

  test('membangun teks dari field terstruktur jika raw_jd_text kosong', () => {
    const jd = {
      raw_jd_text: '',
      title: 'Frontend Developer',
      department: 'Engineering',
      seniority_level: 'Mid',
      mandatory_skills: ['JavaScript', 'React'],
      preferred_skills: ['TypeScript'],
      min_experience_years: 3,
      industry: 'Technology',
      keywords: ['frontend', 'web'],
    };

    const text = prepareJDText(jd);
    expect(text).toContain('Frontend Developer');
    expect(text).toContain('Engineering');
    expect(text).toContain('Mid');
    expect(text).toContain('JavaScript');
    expect(text).toContain('React');
    expect(text).toContain('3 tahun');
  });

  test('membangun teks dari field terstruktur jika raw_jd_text null', () => {
    const jd = {
      raw_jd_text: null,
      title: 'Backend Developer',
      mandatory_skills: ['Python'],
      preferred_skills: [],
      keywords: [],
    };

    const text = prepareJDText(jd);
    expect(text).toContain('Backend Developer');
    expect(text).toContain('Python');
  });
});

// ─── prepareCandidateProfile ──────────────────────────────────────────────────

describe('prepareCandidateProfile', () => {
  test('mengembalikan JSON string yang valid', () => {
    const profile = makeCandidateProfile();
    const json = prepareCandidateProfile(profile);

    expect(() => JSON.parse(json)).not.toThrow();
  });

  test('menyertakan field relevan untuk evaluasi', () => {
    const profile = makeCandidateProfile();
    const json = prepareCandidateProfile(profile);
    const parsed = JSON.parse(json);

    expect(parsed).toHaveProperty('name');
    expect(parsed).toHaveProperty('skills');
    expect(parsed).toHaveProperty('experience_years');
    expect(parsed).toHaveProperty('experience_detail');
    expect(parsed).toHaveProperty('education');
    expect(parsed).toHaveProperty('certifications');
  });

  test('skills default ke array kosong jika tidak ada', () => {
    const profile = makeCandidateProfile({ skills: undefined });
    const json = prepareCandidateProfile(profile);
    const parsed = JSON.parse(json);

    expect(parsed.skills).toEqual([]);
  });
});

// ─── matchCandidateToJD: sukses ───────────────────────────────────────────────

describe('matchCandidateToJD — sukses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('mengembalikan hasil evaluasi dengan semua dimensi', async () => {
    callOpenAI.mockResolvedValue(makeValidOpenAIResponse());

    const result = await matchCandidateToJD(
      makeCandidateProfile(),
      'We need a React developer with 3+ years experience'
    );

    expect(result).toHaveProperty('skill_match');
    expect(result).toHaveProperty('experience_relevance');
    expect(result).toHaveProperty('industry_relevance');
    expect(result).toHaveProperty('seniority_fit');
    expect(result).toHaveProperty('keyword_overlap');
    expect(result).toHaveProperty('mandatory_skills_status');
    expect(result).toHaveProperty('dimension_scores');
  });

  test('skor dimensi adalah integer dalam [0, 100]', async () => {
    callOpenAI.mockResolvedValue(makeValidOpenAIResponse());

    const result = await matchCandidateToJD(
      makeCandidateProfile(),
      'JD text'
    );

    for (const dim of ['skill_match', 'experience_relevance', 'industry_relevance', 'seniority_fit', 'keyword_overlap']) {
      const score = result[dim].score;
      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  test('mandatory_skills_status berisi matched atau missing', async () => {
    callOpenAI.mockResolvedValue(makeValidOpenAIResponse());

    const result = await matchCandidateToJD(
      makeCandidateProfile(),
      'JD text'
    );

    for (const status of Object.values(result.mandatory_skills_status)) {
      expect(['matched', 'missing']).toContain(status);
    }
  });

  test('memanggil callOpenAI dengan system prompt yang benar', async () => {
    callOpenAI.mockResolvedValue(makeValidOpenAIResponse());

    await matchCandidateToJD(makeCandidateProfile(), 'JD text');

    expect(callOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining('sistem evaluasi kandidat'),
        userPrompt: expect.stringContaining('JD text'),
      })
    );
  });

  test('menerima JD object sebagai parameter jdText', async () => {
    callOpenAI.mockResolvedValue(makeValidOpenAIResponse());

    const jdObject = {
      id: 'job-001',
      title: 'Frontend Developer',
      raw_jd_text: 'We need a frontend developer',
      mandatory_skills: ['JavaScript'],
      preferred_skills: [],
      keywords: [],
    };

    const result = await matchCandidateToJD(makeCandidateProfile(), jdObject);

    expect(result).toHaveProperty('skill_match');
    expect(callOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        userPrompt: expect.stringContaining('We need a frontend developer'),
      })
    );
  });
});

// ─── matchCandidateToJD: validasi input ──────────────────────────────────────

describe('matchCandidateToJD — validasi input', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('melempar TypeError jika candidateProfile bukan object', async () => {
    await expect(matchCandidateToJD(null, 'JD text')).rejects.toThrow(TypeError);
    await expect(matchCandidateToJD('string', 'JD text')).rejects.toThrow(TypeError);
    await expect(matchCandidateToJD(123, 'JD text')).rejects.toThrow(TypeError);
  });

  test('melempar TypeError jika jdText bukan string atau object', async () => {
    await expect(matchCandidateToJD(makeCandidateProfile(), null)).rejects.toThrow(TypeError);
    await expect(matchCandidateToJD(makeCandidateProfile(), 123)).rejects.toThrow(TypeError);
  });

  test('melempar error jika jdText string kosong', async () => {
    await expect(matchCandidateToJD(makeCandidateProfile(), '')).rejects.toThrow();
  });

  test('melempar error jika jdText hanya whitespace', async () => {
    await expect(matchCandidateToJD(makeCandidateProfile(), '   ')).rejects.toThrow();
  });
});

// ─── matchCandidateToJD: error handling ──────────────────────────────────────

describe('matchCandidateToJD — error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('melempar error jika OpenAI gagal', async () => {
    callOpenAI.mockRejectedValue(new Error('OPENAI_ERROR: Rate limit exceeded'));

    await expect(
      matchCandidateToJD(makeCandidateProfile(), 'JD text')
    ).rejects.toThrow('OPENAI_ERROR');
  });

  test('melempar error jika output OpenAI tidak valid', async () => {
    callOpenAI.mockResolvedValue('bukan json valid');

    await expect(
      matchCandidateToJD(makeCandidateProfile(), 'JD text')
    ).rejects.toThrow('JD_MATCHER_PARSE_ERROR');
  });

  test('melempar INVALID_DIMENSION_SCORE jika skor di luar range', async () => {
    const invalidResponse = JSON.stringify({
      skill_match: { score: 150, matched_skills: [], missing_skills: [], reasoning: '' },
      experience_relevance: { score: 75, reasoning: '' },
      industry_relevance: { score: 70, reasoning: '' },
      seniority_fit: { score: 85, reasoning: '' },
      keyword_overlap: { score: 60, matched_keywords: [], reasoning: '' },
      mandatory_skills_status: {},
    });

    callOpenAI.mockResolvedValue(invalidResponse);

    await expect(
      matchCandidateToJD(makeCandidateProfile(), 'JD text')
    ).rejects.toThrow('INVALID_DIMENSION_SCORE');
  });
});
