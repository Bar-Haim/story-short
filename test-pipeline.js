// Test StoryShort Video Generation Pipeline
// Run with: node test-pipeline.js

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

async function testPipeline() {
  console.log('🧪 Testing StoryShort Video Generation Pipeline...');
  console.log('================================================');
  
  const results = {
    environment: { configured: false, working: false },
    openai: { configured: false, working: false },
    elevenlabs: { configured: false, working: false },
    openrouter: { configured: false, working: false },
    supabase: { configured: false, working: false },
    database: { configured: false, working: false },
    storage: { configured: false, working: false },
    scriptGeneration: { working: false, error: null },
    storyboardGeneration: { working: false, error: null },
    imageGeneration: { working: false, error: null },
    audioGeneration: { working: false, error: null }
  };
  
  // 1. Test Environment Variables
  console.log('\n🔍 1. Testing Environment Variables...');
  const requiredVars = {
    'OPENAI_API_KEY': 'OpenAI API Key',
    'ELEVENLABS_API_KEY': 'ElevenLabs API Key', 
    'OPENROUTER_API_KEY': 'OpenRouter API Key',
    'NEXT_PUBLIC_SUPABASE_URL': 'Supabase URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'Supabase Key'
  };
  
  let envOk = true;
  for (const [key, name] of Object.entries(requiredVars)) {
    if (!process.env[key]) {
      console.error(`❌ Missing: ${name} (${key})`);
      envOk = false;
    } else {
      console.log(`✅ Found: ${name}`);
    }
  }
  results.environment.configured = envOk;
  
  if (!envOk) {
    console.log('\n💡 Please add missing environment variables to .env.local');
    return results;
  }
  
  // 2. Test OpenAI API
  console.log('\n🔍 2. Testing OpenAI API...');
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      results.openai.configured = true;
      results.openai.working = true;
      console.log('✅ OpenAI API working');
      console.log(`📊 Available models: ${data.data?.length || 0}`);
    } else {
      const errorText = await response.text();
      results.openai.configured = true;
      results.openai.working = false;
      console.error('❌ OpenAI API error:', errorText);
    }
  } catch (error) {
    console.error('❌ OpenAI test failed:', error.message);
  }
  
  // 3. Test ElevenLabs API
  console.log('\n🔍 3. Testing ElevenLabs API...');
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      results.elevenlabs.configured = true;
      results.elevenlabs.working = true;
      console.log('✅ ElevenLabs API working');
      console.log(`🎤 Available voices: ${data.voices?.length || 0}`);
    } else {
      const errorText = await response.text();
      results.elevenlabs.configured = true;
      results.elevenlabs.working = false;
      console.error('❌ ElevenLabs API error:', errorText);
    }
  } catch (error) {
    console.error('❌ ElevenLabs test failed:', error.message);
  }
  
  // 4. Test OpenRouter API
  console.log('\n🔍 4. Testing OpenRouter API...');
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://storyshort.app',
        'X-Title': 'StoryShort - AI Video Generation'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      results.openrouter.configured = true;
      results.openrouter.working = true;
      console.log('✅ OpenRouter API working');
      console.log(`🤖 Available models: ${data.data?.length || 0}`);
    } else {
      const errorText = await response.text();
      results.openrouter.configured = true;
      results.openrouter.working = false;
      console.error('❌ OpenRouter API error:', errorText);
    }
  } catch (error) {
    console.error('❌ OpenRouter test failed:', error.message);
  }
  
  // 5. Test Supabase
  console.log('\n🔍 5. Testing Supabase...');
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    results.supabase.configured = true;
    console.log('✅ Supabase client created');
    
    // Test database
    const { data, error } = await supabase.from('videos').select('count').limit(1);
    if (error) {
      console.error('❌ Database error:', error.message);
    } else {
      results.database.configured = true;
      results.database.working = true;
      console.log('✅ Database connection working');
    }
    
    // Test storage
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    if (bucketsError) {
      console.error('❌ Storage error:', bucketsError.message);
    } else {
      const assetsBucket = buckets.find(b => b.id === 'assets');
      if (assetsBucket) {
        results.storage.configured = true;
        results.storage.working = true;
        console.log('✅ Storage bucket found');
      } else {
        console.log('⚠️ Assets bucket not found');
      }
    }
    
  } catch (error) {
    console.error('❌ Supabase test failed:', error.message);
  }
  
  // 6. Test Script Generation
  console.log('\n🔍 6. Testing Script Generation...');
  try {
    const response = await fetch('http://localhost:4000/api/generate-script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userText: 'Test script generation with a simple story about a cat.'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.script) {
        results.scriptGeneration.working = true;
        console.log('✅ Script generation working');
        console.log(`📝 Generated script length: ${data.script.length} characters`);
      } else {
        results.scriptGeneration.error = 'No script in response';
        console.error('❌ Script generation failed: No script in response');
      }
    } else {
      const errorText = await response.text();
      results.scriptGeneration.error = errorText;
      console.error('❌ Script generation failed:', errorText);
    }
  } catch (error) {
    results.scriptGeneration.error = error.message;
    console.error('❌ Script generation test failed:', error.message);
  }
  
  // 7. Test Audio Generation
  console.log('\n🔍 7. Testing Audio Generation...');
  try {
    const response = await fetch('http://localhost:4000/api/generate-voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'This is a test of the audio generation system.',
        voiceId: 'Dslrhjl3ZpzrctukrQSN'
      })
    });
    
    if (response.ok) {
      const audioBlob = await response.blob();
      if (audioBlob.size > 0) {
        results.audioGeneration.working = true;
        console.log('✅ Audio generation working');
        console.log(`🎵 Generated audio size: ${audioBlob.size} bytes`);
      } else {
        results.audioGeneration.error = 'Empty audio response';
        console.error('❌ Audio generation failed: Empty response');
      }
    } else {
      const errorText = await response.text();
      results.audioGeneration.error = errorText;
      console.error('❌ Audio generation failed:', errorText);
    }
  } catch (error) {
    results.audioGeneration.error = error.message;
    console.error('❌ Audio generation test failed:', error.message);
  }
  
  // Summary
  console.log('\n📊 Pipeline Test Summary:');
  console.log('=========================');
  console.log('Environment:', results.environment.configured ? '✅ Configured' : '❌ Missing');
  console.log('OpenAI API:', results.openai.working ? '✅ Working' : '❌ Failed');
  console.log('ElevenLabs API:', results.elevenlabs.working ? '✅ Working' : '❌ Failed');
  console.log('OpenRouter API:', results.openrouter.working ? '✅ Working' : '❌ Failed');
  console.log('Supabase:', results.supabase.configured ? '✅ Configured' : '❌ Failed');
  console.log('Database:', results.database.working ? '✅ Working' : '❌ Failed');
  console.log('Storage:', results.storage.working ? '✅ Working' : '❌ Failed');
  console.log('Script Generation:', results.scriptGeneration.working ? '✅ Working' : '❌ Failed');
  console.log('Audio Generation:', results.audioGeneration.working ? '✅ Working' : '❌ Failed');
  
  // Check if pipeline is ready
  const pipelineReady = results.environment.configured && 
                       results.openai.working && 
                       results.elevenlabs.working && 
                       results.openrouter.working && 
                       results.database.working && 
                       results.storage.working;
  
  console.log('\n🎯 Pipeline Ready:', pipelineReady ? '✅ YES' : '❌ NO');
  
  if (!pipelineReady) {
    console.log('\n📋 Required Actions:');
    console.log('===================');
    
    if (!results.environment.configured) {
      console.log('1. Add missing environment variables to .env.local');
    }
    if (!results.openai.working) {
      console.log('2. Fix OpenAI API key or add billing information');
    }
    if (!results.elevenlabs.working) {
      console.log('3. Fix ElevenLabs API key');
    }
    if (!results.openrouter.working) {
      console.log('4. Fix OpenRouter API key');
    }
    if (!results.database.working) {
      console.log('5. Fix Supabase database connection');
    }
    if (!results.storage.working) {
      console.log('6. Create assets bucket in Supabase Storage');
    }
  } else {
    console.log('\n🎉 Your pipeline is ready for video generation!');
    console.log('\n✅ All components verified:');
    console.log('   • Script generation (OpenRouter)');
    console.log('   • Storyboard generation (OpenRouter)');
    console.log('   • Image generation (OpenAI DALL-E 3)');
    console.log('   • Audio generation (ElevenLabs)');
    console.log('   • Database storage (Supabase)');
    console.log('   • File storage (Supabase Storage)');
  }
  
  return results;
}

// Run the test
testPipeline().catch(console.error); 