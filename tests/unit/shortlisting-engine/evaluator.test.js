'use strict';

/**
 * Unit tests untuk src/shortlisting-engine/evaluator.js
 * Memvalidasi logika shortlisting untuk semua kombinasi kondisi.
 * Requirements: 7.1, 7.2, 7.3, 7.5
 */

const { evaluateShortlist } = require('../../../src/shortlisting-engine/evaluator');

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Membuat input shortlist yang memenuhi semua kondisi (baseline shortlisted).
 */
function makeShortlistedInput(overrides = {}) {
  return {
    score: 85,
    mandatorySkillsStatus: { JavaScript: 'matched', React: 'matched' },
    experienceYears: 5,
    minExperienceYears: 3,
    ...overrides,
  };
}

// ─── Return shape ─────────────────────────────────────────────────────────────

describe('evaluateShortlist — return shape', () => {
  it('mengembalikan object dengan property isShortlisted dan reason', () => {
    const result = evaluateShortlist(makeShortlistedInput());
    expect(result).toHaveProperty('isShortlisted');
    expect(result).toHaveProperty('reason');
  });

  it('isShortlisted adalah boolean', () => {
    const result = evaluateShortlist(makeShortlistedInput());
    expect(typeof result.isShortlisted).toBe('boolean');
  });

  it('reason adalah string non-kosong', () => {
    const result = evaluateShortlist(makeShortlistedInput());
    expect(typeof result.reason).toBe('string');
    expect(result.reason.length).toBeGreaterThan(0);
  });
});

// ─── Kasus Shortlisted (Req 7.2) ─────────────────────────────────────────────

describe('evaluateShortlist — Shortlisted (Req 7.2)', () => {
  it('score >= 80, semua mandatory matched, experience cukup → Shortlisted', () => {
    const result = evaluateShortlist({
      score: 85,
      mandatorySkillsStatus: { JavaScript: 'matched', React: 'matched' },
      experienceYears: 5,
      minExperienceYears: 3,
    });
    expect(result.isShortlisted).toBe(true);
  });

  it('reason shortlisted mencantumkan score, skills matched, dan experience', () => {
    const result = evaluateShortlist({
      score: 85,
      mandatorySkillsStatus: { JavaScript: 'matched' },
      experienceYears: 5,
      minExperienceYears: 3,
    });
    expect(result.reason).toContain('85');
    expect(result.reason).toContain('all mandatory skills matched');
    expect(result.reason).toContain('5y');
    expect(result.reason).toContain('3y');
  });

  it('score tepat 80 (boundary) → Shortlisted', () => {
    const result = evaluateShortlist({
      score: 80,
      mandatorySkillsStatus: { Python: 'matched' },
      experienceYears: 2,
      minExperienceYears: 2,
    });
    expect(result.isShortlisted).toBe(true);
  });

  it('score 100 → Shortlisted', () => {
    const result = evaluateShortlist({
      score: 100,
      mandatorySkillsStatus: { Java: 'matched' },
      experienceYears: 10,
      minExperienceYears: 5,
    });
    expect(result.isShortlisted).toBe(true);
  });

  it('minExperienceYears = 0 dan experienceYears = 0 → kondisi experience terpenuhi', () => {
    const result = evaluateShortlist({
      score: 90,
      mandatorySkillsStatus: { SQL: 'matched' },
      experienceYears: 0,
      minExperienceYears: 0,
    });
    expect(result.isShortlisted).toBe(true);
  });

  it('mandatorySkillsStatus kosong {} → kondisi skills dianggap terpenuhi', () => {
    const result = evaluateShortlist({
      score: 82,
      mandatorySkillsStatus: {},
      experienceYears: 3,
      minExperienceYears: 1,
    });
    expect(result.isShortlisted).toBe(true);
  });
});

// ─── Kasus Not Shortlisted — Score < 80 (Req 7.3) ────────────────────────────

