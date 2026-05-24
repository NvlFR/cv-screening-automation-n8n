'use strict';

const config = require('../config');

/**
 * Validator untuk file CV yang masuk ke CV_Intake_Workflow.
 * Memvalidasi ekstensi dan ukuran file sebelum diproses lebih lanjut.
 * Requirements: 1.2, 1.3, 1.5, 10.6
 */

/**
 * Memvalidasi file CV berdasarkan ekstensi dan ukuran.
 *
 * @param {Object} params
 * @param {string} params.extension - Ekstensi file tanpa titik, case-insensitive (contoh: 'pdf', 'PDF', 'docx')
 * @param {number} params.sizeBytes - Ukuran file dalam bytes
 * @returns {{ valid: boolean, errorCode?: string }} Hasil validasi
 *
 * @example
 * validateFile({ extension: 'pdf', sizeBytes: 1024 * 1024 })
 * // => { valid: true }
 *
 * validateFile({ extension: 'jpg', sizeBytes: 1024 })
 * // => { valid: false, errorCode: 'INVALID_FORMAT' }
 *
 * validateFile({ extension: 'pdf', sizeBytes: 20 * 1024 * 1024 })
 * // => { valid: false, errorCode: 'FILE_TOO_LARGE' }
 */
function validateFile({ extension, sizeBytes }) {
  // Sanitasi input — pastikan extension adalah string
  if (typeof extension !== 'string' || extension.trim() === '') {
    return { valid: false, errorCode: 'INVALID_FORMAT' };
  }

  // Sanitasi input — pastikan sizeBytes adalah angka non-negatif
  if (typeof sizeBytes !== 'number' || !Number.isFinite(sizeBytes) || sizeBytes < 0) {
    return { valid: false, errorCode: 'FILE_TOO_LARGE' };
  }

  const normalizedExt = extension.trim().toLowerCase();
  const allowedExtensions = config.app.allowedExtensions; // ['pdf', 'docx', 'txt']
  const maxSizeBytes = config.app.maxFileSizeBytes;       // 10 * 1024 * 1024

  // Cek ekstensi terlebih dahulu (Req 1.2, 1.3)
  if (!allowedExtensions.includes(normalizedExt)) {
    return { valid: false, errorCode: 'INVALID_FORMAT' };
  }

  // Cek ukuran file (Req 1.5)
  if (sizeBytes > maxSizeBytes) {
    return { valid: false, errorCode: 'FILE_TOO_LARGE' };
  }

  return { valid: true };
}

module.exports = { validateFile };
