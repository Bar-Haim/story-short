// Test OpenRouter API connectivity
// Run with: node test-openrouter.js

// Simple environment variable loader
const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          process.env[key.trim()] = value.replace(/^["']|["']$/g, '');
        }
      }
    });
  } catch (error) {
    console.log('No .env.local file found, using system environment variables');
  }
}

loadEnvFile('.env.local');

async function testOpenRouter() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    console.error('❌ OPENROUTER_API_KEY not found in .env.local');
    return;
  }
  
  console.log('🔑 API Key found:', apiKey.substring(0, 10) + '...');
  console.log('🔍 API Key format check:', apiKey.startsWith('sk-or-') ? '✅ OpenRouter format' : '❌ Unknown format');
  
  try {
    // Test 1: Check models endpoint
    console.log('\n🧪 Testing models endpoint...');
    const modelsResponse = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    
    console.log('📡 Models response status:', modelsResponse.status);
    
    if (modelsResponse.ok) {
      const modelsData = await modelsResponse.json();
      console.log('✅ Models endpoint working');
      console.log('📊 Available models:', modelsData.data?.length || 0);
      
      // Check if GPT-4 is available
      const gpt4Model = modelsData.data?.find(m => m.id === 'openai/gpt-4');
      console.log('🤖 GPT-4 available:', gpt4Model ? '✅' : '❌');
    } else {
      const errorText = await modelsResponse.text();
      console.error('❌ Models endpoint failed:', errorText);
    }
    
         // Test 2: Test chat completion
     console.log('\n🧪 Testing chat completion...');
     const chatResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${apiKey}`,
         'Content-Type': 'application/json',
         'HTTP-Referer': 'http://localhost:3000',
         'X-Title': 'StoryShort',
       },
       body: JSON.stringify({
         model: 'openai/gpt-4',
         messages: [{ role: 'user', content: 'Hello, this is a test message.' }],
         max_tokens: 50,
       }),
     });
    
    console.log('📡 Chat response status:', chatResponse.status);
    
    if (chatResponse.ok) {
      const chatData = await chatResponse.json();
      console.log('✅ Chat completion working');
      console.log('📝 Response:', chatData.choices?.[0]?.message?.content);
    } else {
      const errorText = await chatResponse.text();
      console.error('❌ Chat completion failed:', errorText);
    }
    
  } catch (error) {
    console.error('🚨 Test failed:', error.message);
  }
}

testOpenRouter(); 