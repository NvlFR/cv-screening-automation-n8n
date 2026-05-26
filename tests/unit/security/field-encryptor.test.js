'use strict';

/**
 * Unit Test: Field Encryptor
 * Requirements: 10.1, 10.2, 10.6
 *
 * Tests:
 * - Round-trip: encryptField(decryptField(x)) = x
 * - Different encryptions produce different ciphertexts (random IV)
 * - Invalid format detection
 */

const { encryptField, decryptField, isEncrypted } = require('../../../src/security/field-encryptor');

// Mock config
jest.mock('../../../src/config', () => ({
  s3: {
    encryptionKey: 'test-encryption-key-32-chars-here', // Will be hashed to 32 bytes
  },
}));

describe('Field Encryptor', () => {
  describe('encryptField', () => {
    it('mengembalikan format iv_hex:ciphertext_hex', () => {
      const result = encryptField('test@example.com');
      expect(result).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
      const parts = result.split(':');
      expect(parts[0].length).toBe(32); // IV = 16 bytes = 32 hex chars
      expect(parts[1].length).toBeGreaterThan(0);
    });

    it('menghasilkan ciphertext berbeda untuk input yang sama (random IV)', () => {
      const plain = 'john@example.com';
      const result1 = encryptField(plain);
      const result2 = encryptField(plain);
      expect(result1).not.toBe(result2);
    });

    it('mengenkripsi null dan undefined dengan graceful', () => {
      expect(encryptField(null)).toBeNull();
      expect(encryptField(undefined)).toBeNull();
    });

    it('mengonversi non-string ke string sebelum encrypt', () => {
      const result = encryptField(12345);
      expect(result).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
    });
  });

  describe('decryptField', () => {
    it('decrypt menghasilkan nilai asli untuk input terenkripsi', () => {
      const plain = 'secret@example.com';
      const encrypted = encryptField(plain);
      const decrypted = decryptField(encrypted);
      expect(decrypted).toBe(plain);
    });

    it('round-trip untuk berbagai input', () => {
      const inputs = [
        'john@example.com',
        '+6281234567890',
        'Very long text with special chars: !@#$%^&*()',
        'Unicode: 日本語 테스트',
        'Numbers: 123456789',
        '',
      ];

      for (const input of inputs) {
        const encrypted = encryptField(input);
        const decrypted = decryptField(encrypted);
        expect(decrypted).toBe(input);
      }
    });

    it('decrypt null dan undefined dengan graceful', () => {
      expect(decryptField(null)).toBeNull();
      expect(decryptField(undefined)).toBeNull();
    });

    it('melempar error untuk format tidak valid', () => {
      expect(() => decryptField('invalid-format')).toThrow('Invalid encrypted value format');
      expect(() => decryptField('not:valid:format:extra')).toThrow('Invalid encrypted value format');
    });

    it('melempar error untuk IV panjang yang tidak valid', () => {
      expect(() => decryptField('tooshort:' + 'a'.repeat(32))).toThrow('Invalid IV length');
    });
  });

  describe('isEncrypted', () => {
    it('mengembalikan true untuk format terenkripsi', () => {
      const encrypted = encryptField('test');
      expect(isEncrypted(encrypted)).toBe(true);
    });

    it('mengembalikan false untuk plaintext', () => {
      expect(isEncrypted('plain@example.com')).toBe(false);
      expect(isEncrypted('simple text')).toBe(false);
    });

    it('mengembalikan false untuk non-string', () => {
      expect(isEncrypted(null)).toBe(false);
      expect(isEncrypted(123)).toBe(false);
      expect(isEncrypted({})).toBe(false);
    });
  });

  describe('Security Properties', () => {
    it('tidak ada information leakage dalam ciphertext', () => {
      const plain1 = 'test1@example.com';
      const plain2 = 'test2@example.com';

      const enc1 = encryptField(plain1);
      const enc2 = encryptField(plain2);

      // Ciphertext tidak mengandung plaintext
      expect(enc1).not.toContain(plain1);
      expect(enc2).not.toContain(plain2);

      // IV berbeda untuk setiap encryption
      const [, ct1] = enc1.split(':');
      const [, ct2] = enc2.split(':');
      expect(ct1).not.toBe(ct2);
    });

    it('konsisten: kunci sama menghasilkan plaintext sama', () => {
      const plain = 'consistent@example.com';
      const enc1 = encryptField(plain);
      const enc2 = encryptField(plain);

      // Kedua ciphertext harus bisa di-decrypt ke plaintext yang sama
      expect(decryptField(enc1)).toBe(plain);
      expect(decryptField(enc2)).toBe(plain);
    });
  });
});