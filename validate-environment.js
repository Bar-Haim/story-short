// Environment Validation and Fix Script
// Run with: node validate-environment.js

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

async function validateEnvironment() {
  console.log('🔍 Validating StoryShort Environment...');
  console.log('=====================================');
  
  const results = {
    openAI: { configured: false, working: false, error: null },
    supabase: { configured: false, working: false, error: null },
    storage: { configured: false, working: false, error: null },
    database: { configured: false, working: false, error: null }
  };
  
  // 1. Validate OpenAI API Key
  console.log('\n🔍 Checking OpenAI API Key...');
  const openAIKey = process.env.OPENAI_API_KEY;
  if (!openAIKey) {
    console.error('❌ Missing OpenAI API Key');
    console.log('💡 Add OPENAI_API_KEY to your .env.local file');
    console.log('💡 Get it from: https://platform.openai.com/api-keys');
  } else {
    results.openAI.configured = true;
    console.log('✅ OpenAI API key found');
    console.log('📏 Key length:', openAIKey.length);
    console.log('🔑 Key format:', openAIKey.startsWith('sk-') ? 'sk-' : 'Unknown');
    
    // Test OpenAI API
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
        
        if (errorText.includes('billing_hard_limit_reached')) {
          console.log('💡 Your OpenAI account has reached the billing limit');
          console.log('💡 Add billing information at: https://platform.openai.com/account/billing');
        }
      }
    } catch (error) {
      results.openAI.error = error.message;
      console.error('❌ OpenAI network error:', error.message);
    }
  }
  
  // 2. Validate Supabase Configuration
  console.log('\n🔍 Checking Supabase Configuration...');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    console.log('💡 Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local file');
  } else {
    results.supabase.configured = true;
    console.log('✅ Supabase credentials found');
    console.log('🌐 URL:', supabaseUrl);
    
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Test database connection
      console.log('\n🔍 Testing Supabase Database...');
      try {
        const { data, error } = await supabase.from('videos').select('count').limit(1);
        
        if (error) {
          if (error.message.includes('relation "public.videos" does not exist')) {
            console.error('❌ Videos table does not exist');
            console.log('💡 Run the SQL from setup-database.sql in your Supabase SQL Editor');
          } else {
            results.database.error = error.message;
            console.error('❌ Database connection error:', error.message);
          }
        } else {
          results.database.working = true;
          console.log('✅ Database connection is working');
        }
      } catch (dbError) {
        results.database.error = dbError.message;
        console.error('❌ Database test error:', dbError.message);
      }
      
      // Test storage
      console.log('\n🔍 Testing Supabase Storage...');
      try {
        const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
        
        if (bucketsError) {
          results.storage.error = bucketsError.message;
          console.error('❌ Storage access error:', bucketsError.message);
        } else {
          const assetsBucket = buckets.find(b => b.id === 'assets');
          
          if (!assetsBucket) {
            console.error('❌ Assets bucket does not exist');
            console.log('💡 Create a bucket named "assets" in your Supabase Storage');
            console.log('💡 Follow the instructions in supabase-storage-setup.md');
          } else {
            results.storage.working = true;
            console.log('✅ Assets bucket found');
            console.log('📁 Bucket name:', assetsBucket.name);
            console.log('🌐 Public:', assetsBucket.public);
          }
        }
      } catch (storageError) {
        results.storage.error = storageError.message;
        console.error('❌ Storage test error:', storageError.message);
      }
      
    } catch (error) {
      results.supabase.error = error.message;
      console.error('❌ Supabase client error:', error.message);
    }
  }
  
  // Summary
  console.log('\n📊 Environment Summary:');
  console.log('======================');
  console.log('OpenAI:', results.openAI.configured ? (results.openAI.working ? '✅ Working' : '❌ Failed') : '❌ Not configured');
  console.log('Supabase:', results.supabase.configured ? '✅ Configured' : '❌ Not configured');
  console.log('Database:', results.database.working ? '✅ Working' : '❌ Failed');
  console.log('Storage:', results.storage.working ? '✅ Working' : '❌ Failed');
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  console.log('==================');
  
  if (!results.openAI.working && results.openAI.configured) {
    console.log('🔧 OpenAI: Check your API key and billing status');
    console.log('🔧 OpenAI: Add billing information if you hit the limit');
  }
  if (!results.database.working) {
    console.log('🔧 Database: Run setup-database.sql in Supabase SQL Editor');
  }
  if (!results.storage.working) {
    console.log('🔧 Storage: Create "assets" bucket and set up policies');
    console.log('🔧 Storage: Follow supabase-storage-setup.md instructions');
  }
  
  // Check if environment is ready for asset generation
  const readyForAssets = results.openAI.working && results.database.working && results.storage.working;
  
  console.log('\n🎯 Asset Generation Ready:', readyForAssets ? '✅ YES' : '❌ NO');
  
  if (!readyForAssets) {
    console.log('\n📋 To-Do List:');
    console.log('==============');
    if (!results.openAI.working) console.log('1. Fix OpenAI API key/billing');
    if (!results.database.working) console.log('2. Create videos table in Supabase');
    if (!results.storage.working) console.log('3. Create assets bucket in Supabase Storage');
  } else {
    console.log('\n🎉 Your environment is ready for asset generation!');
  }
  
  return results;
}

validateEnvironment(); 