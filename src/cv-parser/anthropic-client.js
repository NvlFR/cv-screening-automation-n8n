'use strict';

const config = require('../config');

/**
 * Wrapper Anthropic API dengan retry logic dan exponential backoff.
 *
 * Requirements: 2.2 — CV_Parser menggunakan AI API untuk normalisasi dan ekstraksi
 */

/**
 * Mengirim pesan ke Anthropic Messages API dengan retry logic.
 *
 * @param {Object} params
 * @param {string} params.systemPrompt - System message untuk Claude
 * @param {string} params.userPrompt - User message untuk Claude
 * @param {string} [params.model] - Model Anthropic yang digunakan (default: claude-3-haiku-20240307)
 * @param {number} [params.maxTokens] - Maksimum token output (default: 2000)
 * @returns {Promise<string>} Teks response dari Claude
 */
async function callAnthropic({ systemPrompt, userPrompt, model, maxTokens = 2000 }) {
  const apiKey = config.anthropic?.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('AI_ERROR: ANTHROPIC_API_KEY tidak dikonfigurasi');
  }

  // Debug values directly from process.env to see if they match config
  console.log(`[AI-DEBUG] process.env.ANTHROPIC_BASE_URL: ${process.env.ANTHROPIC_BASE_URL}`);
  console.log(`[AI-DEBUG] config.anthropic.baseUrl: ${config.anthropic?.baseUrl}`);
  
  const baseUrl = config.anthropic?.baseUrl || process.env.ANTHROPIC_BASE_URL || 'https://ai.olagon.site';
  const url = `${baseUrl}/v1/chat/completions`;

  console.log(`[AI-DEBUG] Final URL: ${url}`);
  console.log(`[AI-DEBUG] API Key prefix: ${apiKey.substring(0, 7)}...`);

  const selectedModel = model || config.anthropic?.model || 'claude-3-5-sonnet';
  const retryDelays = config.openai.retryDelays;
  const maxRetries = config.openai.maxRetries;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[AI] Memanggil Proxy Olagon (${selectedModel}), attempt ${attempt + 1}...`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: maxTokens,
          temperature: 0
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP_${response.status}: ${errorBody}`);
      }

      const data = await response.json();

      // Berdasarkan hasil curl: {"content":[{"text":"..."}]}
      const content = data.content?.[0]?.text;
      if (!content) {
        throw new Error('AI_ERROR: Response format tidak sesuai atau content kosong');
      }

      return content;

    } catch (error) {
      lastError = error;
      console.error(`[AI] Attempt ${attempt + 1} gagal:`, error.message);
      
      if (attempt < maxRetries) {
        const delayMs = retryDelays[attempt] || 1000;
        await sleep(delayMs);
      }
    }
  }

  throw new Error(`AI_ERROR: Olagon Proxy call failed. Last error: ${lastError?.message}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { callAnthropic, sleep };
