'use strict';

/**
 * Field Encryptor — AES-256-CBC encryption untuk field sensitif (email, phone).
 * Requirements: 10.1, 10.2, 10.6
 */

const crypto = require('crypto');
const config = require('../config');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // 128 bits

/**
 * Mendapatkan encryption key dari environment.
 * Key harus 32 bytes (256-bit) atau 64-char hex string.
 * @returns {Buffer}
 */
function getKey() {
  const rawKey = config.s3.encryptionKey || process.env.FILE_ENCRYPTION_KEY || '';

  if (!rawKey) {
    throw new Error('FILE_ENCRYPTION_KEY tidak dikonfigurasi');
  }

  // Jika hex string (64 char), decode
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, 'hex');
  }

  // Jika plain text, hash ke 32 bytes
  return crypto.createHash('sha256').update(rawKey).digest();
}

/**
 * Mengenkripsi value field sensitif.
 *
 * @param {string} value - Value yang akan dienkripsi
 * @returns {string} Format: iv_hex:ciphertext_hex (hex encoded)
 *
 * @example
 * encryptField('john@example.com')
 * // => 'a1b2c3d4e5f6...:1a2b3c4d5e6f...'
 */
function encryptField(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    value = String(value);
  }

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Mendekripsi value field sensitif.
 *
 * @param {string} encryptedValue - Value dalam format iv_hex:ciphertext_hex
 * @returns {string|null} Value asli, atau null jika decrypt gagal
 *
 * @example
 * decryptField('a1b2c3d4e5f6...:1a2b3c4d5e6f...')
 * // => 'john@example.com'
 */
function decryptField(encryptedValue) {
  if (encryptedValue === null || encryptedValue === undefined) {
    return null;
  }

  if (typeof encryptedValue !== 'string') {
    return null;
  }

  const parts = encryptedValue.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted value format: expected iv_hex:ciphertext_hex');
  }

  const [ivHex, ciphertextHex] = parts;

  try {
    const iv = Buffer.from(ivHex, 'hex');
    const key = getKey();

    if (iv.length !== IV_LENGTH) {
      throw new Error('Invalid IV length');
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    throw new Error(`Decryption failed: ${err.message}`);
  }
}

/**
 * Memeriksa apakah value sudah terenkripsi (format iv_hex:ciphertext_hex).
 * @param {string} value
 * @returns {boolean}
 */
function isEncrypted(value) {
  if (typeof value !== 'string') return false;
  const parts = value.split(':');
  if (parts.length !== 2) return false;

  const [ivHex, ciphertextHex] = parts;
  // IV harus 32 hex chars (16 bytes), ciphertext harus minimal 1 char hex
  return /^[0-9a-fA-F]{32}$/.test(ivHex) && /^[0-9a-fA-F]+$/.test(ciphertextHex);
}

module.exports = {
  encryptField,
  decryptField,
  isEncrypted,
};