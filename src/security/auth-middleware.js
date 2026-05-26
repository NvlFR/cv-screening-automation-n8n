'use strict';

/**
 * Auth Middleware — memvalidasi akses ke Candidate_Record berdasarkan RBAC.
 * Requirements: 10.3, 10.4
 */

const { checkPermission } = require('./rbac');
const { encryptField, decryptField } = require('./field-encryptor');

/**
 * Middleware function untuk memvalidasi akses ke candidate record.
 *
 * @param {Object} context - Context yang berisi user info
 * @param {string} context.userId - User ID
 * @param {string} context.role - User role
 * @param {string} action - Action yang akan dilakukan
 * @returns {{ allowed: boolean, reason?: string }}
 *
 * @example
 * const result = validateAccess({ userId: 'user-123', role: 'recruiter' }, 'read');
 * if (!result.allowed) throw new Error(result.reason);
 */
function validateAccess(context, action) {
  const { userId, role } = context || {};

  if (!userId || !role) {
    return {
      allowed: false,
      reason: 'User ID dan role diperlukan untuk authorization',
    };
  }

  const hasPermission = checkPermission(userId, role, action);

  if (!hasPermission) {
    return {
      allowed: false,
      reason: `Role '${role}' tidak memiliki permission untuk action '${action}'`,
    };
  }

  return { allowed: true };
}

/**
 * Middleware untuk decrypt field sensitif saat read.
 * Mengembalikan candidate record dengan field yang di-decrypt.
 *
 * @param {Object} candidateRecord - Raw record dari database
 * @param {string} role - User role (untuk audit)
 * @returns {Object} Record dengan field ter-decrypt
 */
function decryptCandidateFields(candidateRecord, role) {
  if (!candidateRecord) return null;

  // Recruiter dan hiring_manager dapat melihat data ter-decrypt
  // Admin dapat melihat semua
  const allowedRoles = ['recruiter', 'hiring_manager', 'admin'];
  const normalizedRole = (role || '').toLowerCase();

  if (!allowedRoles.includes(normalizedRole)) {
    // Role tidak dikenal — return record tanpa decrypt
    return {
      ...candidateRecord,
      email: '[ENCRYPTED]',
      phone: '[ENCRYPTED]',
    };
  }

  const decrypted = { ...candidateRecord };

  // Decrypt email jika terenkripsi
  if (candidateRecord.email && candidateRecord.email.includes(':')) {
    try {
      decrypted.email = decryptField(candidateRecord.email);
    } catch {
      // Gagal decrypt — pertahankan encrypted atau null
      decrypted.email = null;
    }
  }

  // Decrypt phone jika terenkripsi
  if (candidateRecord.phone && candidateRecord.phone.includes(':')) {
    try {
      decrypted.phone = decryptField(candidateRecord.phone);
    } catch {
      decrypted.phone = null;
    }
  }

  return decrypted;
}

/**
 * Middleware untuk encrypt field sensitif sebelum simpan.
 *
 * @param {Object} candidateData - Data kandidat sebelum simpan
 * @returns {Object} Data dengan field ter-encrypt
 */
function encryptCandidateFields(candidateData) {
  if (!candidateData) return {};

  const encrypted = { ...candidateData };

  // Encrypt email jika ada dan belum terenkripsi
  if (candidateData.email && !candidateData.email.includes(':')) {
    encrypted.email = encryptField(candidateData.email);
  }

  // Encrypt phone jika ada dan belum terenkripsi
  if (candidateData.phone && !candidateData.phone.includes(':')) {
    encrypted.phone = encryptField(candidateData.phone);
  }

  return encrypted;
}

module.exports = {
  validateAccess,
  decryptCandidateFields,
  encryptCandidateFields,
};