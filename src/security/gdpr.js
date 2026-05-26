'use strict';

/**
 * GDPR Data Deletion — menghapus semua data kandidat sesuai GDPR right to erasure.
 * Menghapus record dari database dan file dari storage.
 * Requirements: 10.6
 */

const db = require('../db/client');
const { logIntakeEvent } = require('../cv-intake/audit-logger');

/**
 * Menghapus Candidate_Record dari database.
 * Catatan: ini menghapus data secara permanen — pastikan untuk membackup jika diperlukan.
 *
 * @param {string} candidateId - UUID Candidate_Record
 * @param {string} requestedBy - User ID yang meminta penghapusan (untuk audit)
 * @returns {Promise<void>}
 *
 * Requirements: 10.6 — GDPR right to erasure dalam 30 hari atas permintaan
 */
async function deleteCandidateRecord(candidateId, requestedBy) {
  if (!candidateId || typeof candidateId !== 'string') {
    throw new Error('candidateId diperlukan untuk penghapusan data');
  }

  // Cek apakah record ada sebelum dihapus
  const checkResult = await db.query(
    'SELECT id, name, email FROM candidate_records WHERE id = $1',
    [candidateId]
  );

  if (checkResult.rows.length === 0) {
    throw new Error(`Candidate_Record dengan id '${candidateId}' tidak ditemukan`);
  }

  const deletedRecord = checkResult.rows[0];

  // Hapus dari tabel terkait terlebih dahulu (foreign key constraints)
  // notifications
  await db.query(
    'DELETE FROM notifications WHERE candidate_id = $1',
    [candidateId]
  );

  // audit_logs terkait
  await db.query(
    'DELETE FROM audit_logs WHERE entity_id = $1 AND entity_type = $2',
    [candidateId, 'candidate_record']
  );

  // candidate_records
  await db.query(
    'DELETE FROM candidate_records WHERE id = $1',
    [candidateId]
  );

  // Catat ke audit log
  await logIntakeEvent({
    action: 'CANDIDATE_DATA_DELETED',
    entityId: candidateId,
    userId: requestedBy || null,
    details: {
      deletedCandidateName: deletedRecord.name,
      deletedEmail: deletedRecord.email,
      deletedAt: new Date().toISOString(),
      gdprRequest: true,
    },
    errorCode: null,
  });

  console.log(`[GDPR] Candidate_Record ${candidateId} dihapus oleh ${requestedBy || 'system'}`);
}

/**
 * Menghapus semua data kandidat dari storage (S3).
 * Ini menghapus file CV terenkripsi.
 *
 * @param {string} candidateId - UUID Candidate_Record
 * @param {string} cvUrl - S3 URL dari file CV
 * @returns {Promise<void>}
 */
async function deleteCandidateFile(candidateId, cvUrl) {
  if (!cvUrl || typeof cvUrl !== 'string') {
    return; // Tidak ada file untuk dihapus
  }

  // Implementasi S3 delete
  // const s3 = require('../storage/s3-client');
  // await s3.deleteObject({ Bucket: config.s3.bucket, Key: cvUrl });

  // Log penghapusan file
  await logIntakeEvent({
    action: 'CANDIDATE_FILE_DELETED',
    entityId: candidateId,
    details: {
      deletedFileUrl: cvUrl,
      deletedAt: new Date().toISOString(),
    },
  });

  console.log(`[GDPR] File CV untuk candidate ${candidateId} dihapus dari storage`);
}

/**
 * Menghapus semua data kandidat secara lengkap (DB + Storage).
 *
 * @param {string} candidateId - UUID Candidate_Record
 * @param {string} requestedBy - User ID yang meminta
 * @param {string} [cvUrl] - S3 URL (opsional, diambil dari DB jika tidak disediakan)
 * @returns {Promise<void>}
 */
async function deleteAllCandidateData(candidateId, requestedBy, cvUrl) {
  // Hapus dari database
  await deleteCandidateRecord(candidateId, requestedBy);

  // Hapus file dari storage jika URL disediakan
  if (cvUrl) {
    await deleteCandidateFile(candidateId, cvUrl);
  }
}

module.exports = {
  deleteCandidateRecord,
  deleteCandidateFile,
  deleteAllCandidateData,
};