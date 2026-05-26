'use strict';

/**
 * Unit tests untuk src/scoring-engine/calculator.js
 * Memvalidasi formula scoring berbobot, validasi input, dan idempotence.
 * Requirements: 5.1, 5.2, 5.3, 5.5, 5.6
 */

const { calculateScore } = require('../../../src/scoring-engine/calculator');

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Membuat input scoring dengan semua dimensi bernilai sama.
 * @param {number} value - Nilai untuk semua dimensi
 */
function makeUniformInput(value) {
  return { skillMatch: value, experience: value, education: value, industry: value, certification: value };
}

// ─── Kasus dasar ──────────────────────────────────────────────────────────────

describe('calculateScore — kasus dasar', () => {
  it('semua input 100 → score 100 (Strong Fit)', () => {
    const result = calculateScore(makeUniformInput(100));
    expect(result.score).toBe(100);
    expect(result.recommendation).toBe('Strong Fit');
  });

  it('semua input 0 → score 0 (Weak Fit)', () => {
    const result = calculateScore(makeUniformInput(0));
    expect(result.score).toBe(0);
    expect(result.recommendation).toBe('Weak Fit');
  });

  it('input campuran: skillMatch=80, experience=70, education=70, industry=60, certification=50 → score 71 (Moderate Fit)', () => {
    // Manual: 0.4*80 + 0.3*70 + 0.1*70 + 0.1*60 + 0.1*50
    //       = 32 + 21 + 7 + 6 + 5 = 71
    const result = calculateScore({
      skillMatch: 80,
      experience: 70,
      education: 70,
      industry: 60,
      certification: 50,
    });
    expect(result.score).toBe(71);
    expect(result.recommendation).toBe('Moderate Fit');
  });
});

// ─── Threshold recommendation ─────────────────────────────────────────────────

describe('calculateScore — threshold recommendation', () => {
  it('skor tepat 80 → Strong Fit', () => {
    // Untuk mendapat skor 80: semua dimensi = 80
    // 0.4*80 + 0.3*80 + 0.1*80 + 0.1*80 + 0.1*80 = 80
    const result = calculateScore(makeUniformInput(80));
    expect(result.score).toBe(80);
    expect(result.recommendation).toBe('Strong Fit');
  });

  it('skor tepat 79 → Moderate Fit', () => {
    // skillMatch=79, experience=79, education=79, industry=79, certification=79
    // 0.4*79 + 0.3*79 + 0.1*79 + 0.1*79 + 0.1*79 = 79
    const result = calculateScore(makeUniformInput(79));
    expect(result.score).toBe(79);
    expect(result.recommendation).toBe('Moderate Fit');
  });

  it('skor tepat 60 → Moderate Fit', () => {
    const result = calculateScore(makeUniformInput(60));
    expect(result.score).toBe(60);
    expect(result.recommendation).toBe('Moderate Fit');
  });

  it('skor tepat 59 → Weak Fit', () => {
    const result = calculateScore(makeUniformInput(59));
    expect(result.score).toBe(59);
    expect(result.recommendation).toBe('Weak Fit');
  });
});

// ─── Validasi input invalid ───────────────────────────────────────────────────

describe('calculateScore — validasi input invalid (Req 5.6)', () => {
  it('skor -1 → throw INVALID_DIMENSION_SCORE', () => {
    expect(() =>
      calculateScore({ skillMatch: -1, experience: 50, education: 50, industry: 50, certification: 50 })
    ).toThrow('INVALID_DIMENSION_SCORE');
  });

  it('skor 101 → throw INVALID_DIMENSION_SCORE', () => {
    expect(() =>
      calculateScore({ skillMatch: 101, experience: 50, education: 50, industry: 50, certification: 50 })
    ).toThrow('INVALID_DIMENSION_SCORE');
  });

  it('skor null → throw INVALID_DIMENSION_SCORE', () => {
    expect(() =>
      calculateScore({ skillMatch: null, experience: 50, education: 50, industry: 50, certification: 50 })
    ).toThrow('INVALID_DIMENSION_SCORE');
  });

  it('skor NaN → throw INVALID_DIMENSION_SCORE', () => {
    expect(() =>
      calculateScore({ skillMatch: NaN, experience: 50, education: 50, industry: 50, certification: 50 })
    ).toThrow('INVALID_DIMENSION_SCORE');
  });

  it('skor undefined → throw INVALID_DIMENSION_SCORE', () => {
    expect(() =>
      calculateScore({ skillMatch: undefined, experience: 50, education: 50, industry: 50, certification: 50 })
    ).toThrow('INVALID_DIMENSION_SCORE');
  });

  it('skor -1 pada dimensi experience → throw INVALID_DIMENSION_SCORE', () => {
    expect(() =>
      calculateScore({ skillMatch: 50, experience: -1, education: 50, industry: 50, certification: 50 })
    ).toThrow('INVALID_DIMENSION_SCORE');
  });

  it('skor 101 pada dimensi education → throw INVALID_DIMENSION_SCORE', () => {
    expect(() =>
      calculateScore({ skillMatch: 50, experience: 50, education: 101, industry: 50, certification: 50 })
    ).toThrow('INVALID_DIMENSION_SCORE');
  });

  it('skor null pada dimensi certification → throw INVALID_DIMENSION_SCORE', () => {
    expect(() =>
      calculateScore({ skillMatch: 50, experience: 50, education: 50, industry: 50, certification: null })
    ).toThrow('INVALID_DIMENSION_SCORE');
  });
});

