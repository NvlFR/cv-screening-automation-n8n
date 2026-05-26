'use strict';

/**
 * Unit tests untuk src/cv-parser/email-extractor.js
 * Memvalidasi extractEmailFromText dan isValidEmail.
 * Requirements: 2.7
 */

const { extractEmailFromText, isValidEmail } = require('../../../src/cv-parser/email-extractor');

describe('email-extractor', () => {

  // ─── isValidEmail ─────────────────────────────────────────────────────────

  describe('isValidEmail', () => {
    test('mengembalikan true untuk email valid sederhana', () => {
      expect(isValidEmail('john@example.com')).toBe(true);
    });

    test('mengembalikan true untuk email dengan subdomain', () => {
      expect(isValidEmail('user@mail.example.co.id')).toBe(true);
    });

    test('mengembalikan true untuk email dengan karakter khusus di bagian lokal', () => {
      expect(isValidEmail('john.doe+tag@example.com')).toBe(true);
      expect(isValidEmail('john_doe@example.com')).toBe(true);
      expect(isValidEmail('john-doe@example.com')).toBe(true);
    });

    test('mengembalikan false untuk string tanpa @', () => {
      expect(isValidEmail('noatsign.com')).toBe(false);
    });

    test('mengembalikan false untuk string dengan @ tapi tanpa titik setelahnya', () => {
      expect(isValidEmail('@nodomain')).toBe(false);
      expect(isValidEmail('user@nodomain')).toBe(false);
    });

    test('mengembalikan false untuk @ di awal', () => {
      expect(isValidEmail('@example.com')).toBe(false);
    });

    test('mengembalikan false untuk string kosong', () => {
      expect(isValidEmail('')).toBe(false);
    });

    test('mengembalikan false untuk input non-string', () => {
      expect(isValidEmail(null)).toBe(false);
      expect(isValidEmail(undefined)).toBe(false);
      expect(isValidEmail(123)).toBe(false);
    });

    test('mengembalikan false untuk domain yang diawali titik', () => {
      expect(isValidEmail('user@.example.com')).toBe(false);
    });

    test('mengembalikan false untuk domain yang diakhiri titik', () => {
      expect(isValidEmail('user@example.')).toBe(false);
    });
  });

  // ─── extractEmailFromText ─────────────────────────────────────────────────

  describe('extractEmailFromText', () => {

    // ── Email valid dalam teks ──────────────────────────────────────────────

    test('mengekstrak email valid dari teks sederhana', () => {
      const result = extractEmailFromText('hubungi saya di john@example.com untuk info lebih lanjut');
      expect(result).toBe('john@example.com');
    });

    test('mengekstrak email valid dari teks CV lengkap', () => {
      const cvText = `
        Nama: John Doe
        Email: john.doe@company.co.id
        Telepon: +62812345678
        Skills: JavaScript, Python
      `;
      expect(extractEmailFromText(cvText)).toBe('john.doe@company.co.id');
    });

    test('mengekstrak email dengan karakter khusus di bagian lokal', () => {
      expect(extractEmailFromText('Email saya: john.doe+work@example.com')).toBe('john.doe+work@example.com');
      expect(extractEmailFromText('Kontak: john_doe@example.com')).toBe('john_doe@example.com');
    });

    test('mengekstrak email dengan subdomain', () => {
      expect(extractEmailFromText('Kirim ke user@mail.example.co.id')).toBe('user@mail.example.co.id');
    });

    // ── Tidak ada email dalam teks ──────────────────────────────────────────

    test('mengembalikan null jika tidak ada email dalam teks', () => {
      expect(extractEmailFromText('Tidak ada email di sini sama sekali')).toBeNull();
    });

    test('mengembalikan null untuk teks yang hanya berisi nama dan telepon', () => {
      const text = 'Nama: Budi Santoso\nTelepon: 08123456789\nAlamat: Jakarta';
      expect(extractEmailFromText(text)).toBeNull();
    });

    // ── Format tidak valid ──────────────────────────────────────────────────

    test('mengembalikan null untuk format "tidakvalid" (tanpa @ dan titik)', () => {
      expect(extractEmailFromText('email: tidakvalid')).toBeNull();
    });

    test('mengembalikan null untuk "@nodomain" (tanpa titik setelah @)', () => {
      expect(extractEmailFromText('email: @nodomain')).toBeNull();
    });

    test('mengembalikan null untuk "noatsign.com" (tanpa @)', () => {
      expect(extractEmailFromText('email: noatsign.com')).toBeNull();
    });

    test('mengembalikan null untuk email tanpa TLD', () => {
      expect(extractEmailFromText('kontak: user@domain')).toBeNull();
    });

    // ── Teks kosong atau null ───────────────────────────────────────────────

    test('mengembalikan null untuk teks kosong ""', () => {
      expect(extractEmailFromText('')).toBeNull();
    });

    test('mengembalikan null untuk teks hanya spasi', () => {
      expect(extractEmailFromText('   ')).toBeNull();
    });

    test('mengembalikan null untuk input null', () => {
      expect(extractEmailFromText(null)).toBeNull();
    });

    test('mengembalikan null untuk input undefined', () => {
      expect(extractEmailFromText(undefined)).toBeNull();
    });

    test('mengembalikan null untuk input angka', () => {
      expect(extractEmailFromText(123)).toBeNull();
    });

    test('mengembalikan null untuk input array', () => {
      expect(extractEmailFromText(['john@example.com'])).toBeNull();
    });

    // ── Multiple email dalam teks ───────────────────────────────────────────

    test('mengembalikan email PERTAMA jika ada beberapa email dalam teks', () => {
      const text = 'Kontak utama: first@example.com atau second@example.com';
      expect(extractEmailFromText(text)).toBe('first@example.com');
    });

    test('mengembalikan email pertama yang valid dari teks dengan banyak email', () => {
      const text = `
        Email kerja: work@company.com
        Email pribadi: personal@gmail.com
        Email cadangan: backup@yahoo.com
      `;
      expect(extractEmailFromText(text)).toBe('work@company.com');
    });

    // ── Invariant: tidak pernah mengembalikan string kosong ─────────────────

    test('TIDAK PERNAH mengembalikan string kosong ""', () => {
      const testCases = [
        '',
        '   ',
        null,
        undefined,
        'teks tanpa email',
        'email: tidakvalid',
        'email: @nodomain',
        'email: noatsign.com',
      ];

      for (const input of testCases) {
        const result = extractEmailFromText(input);
        expect(result).not.toBe('');
        // Harus null atau string valid
        if (result !== null) {
          expect(typeof result).toBe('string');
          expect(result.length).toBeGreaterThan(0);
        }
      }
    });

    test('hasil selalu berupa string valid atau null — tidak pernah string kosong', () => {
      const validInputs = [
        'john@example.com ada di sini',
        'tidak ada email',
        '',
        null,
      ];

      for (const input of validInputs) {
        const result = extractEmailFromText(input);
        // Invariant: hasil harus null atau string non-kosong yang valid
        if (result !== null) {
          expect(typeof result).toBe('string');
          expect(result.length).toBeGreaterThan(0);
          expect(result).toContain('@');
          expect(result.split('@')[1]).toContain('.');
        }
      }
    });
  });
});
