'use strict';

const { parseCV } = require('./cv-parser');
const { decryptFile } = require('../cv-intake/encryptor');
const { extractText } = require('./text-extractor');

async function runCVParser(items) {
  const results = [];

  for (const item of items) {
    try {
      const job = item.json;
      let cvText = job.cvText || job.rawText || '';

      if (!cvText && job.encryptedContent) {
        const decryptedBuffer = decryptFile(job.encryptedContent);
        cvText = await extractText(decryptedBuffer, job.mimeType || 'text/plain');
      }

      const candidateData = await parseCV(cvText);
      results.push({
        json: {
          ...item.json,
          ...candidateData,
          status: candidateData.status || 'PENDING'
        }
      });
    } catch (error) {
      results.push({
        json: {
          ...item.json,
          status: 'PARSING_FAILED',
          error: error.message
        }
      });
    }
  }

  return results;
}

module.exports = { runCVParser };
