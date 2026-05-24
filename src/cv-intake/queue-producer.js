'use strict';

const redis = require('../cache/redis-client');
const config = require('../config');

/**
 * Queue Producer untuk CV_Intake_Workflow.
 * Memasukkan CVQueueJob ke Redis list `cv_processing_queue` menggunakan LPUSH.
 *
 * Requirements: 1.1, 1.6, 11.5
 */

/**
 * Memasukkan CV job ke antrian pemrosesan.
 * Menggunakan LPUSH sehingga consumer (BRPOP dari kanan) memproses secara FIFO.
 *
 * @param {Object} cvQueueJob - Job yang akan di-enqueue
 * @param {string} cvQueueJob.jobId - UUID untuk tracking
 * @param {string} cvQueueJob.fileKey - S3 key file terenkripsi
 * @param {string} cvQueueJob.filename - Nama file asli
 * @param {string} cvQueueJob.source - Sumber input: 'gmail' | 'webhook' | 'google_drive' | 'google_form'
 * @param {string} [cvQueueJob.positionId] - ID posisi pekerjaan (opsional)
 * @param {string} cvQueueJob.enqueuedAt - ISO 8601 timestamp saat di-enqueue
 * @returns {Promise<number>} Panjang queue setelah push
 * @throws {Error} Jika parameter tidak valid atau Redis gagal
 *
 * @example
 * const queueLength = await enqueueCV({
 *   jobId: '550e8400-e29b-41d4-a716-446655440000',
 *   fileKey: 'cv/encrypted/2024/01/abc123.enc',
 *   filename: 'john_doe_cv.pdf',
 *   source: 'webhook',
 *   enqueuedAt: new Date().toISOString()
 * });
 * // => 1 (panjang queue setelah push)
 */
async function enqueueCV(cvQueueJob) {
  // Validasi parameter wajib
  if (!cvQueueJob || typeof cvQueueJob !== 'object') {
    throw new Error('enqueueCV: parameter cvQueueJob wajib berupa object');
  }

  const { jobId, fileKey, filename, source, enqueuedAt } = cvQueueJob;

  if (!jobId || typeof jobId !== 'string' || jobId.trim() === '') {
    throw new Error('enqueueCV: parameter "jobId" wajib diisi');
  }

  if (!fileKey || typeof fileKey !== 'string' || fileKey.trim() === '') {
    throw new Error('enqueueCV: parameter "fileKey" wajib diisi');
  }

  if (!filename || typeof filename !== 'string' || filename.trim() === '') {
    throw new Error('enqueueCV: parameter "filename" wajib diisi');
  }

  if (!source || typeof source !== 'string' || source.trim() === '') {
    throw new Error('enqueueCV: parameter "source" wajib diisi');
  }

  if (!enqueuedAt || typeof enqueuedAt !== 'string' || enqueuedAt.trim() === '') {
    throw new Error('enqueueCV: parameter "enqueuedAt" wajib diisi');
  }

  const queueKey = config.queue.cvProcessingKey; // 'cv_processing_queue'
  const payload = JSON.stringify(cvQueueJob);

  try {
    const queueLength = await redis.lpush(queueKey, payload);
    return queueLength;
  } catch (err) {
    console.error('[QueueProducer] Gagal enqueue CV job:', {
      jobId,
      filename,
      source,
      error: err.message,
    });
    throw err;
  }
}

/**
 * Mengecek panjang antrian pemrosesan CV saat ini.
 * Digunakan oleh rate limiter untuk menentukan apakah queue sudah penuh.
 *
 * @returns {Promise<number>} Jumlah item dalam queue
 * @throws {Error} Jika Redis gagal
 *
 * @example
 * const length = await getQueueLength();
 * // => 42
 */
async function getQueueLength() {
  const queueKey = config.queue.cvProcessingKey;

  try {
    return await redis.llen(queueKey);
  } catch (err) {
    console.error('[QueueProducer] Gagal mengecek panjang queue:', err.message);
    throw err;
  }
}

module.exports = { enqueueCV, getQueueLength };
