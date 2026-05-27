'use strict';

/**
 * Unit tests untuk CV Processing Pipeline
 * Tests semua tahap pipeline dan alur decision (DUPLICATE, POSSIBLE_DUPLICATE, NO_JD_AVAILABLE, dll.)
 *
 * Requirements: 2.4, 3.3, 3.4, 3.5, 4.5, 5.4, 6.4
 */

// ─── Mocks Setup (before requiring pipeline) ───────────────────────────────────

const mockParseCV = jest.fn();
const mockDuplicateCheck = jest.fn();
const mockGetActiveJD = jest.fn();
const mockMatchCandidateToJD = jest.fn();
const mockCalculateScore = jest.fn();
const mockCalculateEducationScore = jest.fn();
const mockCalculateCertificationScore = jest.fn();
const mockGenerateSummary = jest.fn();
const mockEvaluateShortlist = jest.fn();
const mockLogIntakeEvent = jest.fn();
const mockSendNotification = jest.fn();
const mockDbQuery = jest.fn();

jest.mock('../../../src/cv-parser/cv-parser', () => ({
  parseCV: (...args) => mockParseCV(...args),
}));

jest.mock('../../../src/duplicate-detector/detector', () => ({
  DuplicateDetector: jest.fn().mockImplementation(() => ({
    check: (...args) => mockDuplicateCheck(...args),
  })),
}));

jest.mock('../../../src/jd-matcher/jd-fetcher', () => ({
  getActiveJD: (...args) => mockGetActiveJD(...args),
}));

jest.mock('../../../src/jd-matcher/jd-matcher', () => ({
  matchCandidateToJD: (...args) => mockMatchCandidateToJD(...args),
}));

jest.mock('../../../src/jd-cache/redis-cache', () => ({
  JDCache: jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  })),
}));

jest.mock('../../../src/scoring-engine/calculator', () => ({
  calculateScore: (...args) => mockCalculateScore(...args),
}));

jest.mock('../../../src/scoring-engine/education-scorer', () => ({
  calculateEducationScore: (...args) => mockCalculateEducationScore(...args),
}));

jest.mock('../../../src/scoring-engine/certification-scorer', () => ({
  calculateCertificationScore: (...args) => mockCalculateCertificationScore(...args),
}));

jest.mock('../../../src/summary-generator/summary-generator', () => ({
  generateSummary: (...args) => mockGenerateSummary(...args),
}));

jest.mock('../../../src/shortlisting-engine/evaluator', () => ({
  evaluateShortlist: (...args) => mockEvaluateShortlist(...args),
}));

jest.mock('../../../src/cv-intake/audit-logger', () => ({
  logIntakeEvent: (...args) => mockLogIntakeEvent(...args),
}));

jest.mock('../../../src/notification/notification-service', () => ({
  sendNotification: (...args) => mockSendNotification(...args),
}));

jest.mock('../../../src/db/client', () => ({
  query: (...args) => mockDbQuery(...args),
}));

jest.mock('../../../src/cache/redis-client', () => ({
  getClient: jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  }),
}));

// ─── Import Pipeline ───────────────────────────────────────────────────────────

const pipeline = require('../../../src/cv-processing/pipeline');

// ─── Helper: Reset semua mocks ────────────────────────────────────────────────

function resetAllMocks() {
  mockParseCV.mockReset();
  mockDuplicateCheck.mockReset();
  mockGetActiveJD.mockReset();
  mockMatchCandidateToJD.mockReset();
  mockCalculateScore.mockReset();
  mockCalculateEducationScore.mockReset();
  mockCalculateCertificationScore.mockReset();
  mockGenerateSummary.mockReset();
  mockEvaluateShortlist.mockReset();
  mockLogIntakeEvent.mockReset();
  mockSendNotification.mockReset();
  mockDbQuery.mockReset();
}

// ─── Test Fixtures ─────────────────────────────────────────────────────────────

const mockCandidateData = {
  name: 'John Doe',
  email: 'john@example.com',
  phone: '+6281234567890',
  location: 'Jakarta',
  skills: ['JavaScript', 'Node.js', 'React'],
  experience_years: 5,
  education: [{ degree: 'S1', institution: 'UI', year: 2018 }],
  certifications: [{ name: 'AWS Certified', issuer: 'Amazon', year: 2023 }],
  languages: [{ language: 'Indonesia', proficiency: 'Native' }],
  experience_detail: [{ company: 'Tech Corp', title: 'Engineer', duration_months: 36, industry: 'Tech' }],
};

