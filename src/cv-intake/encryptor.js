'use strict';

const crypto = require('crypto');

/**
 * Enkripsi dan dekripsi file CV menggunakan AES-256-CBC.
 * IV (Initialization Vector) di-generate secara random untuk setiap enkripsi
 * dan disimpan bersama ciphertext dalam format: <iv_hex>:<encrypted_hex>
 *
 * Requirements: 10.1 — File CV dienkripsi dengan AES-256 sebelum disimpan ke storage
 */

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;   // AES block size = 16 bytes
const KEY_LENGTH = 32;  // AES-256 = 32 bytes key

/**
 * Mendapatkan encryption key dari environment variable.
 * Key harus berupa hex string 64 karakter (32 bytes) atau string 32 karakter.
 *
 * @returns {Buffer} 32-byte encryption key
 * @throws {Error} Jika ENCRYPTION_KEY tidak dikonfigurasi atau panjangnya salah
 */
function getEncryptionKey() {
  const rawKey = process.env.ENCRYPTION_KEY || process.env.FILE_ENCRYPTION_KEY;

  if (!rawKey) {
    throw new Error('ENCRYPTION_KEY environment variable tidak dikonfigurasi');
  }

  // Jika key berupa hex string (64 karakter = 32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, 'hex');
  }

  // Jika key berupa string biasa, gunakan langsung (harus tepat 32 karakter)
  const keyBuffer = Buffer.from(rawKey, 'utf8');
  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(
      `ENCRYPTION_KEY harus 32 bytes (256-bit). Panjang saat ini: ${keyBuffer.length} bytes. ` +
      'Gunakan hex string 64 karakter atau string tepat 32 karakter.'
    );
  }

  return keyBuffer;
}

/**
 * Mengenkripsi buffer file menggunakan AES-256-CBC.
 * Menghasilkan string format: <iv_hex>:<ciphertext_hex>
 *
 * @param {Buffer} buffer - Raw file content yang akan dienkripsi
 * @returns {string} Encrypted string dalam format "iv_hex:ciphertext_hex"
 * @throws {Error} Jika buffer bukan Buffer atau enkripsi gagal
 *
 * @example
 * const encrypted = encryptFile(Buffer.from('isi CV...'));
 * // => "a1b2c3d4...:e5f6g7h8..."
 */
function encryptFile(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('encryptFile: parameter harus berupa Buffer');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);

  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Mendekripsi string terenkripsi kembali ke Buffer asli.
 *
 * @param {string} encryptedString - String dalam format "iv_hex:ciphertext_hex"
 * @returns {Buffer} Decrypted file content
 * @throws {Error} Jika format tidak valid atau dekripsi gagal
 *
 * @example
 * const original = decryptFile(encryptedString);
 * // => Buffer berisi konten file asli
 */
function decryptFile(encryptedString) {
  if (typeof encryptedString !== 'string') {
    throw new TypeError('decryptFile: parameter harus berupa string');
  }

  const parts = encryptedString.split(':');
  if (parts.length !== 2) {
    throw new Error('decryptFile: format tidak valid, harus "iv_hex:ciphertext_hex"');
  }

  const [ivHex, ciphertextHex] = parts;

  if (ivHex.length !== IV_LENGTH * 2) {
    throw new Error(`decryptFile: IV tidak valid, harus ${IV_LENGTH * 2} karakter hex`);
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return decrypted;
}

module.exports = { encryptFile, decryptFile };
