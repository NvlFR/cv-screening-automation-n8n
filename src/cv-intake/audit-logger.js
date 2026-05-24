'use strict';

const db = require('../db/client');

/**
 * Audit logger untuk CV_Intake_Workflow.
 * Mencatat setiap event intake CV ke tabel audit_logs di PostgreSQL.
 *
 * Requirements: 1.3, 1.5, 10.4 — Setiap operasi dicatat ke Audit_Log
 */

/**
 * Mencatat event intake CV ke tabel audit_logs.
 *
 * @param {Object} params
 * @param {string} params.action - Nama aksi yang dilakukan (contoh: 'CV_RECEIVED', 'CV_REJECTED', 'CV_ENQUEUED')
 * @param {string|null} [params.entityId] - UUID Candidate_Record terkait (nullable untuk event sebelum record dibuat)
 * @param {string|null} [params.errorCode] - Kode error jika ada (contoh: 'INVALID_FORMAT', 'FILE_TOO_LARGE')
 * @param {Object|null} [params.details] - Detail tambahan dalam format JSON (contoh: { filename, source, sizeBytes })
 * @param {string|null} [params.userId] - ID user yang melakukan aksi (null untuk system actions)
 * @param {string|null} [params.ipAddress] - IP address sumber request (nullable)
 * @returns {Promise<{ id: string, created_at: string }>} Record audit log yang baru dibuat
 * @throws {Error} Jika query database gagal
 *
 * @example
 * await logIntakeEvent({
 *   action: 'CV_REJECTED',
 *   entityId: null,
 *   errorCode: 'INVALID_FORMAT',
 *   details: { filename: 'photo.jpg', source: 'webhook' }
 * });
 */
async function logIntakeEvent({ action, entityId = null, errorCode = null, details = null, userId = null, ipAddress = null }) {
  // Validasi input wajib
  if (!action || typeof action !== 'string' || action.trim() === '') {
    throw new Error('logIntakeEvent: parameter "action" wajib diisi dan harus berupa string');
  }

  // Sanitasi action — hanya huruf besar, angka, dan underscore
  const sanitizedAction = action.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');

  const sql = `
    INSERT INTO audit_logs (
      user_id,
      action,
      entity_type,
      entity_id,
      details,
      error_code,
      ip_address,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7::inet, NOW())
    RETURNING id, created_at
  `;

  const params = [
    userId || null,
    sanitizedAction,
    'candidate_record',
    entityId || null,
    details ? JSON.stringify(details) : null,
    errorCode || null,
    ipAddress || null,
  ];

  try {
    const result = await db.query(sql, params);
    return result.rows[0];
  } catch (err) {
    // Log ke console agar tidak kehilangan informasi audit meskipun DB gagal
    console.error('[AuditLogger] Gagal menulis audit log:', {
      action: sanitizedAction,
      entityId,
      errorCode,
      error: err.message,
    });
    throw err;
  }
}

/**
 * Shortcut untuk mencatat event penolakan file.
 *
 * @param {Object} params
 * @param {string} params.errorCode - 'INVALID_FORMAT' atau 'FILE_TOO_LARGE'
 * @param {Object} params.details - Detail file yang ditolak
 * @param {string|null} [params.ipAddress] - IP address sumber request
 * @returns {Promise<{ id: string, created_at: string }>}
 */
async function logFileRejected({ errorCode, details, ipAddress = null }) {
  return logIntakeEvent({
    action: 'CV_REJECTED',
    entityId: null,
    errorCode,
    details,
    ipAddress,
  });
}

/**
 * Shortcut untuk mencatat event penerimaan file yang valid.
 *
 * @param {Object} params
 * @param {string|null} [params.entityId] - UUID job/queue entry
 * @param {Object} params.details - Detail file yang diterima
 * @param {string|null} [params.ipAddress] - IP address sumber request
 * @returns {Promise<{ id: string, created_at: string }>}
 */
async function logFileReceived({ entityId = null, details, ipAddress = null }) {
  return logIntakeEvent({
    action: 'CV_RECEIVED',
    entityId,
    details,
    ipAddress,
  });
}

/**
 * Shortcut untuk mencatat event file berhasil masuk ke queue.
 *
 * @param {Object} params
 * @param {string} params.entityId - UUID queue job
 * @param {Object} params.details - Detail queue job
 * @returns {Promise<{ id: string, created_at: string }>}
 */
async function logFileEnqueued({ entityId, details }) {
  return logIntakeEvent({
    action: 'CV_ENQUEUED',
    entityId,
    details,
  });
}

module.exports = {
  logIntakeEvent,
  logFileRejected,
  logFileReceived,
  logFileEnqueued,
};