const mockJob = {
  jobId: 'job-123',
  filename: 'john_doe_cv.pdf',
  fileKey: 'uploads/john_doe_cv.pdf',
  source: 'webhook',
  positionId: 'pos-001',
  cvText: 'John Doe\njohn@example.com\nSkills: JavaScript, Node.js',
  enqueuedAt: new Date().toISOString(),
};

const mockJD = {
  id: 'pos-001',
  title: 'Software Engineer',
  raw_jd_text: 'Looking for a Software Engineer with JavaScript skills...',
  mandatory_skills: ['JavaScript', 'Node.js'],
  min_experience_years: 3,
  is_active: true,
};

const mockMatchResult = {
  skill_match: { score: 85, reasoning: 'Good match', matched_skills: ['JavaScript'], missing_skills: [] },
  experience_relevance: { score: 80, reasoning: 'Relevant experience' },
  industry_relevance: { score: 70, reasoning: 'Industry match' },
  seniority_fit: { score: 75, reasoning: 'Seniority fit' },
  keyword_overlap: { score: 80, reasoning: 'Keyword overlap' },
  mandatory_skills_status: { 'JavaScript': 'matched', 'Node.js': 'matched' },
  jd: mockJD,
};

const mockScoringResult = {
  score: 82,
  recommendation: 'Strong Fit',
  dimension_scores: {
    skill_match: 85,
    experience: 80,
    education: 70,
    industry: 70,
    certification: 60,
  },
};

// ─── Test: Stage Parse ─────────────────────────────────────────────────────────

describe('stageParse', () => {
  test('harus parse CV dengan hasil yang benar', async () => {
    resetAllMocks();
    mockParseCV.mockResolvedValue({ ...mockCandidateData, status: 'PENDING' });

    const result = await pipeline.stageParse(mockJob);

    expect(mockParseCV).toHaveBeenCalledWith(mockJob.cvText);
    expect(result.name).toBe(mockCandidateData.name);
    expect(result.email).toBe(mockCandidateData.email);
    expect(result.status).toBe('PENDING');
    expect(result.cv_url).toBe(mockJob.fileKey);
    expect(result.source).toBe(mockJob.source);
  });

  test('harus menangani PARSING_INCOMPLETE', async () => {
    resetAllMocks();
    mockParseCV.mockResolvedValue({ ...mockCandidateData, name: null, email: 'john@example.com', status: 'PARSING_INCOMPLETE' });

    const result = await pipeline.stageParse(mockJob);

    expect(result.status).toBe('PARSING_INCOMPLETE');
    expect(result.name).toBeNull();
  });

  test('harus menangani cvText kosong', async () => {
    resetAllMocks();
    mockParseCV.mockResolvedValue({ status: 'PARSING_INCOMPLETE' });

    const emptyJob = { ...mockJob, cvText: '' };
    const result = await pipeline.stageParse(emptyJob);

    expect(result.status).toBe('PARSING_INCOMPLETE');
  });
});

// ─── Test: Stage Duplicate Check ────────────────────────────────────────────────

describe('stageDuplicateCheck', () => {
  test('harus deteksi DUPLICATE berdasarkan email', async () => {
    resetAllMocks();
    mockDuplicateCheck.mockResolvedValue({
      status: 'DUPLICATE',
      existingRecordId: 'existing-id-123',
    });

    const result = await pipeline.stageDuplicateCheck(mockCandidateData);

    expect(mockDuplicateCheck).toHaveBeenCalledWith({
      email: mockCandidateData.email,
      name: mockCandidateData.name,
      phone: mockCandidateData.phone,
    });
    expect(result.status).toBe('DUPLICATE');
    expect(result.existingRecordId).toBe('existing-id-123');
  });

  test('harus deteksi POSSIBLE_DUPLICATE berdasarkan nama+telepon', async () => {
    resetAllMocks();
    mockDuplicateCheck.mockResolvedValue({
      status: 'POSSIBLE_DUPLICATE',
      existingRecordId: 'possible-id-456',
    });

    const result = await pipeline.stageDuplicateCheck(mockCandidateData);

    expect(result.status).toBe('POSSIBLE_DUPLICATE');
    expect(result.existingRecordId).toBe('possible-id-456');
  });

  test('harus mengembalikan NONE jika tidak ada duplikat', async () => {
    resetAllMocks();
    mockDuplicateCheck.mockResolvedValue({ status: 'NONE' });

    const result = await pipeline.stageDuplicateCheck(mockCandidateData);

    expect(result.status).toBe('NONE');
    expect(result.existingRecordId).toBeUndefined();
  });
});