describe('evaluateShortlist — Not Shortlisted karena score < 80 (Req 7.3)', () => {
  it('score 79 (boundary) → Not Shortlisted', () => {
    const result = evaluateShortlist({
      score: 79,
      mandatorySkillsStatus: { JavaScript: 'matched' },
      experienceYears: 5,
      minExperienceYears: 3,
    });
    expect(result.isShortlisted).toBe(false);
  });

  it('score 0 → Not Shortlisted', () => {
    const result = evaluateShortlist({
      score: 0,
      mandatorySkillsStatus: { JavaScript: 'matched' },
      experienceYears: 5,
      minExperienceYears: 3,
    });
    expect(result.isShortlisted).toBe(false);
  });

  it('score 50 → Not Shortlisted', () => {
    const result = evaluateShortlist({
      score: 50,
      mandatorySkillsStatus: {},
      experienceYears: 10,
      minExperienceYears: 0,
    });
    expect(result.isShortlisted).toBe(false);
  });

  it('reason mencantumkan "Score X < 80" saat score kurang', () => {
    const result = evaluateShortlist({
      score: 75,
      mandatorySkillsStatus: { JavaScript: 'matched' },
      experienceYears: 5,
      minExperienceYears: 3,
    });
    expect(result.reason).toContain('Score 75 < 80');
  });
});

// ─── Kasus Not Shortlisted — Mandatory Skill Missing (Req 7.3) ───────────────

describe('evaluateShortlist — Not Shortlisted karena mandatory skill missing (Req 7.3)', () => {
  it('score >= 80 tapi ada skill missing → Not Shortlisted', () => {
    const result = evaluateShortlist({
      score: 85,
      mandatorySkillsStatus: { JavaScript: 'matched', Python: 'missing' },
      experienceYears: 5,
      minExperienceYears: 3,
    });
    expect(result.isShortlisted).toBe(false);
  });

  it('semua skills missing → Not Shortlisted', () => {
    const result = evaluateShortlist({
      score: 90,
      mandatorySkillsStatus: { JavaScript: 'missing', React: 'missing', TypeScript: 'missing' },
      experienceYears: 5,
      minExperienceYears: 3,
    });
    expect(result.isShortlisted).toBe(false);
  });

  it('reason mencantumkan nama skill yang missing', () => {
    const result = evaluateShortlist({
      score: 85,
      mandatorySkillsStatus: { JavaScript: 'matched', Python: 'missing', Docker: 'missing' },
      experienceYears: 5,
      minExperienceYears: 3,
    });
    expect(result.reason).toContain('Missing mandatory skills');
    expect(result.reason).toContain('Python');
    expect(result.reason).toContain('Docker');
  });

  it('reason tidak mencantumkan skill yang matched', () => {
    const result = evaluateShortlist({
      score: 85,
      mandatorySkillsStatus: { JavaScript: 'matched', Python: 'missing' },
      experienceYears: 5,
      minExperienceYears: 3,
    });
    // JavaScript matched, tidak boleh muncul di reason sebagai missing
    expect(result.reason).not.toContain('JavaScript');
    expect(result.reason).toContain('Python');
  });
});

// ─── Kasus Not Shortlisted — Experience Kurang (Req 7.3) ─────────────────────

describe('evaluateShortlist — Not Shortlisted karena experience kurang (Req 7.3)', () => {
  it('score >= 80, semua matched, tapi experience kurang → Not Shortlisted', () => {
    const result = evaluateShortlist({
      score: 85,
      mandatorySkillsStatus: { JavaScript: 'matched' },
      experienceYears: 2,
      minExperienceYears: 5,
    });
    expect(result.isShortlisted).toBe(false);
  });

  it('experienceYears = 0, minExperienceYears = 1 → Not Shortlisted', () => {
    const result = evaluateShortlist({
      score: 90,
      mandatorySkillsStatus: { Python: 'matched' },
      experienceYears: 0,
      minExperienceYears: 1,
    });
    expect(result.isShortlisted).toBe(false);
  });

  it('reason mencantumkan "Experience Xy < Zy required"', () => {
    const result = evaluateShortlist({
      score: 85,
      mandatorySkillsStatus: { JavaScript: 'matched' },
      experienceYears: 2,
      minExperienceYears: 5,
    });
    expect(result.reason).toContain('Experience 2y < 5y required');
  });
});

