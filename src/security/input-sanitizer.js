'use strict';

/**
 * Input Sanitizer — mencegah injection attack pada semua input.
 * Requirements: 10.5
 */

/**
 * Characters yang harus dihapus untuk mencegah injection.
 * Termasuk: SQL special chars, command injection chars, template injection chars.
 */
const DANGEROUS_CHARS_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const SQL_COMMENT_REGEX = /(--|\/\*|\*\/)/g;
const COMMAND_INJECTION_REGEX = /[;&|`$<>{}]/g;
const TEMPLATE_INJECTION_REGEX = /[{}]/g;

/**
 * Patterns yang harus diganti dengan placeholder.
 */
const SQL_INJECTION_PATTERNS = [
  // UNION-based
  { pattern: /union\s+select/gi, placeholder: 'UNION SELECT' },
  // DROP/DELETE
  { pattern: /\b(drop|delete|truncate|alter)\s+(table|database)/gi, placeholder: '[SANITIZED SQL]' },
  // INSERT/UPDATE
  { pattern: /\b(insert|update)\s+into/gi, placeholder: '[SANITIZED SQL]' },
  // Exec
  { pattern: /\bexec(ute)?\s*\(/gi, placeholder: '[SANITIZED SQL]' },
  // OR 1=1
  { pattern: /'\s+or\s+'1'\s*=\s*'1/gi, placeholder: '[SANITIZED]' },
  { pattern: /'\s+or\s+1\s*=\s*1/gi, placeholder: '[SANITIZED]' },
];

/**
 * Mensanitasi input untuk mencegah SQL injection.
 *
 * @param {string} input - Input string yang akan disanitasi
 * @returns {string} Input yang sudah disanitasi
 *
 * @example
 * sanitizeSQLInput("'; DROP TABLE candidates; --")
 * // => "[SANITIZED SQL]"
 */
function sanitizeSQLInput(input) {
  if (typeof input !== 'string') {
    return '';
  }

  let sanitized = input;

  // Apply pattern-based sanitization
  for (const { pattern, placeholder } of SQL_INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, placeholder);
  }

  // Remove control characters
  sanitized = sanitized.replace(DANGEROUS_CHARS_REGEX, '');

  // Remove SQL comment markers
  sanitized = sanitized.replace(SQL_COMMENT_REGEX, ' ');

  return sanitized.trim();
}

/**
 * Mensanitasi input umum untuk mencegah command injection.
 *
 * @param {string} input - Input string
 * @returns {string} Input yang sudah disanitasi
 */
function sanitizeCommandInput(input) {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .replace(COMMAND_INJECTION_REGEX, '')
    .replace(DANGEROUS_CHARS_REGEX, '')
    .trim();
}

/**
 * Mensanitasi input untuk filepath/filename.
 * Menghapus path traversal characters.
 *
 * @param {string} filename - Nama file
 * @returns {string} Nama file yang aman
 */
function sanitizeFilename(filename) {
  if (typeof filename !== 'string') {
    return '';
  }

  // Hapus path traversal
  let safe = filename.replace(/\.\./g, '');
  // Hapus leading/trailing slashes
  safe = safe.replace(/^[\/\\]+|[\/\\]+$/g, '');
  // Ganti spasi dengan underscore
  safe = safe.replace(/\s+/g, '_');
  // Hapus dangerous characters
  safe = safe.replace(/[<>:"|?*]/g, '');

  return safe || 'unnamed';
}

/**
 * Mensanitasi JSON input dari webhook/API request.
 *
 * @param {Object} input - Object input
 * @returns {Object} Object dengan field yang sudah disanitasi
 */
function sanitizeJSONInput(input) {
  if (typeof input !== 'object' || input === null) {
    return {};
  }

  const sanitized = {};

  for (const [key, value] of Object.entries(input)) {
    // Sanitasi key (hanya alphanumeric, underscore, hyphen)
    const safeKey = String(key).replace(/[^a-zA-Z0-9_-]/g, '');

    if (safeKey === '') continue;

    if (typeof value === 'string') {
      sanitized[safeKey] = sanitizeSQLInput(value);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[safeKey] = value;
    } else if (Array.isArray(value)) {
      sanitized[safeKey] = value.map(item =>
        typeof item === 'string' ? sanitizeSQLInput(item) : item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[safeKey] = sanitizeJSONInput(value);
    }
  }

  return sanitized;
}

/**
 * Mensanitasi semua input yang masuk ke CV_Intake_Workflow.
 *
 * @param {Object} webhookData - Data dari webhook/API request
 * @returns {Object} Data yang sudah disanitasi
 */
function sanitizeWebhookInput(webhookData) {
  return sanitizeJSONInput(webhookData);
}

module.exports = {
  sanitizeSQLInput,
  sanitizeCommandInput,
  sanitizeFilename,
  sanitizeJSONInput,
  sanitizeWebhookInput,
};