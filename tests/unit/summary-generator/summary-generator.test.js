'use strict';

/**
 * Unit tests untuk src/summary-generator/summary-generator.js
 * Memvalidasi generateSummary, fallback GENERATION_FAILED, dan validasi word count.
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

// Mock openai-client agar tidak memanggil API sungguhan
jest.mock('../../../src/cv-parser/openai-client', () => ({
  callOpenAI: jest.fn(),
}));

const {
  generateSummary,
  buildSummaryPrompt,
  countWords,
} = require('../../../src/summary-generator/summary-generator');

const { callOpenAI } = require('../../../src/cv-parser/openai-client');

// ─── Data fixture ─────────────────────────────────────────────────────────────

const defaultParams = {
  candidateName: 'John Doe',
  jobTitle: 'Software Engineer',
  score: 85,
  recommendation: 'Strong Fit',
  candidateProfile: {
    name: 'John Doe',
    email: 'john@example.com',
    skills: ['JavaScript', 'Node.js', 'React'],
    experience_years: 5,
    education: [{ degree: 'S1', institution: 'Universitas Indonesia', year: 2018 }],
  },
  jdMatchDetails: {
    skill_match: { score: 90, matched_skills: ['JavaScript', 'Node.js'], missing_skills: [] },
    experience_relevance: { score: 80, reasoning: 'Pengalaman relevan' },
    industry_relevance: { score: 75, reasoning: 'Industri sesuai' },
  },
};

/**
 * Membuat teks ringkasan dengan jumlah kata tertentu.
 * @param {number} wordCount - Jumlah kata yang diinginkan
 * @returns {string}
 */
function makeSummaryWithWords(wordCount) {
  const word = 'kata';
  return Array(wordCount).fill(word).join(' ');
}

// ─── countWords ───────────────────────────────────────────────────────────────

describe('countWords', () => {
  test('menghitung kata dengan benar untuk teks normal', () => {
    expect(countWords('satu dua tiga')).toBe(3);
  });

  test('menghitung kata dengan benar untuk teks dengan spasi berlebih', () => {
    expect(countWords('  satu   dua   tiga  ')).toBe(3);
  });

  test('mengembalikan 0 untuk string kosong', () => {
    expect(countWords('')).toBe(0);
  });

  test('mengembalikan 0 untuk null', () => {
    expect(countWords(null)).toBe(0);
  });

  test('mengembalikan 0 untuk undefined', () => {
    expect(countWords(undefined)).toBe(0);
  });

  test('menghitung satu kata dengan benar', () => {
    expect(countWords('kata')).toBe(1);
  });

  test('menghitung kata dengan newline', () => {
    expect(countWords('satu\ndua\ntiga')).toBe(3);
  });
});

// ─── buildSummaryPrompt ───────────────────────────────────────────────────────

describe('buildSummaryPrompt', () => {
  test('menyertakan nama kandidat dalam prompt', () => {
    const prompt = buildSummaryPrompt(defaultParams);
    expect(prompt).toContain('John Doe');
  });

  test('menyertakan judul posisi dalam prompt', () => {
    const prompt = buildSummaryPrompt(defaultParams);
    expect(prompt).toContain('Software Engineer');
  });

  test('menyertakan skor dan rekomendasi dalam prompt', () => {
    const prompt = buildSummaryPrompt(defaultParams);
    expect(prompt).toContain('85/100');
    expect(prompt).toContain('Strong Fit');
  });

  test('menyertakan profil kandidat sebagai JSON dalam prompt', () => {
    const prompt = buildSummaryPrompt(defaultParams);
    expect(prompt).toContain('JavaScript');
    expect(prompt).toContain('experience_years');
  });

  test('menyertakan detail JD match dalam prompt', () => {
    const prompt = buildSummaryPrompt(defaultParams);
    expect(prompt).toContain('skill_match');
  });

  test('menyertakan instruksi ringkasan dalam prompt', () => {
    const prompt = buildSummaryPrompt(defaultParams);
    expect(prompt).toContain('Kekuatan utama kandidat');
    expect(prompt).toContain('Gap skill');
    expect(prompt).toContain('Rekomendasi tindak lanjut');
  });
});

