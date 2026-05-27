'use strict';

require('dotenv').config();
const { OpenAI } = require('openai');

async function testModels() {
  // PAKSA pakai URL Olagon jika di .env salah
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = 'https://ai.olagon.site/v1'; 
  
  console.log('🧪 DIAGNOSTIC TEST (FORCED URL)');
  console.log('Target URL:', baseURL);
  
  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: baseURL,
    timeout: 30000 // 30 detik timeout
  });

  const models = ['claude-3-5-sonnet', 'claude-3-5-haiku', 'claude-3-7-sonnet'];

  for (const model of models) {
    console.log(`\n--- Testing Model: ${model} ---`);
    try {
      const start = Date.now();
      const response = await client.chat.completions.create({
        model: model,
        messages: [{ role: 'user', content: 'Say OK' }],
        max_tokens: 5
      });
      console.log(`✅ SUCCESS! Response: "${response.choices[0].message.content}"`);
      console.log(`⏱️ Duration: ${Date.now() - start}ms`);
    } catch (err) {
      console.error(`❌ FAILED: ${err.message}`);
    }
  }
}

testModels();
