'use strict';

require('dotenv').config();

async function testFetch() {
  const apiKey = process.env.OPENAI_API_KEY;
  const url = 'https://ai.olagon.site/v1/chat/completions';
  
  console.log('🧪 Testing Raw Fetch to Olagon');
  console.log('URL:', url);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet',
        messages: [
          { role: 'user', content: 'Say OK' }
        ],
        max_tokens: 10
      })
    });

    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response Body:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('❌ Fetch Failed:', err.message);
    if (err.cause) console.error('Cause:', err.cause);
  }
}

testFetch();