// ─── Kombinasi Multiple Failures (Req 7.3) ───────────────────────────────────

describe('evaluateShortlist — kombinasi multiple failures (Req 7.3)', () => {
  it('score < 80 DAN skill missing → Not Shortlisted, reason mencantumkan keduanya', () => {
    const result = evaluateShortlist({
      score: 70,
      mandatorySkillsStatus: { JavaScript: 'matched', Python: 'missing' },
      experienceYears: 5,
      minExperienceYears: 3,
    });
    expect(result.isShortlisted).toBe(false);
    expect(result.reason).toContain('Score 70 < 80');
    expect(result.reason).toContain('Missing mandatory skills');
    expect(result.reason).toContain('Python');
  });

  it('score < 80 DAN experience kurang → Not Shortlisted, reason mencantumkan keduanya', () => {
    const result = evaluateShortlist({
      score: 65,
      mandatorySkillsStatus: { JavaScript: 'matched' },
      experienceYears: 1,
      minExperienceYears: 5,
    });
    expect(result.isShortlisted).toBe(false);
    expect(result.reason).toContain('Score 65 < 80');
    expect(result.reason).toContain('Experience 1y < 5y required');
  });

  it('skill missing DAN experience kurang → Not Shortlisted, reason mencantumkan keduanya', () => {
    const result = evaluateShortlist({
      score: 85,
      mandatorySkillsStatus: { JavaScript: 'missing', React: 'missing' },
      experienceYears: 1,
      minExperienceYears: 5,
    });
    expect(result.isShortlisted).toBe(false);
    expect(result.reason).toContain('Missing mandatory skills');
    expect(result.reason).toContain('Experience 1y < 5y required');
  });

  it('semua tiga kondisi gagal → Not Shortlisted, reason mencantumkan ketiga alasan', () => {
    const result = evaluateShortlist({
      score: 60,
      mandatorySkillsStatus: { JavaScript: 'missing', Python: 'missing' },
      experienceYears: 1,
      minExperienceYears: 5,
    });
    expect(result.isShortlisted).toBe(false);
    expect(result.reason).toContain('Score 60 < 80');
    expect(result.reason).toContain('Missing mandatory skills');
    expect(result.reason).toContain('Experience 1y < 5y required');
  });
});

// ─── Edge Cases ───────────────────────────────────────────────────────────────