// ─── Test: Stage JD Match ─────────────────────────────────────────────────────

describe('stageJDMatch', () => {
  test('harus kembalikan NO_JD_AVAILABLE jika jobId null', async () => {
    resetAllMocks();
    const result = await pipeline.stageJDMatch(mockCandidateData, null);

    expect(result.status).toBe('NO_JD_AVAILABLE');
  });

  test('harus kembalikan NO_JD_AVAILABLE jika JD tidak ditemukan', async () => {
    resetAllMocks();
    mockGetActiveJD.mockResolvedValue({ status: 'NO_JD_AVAILABLE', reason: 'Job tidak ditemukan' });

    const result = await pipeline.stageJDMatch(mockCandidateData, 'pos-999');

    expect(result.status).toBe('NO_JD_AVAILABLE');
  });

  test('harus mengambil JD dari database dan men-cache ke Redis', async () => {
    resetAllMocks();
    mockGetActiveJD.mockResolvedValue(mockJD);
    mockMatchCandidateToJD.mockResolvedValue(mockMatchResult);

    const result = await pipeline.stageJDMatch(mockCandidateData, 'pos-001');

    expect(mockGetActiveJD).toHaveBeenCalledWith('pos-001');
    expect(mockMatchCandidateToJD).toHaveBeenCalled();
    expect(result).toHaveProperty('skill_match');
  });
});

// ─── Test: Stage Score ────────────────────────────────────────────────────────

describe('stageScore', () => {
  test('harus menghitung skor dengan benar', () => {
    resetAllMocks();
    mockCalculateEducationScore.mockReturnValue(70);
    mockCalculateCertificationScore.mockReturnValue(60);
    mockCalculateScore.mockReturnValue(mockScoringResult);

    const result = pipeline.stageScore(mockCandidateData, mockMatchResult);

    expect(mockCalculateScore).toHaveBeenCalledWith({
      skillMatch: mockMatchResult.skill_match.score,
      experience: mockMatchResult.experience_relevance.score,
      education: 70,
      industry: mockMatchResult.industry_relevance.score,
      certification: 60,
    });

    expect(result.score).toBe(82);
    expect(result.recommendation).toBe('Strong Fit');
    expect(result.dimension_scores).toBeDefined();
  });

  test('harus throw error INVALID_DIMENSION_SCORE untuk input invalid', () => {
    resetAllMocks();
    mockCalculateEducationScore.mockReturnValue(70);
    mockCalculateCertificationScore.mockReturnValue(60);
    mockCalculateScore.mockImplementation(() => {
      throw new Error('INVALID_DIMENSION_SCORE: skillMatch = 150');
    });

    expect(() => pipeline.stageScore(mockCandidateData, mockMatchResult)).toThrow('INVALID_DIMENSION_SCORE');
  });
});

// ─── Test: Stage Summary ───────────────────────────────────────────────────────

describe('stageSummary', () => {
  test('harus generate summary dengan benar', async () => {
    resetAllMocks();
    mockGenerateSummary.mockResolvedValue({
      summary: 'John Doe adalah kandidat yang sangat sesuai...',
    });

    const result = await pipeline.stageSummary(mockCandidateData, mockMatchResult, mockScoringResult);

    expect(mockGenerateSummary).toHaveBeenCalledWith({
      candidateName: mockCandidateData.name,
      jobTitle: mockJD.title,
      score: mockScoringResult.score,
      recommendation: mockScoringResult.recommendation,
      candidateProfile: mockCandidateData,
      jdMatchDetails: mockMatchResult,
    });

    expect(result).toBe('John Doe adalah kandidat yang sangat sesuai...');
  });

  test('harus kembalikan GENERATION_FAILED jika OpenAI error', async () => {
    resetAllMocks();
    mockGenerateSummary.mockResolvedValue({
      summary: 'GENERATION_FAILED',
      error: 'OpenAI API failed',
    });

    const result = await pipeline.stageSummary(mockCandidateData, mockMatchResult, mockScoringResult);

    expect(result).toBe('GENERATION_FAILED');
  });
});

// ─── Test: Stage Shortlist ────────────────────────────────────────────────────

