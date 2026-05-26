'use strict';

/**
 * Notification Templates — template notifikasi untuk setiap event type.
 *
 * Requirements: 8.2, 8.3, 8.4
 */

/**
 * Template untuk event SHORTLISTED.
 * Wajib mencakup: nama kandidat, posisi, skor akhir, recommendation, link ke record.
 */
function templateShortlisted({ candidateName, jobTitle, score, recommendation, recordId }) {
  return {
    subject: `🎉 Kandidat Shortlisted: ${candidateName || '(Nama tidak tersedia)'} — ${jobTitle || '(Posisi tidak tersedia)'}`,
    body: `Kandidat telah masuk shortlist!

**Nama:** ${candidateName || '-'}
**Posisi:** ${jobTitle || '-'}
**Skor Akhir:** ${score ?? '-'}/100
**Recommendation:** ${recommendation || '-'}
**Record:** ${recordId ? `https://app.example.com/candidates/${recordId}` : '(record ID tidak tersedia)'}

Silakan lanjut ke tahap interview.`,
    channels: ['email', 'slack'],
  };
}

/**
 * Template untuk event POSSIBLE_DUPLICATE.
 * Wajib mencakup: detail kedua record untuk review manual.
 */
function templatePossibleDuplicate({ newRecord, existingRecordId }) {
  return {
    subject: '⚠️ Kemungkinan Duplikat Kandidat Terdeteksi',
    body: `Kemungkinan duplikat kandidat terdeteksi dan memerlukan review manual.

**Record Baru:**
  Nama: ${newRecord.name || '-'}
  Email: ${newRecord.email || '-'}
  Telepon: ${newRecord.phone || '-'}

**Record Existing:** ${existingRecordId || '-'}

Mohon periksa kedua record dan tentukan tindakan yang tepat.`,
    channels: ['slack', 'discord'],
  };
}

/**
 * Template untuk event PARSING_INCOMPLETE.
 */
function templateParsingIncomplete({ filename, missingFields }) {
  return {
    subject: '⚠️ CV Parsing Tidak Lengkap',
    body: `CV tidak dapat diproses karena data penting tidak ditemukan.

**File:** ${filename}
**Field yang hilang:** ${missingFields && missingFields.length > 0 ? missingFields.join(', ') : 'name dan/atau email'}

CV disimpan dengan status PARSING_INCOMPLETE untuk review manual.`,
    channels: ['slack'],
  };
}

/**
 * Template untuk event NOTIFICATION_FAILED.
 */
function templateNotificationFailed({ eventType, errorMessage, candidateId }) {
  return {
    subject: '❌ Gagal Mengirim Notifikasi',
    body: `Gagal mengirim notifikasi untuk event ${eventType}${candidateId ? ` (candidate: ${candidateId})` : ''}.

**Error:** ${errorMessage}

Silakan cek konfigurasi notification service dan kirim notifikasi secara manual jika diperlukan.`,
    channels: ['slack'],
  };
}

/**
 * Mendapatkan template berdasarkan event type.
 *
 * @param {string} eventType - SHORTLISTED, POSSIBLE_DUPLICATE, PARSING_INCOMPLETE, NOTIFICATION_FAILED
 * @param {Object} payload - Data payload untuk template
 * @returns {Object} { subject, body, channels }
 */
function getTemplate(eventType, payload) {
  // Guard against null/undefined payload
  const safePayload = payload || {};
  switch (eventType) {
    case 'SHORTLISTED':
      return templateShortlisted(safePayload);
    case 'POSSIBLE_DUPLICATE':
      return templatePossibleDuplicate(safePayload);
    case 'PARSING_INCOMPLETE':
      return templateParsingIncomplete(safePayload);
    case 'NOTIFICATION_FAILED':
      return templateNotificationFailed(safePayload);
    default:
      return {
        subject: `Notification: ${eventType}`,
        body: JSON.stringify(safePayload, null, 2),
        channels: ['slack'],
      };
  }
}

module.exports = {
  getTemplate,
  templateShortlisted,
  templatePossibleDuplicate,
  templateParsingIncomplete,
  templateNotificationFailed,
};