// ─── generateSummary ─────────────────────────────────────────────────────────

describe('generateSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Req 6.1, 6.5: Berhasil generate summary ─────────────────────────────

  test('mengembalikan { summary } saat OpenAI berhasil', async () => {
    const mockSummary = makeSummaryWithWords(150);
    callOpenAI.mockResolvedValue(mockSummary);

    const result = await generateSummary(defaultParams);

    expect(result).toHaveProperty('summary');
    expect(result.summary).toBe(mockSummary);
    expect(result.error).toBeUndefined();
  });

  test('memanggil callOpenAI dengan system prompt dan user prompt yang benar', async () => {
    const mockSummary = makeSummaryWithWords(150);
    callOpenAI.mockResolvedValue(mockSummary);

    await generateSummary(defaultParams);

    expect(callOpenAI).toHaveBeenCalledTimes(1);
    expect(callOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining('HR analyst'),
        userPrompt: expect.stringContaining('John Doe'),
      })
    );
  });

  test('user prompt menyertakan semua informasi kandidat', async () => {
    const mockSummary = makeSummaryWithWords(150);
    callOpenAI.mockResolvedValue(mockSummary);

    await generateSummary(defaultParams);

    const callArgs = callOpenAI.mock.calls[0][0];
    expect(callArgs.userPrompt).toContain('Software Engineer');
    expect(callArgs.userPrompt).toContain('85/100');
    expect(callArgs.userPrompt).toContain('Strong Fit');
  });

  // ─── Req 6.4: Fallback GENERATION_FAILED saat API error ──────────────────

  test('mengembalikan { summary: GENERATION_FAILED, error } saat OpenAI error', async () => {
    const errorMessage = 'OPENAI_ERROR: Semua 3 retry gagal. Error terakhir: Network error';
    callOpenAI.mockRejectedValue(new Error(errorMessage));

    const result = await generateSummary(defaultParams);

    expect(result.summary).toBe('GENERATION_FAILED');
    expect(result.error).toBe(errorMessage);
  });

  test('mengembalikan GENERATION_FAILED untuk berbagai jenis error OpenAI', async () => {
    callOpenAI.mockRejectedValue(new Error('OPENAI_ERROR: API key tidak valid'));

    const result = await generateSummary(defaultParams);

    expect(result.summary).toBe('GENERATION_FAILED');
    expect(result.error).toContain('OPENAI_ERROR');
  });

  test('mengembalikan GENERATION_FAILED dengan error message saat timeout', async () => {
    callOpenAI.mockRejectedValue(new Error('OPENAI_ERROR: Request timeout'));

    const result = await generateSummary(defaultParams);

    expect(result.summary).toBe('GENERATION_FAILED');
    expect(result).toHaveProperty('error');
    expect(typeof result.error).toBe('string');
  });

  test('tidak melempar exception saat OpenAI error — selalu return object', async () => {
    callOpenAI.mockRejectedValue(new Error('Network failure'));

    await expect(generateSummary(defaultParams)).resolves.not.toThrow();
    const result = await generateSummary(defaultParams);
    expect(result).toHaveProperty('summary');
  });

  // ─── Req 6.3: Validasi word count (log warning, tetap simpan) ────────────

  test('tetap mengembalikan summary meskipun terlalu pendek (< 100 kata)', async () => {
    const shortSummary = makeSummaryWithWords(50); // 50 kata — di bawah minimum
    callOpenAI.mockResolvedValue(shortSummary);

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await generateSummary(defaultParams);

    expect(result.summary).toBe(shortSummary);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('terlalu pendek'));

    consoleSpy.mockRestore();
  });

  test('tetap mengembalikan summary meskipun terlalu panjang (> 300 kata)', async () => {
    const longSummary = makeSummaryWithWords(350); // 350 kata — di atas maksimum
    callOpenAI.mockResolvedValue(longSummary);

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await generateSummary(defaultParams);

    expect(result.summary).toBe(longSummary);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('terlalu panjang'));

    consoleSpy.mockRestore();
  });

  test('tidak log warning untuk summary dengan panjang valid (100-300 kata)', async () => {
    const validSummary = makeSummaryWithWords(150); // 150 kata — dalam range
    callOpenAI.mockResolvedValue(validSummary);

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await generateSummary(defaultParams);

    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test('tidak log warning untuk summary tepat 100 kata (batas bawah)', async () => {
    const exactMinSummary = makeSummaryWithWords(100);
    callOpenAI.mockResolvedValue(exactMinSummary);

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await generateSummary(defaultParams);

    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test('tidak log warning untuk summary tepat 300 kata (batas atas)', async () => {
    const exactMaxSummary = makeSummaryWithWords(300);
    callOpenAI.mockResolvedValue(exactMaxSummary);

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await generateSummary(defaultParams);

    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  // ─── Req 6.2: Konten ringkasan (verifikasi prompt mencakup semua aspek) ───

  test('prompt mencakup instruksi kekuatan utama kandidat', async () => {
    const mockSummary = makeSummaryWithWords(150);
    callOpenAI.mockResolvedValue(mockSummary);

    await generateSummary(defaultParams);

    const callArgs = callOpenAI.mock.calls[0][0];
    expect(callArgs.userPrompt).toContain('Kekuatan utama kandidat');
  });

  test('prompt mencakup instruksi gap skill', async () => {
    const mockSummary = makeSummaryWithWords(150);
    callOpenAI.mockResolvedValue(mockSummary);

    await generateSummary(defaultParams);

    const callArgs = callOpenAI.mock.calls[0][0];
    expect(callArgs.userPrompt).toContain('Gap skill');
  });

  test('prompt mencakup instruksi highlight pengalaman relevan', async () => {
    const mockSummary = makeSummaryWithWords(150);
    callOpenAI.mockResolvedValue(mockSummary);

    await generateSummary(defaultParams);

    const callArgs = callOpenAI.mock.calls[0][0];
    expect(callArgs.userPrompt).toContain('pengalaman');
  });

  test('prompt mencakup instruksi rekomendasi tindak lanjut', async () => {
    const mockSummary = makeSummaryWithWords(150);
    callOpenAI.mockResolvedValue(mockSummary);

    await generateSummary(defaultParams);

    const callArgs = callOpenAI.mock.calls[0][0];
    expect(callArgs.userPrompt).toContain('Rekomendasi tindak lanjut');
  });

  // ─── Edge cases ───────────────────────────────────────────────────────────

  test('menangani candidateProfile kosong tanpa error', async () => {
    const mockSummary = makeSummaryWithWords(150);
    callOpenAI.mockResolvedValue(mockSummary);

    const result = await generateSummary({
      ...defaultParams,
      candidateProfile: {},
      jdMatchDetails: {},
    });

    expect(result.summary).toBe(mockSummary);
  });

  test('menangani skor 0 (Weak Fit) dengan benar', async () => {
    const mockSummary = makeSummaryWithWords(150);
    callOpenAI.mockResolvedValue(mockSummary);

    const result = await generateSummary({
      ...defaultParams,
      score: 0,
      recommendation: 'Weak Fit',
    });

    expect(result.summary).toBe(mockSummary);
    const callArgs = callOpenAI.mock.calls[0][0];
    expect(callArgs.userPrompt).toContain('0/100');
    expect(callArgs.userPrompt).toContain('Weak Fit');
  });

  test('menangani skor 100 (Strong Fit) dengan benar', async () => {
    const mockSummary = makeSummaryWithWords(150);
    callOpenAI.mockResolvedValue(mockSummary);

    const result = await generateSummary({
      ...defaultParams,
      score: 100,
      recommendation: 'Strong Fit',
    });

    expect(result.summary).toBe(mockSummary);
    const callArgs = callOpenAI.mock.calls[0][0];
    expect(callArgs.userPrompt).toContain('100/100');
  });
});
