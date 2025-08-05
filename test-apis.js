// Test all APIs configuration and connectivity
// Run with: node test-apis.js

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

async function testAllAPIs() {
  console.log('🧪 Testing All APIs Configuration');
  console.log('==================================');
  
  const results = {
    openRouter: { configured: false, working: false, error: null },
    openAI: { configured: false, working: false, error: null },
    elevenLabs: { configured: false, working: false, error: null },
    supabase: { configured: false, working: false, error: null }
  };
  
  // Test OpenRouter
  console.log('\n🔍 Testing OpenRouter...');
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    results.openRouter.configured = true;
    console.log('✅ OpenRouter API key found');
    console.log('📏 Key length:', openRouterKey.length);
    console.log('🔑 Key format:', openRouterKey.startsWith('sk-or-') ? 'sk-or-' : 
                               openRouterKey.startsWith('sk-proj-') ? 'sk-proj-' : 'Unknown');
    
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${openRouterKey}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        results.openRouter.working = true;
        console.log('✅ OpenRouter API is working');
        console.log('📊 Available models:', data.data?.length || 0);
      } else {
        const errorText = await response.text();
        results.openRouter.error = `${response.status}: ${errorText}`;
        console.error('❌ OpenRouter API error:', errorText);
      }
    } catch (error) {
      results.openRouter.error = error.message;
      console.error('❌ OpenRouter network error:', error.message);
    }
  } else {
    console.log('❌ OpenRouter API key not found');
  }
  
  // Test OpenAI
  console.log('\n🔍 Testing OpenAI...');
  const openAIKey = process.env.OPENAI_API_KEY;
  if (openAIKey) {
    results.openAI.configured = true;
    console.log('✅ OpenAI API key found');
    console.log('📏 Key length:', openAIKey.length);
    console.log('🔑 Key format:', openAIKey.startsWith('sk-') ? 'sk-' : 'Unknown');
    
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${openAIKey}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        results.openAI.working = true;
        console.log('✅ OpenAI API is working');
        console.log('📊 Available models:', data.data?.length || 0);
      } else {
        const errorText = await response.text();
        results.openAI.error = `${response.status}: ${errorText}`;
        console.error('❌ OpenAI API error:', errorText);
      }
    } catch (error) {
      results.openAI.error = error.message;
      console.error('❌ OpenAI network error:', error.message);
    }
  } else {
    console.log('❌ OpenAI API key not found');
  }
  
  // Test ElevenLabs
  console.log('\n🔍 Testing ElevenLabs...');
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
  if (elevenLabsKey) {
    results.elevenLabs.configured = true;
    console.log('✅ ElevenLabs API key found');
    console.log('📏 Key length:', elevenLabsKey.length);
    
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: {
          'xi-api-key': elevenLabsKey,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        results.elevenLabs.working = true;
        console.log('✅ ElevenLabs API is working');
        console.log('🎤 Available voices:', data.voices?.length || 0);
      } else {
        const errorText = await response.text();
        results.elevenLabs.error = `${response.status}: ${errorText}`;
        console.error('❌ ElevenLabs API error:', errorText);
      }
    } catch (error) {
      results.elevenLabs.error = error.message;
      console.error('❌ ElevenLabs network error:', error.message);
    }
  } else {
    console.log('❌ ElevenLabs API key not found');
  }
  
  // Test Supabase
  console.log('\n🔍 Testing Supabase...');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseKey) {
    results.supabase.configured = true;
    console.log('✅ Supabase credentials found');
    console.log('🌐 URL:', supabaseUrl);
    
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { data, error } = await supabase.from('videos').select('count').limit(1);
      
      if (error) {
        results.supabase.error = error.message;
        console.error('❌ Supabase connection error:', error.message);
      } else {
        results.supabase.working = true;
        console.log('✅ Supabase connection is working');
      }
    } catch (error) {
      results.supabase.error = error.message;
      console.error('❌ Supabase test error:', error.message);
    }
  } else {
    console.log('❌ Supabase credentials not found');
  }
  
  // Summary
  console.log('\n📊 Summary:');
  console.log('===========');
  console.log('OpenRouter:', results.openRouter.configured ? (results.openRouter.working ? '✅ Working' : '❌ Failed') : '❌ Not configured');
  console.log('OpenAI:', results.openAI.configured ? (results.openAI.working ? '✅ Working' : '❌ Failed') : '❌ Not configured');
  console.log('ElevenLabs:', results.elevenLabs.configured ? (results.elevenLabs.working ? '✅ Working' : '❌ Failed') : '❌ Not configured');
  console.log('Supabase:', results.supabase.configured ? (results.supabase.working ? '✅ Working' : '❌ Failed') : '❌ Not configured');
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  console.log('==================');
  
  if (!results.openRouter.working && results.openRouter.configured) {
    console.log('🔧 OpenRouter: Check your API key format and credits');
  }
  if (!results.openAI.working && results.openAI.configured) {
    console.log('🔧 OpenAI: Check your API key and billing status');
  }
  if (!results.elevenLabs.working && results.elevenLabs.configured) {
    console.log('🔧 ElevenLabs: Check your API key and credits');
  }
  if (!results.supabase.working && results.supabase.configured) {
    console.log('🔧 Supabase: Check your project URL and anon key');
  }
  
  return results;
}

testAllAPIs(); 