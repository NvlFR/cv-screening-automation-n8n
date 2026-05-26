'use strict';

/**
 * Unit tests untuk src/jd-matcher/jd-fetcher.js
 * Memvalidasi query database dan fallback NO_JD_AVAILABLE.
 * Requirements: 4.1, 4.5
 */

// Mock database client
jest.mock('../../../src/db/client', () => ({
  query: jest.fn(),
}));

const { getActiveJD } = require('../../../src/jd-matcher/jd-fetcher');
const db = require('../../../src/db/client');

// ─── Helper: buat JD row dari database ───────────────────────────────────────

function makeJDRow(overrides = {}) {
  return {
    id: 'job-001',
    title: 'Senior Frontend Developer',
    department: 'Engineering',
    seniority_level: 'Senior',
    mandatory_skills: ['JavaScript', 'React', 'TypeScript'],
    preferred_skills: ['Next.js', 'GraphQL'],
    min_experience_years: 4,
    industry: 'Technology',
    keywords: ['frontend', 'web', 'spa'],
    raw_jd_text: 'We are looking for a Senior Frontend Developer...',
    parsed_jd: null,
    is_active: true,
    ...overrides,
  };
}

// ─── getActiveJD: sukses ──────────────────────────────────────────────────────

describe('getActiveJD — sukses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('mengembalikan JD aktif jika ditemukan', async () => {
    const jdRow = makeJDRow();
    db.query.mockResolvedValue({ rows: [jdRow] });

    const result = await getActiveJD('job-001');

    expect(result).not.toHaveProperty('status');
    expect(result.id).toBe('job-001');
    expect(result.title).toBe('Senior Frontend Developer');
    expect(result.mandatory_skills).toEqual(['JavaScript', 'React', 'TypeScript']);
  });

  test('tidak menyertakan field is_active di hasil', async () => {
    db.query.mockResolvedValue({ rows: [makeJDRow()] });

    const result = await getActiveJD('job-001');

    expect(result).not.toHaveProperty('is_active');
  });

  test('query menggunakan parameterized query dengan jobId', async () => {
    db.query.mockResolvedValue({ rows: [makeJDRow()] });

    await getActiveJD('job-001');

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = $1'),
      ['job-001']
    );
  });

  test('trim whitespace dari jobId sebelum query', async () => {
    db.query.mockResolvedValue({ rows: [makeJDRow()] });

    await getActiveJD('  job-001  ');

    expect(db.query).toHaveBeenCalledWith(
      expect.any(String),
      ['job-001']
    );
  });

  test('mandatory_skills default ke array kosong jika null di database', async () => {
    db.query.mockResolvedValue({
      rows: [makeJDRow({ mandatory_skills: null })],
    });

    const result = await getActiveJD('job-001');

    expect(result.mandatory_skills).toEqual([]);
  });

  test('preferred_skills default ke array kosong jika null di database', async () => {
    db.query.mockResolvedValue({
      rows: [makeJDRow({ preferred_skills: null })],
    });

    const result = await getActiveJD('job-001');

    expect(result.preferred_skills).toEqual([]);
  });

  test('keywords default ke array kosong jika null di database', async () => {
    db.query.mockResolvedValue({
      rows: [makeJDRow({ keywords: null })],
    });

    const result = await getActiveJD('job-001');

    expect(result.keywords).toEqual([]);
  });

  test('min_experience_years default ke 0 jika null di database', async () => {
    db.query.mockResolvedValue({
      rows: [makeJDRow({ min_experience_years: null })],
    });

    const result = await getActiveJD('job-001');

    expect(result.min_experience_years).toBe(0);
  });
});

// ─── getActiveJD: NO_JD_AVAILABLE ────────────────────────────────────────────

describe('getActiveJD — NO_JD_AVAILABLE', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('mengembalikan NO_JD_AVAILABLE jika JD tidak ditemukan', async () => {
    db.query.mockResolvedValue({ rows: [] });

    const result = await getActiveJD('job-tidak-ada');

    expect(result.status).toBe('NO_JD_AVAILABLE');
    expect(result.reason).toContain('job-tidak-ada');
  });

  test('mengembalikan NO_JD_AVAILABLE jika JD tidak aktif', async () => {
    db.query.mockResolvedValue({
      rows: [makeJDRow({ is_active: false })],
    });

    const result = await getActiveJD('job-001');

    expect(result.status).toBe('NO_JD_AVAILABLE');
    expect(result.reason).toContain('tidak aktif');
  });

  test('mengembalikan NO_JD_AVAILABLE jika jobId null', async () => {
    const result = await getActiveJD(null);

    expect(result.status).toBe('NO_JD_AVAILABLE');
    expect(db.query).not.toHaveBeenCalled();
  });

  test('mengembalikan NO_JD_AVAILABLE jika jobId undefined', async () => {
    const result = await getActiveJD(undefined);

    expect(result.status).toBe('NO_JD_AVAILABLE');
    expect(db.query).not.toHaveBeenCalled();
  });

  test('mengembalikan NO_JD_AVAILABLE jika jobId string kosong', async () => {
    const result = await getActiveJD('');

    expect(result.status).toBe('NO_JD_AVAILABLE');
    expect(db.query).not.toHaveBeenCalled();
  });

  test('mengembalikan NO_JD_AVAILABLE jika jobId hanya whitespace', async () => {
    const result = await getActiveJD('   ');

    expect(result.status).toBe('NO_JD_AVAILABLE');
    expect(db.query).not.toHaveBeenCalled();
  });
});

// ─── getActiveJD: error handling ─────────────────────────────────────────────

describe('getActiveJD — error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('melempar error jika database query gagal', async () => {
    db.query.mockRejectedValue(new Error('Connection refused'));

    await expect(getActiveJD('job-001')).rejects.toThrow('Connection refused');
  });
});
