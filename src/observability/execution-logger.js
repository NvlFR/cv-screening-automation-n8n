'use strict';

/**
 * Execution Logger — mencatat execution log setiap node/workflow untuk observability.
 * Requirements: 12.2, 12.4, 12.5
 */

const { logIntakeEvent } = require('../cv-intake/audit-logger');

/**
 * Format standar untuk execution log entry.
 * @typedef {Object} ExecutionLogEntry
 * @property {string} nodeName - Nama node yang dieksekusi
 * @property {Object} input - Input yang diberikan ke node
 * @property {Object} output - Output dari node
 * @property {number} durationMs - Durasi eksekusi dalam milliseconds
 * @property {string} workflowId - UUID workflow
 * @property {string} [executionId] - UUID execution
 */

/**
 * Interval minimum untuk log rotation (ms).
 * Jika durationMs < MIN_LOG_INTERVAL, tidak perlu log ke database.
 */
const MIN_DURATION_LOG_MS = 1000;

/**
 * Memformat durasi ke string readable.
 *
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Logging execution node dengan durasi.
 *
 * @param {Object} params
 * @param {string} params.nodeName - Nama node
 * @param {Object} params.input - Input node
 * @param {Object} params.output - Output node
 * @param {number} params.durationMs - Durasi eksekusi
 * @param {string} params.workflowId - ID workflow
 * @param {string} [params.executionId] - ID execution
 * @returns {Promise<void>}
 *
 * Requirements: 12.2 — execution log setiap node
 */
async function logNodeExecution({ nodeName, input, output, durationMs, workflowId, executionId }) {
  // Catat semua execution ke console/stdout
  const logEntry = {
    nodeName,
    workflowId,
    executionId,
    durationMs,
    durationReadable: formatDuration(durationMs),
    timestamp: new Date().toISOString(),
    hasOutput: output !== undefined && output !== null,
    inputKeys: input ? Object.keys(input) : [],
  };

  console.log(
    `[ExecutionLog] ${logEntry.nodeName} | ${logEntry.durationReadable} | ${logEntry.workflowId}${logEntry.executionId ? ` | exec: ${logEntry.executionId}` : ''}`
  );

  // Hanya log ke database untuk execution yang lama (>1 detik)
  // untuk menghindari overhead database yang tidak perlu
  if (durationMs >= MIN_DURATION_LOG_MS) {
    try {
      await logIntakeEvent({
        action: 'NODE_EXECUTED',
        entityType: 'workflow_execution',
        entityId: executionId || null,
        details: {
          nodeName,
          workflowId,
          durationMs,
          inputKeys: logEntry.inputKeys,
          hasOutput: logEntry.hasOutput,
        },
      });
    } catch (err) {
      console.error('[ExecutionLog] Gagal mencatat execution log ke database:', err.message);
    }
  }
}

/**
 * Logging error pada node/workflow expression.
 *
 * Requirements: 12.4 — mencatat error n8n expression syntax
 *
 * @param {Object} params
 * @param {string} params.nodeName - Nama node yang error
 * @param {Error|string} params.error - Error yang terjadi
 * @param {string} params.expression - Ekspresi yang gagal (jika ada)
 * @param {string} params.workflowId - ID workflow
 * @param {string} [params.executionId] - ID execution
 * @returns {Promise<void>}
 */
async function logExpressionError({ nodeName, error, expression, workflowId, executionId }) {
  const errorMessage = typeof error === 'string' ? error : error.message || String(error);

  // Deteksi apakah ini error expression syntax
  const isExpressionError = expression !== undefined ||
    errorMessage.includes('$json') ||
    errorMessage.includes('$vars') ||
    errorMessage.includes('expression') ||
    errorMessage.includes('is not defined');

  console.error(
    `[ExecutionLog] ERROR | Node: ${nodeName} | Workflow: ${workflowId}` +
    `${expression ? ` | Expression: ${expression.substring(0, 100)}` : ''}` +
    ` | Error: ${errorMessage}`
  );

  try {
    await logIntakeEvent({
      action: 'EXPRESSION_ERROR',
      entityType: 'workflow_execution',
      entityId: executionId || null,
      errorCode: 'EXPRESSION_ERROR',
      details: {
        nodeName,
        workflowId,
        expression: expression ? expression.substring(0, 500) : null,
        errorMessage,
        isExpressionError,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (logErr) {
    console.error('[ExecutionLog] Gagal mencatat expression error:', logErr.message);
  }
}

/**
 * Logging slow workflow execution.
 *
 * @param {Object} params
 * @param {string} params.workflowId
 * @param {string} params.workflowName
 * @param {number} params.durationMs
 * @param {string} [params.executionId]
 * @returns {Promise<void>}
 *
 * Requirements: 12.5
 */
async function logSlowExecution({ workflowId, workflowName, durationMs, executionId }) {
  const threshold = 5 * 60 * 1000; // 5 menit

  if (durationMs < threshold) return;

  const message = `[ExecutionLog] ⚠️ SLOW WORKFLOW | ${workflowName} | ${formatDuration(durationMs)} | ${workflowId}`;

  if (durationMs >= threshold) {
    console.warn(message);
  }

  try {
    await logIntakeEvent({
      action: 'SLOW_WORKFLOW_EXECUTION',
      entityType: 'workflow_execution',
      entityId: executionId || null,
      details: {
        workflowId,
        workflowName,
        durationMs,
        durationReadable: formatDuration(durationMs),
        thresholdMs: threshold,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[ExecutionLog] Gagal mencatat slow execution:', err.message);
  }
}

module.exports = {
  logNodeExecution,
  logExpressionError,
  logSlowExecution,
  formatDuration,
};