'use strict';

const { validateFile } = require('../../../src/cv-intake/validator');

/**
 * Unit tests untuk src/cv-intake/validator.js
 * Memvalidasi logika validasi ekstensi dan ukuran file CV.
 * Requirements: 1.2, 1.3, 1.5
 */

describe('validateFile', () => {
  // ─── Ekstensi Valid ───────────────────────────────────────────────────────

  describe('ekstensi valid', () => {
    const validCases = [
      { extension: 'pdf', sizeBytes: 1024 },
      { extension: 'docx', sizeBytes: 1024 },
      { extension: 'txt', sizeBytes: 1024 },
      // Case-insensitive
      { extension: 'PDF', sizeBytes: 1024 },
      { extension: 'DOCX', sizeBytes: 1024 },
      { extension: 'TXT', sizeBytes: 1024 },
      { extension: 'Pdf', sizeBytes: 1024 },
    ];

    test.each(validCases)(
      'menerima file dengan ekstensi "$extension"',
      ({ extension, sizeBytes }) => {
        const result = validateFile({ extension, sizeBytes });
        expect(result.valid).toBe(true);
        expect(result.errorCode).toBeUndefined();
      }
    );
  });

  // ─── Ekstensi Tidak Valid ─────────────────────────────────────────────────

  describe('ekstensi tidak valid', () => {
    const invalidExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'xlsx', 'xls', 'ppt', 'pptx', 'zip', 'rar', 'exe', 'mp4', 'doc'];

    test.each(invalidExtensions)(
      'menolak file dengan ekstensi "%s" dengan INVALID_FORMAT',
      (extension) => {
        const result = validateFile({ extension, sizeBytes: 1024 });
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('INVALID_FORMAT');
      }
    );

    test('menolak ekstensi kosong', () => {
      const result = validateFile({ extension: '', sizeBytes: 1024 });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_FORMAT');
    });

    test('menolak ekstensi berupa spasi', () => {
      const result = validateFile({ extension: '   ', sizeBytes: 1024 });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_FORMAT');
    });

    test('menolak ekstensi null', () => {
      const result = validateFile({ extension: null, sizeBytes: 1024 });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_FORMAT');
    });

    test('menolak ekstensi undefined', () => {
      const result = validateFile({ extension: undefined, sizeBytes: 1024 });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_FORMAT');
    });
  });

  // ─── Ukuran File ──────────────────────────────────────────────────────────

  describe('validasi ukuran file', () => {
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB

    test('menerima file tepat 10MB', () => {
      const result = validateFile({ extension: 'pdf', sizeBytes: MAX_SIZE });
      expect(result.valid).toBe(true);
    });

    test('menerima file 1 byte di bawah 10MB', () => {
      const result = validateFile({ extension: 'pdf', sizeBytes: MAX_SIZE - 1 });
      expect(result.valid).toBe(true);
    });

    test('menolak file 1 byte di atas 10MB dengan FILE_TOO_LARGE', () => {
      const result = validateFile({ extension: 'pdf', sizeBytes: MAX_SIZE + 1 });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('FILE_TOO_LARGE');
    });

    test('menolak file 20MB dengan FILE_TOO_LARGE', () => {
      const result = validateFile({ extension: 'pdf', sizeBytes: 20 * 1024 * 1024 });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('FILE_TOO_LARGE');
    });

    test('menerima file 0 bytes (file kosong tapi valid format)', () => {
      const result = validateFile({ extension: 'txt', sizeBytes: 0 });
      expect(result.valid).toBe(true);
    });

    test('menolak sizeBytes negatif', () => {
      const result = validateFile({ extension: 'pdf', sizeBytes: -1 });
      expect(result.valid).toBe(false);
    });

    test('menolak sizeBytes NaN', () => {
      const result = validateFile({ extension: 'pdf', sizeBytes: NaN });
      expect(result.valid).toBe(false);
    });

    test('menolak sizeBytes Infinity', () => {
      const result = validateFile({ extension: 'pdf', sizeBytes: Infinity });
      expect(result.valid).toBe(false);
    });
  });

  // ─── Prioritas Error ──────────────────────────────────────────────────────

  describe('prioritas error', () => {
    test('mengembalikan INVALID_FORMAT jika ekstensi invalid meskipun ukuran juga melebihi batas', () => {
      // Ekstensi dicek lebih dulu
      const result = validateFile({ extension: 'jpg', sizeBytes: 20 * 1024 * 1024 });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_FORMAT');
    });
  });

  // ─── Kombinasi Valid ──────────────────────────────────────────────────────

  describe('kombinasi valid', () => {
    test('pdf 5MB — valid', () => {
      expect(validateFile({ extension: 'pdf', sizeBytes: 5 * 1024 * 1024 }).valid).toBe(true);
    });

    test('docx 100KB — valid', () => {
      expect(validateFile({ extension: 'docx', sizeBytes: 100 * 1024 }).valid).toBe(true);
    });

    test('txt 1KB — valid', () => {
      expect(validateFile({ extension: 'txt', sizeBytes: 1024 }).valid).toBe(true);
    });
  });
});
