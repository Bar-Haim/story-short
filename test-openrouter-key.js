// Test OpenRouter API key format and connectivity
// Run with: node test-openrouter-key.js

const fs = require('fs');

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
    console.log('No .env.local file found');
  }
}

loadEnvFile('.env.local');

async function testOpenRouterKey() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  console.log('🔍 OpenRouter API Key Analysis:');
  console.log('================================');
  
  if (!apiKey) {
    console.error('❌ No OPENROUTER_API_KEY found in .env.local');
    return;
  }
  
  console.log('✅ API Key found');
  console.log('📏 Length:', apiKey.length);
  console.log('🔑 Starts with:', apiKey.substring(0, 10) + '...');
  console.log('🔑 Full key (first 20 chars):', apiKey.substring(0, 20) + '...');
  
  // Check different possible formats
  console.log('\n🔍 Format Analysis:');
  console.log('sk-or- format:', apiKey.startsWith('sk-or-') ? '✅' : '❌');
  console.log('sk-proj- format:', apiKey.startsWith('sk-proj-') ? '✅' : '❌');
  console.log('sk- format:', apiKey.startsWith('sk-') ? '✅' : '❌');
  
  if (apiKey.startsWith('sk-proj-')) {
    console.log('\n⚠️  WARNING: Your key starts with "sk-proj-" which might be a different format');
    console.log('💡 This could be a project-specific key or different OpenRouter key type');
  }
  
  if (!apiKey.startsWith('sk-or-')) {
    console.log('\n❌ Your key does not match the standard OpenRouter format (sk-or-)');
    console.log('💡 You may need to get a new API key from https://openrouter.ai/keys');
  }
  
  // Test the key with OpenRouter
  console.log('\n🧪 Testing API Key with OpenRouter...');
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    
    console.log('📡 Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API Key is working!');
      console.log('📊 Available models:', data.data?.length || 0);
    } else {
      const errorText = await response.text();
      console.error('❌ API Key test failed:', errorText);
    }
  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
}

testOpenRouterKey(); 