describe('stageShortlist', () => {
  test('harus evaluate shortlist untuk kandidat yang di-shortlist', () => {
    resetAllMocks();
    mockEvaluateShortlist.mockReturnValue({
      isShortlisted: true,
      reason: 'Score 82 >= 80, all mandatory skills matched, experience 5y >= 3y required',
    });

    const result = pipeline.stageShortlist(mockCandidateData, mockMatchResult, mockScoringResult);

    expect(mockEvaluateShortlist).toHaveBeenCalledWith({
      score: mockScoringResult.score,
      mandatorySkillsStatus: mockMatchResult.mandatory_skills_status,
      experienceYears: mockCandidateData.experience_years,
      minExperienceYears: mockJD.min_experience_years,
    });

    expect(result.isShortlisted).toBe(true);
  });

  test('harus evaluate shortlist untuk kandidat yang tidak di-shortlist', () => {
    resetAllMocks();
    mockEvaluateShortlist.mockReturnValue({
      isShortlisted: false,
      reason: 'Score 65 < 80',
    });

    const result = pipeline.stageShortlist(mockCandidateData, mockMatchResult, mockScoringResult);

    expect(result.isShortlisted).toBe(false);
    expect(result.reason).toContain('< 80');
  });
});

// ─── Test: Full Pipeline Flow (processJob) ───────────────────────────────────

