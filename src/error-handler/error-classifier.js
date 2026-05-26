'use strict';

/**
 * Error Classifier — mengklasifikasikan error berdasarkan jenis dan menentukan
 * apakah error tersebut dapat di-retry dan apakah perlu notifikasi.
 *
 * Requirements: 12.1, 12.2, 12.4
 */

/**
 * Kategori error.
 * @typedef {'RETRYABLE' | 'NON_RETRYABLE' | 'FATAL'} ErrorCategory
 */

/**
 * Hasil klasifikasi error.
 * @typedef {Object} ErrorClassification
 * @property {string} errorCode - Kode error pendek
 * @property {boolean} isRetryable - Apakah operasi boleh di-retry
 * @property {boolean} shouldNotify - Apakah perlu mengirim notifikasi ke admin
 */

/**
 * Peta error code ke klasifikasi.
 * Requirements: Tabel klasifikasi error di design.md
 */
const ERROR_CLASSIFICATIONS = {
  // Format & Validation errors — non-retryable, no notification
  INVALID_FORMAT: { errorCode: 'INVALID_FORMAT', isRetryable: false, shouldNotify: false },
  FILE_TOO_LARGE: { errorCode: 'FILE_TOO_LARGE', isRetryable: false, shouldNotify: false },
  INVALID_DIMENSION_SCORE: { errorCode: 'INVALID_DIMENSION_SCORE', isRetryable: false, shouldNotify: true },
  ENCRYPTION_FAILED: { errorCode: 'ENCRYPTION_FAILED', isRetryable: false, shouldNotify: true },

  // Processing errors — non-retryable, notify for investigation
  PARSING_INCOMPLETE: { errorCode: 'PARSING_INCOMPLETE', isRetryable: false, shouldNotify: true },
  PARSING_FAILED: { errorCode: 'PARSING_FAILED', isRetryable: false, shouldNotify: true },
  NO_JD_AVAILABLE: { errorCode: 'NO_JD_AVAILABLE', isRetryable: false, shouldNotify: false },

  // API/Network errors — retryable
  OPENAI_ERROR: { errorCode: 'OPENAI_ERROR', isRetryable: true, shouldNotify: true },
  DB_WRITE_FAILED: { errorCode: 'DB_WRITE_FAILED', isRetryable: true, shouldNotify: true },
  REDIS_ERROR: { errorCode: 'REDIS_ERROR', isRetryable: true, shouldNotify: true },
  S3_ERROR: { errorCode: 'S3_ERROR', isRetryable: true, shouldNotify: true },
  NETWORK_ERROR: { errorCode: 'NETWORK_ERROR', isRetryable: true, shouldNotify: true },

  // Notification errors — non-retryable but notify
  NOTIFICATION_FAILED: { errorCode: 'NOTIFICATION_FAILED', isRetryable: false, shouldNotify: true },
  GENERATION_FAILED: { errorCode: 'GENERATION_FAILED', isRetryable: false, shouldNotify: true },

  // Queue errors — non-retryable
  QUEUE_FULL: { errorCode: 'QUEUE_FULL', isRetryable: false, shouldNotify: false },
  QUEUE_TIMEOUT: { errorCode: 'QUEUE_TIMEOUT', isRetryable: false, shouldNotify: false },

  // Security errors — non-retryable, always notify
  AUTH_FAILED: { errorCode: 'AUTH_FAILED', isRetryable: false, shouldNotify: true },
  PERMISSION_DENIED: { errorCode: 'PERMISSION_DENIED', isRetryable: false, shouldNotify: true },
  INPUT_INJECTION: { errorCode: 'INPUT_INJECTION', isRetryable: false, shouldNotify: true },
};

/**
 * Mengklasifikasikan error berdasarkan pesan atau kode error.
 *
 * @param {Error|string} error - Error object atau error message
 * @returns {ErrorClassification} Hasil klasifikasi
 *
 * @example
 * classifyError(new Error('INVALID_DIMENSION_SCORE: skillMatch = -1'))
 * // => { errorCode: 'INVALID_DIMENSION_SCORE', isRetryable: false, shouldNotify: true }
 *
 * @example
 * classifyError(new Error('OpenAI API timeout'))
 * // => { errorCode: 'OPENAI_ERROR', isRetryable: true, shouldNotify: true }
 */
function classifyError(error) {
  const errorMessage = typeof error === 'string' ? error : error.message || '';

  // Cek apakah error message mengandung kode error yang dikenal
  for (const [code, classification] of Object.entries(ERROR_CLASSIFICATIONS)) {
    if (errorMessage.includes(code)) {
      return { ...classification };
    }
  }

  // Fallback: klasifikasi berdasarkan pola error message
  const messageLower = errorMessage.toLowerCase();

  // Network/API errors
  if (messageLower.includes('timeout') || messageLower.includes('etimedout') || messageLower.includes('enotfound')) {
    return { errorCode: 'NETWORK_ERROR', isRetryable: true, shouldNotify: true };
  }

  // OpenAI specific errors
  if (messageLower.includes('openai') || messageLower.includes('ai_response') || messageLower.includes('gpt')) {
    return { errorCode: 'OPENAI_ERROR', isRetryable: true, shouldNotify: true };
  }

  // Database errors
  if (messageLower.includes('db_') || messageLower.includes('database') || messageLower.includes('postgres') || messageLower.includes('connection')) {
    return { errorCode: 'DB_WRITE_FAILED', isRetryable: true, shouldNotify: true };
  }

  // Redis errors
  if (messageLower.includes('redis') || messageLower.includes('brpop') || messageLower.includes('lpop') || messageLower.includes('lpush')) {
    return { errorCode: 'REDIS_ERROR', isRetryable: true, shouldNotify: true };
  }

  // S3/Storage errors
  if (messageLower.includes('s3') || messageLower.includes('storage') || messageLower.includes('bucket') || messageLower.includes('upload')) {
    return { errorCode: 'S3_ERROR', isRetryable: true, shouldNotify: true };
  }

  // Validation errors (input masalah)
  if (messageLower.includes('invalid') || messageLower.includes('validation') || messageLower.includes('typeerror')) {
    return { errorCode: 'INVALID_FORMAT', isRetryable: false, shouldNotify: false };
  }

  // Unknown errors — treat as non-retryable but notify for investigation
  return {
    errorCode: 'UNKNOWN_ERROR',
    isRetryable: false,
    shouldNotify: true,
  };
}

/**
 * Mendapatkan error code dari error object atau string.
 *
 * @param {Error|string} error
 * @returns {string} Error code
 */
function getErrorCode(error) {
  const { errorCode } = classifyError(error);
  return errorCode;
}

module.exports = {
  classifyError,
  getErrorCode,
  ERROR_CLASSIFICATIONS,
};
