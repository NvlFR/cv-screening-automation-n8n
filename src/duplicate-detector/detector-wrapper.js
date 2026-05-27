'use strict';

const { DuplicateDetector } = require('./detector');
const db = require('../db/client');

async function runDuplicateDetector(items) {
  const detector = new DuplicateDetector(db);
  const results = [];

  for (const item of items) {
    try {
      const { email, name, phone } = item.json;
      const duplicateResult = await detector.check({ email, name, phone });
      results.push({
        json: {
          ...item.json,
          duplicateStatus: duplicateResult.status,
          duplicateOf: duplicateResult.existingRecordId || null
        }
      });
    } catch (error) {
      results.push({
        json: {
          ...item.json,
          duplicateStatus: 'ERROR',
          duplicateError: error.message
        }
      });
    }
  }

  return results;
}

module.exports = { runDuplicateDetector };