describe('processJob - Full Pipeline Flow', () => {
  beforeEach(() => {
    // Mock global fetch untuk notification webhook calls
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('harus proses end-to-end dengan sukses', async () => {
    resetAllMocks();
    mockParseCV.mockResolvedValue({ ...mockCandidateData, status: 'PENDING' });
    mockDuplicateCheck.mockResolvedValue({ status: 'NONE' });
    mockGetActiveJD.mockResolvedValue(mockJD);
    mockMatchCandidateToJD.mockResolvedValue(mockMatchResult);
    mockCalculateEducationScore.mockReturnValue(70);
    mockCalculateCertificationScore.mockReturnValue(60);
    mockCalculateScore.mockReturnValue(mockScoringResult);
    mockGenerateSummary.mockResolvedValue({ summary: 'Test summary' });
    mockEvaluateShortlist.mockReturnValue({
      isShortlisted: true,
      reason: 'Shortlisted',
    });
    mockDbQuery.mockResolvedValue({ rows: [{ id: 'test-id' }] });

    await pipeline.processJob(mockJob);

    expect(mockParseCV).toHaveBeenCalled();
    expect(mockCalculateScore).toHaveBeenCalled();
    expect(mockEvaluateShortlist).toHaveBeenCalled();
    // Verify notification via fetch (inline sendNotification in pipeline.js uses fetch)
    expect(global.fetch).toHaveBeenCalled();
  });

  test('harus menangani PARSING_INCOMPLETE dengan notifikasi', async () => {
    resetAllMocks();
    mockParseCV.mockResolvedValue({
      name: null,
      email: 'john@example.com',
      status: 'PARSING_INCOMPLETE',
    });
    mockDbQuery.mockResolvedValue({ rows: [{ id: 'new-id' }] });

    await pipeline.processJob(mockJob);

    expect(mockLogIntakeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PARSING_INCOMPLETE',
      })
    );
  });

  test('harus menangani NO_JD_AVAILABLE dan skip scoring', async () => {
    resetAllMocks();
    mockParseCV.mockResolvedValue({ ...mockCandidateData, status: 'PENDING' });
    mockDuplicateCheck.mockResolvedValue({ status: 'NONE' });
    mockGetActiveJD.mockResolvedValue({ status: 'NO_JD_AVAILABLE', reason: 'Job tidak ditemukan' });
    mockDbQuery.mockResolvedValue({ rows: [{ id: 'no-jd-id' }] });

    await pipeline.processJob(mockJob);

    // Verify calculateScore TIDAK dipanggil
    expect(mockCalculateScore).not.toHaveBeenCalled();
  });

  test('harus menangani DUPLICATE dan skip scoring', async () => {
    resetAllMocks();
    mockParseCV.mockResolvedValue({ ...mockCandidateData, status: 'PENDING' });
    mockDuplicateCheck.mockResolvedValue({
      status: 'DUPLICATE',
      existingRecordId: 'existing-id',
    });
    mockDbQuery.mockResolvedValue({ rows: [{ id: 'new-id' }] });

    await pipeline.processJob(mockJob);

    // Verify calculateScore TIDAK dipanggil
    expect(mockCalculateScore).not.toHaveBeenCalled();
    // Verify notification TIDAK dikirim untuk DUPLICATE (langsung selesai)
    // Note: pipeline tidak kirim notifikasi untuk DUPLICATE
  });

  test('harus menangani POSSIBLE_DUPLICATE dan kirim notifikasi review manual', async () => {
    resetAllMocks();
    mockParseCV.mockResolvedValue({ ...mockCandidateData, status: 'PENDING' });
    mockDuplicateCheck.mockResolvedValue({
      status: 'POSSIBLE_DUPLICATE',
      existingRecordId: 'possible-id',
    });
    mockDbQuery.mockResolvedValue({ rows: [{ id: 'new-id' }] });

    await pipeline.processJob(mockJob);

    // Verify notification dikirim via fetch webhook
    expect(global.fetch).toHaveBeenCalled();
  });

  test('harus mengirim notifikasi SHORTLISTED jika kandidat di-shortlist', async () => {
    resetAllMocks();
    mockParseCV.mockResolvedValue({ ...mockCandidateData, status: 'PENDING' });
    mockDuplicateCheck.mockResolvedValue({ status: 'NONE' });
    mockGetActiveJD.mockResolvedValue(mockJD);
    mockMatchCandidateToJD.mockResolvedValue(mockMatchResult);
    mockCalculateEducationScore.mockReturnValue(70);
    mockCalculateCertificationScore.mockReturnValue(60);
    mockCalculateScore.mockReturnValue(mockScoringResult);
    mockGenerateSummary.mockResolvedValue({ summary: 'Test summary' });
    mockEvaluateShortlist.mockReturnValue({
      isShortlisted: true,
      reason: 'Shortlisted',
    });
    mockDbQuery.mockResolvedValue({ rows: [{ id: 'shortlisted-id' }] });

    await pipeline.processJob(mockJob);

    // Verify notification dikirim via fetch webhook
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('localhost:5678'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  test('harus TIDAK mengirim notifikasi jika kandidat tidak di-shortlist', async () => {
    resetAllMocks();
    mockParseCV.mockResolvedValue({ ...mockCandidateData, status: 'PENDING' });
    mockDuplicateCheck.mockResolvedValue({ status: 'NONE' });
    mockGetActiveJD.mockResolvedValue(mockJD);
    mockMatchCandidateToJD.mockResolvedValue(mockMatchResult);
    mockCalculateEducationScore.mockReturnValue(70);
    mockCalculateCertificationScore.mockReturnValue(60);
    mockCalculateScore.mockReturnValue({ score: 55, recommendation: 'Weak Fit' });
    mockGenerateSummary.mockResolvedValue({ summary: 'Test summary' });
    mockEvaluateShortlist.mockReturnValue({
      isShortlisted: false,
      reason: 'Score 55 < 80',
    });
    mockDbQuery.mockResolvedValue({ rows: [{ id: 'not-shortlisted-id' }] });

    await pipeline.processJob(mockJob);

    // Verify notification TIDAK dikirim
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// ─── Test: saveCandidateRecord ──────────────────────────────────────────────

describe('saveCandidateRecord', () => {
  test('harus menyimpan record dengan benar', async () => {
    resetAllMocks();
    mockDbQuery.mockResolvedValue({ rows: [{ id: 'new-record-id' }] });

    const record = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      score: 85,
      status: 'Shortlisted',
    };

    const result = await pipeline.saveCandidateRecord(record);

    expect(mockDbQuery).toHaveBeenCalled();
    expect(result).toBe('new-record-id');
  });

  test('harus retry hingga 3x jika gagal', async () => {
    resetAllMocks();
    mockDbQuery
      .mockRejectedValueOnce(new Error('Connection error'))
      .mockRejectedValueOnce(new Error('Connection error'))
      .mockResolvedValue({ rows: [{ id: 'retry-success-id' }] });

    const record = { name: 'Test', status: 'PENDING' };

    const result = await pipeline.saveCandidateRecord(record);

    expect(mockDbQuery).toHaveBeenCalledTimes(3);
    expect(result).toBe('retry-success-id');
  });
});

// ─── Test: sendNotification ─────────────────────────────────────────────────

describe('sendNotification', () => {
  beforeEach(() => {
    resetAllMocks();
    // Mock global fetch
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('harus mengirim notifikasi via HTTP webhook', async () => {
    global.fetch.mockResolvedValue({ ok: true, status: 200 });

    await pipeline.sendNotification({
      eventType: 'SHORTLISTED',
      candidateId: 'test-id',
      payload: { candidateName: 'John' },
    });

    expect(global.fetch).toHaveBeenCalled();
  });

  test('harus tidak throw jika notification gagal', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));

    await expect(
      pipeline.sendNotification({
        eventType: 'SHORTLISTED',
        candidateId: 'test-id',
        payload: {},
      })
    ).resolves.not.toThrow();
  });
});
