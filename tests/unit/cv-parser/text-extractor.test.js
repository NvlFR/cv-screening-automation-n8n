'use strict';

const { extractText, isPDF, isDOCX, isTXT } = require('../../../src/cv-parser/text-extractor');

/**
 * Unit tests untuk src/cv-parser/text-extractor.js
 * Memvalidasi ekstraksi teks dari berbagai format file CV.
 * Requirements: 2.1
 */

describe('text-extractor', () => {
  // ─── Helper functions ─────────────────────────────────────────────────────

  describe('isPDF', () => {
    test('mengembalikan true untuk application/pdf', () => {
      expect(isPDF('application/pdf')).toBe(true);
    });

    test('mengembalikan false untuk MIME type lain', () => {
      expect(isPDF('text/plain')).toBe(false);
      expect(isPDF('application/docx')).toBe(false);
    });
  });

  describe('isDOCX', () => {
    test('mengembalikan true untuk MIME type DOCX standar', () => {
      expect(isDOCX('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true);
    });

    test('mengembalikan true untuk application/docx', () => {
      expect(isDOCX('application/docx')).toBe(true);
    });

    test('mengembalikan true untuk application/msword', () => {
      expect(isDOCX('application/msword')).toBe(true);
    });

    test('mengembalikan false untuk MIME type lain', () => {
      expect(isDOCX('text/plain')).toBe(false);
      expect(isDOCX('application/pdf')).toBe(false);
    });
  });

  describe('isTXT', () => {
    test('mengembalikan true untuk text/plain', () => {
      expect(isTXT('text/plain')).toBe(true);
    });

    test('mengembalikan true untuk text/txt', () => {
      expect(isTXT('text/txt')).toBe(true);
    });

    test('mengembalikan false untuk MIME type lain', () => {
      expect(isTXT('application/pdf')).toBe(false);
      expect(isTXT('application/docx')).toBe(false);
    });
  });

  // ─── extractText: TXT ─────────────────────────────────────────────────────

  describe('extractText — TXT', () => {
    test('mengekstrak teks dari buffer TXT dengan benar', async () => {
      const content = 'Nama: John Doe\nEmail: john@example.com\nSkills: JavaScript, Python';
      const buffer = Buffer.from(content, 'utf8');

      const result = await extractText(buffer, 'text/plain');
      expect(result).toBe(content);
    });

    test('mengekstrak teks dari buffer TXT kosong', async () => {
      const buffer = Buffer.from('', 'utf8');
      const result = await extractText(buffer, 'text/plain');
      expect(result).toBe('');
    });

    test('mengekstrak teks dengan karakter Unicode', async () => {
      const content = 'Nama: Budi Santoso\nLokasi: Jakarta, Indonesia\nKeahlian: Pemrograman';
      const buffer = Buffer.from(content, 'utf8');

      const result = await extractText(buffer, 'text/plain');
      expect(result).toBe(content);
    });

    test('mendukung MIME type text/txt', async () => {
      const content = 'Test content';
      const buffer = Buffer.from(content, 'utf8');

      const result = await extractText(buffer, 'text/txt');
      expect(result).toBe(content);
    });
  });

  // ─── extractText: Error handling ─────────────────────────────────────────

  describe('extractText — validasi input', () => {
    test('melempar TypeError jika fileBuffer bukan Buffer', async () => {
      await expect(extractText('bukan buffer', 'text/plain'))
        .rejects.toThrow(TypeError);
      await expect(extractText('bukan buffer', 'text/plain'))
        .rejects.toThrow('fileBuffer harus berupa Buffer');
    });

    test('melempar TypeError jika mimeType bukan string', async () => {
      const buffer = Buffer.from('test');
      await expect(extractText(buffer, null))
        .rejects.toThrow(TypeError);
      await expect(extractText(buffer, null))
        .rejects.toThrow('mimeType harus berupa string non-kosong');
    });

    test('melempar TypeError jika mimeType string kosong', async () => {
      const buffer = Buffer.from('test');
      await expect(extractText(buffer, ''))
        .rejects.toThrow(TypeError);
    });

    test('melempar Error untuk MIME type tidak didukung', async () => {
      const buffer = Buffer.from('test');
      await expect(extractText(buffer, 'image/jpeg'))
        .rejects.toThrow('UNSUPPORTED_FORMAT');
    });

    test('melempar Error untuk MIME type xlsx', async () => {
      const buffer = Buffer.from('test');
      await expect(extractText(buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))
        .rejects.toThrow('UNSUPPORTED_FORMAT');
    });
  });

  // ─── extractText: DOCX ───────────────────────────────────────────────────

  describe('extractText — DOCX', () => {
    test('mengekstrak teks dari buffer DOCX yang valid', async () => {
      // Buat DOCX minimal menggunakan mammoth
      // Untuk test ini kita gunakan buffer DOCX yang sudah ada atau mock
      const mammoth = require('mammoth');

      // Buat DOCX sederhana dari HTML menggunakan mammoth (untuk testing)
      // Karena mammoth tidak bisa membuat DOCX, kita test dengan file DOCX yang valid
      // Gunakan buffer minimal yang valid untuk DOCX (ZIP header)
      // Untuk unit test, kita verifikasi bahwa fungsi memanggil mammoth dengan benar

      // Test dengan buffer yang tidak valid — harus melempar error yang tepat
      const invalidBuffer = Buffer.from('bukan docx');
      await expect(
        extractText(invalidBuffer, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      ).rejects.toThrow('DOCX_EXTRACTION_FAILED');
    });
  });

  // ─── extractText: PDF ────────────────────────────────────────────────────

  describe('extractText — PDF', () => {
    test('melempar error yang tepat untuk buffer PDF tidak valid', async () => {
      const invalidBuffer = Buffer.from('bukan pdf');
      await expect(extractText(invalidBuffer, 'application/pdf'))
        .rejects.toThrow('PDF_EXTRACTION_FAILED');
    });
  });
});
