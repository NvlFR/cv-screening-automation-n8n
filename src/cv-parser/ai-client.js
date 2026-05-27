'use strict';

const config = require('../config');
const { callOpenAI } = require('./openai-client');
const { callAnthropic } = require('./anthropic-client');

/**
 * AI Client Dispatcher — mendispatch request ke provider AI yang dipilih (OpenAI atau Anthropic).
 *
 * @param {Object} params
 * @returns {Promise<string>}
 */
async function callAI(params) {
  const provider = config.ai.provider;

  if (provider === 'anthropic') {
    return callAnthropic(params);
  }

  // Default to OpenAI
  return callOpenAI(params);
}

module.exports = { callAI };
