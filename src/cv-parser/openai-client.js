'use strict';

const config = require('../config');

/**
 * Wrapper OpenAI API dengan retry logic dan exponential backoff.
 * Retry maksimal 3x dengan delay: 30s, 60s, 120s.
 *
 * Requirements: 2.2 — CV_Parser menggunakan OpenAI API untuk normalisasi dan ekstraksi
 * Error handling: OPENAI_ERROR → retry 3x dengan exponential backoff (30s, 60s, 120s)
 */

/**
 * Mengirim pesan ke OpenAI Chat Completions API dengan retry logic.
 *
 * @param {Object} params
 * @param {string} params.systemPrompt - System message untuk OpenAI
 * @param {string} params.userPrompt - User message untuk OpenAI
 * @param {string} [params.model] - Model OpenAI yang digunakan (default: gpt-4o-mini)
 * @param {number} [params.maxTokens] - Maksimum token output (default: 2000)
 * @returns {Promise<string>} Teks response dari OpenAI
 * @throws {Error} Jika semua retry gagal, melempar error dengan kode OPENAI_ERROR
 *
 * @example
 * const response = await callOpenAI({
 *   systemPrompt: 'Kamu adalah CV parser...',
 *   userPrompt: 'Ekstrak informasi dari CV berikut: ...'
 * });
 */
async function callOpenAI({ systemPrompt, userPrompt, model, maxTokens = 2000 }) {
  const { OpenAI } = require('openai');

  const apiKey = config.openai.apiKey;
  if (!apiKey) {
    throw new Error('OPENAI_ERROR: OPENAI_API_KEY tidak dikonfigurasi');
  }

  const client = new OpenAI({ apiKey });
  const selectedModel = model || config.openai.model;
  const retryDelays = config.openai.retryDelays; // [30000, 60000, 120000]
  const maxRetries = config.openai.maxRetries;   // 3

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: selectedModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: maxTokens,
        temperature: 0,  // deterministik untuk parsing
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('OPENAI_ERROR: Response kosong dari OpenAI');
      }

      return content;

    } catch (error) {
      lastError = error;

      // Jika ini bukan attempt terakhir, tunggu sebelum retry
      if (attempt < maxRetries) {
        const delayMs = retryDelays[attempt] || retryDelays[retryDelays.length - 1];
        await sleep(delayMs);
      }
    }
  }

  // Semua retry gagal
  throw new Error(`OPENAI_ERROR: Semua ${maxRetries} retry gagal. Error terakhir: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Helper: sleep untuk delay antar retry.
 * @param {number} ms - Durasi sleep dalam milliseconds
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { callOpenAI, sleep };
