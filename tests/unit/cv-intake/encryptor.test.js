'use strict';

/**
 * Unit tests untuk src/cv-intake/encryptor.js
 * Memvalidasi enkripsi/dekripsi AES-256-CBC round-trip.
 * Requirements: 10.1
 */

// Set encryption key untuk testing (32 bytes = 64 hex chars)
const TEST_KEY = 'a'.repeat(64); // 64 hex chars = 32 bytes
process.env.ENCRYPTION_KEY = TEST_KEY;

const { encryptFile, decryptFile } = require('../../../src/cv-intake/encryptor');

describe('encryptFile', () => {
  test('menghasilkan string dengan format iv_hex:ciphertext_hex', () => {
    const buffer = Buffer.from('isi CV test');
    const result = encryptFile(buffer);

    expect(typeof result).toBe('string');
    const parts = result.split(':');
    expect(parts).toHaveLength(2);
    // IV harus 32 hex chars (16 bytes)
    expect(parts[0]).toHaveLength(32);
    // Ciphertext harus berupa hex string non-kosong
    expect(parts[1].length).toBeGreaterThan(0);
    expect(/^[0-9a-f]+$/.test(parts[0])).toBe(true);
    expect(/^[0-9a-f]+$/.test(parts[1])).toBe(true);
  });

  test('menghasilkan output berbeda untuk input yang sama (IV random)', () => {
    const buffer = Buffer.from('konten yang sama');
    const result1 = encryptFile(buffer);
    const result2 = encryptFile(buffer);
    // IV berbeda setiap kali, sehingga output berbeda
    expect(result1).not.toBe(result2);
  });

  test('melempar TypeError jika input bukan Buffer', () => {
    expect(() => encryptFile('bukan buffer')).toThrow(TypeError);
    expect(() => encryptFile(null)).toThrow(TypeError);
    expect(() => encryptFile(123)).toThrow(TypeError);
  });

  test('dapat mengenkripsi buffer kosong', () => {
    const buffer = Buffer.alloc(0);
    expect(() => encryptFile(buffer)).not.toThrow();
  });

  test('dapat mengenkripsi buffer besar (1MB)', () => {
    const buffer = Buffer.alloc(1024 * 1024, 'x');
    expect(() => encryptFile(buffer)).not.toThrow();
  });
});

describe('decryptFile', () => {
  test('round-trip: decrypt(encrypt(buffer)) === buffer asli', () => {
    const original = Buffer.from('Ini adalah isi CV kandidat yang sangat penting');
    const encrypted = encryptFile(original);
    const decrypted = decryptFile(encrypted);

    expect(Buffer.isBuffer(decrypted)).toBe(true);
    expect(decrypted.equals(original)).toBe(true);
  });

  test('round-trip untuk konten binary', () => {
    const original = Buffer.from([0x00, 0xFF, 0x42, 0xAB, 0xCD, 0xEF]);
    const encrypted = encryptFile(original);
    const decrypted = decryptFile(encrypted);
    expect(decrypted.equals(original)).toBe(true);
  });

  test('round-trip untuk buffer kosong', () => {
    const original = Buffer.alloc(0);
    const encrypted = encryptFile(original);
    const decrypted = decryptFile(encrypted);
    expect(decrypted.equals(original)).toBe(true);
  });

  test('round-trip untuk teks panjang (CV realistis)', () => {
    const cvText = 'John Doe\nEmail: john@example.com\nSkills: JavaScript, Node.js, PostgreSQL\n'.repeat(100);
    const original = Buffer.from(cvText, 'utf8');
    const encrypted = encryptFile(original);
    const decrypted = decryptFile(encrypted);
    expect(decrypted.toString('utf8')).toBe(cvText);
  });

  test('melempar TypeError jika input bukan string', () => {
    expect(() => decryptFile(Buffer.from('test'))).toThrow(TypeError);
    expect(() => decryptFile(null)).toThrow(TypeError);
    expect(() => decryptFile(123)).toThrow(TypeError);
  });

  test('melempar Error jika format tidak valid (tidak ada tanda titik dua)', () => {
    expect(() => decryptFile('tidakadakolonsamasekali')).toThrow(Error);
  });

  test('melempar Error jika IV tidak valid (panjang salah)', () => {
    expect(() => decryptFile('abcd:ciphertext')).toThrow(Error);
  });
});
