'use strict';

/**
 * Email extractor untuk teks CV.
 * Mengekstrak email pertama yang valid dari teks, atau mengembalikan null.
 *
 * Requirements: 2.7 — field email SHALL berformat valid (mengandung @ dan domain) atau null
 */

/**
 * Regex untuk mencocokkan email valid:
 * - Bagian lokal: karakter alfanumerik, titik, underscore, tanda plus, tanda hubung
 * - Karakter @
 * - Domain: karakter alfanumerik dan tanda hubung
 * - Setidaknya satu titik setelah @
 * - TLD: minimal 2 karakter
 */
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

/**
 * Memvalidasi apakah string adalah email yang valid.
 * Email valid harus mengandung @ dan setidaknya satu titik setelah @.
 *
 * @param {string} email - String yang akan divalidasi
 * @returns {boolean} true jika email valid, false jika tidak
 */
function isValidEmail(email) {
  if (typeof email !== 'string' || email.trim() === '') {
    return false;
  }

  const atIndex = email.indexOf('@');
  if (atIndex === -1) {
    return false;
  }

  // Pastikan ada bagian lokal sebelum @
  if (atIndex === 0) {
    return false;
  }

  const domainPart = email.slice(atIndex + 1);

  // Domain harus mengandung setidaknya satu titik
  if (!domainPart.includes('.')) {
    return false;
  }

  // Titik tidak boleh di awal atau akhir domain
  if (domainPart.startsWith('.') || domainPart.endsWith('.')) {
    return false;
  }

  return true;
}

/**
 * Mengekstrak email pertama yang valid dari teks CV.
 * Mengembalikan email valid atau null — TIDAK PERNAH mengembalikan string kosong "".
 *
 * Requirements: 2.7 — field email SHALL berformat valid atau null jika tidak ditemukan
 *
 * @param {string} text - Teks CV yang akan dicari emailnya
 * @returns {string|null} Email pertama yang valid, atau null jika tidak ditemukan
 *
 * @example
 * extractEmailFromText("Hubungi saya di john@example.com")
 * // => "john@example.com"
 *
 * @example
 * extractEmailFromText("Tidak ada email di sini")
 * // => null
 *
 * @example
 * extractEmailFromText(null)
 * // => null
 */
function extractEmailFromText(text) {
  // Input non-string atau kosong → kembalikan null (bukan string kosong)
  if (typeof text !== 'string' || text.trim() === '') {
    return null;
  }

  // Reset lastIndex karena regex menggunakan flag 'g'
  EMAIL_REGEX.lastIndex = 0;

  const matches = text.match(EMAIL_REGEX);

  if (!matches || matches.length === 0) {
    return null;
  }

  // Cari email pertama yang lolos validasi tambahan
  for (const candidate of matches) {
    if (isValidEmail(candidate)) {
      return candidate;
    }
  }

  // Tidak ada email valid ditemukan
  return null;
}

module.exports = { extractEmailFromText, isValidEmail };