describe('evaluateShortlist — edge cases', () => {
  it('score tepat 80 (boundary bawah shortlist) → Shortlisted', () => {
    const result = evaluateShortlist({
      score: 80,
      mandatorySkillsStatus: { Go: 'matched' },
      experienceYears: 3,
      minExperienceYears: 3,
    });
    expect(result.isShortlisted).toBe(true);
  });

  it('score tepat 79 (boundary atas not shortlisted) → Not Shortlisted', () => {
    const result = evaluateShortlist({
      score: 79,
      mandatorySkillsStatus: { Go: 'matched' },
      experienceYears: 3,
      minExperienceYears: 3,
    });
    expect(result.isShortlisted).toBe(false);
    expect(result.reason).toContain('Score 79 < 80');
  });

  it('mandatorySkillsStatus tidak diberikan (undefined) → dianggap tidak ada mandatory skills', () => {
    const result = evaluateShortlist({
      score: 85,
      mandatorySkillsStatus: undefined,
      experienceYears: 5,
      minExperienceYears: 3,
    });
    expect(result.isShortlisted).toBe(true);
  });

  it('minExperienceYears = 0 → experience selalu cukup (kecuali experienceYears negatif)', () => {
    const result = evaluateShortlist({
      score: 85,
      mandatorySkillsStatus: { JavaScript: 'matched' },
      experienceYears: 0,
      minExperienceYears: 0,
    });
    expect(result.isShortlisted).toBe(true);
  });

  it('experienceYears tepat sama dengan minExperienceYears → kondisi terpenuhi', () => {
    const result = evaluateShortlist({
      score: 85,
      mandatorySkillsStatus: { JavaScript: 'matched' },
      experienceYears: 5,
      minExperienceYears: 5,
    });
    expect(result.isShortlisted).toBe(true);
  });

  it('experienceYears satu kurang dari minExperienceYears → Not Shortlisted', () => {
    const result = evaluateShortlist({
      score: 85,
      mandatorySkillsStatus: { JavaScript: 'matched' },
      experienceYears: 4,
      minExperienceYears: 5,
    });
    expect(result.isShortlisted).toBe(false);
    expect(result.reason).toContain('Experience 4y < 5y required');
  });

  it('satu skill matched dan satu skill missing → Not Shortlisted', () => {
    const result = evaluateShortlist({
      score: 90,
      mandatorySkillsStatus: { JavaScript: 'matched', Kubernetes: 'missing' },
      experienceYears: 7,
      minExperienceYears: 3,
    });
    expect(result.isShortlisted).toBe(false);
    expect(result.reason).toContain('Kubernetes');
    expect(result.reason).not.toContain('JavaScript');
  });

  it('banyak mandatory skills semua matched → kondisi skills terpenuhi', () => {
    const result = evaluateShortlist({
      score: 88,
      mandatorySkillsStatus: {
        JavaScript: 'matched',
        TypeScript: 'matched',
        React: 'matched',
        Node: 'matched',
        PostgreSQL: 'matched',
      },
      experienceYears: 6,
      minExperienceYears: 4,
    });
    expect(result.isShortlisted).toBe(true);
  });
});

// ─── Konsistensi reason (Req 7.5) ─────────────────────────────────────────────

describe('evaluateShortlist — konsistensi reason untuk audit log (Req 7.5)', () => {
  it('reason shortlisted selalu mengandung informasi score, skills, dan experience', () => {
    const result = evaluateShortlist({
      score: 92,
      mandatorySkillsStatus: { Java: 'matched', Spring: 'matched' },
      experienceYears: 8,
      minExperienceYears: 5,
    });
    expect(result.isShortlisted).toBe(true);
    expect(result.reason).toMatch(/Score \d+ >= 80/);
    expect(result.reason).toContain('all mandatory skills matched');
    expect(result.reason).toMatch(/experience \d+y >= \d+y required/);
  });

  it('reason not shortlisted selalu non-kosong dan informatif', () => {
    const result = evaluateShortlist({
      score: 50,
      mandatorySkillsStatus: { Java: 'missing' },
      experienceYears: 1,
      minExperienceYears: 5,
    });
    expect(result.isShortlisted).toBe(false);
    expect(result.reason.length).toBeGreaterThan(0);
    // Reason harus mengandung setidaknya satu alasan konkret
    const hasConcreteReason =
      result.reason.includes('Score') ||
      result.reason.includes('Missing mandatory skills') ||
      result.reason.includes('Experience');
    expect(hasConcreteReason).toBe(true);
  });

  it('multiple rejection reasons dipisahkan dengan "; "', () => {
    const result = evaluateShortlist({
      score: 70,
      mandatorySkillsStatus: { Python: 'missing' },
      experienceYears: 1,
      minExperienceYears: 5,
    });
    expect(result.isShortlisted).toBe(false);
    // Harus ada separator "; " antara alasan-alasan
    expect(result.reason).toContain('; ');
  });
});
