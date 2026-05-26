'use strict';

/**
 * Property Test P1: File Validation Completeness
 *
 * Property: validator menerima file jika dan hanya jika
 *   ekstensi ∈ {pdf, docx, txt} DAN ukuran ≤ 10MB
 *
 * Validates: Requirements 1.2, 1.5
 */

const fc = require('fast-check');
const { validateFile } = require('../../src/cv-intake/validator');

// Semua ekstensi valid
const VALID_EXTENSIONS = ['pdf', 'docx', 'txt'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

describe('P1: File Validation Completeness', () => {
  /**
   * Validates: Requirements 1.2, 1.5
   *
   * Property: hasil validasi selalu konsisten dengan rule:
   * valid = (ext valid AND size <= 10MB)
   */
  it('valid = (ekstensi valid AND ukuran <= 10MB)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 0, max: 20 * 1024 * 1024 }),
        (extension, sizeBytes) => {
          const result = validateFile({ extension, sizeBytes });

          const isValidExtension = VALID_EXTENSIONS.includes(extension.toLowerCase());
          const isValidSize = sizeBytes <= MAX_SIZE_BYTES;
          const expectedValid = isValidExtension && isValidSize;

          return result.valid === expectedValid;
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * Validates: Requirements 1.2
   *
   * Property: ekstensi tidak valid → valid = false, errorCode = 'INVALID_FORMAT'
   */
  it('ekstensi tidak valid selalu ditolak dengan INVALID_FORMAT', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter(ext =>
          !VALID_EXTENSIONS.includes(ext.toLowerCase())
        ),
        fc.integer({ min: 0, max: MAX_SIZE_BYTES }),
        (extension, sizeBytes) => {
          const result = validateFile({ extension, sizeBytes });
          return result.valid === false && result.errorCode === 'INVALID_FORMAT';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 1.5
   *
   * Property: ukuran > 10MB → valid = false, errorCode = 'FILE_TOO_LARGE'
   */
  it('file > 10MB selalu ditolak dengan FILE_TOO_LARGE', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_EXTENSIONS),
        fc.integer({ min: MAX_SIZE_BYTES + 1, max: MAX_SIZE_BYTES * 2 }),
        (extension, sizeBytes) => {
          const result = validateFile({ extension, sizeBytes });
          return result.valid === false && result.errorCode === 'FILE_TOO_LARGE';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 1.2
   *
   * Property: semua ekstensi valid (pdf, docx, txt) selalu diterima jika ukuran <= 10MB
   */
  it('ekstensi valid selalu diterima jika ukuran <= 10MB', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_EXTENSIONS),
        fc.integer({ min: 0, max: MAX_SIZE_BYTES }),
        (extension, sizeBytes) => {
          const result = validateFile({ extension, sizeBytes });
          return result.valid === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 1.2, 1.5
   *
   * Property: case-insensitive extension match
   */
  it('extension matching case-insensitive', () => {
    const cases = [
      ['PDF', true], ['pdf', true], ['Pdf', true],
      ['DOCX', true], ['docx', true], ['Docx', true],
      ['TXT', true], ['txt', true], ['Txt', true],
      ['JPG', false], ['PNG', false], ['EXE', false],
    ];

    for (const [ext, expected] of cases) {
      const result = validateFile({ extension: ext, sizeBytes: 1024 });
      expect(result.valid).toBe(expected);
    }
  });
});