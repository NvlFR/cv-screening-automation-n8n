'use strict';

/**
 * Duplicate Detector untuk memeriksa kandidat duplikat sebelum menyimpan Candidate_Record.
 * Melakukan pengecekan berdasarkan email (exact match) dan kombinasi nama+telepon.
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.6
 */

/**
 * Status hasil pengecekan duplikat.
 * @typedef {'NONE' | 'DUPLICATE' | 'POSSIBLE_DUPLICATE'} DuplicateStatus
 */

/**
 * Hasil pengecekan duplikat.
 * @typedef {Object} DuplicateCheckResult
 * @property {DuplicateStatus} status - Status duplikat
 * @property {string} [existingRecordId] - ID record yang sudah ada (jika duplikat ditemukan)
 */

class DuplicateDetector {
  /**
   * Membuat instance DuplicateDetector.
   * @param {Object} dbClient - Database client dengan method `query(text, params)`
   */
  constructor(dbClient) {
    if (!dbClient || typeof dbClient.query !== 'function') {
      throw new Error('DuplicateDetector: dbClient harus memiliki method query()');
    }
    this.db = dbClient;
  }

  /**
   * Memeriksa apakah kandidat sudah ada di database.
   *
   * Urutan pengecekan:
   * 1. Jika email tersedia → cari berdasarkan email (exact match)
   *    - Ditemukan → return { status: 'DUPLICATE', existingRecordId }
   * 2. Jika email tidak tersedia atau tidak ditemukan, dan name+phone tersedia
   *    → cari berdasarkan kombinasi nama+telepon
   *    - Ditemukan → return { status: 'POSSIBLE_DUPLICATE', existingRecordId }
   * 3. Tidak ada yang cocok → return { status: 'NONE' }
   *
   * Menggunakan index `idx_candidate_email` dan `idx_candidate_name_phone`
   * untuk memastikan pengecekan selesai dalam < 2 detik (Req 3.6).
   *
   * @param {Object} params
   * @param {string|null|undefined} params.email - Email kandidat
   * @param {string|null|undefined} params.name - Nama lengkap kandidat
   * @param {string|null|undefined} params.phone - Nomor telepon kandidat
   * @returns {Promise<DuplicateCheckResult>} Hasil pengecekan duplikat
   * @throws {Error} Jika terjadi error database
   *
   * @example
   * const result = await detector.check({ email: 'john@example.com', name: 'John Doe', phone: '08123456789' });
   * // => { status: 'DUPLICATE', existingRecordId: 'uuid-...' }
   *
   * @example
   * const result = await detector.check({ email: null, name: 'John Doe', phone: '08123456789' });
   * // => { status: 'POSSIBLE_DUPLICATE', existingRecordId: 'uuid-...' }
   *
   * @example
   * const result = await detector.check({ email: 'new@example.com', name: 'New Person', phone: '08999999999' });
   * // => { status: 'NONE' }
   */
  async check({ email, name, phone }) {
    // Req 3.1: Periksa email terlebih dahulu jika tersedia
    const hasEmail = email != null && typeof email === 'string' && email.trim() !== '';

    if (hasEmail) {
      const emailResult = await this.db.query(
        'SELECT id FROM candidate_records WHERE email = $1 LIMIT 1',
        [email.trim()]
      );

      // Req 3.3: Jika ditemukan berdasarkan email → DUPLICATE
      if (emailResult.rows.length > 0) {
        return {
          status: 'DUPLICATE',
          existingRecordId: emailResult.rows[0].id,
        };
      }
    }

    // Req 3.2: Jika email tidak ditemukan, periksa kombinasi nama+telepon
    const hasName = name != null && typeof name === 'string' && name.trim() !== '';
    const hasPhone = phone != null && typeof phone === 'string' && phone.trim() !== '';

    if (hasName && hasPhone) {
      const namePhoneResult = await this.db.query(
        'SELECT id FROM candidate_records WHERE name = $1 AND phone = $2 LIMIT 1',
        [name.trim(), phone.trim()]
      );

      // Req 3.4: Jika ditemukan berdasarkan nama+telepon → POSSIBLE_DUPLICATE
      if (namePhoneResult.rows.length > 0) {
        return {
          status: 'POSSIBLE_DUPLICATE',
          existingRecordId: namePhoneResult.rows[0].id,
        };
      }
    }

    // Tidak ada duplikat ditemukan
    return { status: 'NONE' };
  }
}

module.exports = { DuplicateDetector };