// ─── Idempotence (Req 5.5) ────────────────────────────────────────────────────

describe('calculateScore — idempotence (Req 5.5)', () => {
  it('panggil 2x dengan input sama → hasil sama', () => {
    const input = { skillMatch: 75, experience: 65, education: 80, industry: 70, certification: 60 };

    const result1 = calculateScore(input);
    const result2 = calculateScore(input);

    expect(result1.score).toBe(result2.score);
    expect(result1.recommendation).toBe(result2.recommendation);
  });

  it('panggil 5x dengan input sama → semua hasil identik', () => {
    const input = makeUniformInput(55);
    const results = Array.from({ length: 5 }, () => calculateScore(input));

    const firstScore = results[0].score;
    const firstRec = results[0].recommendation;

    for (const result of results) {
      expect(result.score).toBe(firstScore);
      expect(result.recommendation).toBe(firstRec);
    }
  });
});

// ─── Clamp test ───────────────────────────────────────────────────────────────

describe('calculateScore — clamp ke [0, 100]', () => {
  it('kombinasi yang menghasilkan tepat 100 setelah rounding', () => {
    // Semua 100 → rawScore = 100 → finalScore = 100
    const result = calculateScore(makeUniformInput(100));
    expect(result.score).toBe(100);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('kombinasi yang menghasilkan tepat 0 setelah rounding', () => {
    const result = calculateScore(makeUniformInput(0));
    expect(result.score).toBe(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('skor akhir selalu integer', () => {
    const inputs = [
      { skillMatch: 33, experience: 67, education: 45, industry: 78, certification: 12 },
      { skillMatch: 1, experience: 1, education: 1, industry: 1, certification: 1 },
      { skillMatch: 99, experience: 99, education: 99, industry: 99, certification: 99 },
    ];

    for (const input of inputs) {
      const result = calculateScore(input);
      expect(Number.isInteger(result.score)).toBe(true);
    }
  });
});

// ─── Return shape ─────────────────────────────────────────────────────────────

describe('calculateScore — return shape', () => {
  it('mengembalikan object dengan property score dan recommendation', () => {
    const result = calculateScore(makeUniformInput(70));
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('recommendation');
  });

  it('score adalah number', () => {
    const result = calculateScore(makeUniformInput(70));
    expect(typeof result.score).toBe('number');
  });

  it('recommendation adalah string', () => {
    const result = calculateScore(makeUniformInput(70));
    expect(typeof result.recommendation).toBe('string');
  });

  it('recommendation hanya berisi nilai yang valid', () => {
    const validRecommendations = ['Strong Fit', 'Moderate Fit', 'Weak Fit'];
    const testScores = [0, 30, 59, 60, 70, 79, 80, 90, 100];

    for (const score of testScores) {
      const result = calculateScore(makeUniformInput(score));
      expect(validRecommendations).toContain(result.recommendation);
    }
  });
});

// ─── Formula berbobot (Req 5.1) ───────────────────────────────────────────────

describe('calculateScore — formula berbobot (Req 5.1)', () => {
  it('skillMatch memiliki bobot 40%', () => {
    // Hanya skillMatch = 100, sisanya 0
    // rawScore = 0.4*100 + 0.3*0 + 0.1*0 + 0.1*0 + 0.1*0 = 40
    const result = calculateScore({ skillMatch: 100, experience: 0, education: 0, industry: 0, certification: 0 });
    expect(result.score).toBe(40);
  });

  it('experience memiliki bobot 30%', () => {
    // Hanya experience = 100, sisanya 0
    // rawScore = 0.4*0 + 0.3*100 + 0.1*0 + 0.1*0 + 0.1*0 = 30
    const result = calculateScore({ skillMatch: 0, experience: 100, education: 0, industry: 0, certification: 0 });
    expect(result.score).toBe(30);
  });

  it('education memiliki bobot 10%', () => {
    // Hanya education = 100, sisanya 0
    // rawScore = 0.4*0 + 0.3*0 + 0.1*100 + 0.1*0 + 0.1*0 = 10
    const result = calculateScore({ skillMatch: 0, experience: 0, education: 100, industry: 0, certification: 0 });
    expect(result.score).toBe(10);
  });

  it('industry memiliki bobot 10%', () => {
    // Hanya industry = 100, sisanya 0
    // rawScore = 0.4*0 + 0.3*0 + 0.1*0 + 0.1*100 + 0.1*0 = 10
    const result = calculateScore({ skillMatch: 0, experience: 0, education: 0, industry: 100, certification: 0 });
    expect(result.score).toBe(10);
  });

  it('certification memiliki bobot 10%', () => {
    // Hanya certification = 100, sisanya 0
    // rawScore = 0.4*0 + 0.3*0 + 0.1*0 + 0.1*0 + 0.1*100 = 10
    const result = calculateScore({ skillMatch: 0, experience: 0, education: 0, industry: 0, certification: 100 });
    expect(result.score).toBe(10);
  });

  it('total bobot = 100% (semua 100 → score 100)', () => {
    // 0.4 + 0.3 + 0.1 + 0.1 + 0.1 = 1.0
    const result = calculateScore(makeUniformInput(100));
    expect(result.score).toBe(100);
  });
});
