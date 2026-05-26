'use strict';

/**
 * Text extractor untuk file CV dalam format PDF, DOCX, dan TXT.
 * Mengekstrak teks mentah dari buffer file sesuai MIME type-nya.
 *
 * Requirements: 2.1 — CV_Parser mengekstrak teks dari berbagai format file
 */

/**
 * Mengekstrak teks dari buffer file berdasarkan MIME type.
 *
 * @param {Buffer} fileBuffer - Raw file content sebagai Buffer
 * @param {string} mimeType - MIME type file (contoh: 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain')
 * @returns {Promise<string>} Teks yang diekstrak dari file
 * @throws {Error} Jika format tidak didukung atau ekstraksi gagal
 *
 * @example
 * const text = await extractText(pdfBuffer, 'application/pdf');
 * // => "Nama: John Doe\nEmail: john@example.com\n..."
 */
async function extractText(fileBuffer, mimeType) {
  if (!Buffer.isBuffer(fileBuffer)) {
    throw new TypeError('extractText: fileBuffer harus berupa Buffer');
  }

  if (typeof mimeType !== 'string' || !mimeType.trim()) {
    throw new TypeError('extractText: mimeType harus berupa string non-kosong');
  }

  const normalizedMime = mimeType.trim().toLowerCase();

  if (isPDF(normalizedMime)) {
    return extractFromPDF(fileBuffer);
  }

  if (isDOCX(normalizedMime)) {
    return extractFromDOCX(fileBuffer);
  }

  if (isTXT(normalizedMime)) {
    return extractFromTXT(fileBuffer);
  }

  throw new Error(`UNSUPPORTED_FORMAT: MIME type '${mimeType}' tidak didukung. Gunakan PDF, DOCX, atau TXT.`);
}

/**
 * Cek apakah MIME type adalah PDF.
 * @param {string} mimeType
 * @returns {boolean}
 */
function isPDF(mimeType) {
  return mimeType === 'application/pdf';
}

/**
 * Cek apakah MIME type adalah DOCX.
 * @param {string} mimeType
 * @returns {boolean}
 */
function isDOCX(mimeType) {
  return (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/docx' ||
    mimeType === 'application/msword'
  );
}

/**
 * Cek apakah MIME type adalah TXT.
 * @param {string} mimeType
 * @returns {boolean}
 */
function isTXT(mimeType) {
  return mimeType === 'text/plain' || mimeType === 'text/txt';
}

/**
 * Ekstrak teks dari buffer PDF menggunakan pdf-parse.
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
async function extractFromPDF(buffer) {
  try {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (error) {
    throw new Error(`PDF_EXTRACTION_FAILED: ${error.message}`);
  }
}

/**
 * Ekstrak teks dari buffer DOCX menggunakan mammoth.
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
async function extractFromDOCX(buffer) {
  try {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch (error) {
    throw new Error(`DOCX_EXTRACTION_FAILED: ${error.message}`);
  }
}

/**
 * Ekstrak teks dari buffer TXT menggunakan native Buffer.
 * @param {Buffer} buffer
 * @returns {string}
 */
function extractFromTXT(buffer) {
  try {
    return buffer.toString('utf8');
  } catch (error) {
    throw new Error(`TXT_EXTRACTION_FAILED: ${error.message}`);
  }
}

module.exports = { extractText, isPDF, isDOCX, isTXT };
