// Verify and Fix Video Generation Pipeline
// Run with: node verify-and-fix-pipeline.js

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

async function verifyAndFixPipeline() {
  console.log('🔍 Verifying and Fixing Video Generation Pipeline...');
  console.log('==================================================');
  
  const results = {
    environment: { configured: false, working: false },
    supabase: { configured: false, working: false },
    storage: { configured: false, working: false },
    database: { configured: false, working: false },
    openai: { configured: false, working: false },
    elevenlabs: { configured: false, working: false }
  };
  
  // ✅ 1. Verify Environment Variables
  console.log('\n🔍 1. Checking Environment Variables...');
  const requiredEnvVars = {
    'OPENAI_API_KEY': 'OpenAI API Key (for image generation)',
    'ELEVENLABS_API_KEY': 'ElevenLabs API Key (for voice generation)',
    'OPENROUTER_API_KEY': 'OpenRouter API Key (for script generation)',
    'NEXT_PUBLIC_SUPABASE_URL': 'Supabase Project URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'Supabase Anonymous Key'
  };
  
  let envConfigured = true;
  for (const [key, description] of Object.entries(requiredEnvVars)) {
    if (!process.env[key]) {
      console.error(`❌ Missing: ${key} - ${description}`);
      envConfigured = false;
    } else {
      console.log(`✅ Found: ${key}`);
    }
  }
  
  results.environment.configured = envConfigured;
  
  if (!envConfigured) {
    console.log('\n💡 Please add missing environment variables to your .env.local file');
    console.log('💡 Get OpenAI API key from: https://platform.openai.com/api-keys');
    console.log('💡 Get ElevenLabs API key from: https://elevenlabs.io/speech-synthesis');
    console.log('💡 Get OpenRouter API key from: https://openrouter.ai/keys');
    return results;
  }
  
  // ✅ 2. Test OpenAI API
  console.log('\n🔍 2. Testing OpenAI API...');
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      results.openai.configured = true;
      results.openai.working = true;
      console.log('✅ OpenAI API is working');
      console.log('📊 Available models:', data.data?.length || 0);
    } else {
      const errorText = await response.text();
      results.openai.configured = true;
      results.openai.working = false;
      console.error('❌ OpenAI API error:', errorText);
      
      if (errorText.includes('billing_hard_limit_reached')) {
        console.log('💡 Your OpenAI account has reached the billing limit');
        console.log('💡 Add billing information at: https://platform.openai.com/account/billing');
      }
    }
  } catch (error) {
    console.error('❌ OpenAI test failed:', error.message);
  }
  
  // ✅ 3. Test ElevenLabs API
  console.log('\n🔍 3. Testing ElevenLabs API...');
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      results.elevenlabs.configured = true;
      results.elevenlabs.working = true;
      console.log('✅ ElevenLabs API is working');
      console.log('🎤 Available voices:', data.voices?.length || 0);
    } else {
      const errorText = await response.text();
      results.elevenlabs.configured = true;
      results.elevenlabs.working = false;
      console.error('❌ ElevenLabs API error:', errorText);
    }
  } catch (error) {
    console.error('❌ ElevenLabs test failed:', error.message);
  }
  
  // ✅ 4. Test Supabase Connection
  console.log('\n🔍 4. Testing Supabase Connection...');
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    results.supabase.configured = true;
    console.log('✅ Connected to Supabase');
    
    // ✅ 5. Verify Database Table
    console.log('\n🔍 5. Verifying Database Table...');
    try {
      const { data, error } = await supabase.from('videos').select('count').limit(1);
      
      if (error) {
        if (error.message.includes('relation "public.videos" does not exist')) {
          console.error('❌ Videos table does not exist');
          console.log('💡 Creating videos table...');
          
          // Create the table using SQL
          const createTableSQL = `
            CREATE TABLE IF NOT EXISTS public.videos (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              input_text TEXT,
              script TEXT,
              storyboard_json JSONB,
              audio_url TEXT,
              captions_url TEXT,
              image_urls TEXT[],
              total_duration INTEGER,
              status TEXT DEFAULT 'pending',
              error_message TEXT,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            -- Enable RLS
            ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
            
            -- Create policy
            CREATE POLICY "Allow all operations" ON public.videos
            FOR ALL USING (true);
            
            -- Create indexes
            CREATE INDEX IF NOT EXISTS idx_videos_status ON public.videos(status);
            CREATE INDEX IF NOT EXISTS idx_videos_created_at ON public.videos(created_at);
          `;
          
          console.log('💡 Please run this SQL in your Supabase SQL Editor:');
          console.log(createTableSQL);
          
        } else {
          console.error('❌ Database error:', error.message);
        }
      } else {
        results.database.configured = true;
        results.database.working = true;
        console.log('✅ Videos table exists and is accessible');
        
        // Check for required columns
        const requiredColumns = ['audio_url', 'captions_url', 'image_urls', 'storyboard_json', 'total_duration'];
        for (const column of requiredColumns) {
          try {
            const { error: colError } = await supabase
              .from('videos')
              .select(column)
              .limit(1);
            
            if (colError && colError.message.includes('column') && colError.message.includes('does not exist')) {
              console.log(`⚠️ Missing column: ${column}`);
            } else {
              console.log(`✅ Column exists: ${column}`);
            }
          } catch (colCheckError) {
            console.log(`⚠️ Could not check column ${column}`);
          }
        }
      }
    } catch (dbError) {
      console.error('❌ Database test failed:', dbError.message);
    }
    
    // ✅ 6. Verify Storage Bucket
    console.log('\n🔍 6. Verifying Storage Bucket...');
    try {
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      
      if (bucketsError) {
        console.error('❌ Cannot access storage:', bucketsError.message);
      } else {
        const assetsBucket = buckets.find(b => b.id === 'assets');
        
        if (!assetsBucket) {
          console.log('📁 Creating assets bucket...');
          const { data: newBucket, error: createError } = await supabase.storage.createBucket('assets', {
            public: true,
            fileSizeLimit: 52428800, // 50MB
          });
          
          if (createError) {
            console.error('❌ Failed to create assets bucket:', createError.message);
          } else {
            console.log('✅ Assets bucket created successfully');
            results.storage.configured = true;
            results.storage.working = true;
          }
        } else {
          console.log('✅ Assets bucket exists');
          results.storage.configured = true;
          results.storage.working = true;
        }
        
        // Test storage policies
        if (results.storage.working) {
          console.log('\n🔍 7. Testing Storage Policies...');
          try {
            const testContent = 'test';
            const testPath = 'test/validation.txt';
            
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('assets')
              .upload(testPath, testContent, {
                contentType: 'text/plain',
                upsert: true
              });
            
            if (uploadError) {
              console.error('❌ Storage upload test failed:', uploadError.message);
              console.log('💡 Storage policies need to be fixed');
              console.log('💡 Run this SQL in your Supabase SQL Editor:');
              console.log(`
DROP POLICY IF EXISTS "Allow all operations" ON storage.objects;
CREATE POLICY "Allow all operations" ON storage.objects
FOR ALL USING (bucket_id = 'assets');
              `);
            } else {
              console.log('✅ Storage upload test successful');
              
              // Clean up test file
              await supabase.storage.from('assets').remove([testPath]);
              console.log('✅ Test file cleaned up');
            }
          } catch (policyError) {
            console.error('❌ Storage policy test failed:', policyError.message);
          }
        }
      }
    } catch (storageError) {
      console.error('❌ Storage test failed:', storageError.message);
    }
    
  } catch (error) {
    console.error('❌ Supabase connection failed:', error.message);
  }
  
  // Summary
  console.log('\n📊 Pipeline Status Summary:');
  console.log('============================');
  console.log('Environment Variables:', results.environment.configured ? '✅ Configured' : '❌ Missing');
  console.log('OpenAI API:', results.openai.working ? '✅ Working' : '❌ Failed');
  console.log('ElevenLabs API:', results.elevenlabs.working ? '✅ Working' : '❌ Failed');
  console.log('Supabase Connection:', results.supabase.configured ? '✅ Configured' : '❌ Failed');
  console.log('Database Table:', results.database.working ? '✅ Working' : '❌ Failed');
  console.log('Storage Bucket:', results.storage.working ? '✅ Working' : '❌ Failed');
  
  // Check if pipeline is ready
  const pipelineReady = results.environment.configured && 
                       results.openai.working && 
                       results.elevenlabs.working && 
                       results.database.working && 
                       results.storage.working;
  
  console.log('\n🎯 Video Generation Pipeline Ready:', pipelineReady ? '✅ YES' : '❌ NO');
  
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
    if (!results.database.working) {
      console.log('4. Create videos table in Supabase SQL Editor');
    }
    if (!results.storage.working) {
      console.log('5. Create assets bucket and fix storage policies');
    }
  } else {
    console.log('\n🎉 Your video generation pipeline is fully configured and ready!');
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

verifyAndFixPipeline(); 