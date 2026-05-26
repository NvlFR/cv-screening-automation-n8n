'use strict';

/**
 * Audit Writer — menulis audit log ke tabel audit_logs di PostgreSQL.
 *
 * Requirements: 12.2, 12.4
 */

const db = require('../db/client');

/**
 * Menulis audit log ke database.
 *
 * @param {Object} params
 * @param {string|null} [params.userId] - User ID (null untuk system actions)
 * @param {string} params.action - Action type (e.g., 'CV_RECEIVED', 'CANDIDATE_SHORTLISTED')
 * @param {string} [params.entityType] - Entity type (e.g., 'candidate_record', 'job_description')
 * @param {string|null} [params.entityId] - Entity UUID (null jika belum ada)
 * @param {Object} [params.details] - Detail JSON payload
 * @param {string|null} [params.errorCode] - Error code jika action adalah error
 * @param {string|null} [params.ipAddress] - IP address client
 * @returns {Promise<string>} UUID audit log entry
 */
async function writeAuditLog({ userId, action, entityType, entityId, details, errorCode, ipAddress }) {
  const sql = `
    INSERT INTO audit_logs (
      user_id, action, entity_type, entity_id,
      details, error_code, ip_address,
      created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4,
      $5::jsonb, $6, $7::inet,
      NOW(), NOW()
    )
    RETURNING id
  `;

  const params = [
    userId || null,
    action,
    entityType || null,
    entityId || null,
    details ? JSON.stringify(details) : null,
    errorCode || null,
    ipAddress || null,
  ];

  const result = await db.query(sql, params);
  return result.rows[0].id;
}

module.exports = { writeAuditLog };