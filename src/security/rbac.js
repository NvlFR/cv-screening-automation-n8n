'use strict';

/**
 * RBAC (Role-Based Access Control) — memeriksa permission user berdasarkan role.
 * Roles: recruiter, hiring_manager, admin
 * Requirements: 10.3, 10.4
 */

/**
 * Role yang tersedia.
 * @typedef {'recruiter' | 'hiring_manager' | 'admin'} UserRole
 */

/**
 * Action yang dapat dilakukan pada Candidate_Record.
 * @typedef {'read' | 'create' | 'update' | 'delete' | 'export'} PermissionAction
 */

/**
 * Peta permission per role.
 * recruiter: read, create candidates; default action allowed
 * hiring_manager: read, update, shortlist decisions
 * admin: semua action diizinkan
 */
const ROLE_PERMISSIONS = {
  recruiter: new Set(['read', 'create']),
  hiring_manager: new Set(['read', 'create', 'update', 'shortlist']),
  admin: new Set(['read', 'create', 'update', 'delete', 'export', 'shortlist', 'manage_users', 'manage_jd']),
};

/**
 * Permission default untuk role yang tidak dikenal.
 */
const NO_PERMISSIONS = new Set([]);

/**
 * Memeriksa apakah user memiliki permission untuk action tertentu.
 *
 * @param {string} userId - User ID
 * @param {UserRole} role - User role
 * @param {PermissionAction} action - Action yang akan dilakukan
 * @returns {boolean} true jika diizinkan
 *
 * @example
 * checkPermission('user-123', 'recruiter', 'read') // => true
 * checkPermission('user-123', 'recruiter', 'delete') // => false
 * checkPermission('user-123', 'admin', 'delete') // => true
 */
function checkPermission(userId, role, action) {
  if (!userId || typeof userId !== 'string') {
    return false;
  }

  if (!role || typeof role !== 'string') {
    return false;
  }

  const normalizedRole = role.toLowerCase().trim();
  const permissions = ROLE_PERMISSIONS[normalizedRole] || NO_PERMISSIONS;

  return permissions.has(action);
}

/**
 * Memeriksa apakah role valid (ada di ROLE_PERMISSIONS).
 *
 * @param {string} role
 * @returns {boolean}
 */
function isValidRole(role) {
  if (!role || typeof role !== 'string') return false;
  return role.toLowerCase().trim() in ROLE_PERMISSIONS;
}

/**
 * Mendapatkan semua permission untuk role tertentu.
 *
 * @param {UserRole} role
 * @returns {string[]} Array of permission names
 */
function getPermissionsForRole(role) {
  if (!role || typeof role !== 'string') return [];
  const normalizedRole = role.toLowerCase().trim();
  const permissions = ROLE_PERMISSIONS[normalizedRole];
  return permissions ? Array.from(permissions) : [];
}

/**
 * Memeriksa apakah user adalah admin.
 *
 * @param {string} role
 * @returns {boolean}
 */
function isAdmin(role) {
  return checkPermission('system', role, 'delete');
}

module.exports = {
  checkPermission,
  isValidRole,
  getPermissionsForRole,
  isAdmin,
  ROLE_PERMISSIONS,
};