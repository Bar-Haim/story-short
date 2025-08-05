require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

console.log('🔍 Supabase Setup Diagnostic & Fix Script (Simple Version)');
console.log('==========================================================\n');

// Check environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Missing Supabase environment variables:');
  console.log('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.log('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? '✅ Set' : '❌ Missing');
  console.log('\n💡 Please add these to your .env.local file');
  process.exit(1);
}

console.log('✅ Supabase environment variables found');
console.log('🔗 URL:', supabaseUrl);
console.log('🔑 Key:', supabaseKey.substring(0, 20) + '...');

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSupabaseConnection() {
  console.log('\n🔌 Testing Supabase connection...');
  
  try {
    const { data, error } = await supabase.from('videos').select('count').limit(1);
    
    if (error) {
      console.log('❌ Connection failed:', error.message);
      return false;
    }
    
    console.log('✅ Supabase connection successful');
    return true;
  } catch (error) {
    console.log('❌ Connection error:', error.message);
    return false;
  }
}

async function checkVideosTable() {
  console.log('\n📊 Checking videos table...');
  
  try {
    // Check if table exists by trying to select from it
    const { data, error } = await supabase.from('videos').select('*').limit(1);
    
    if (error) {
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log('❌ Videos table does not exist');
        return false;
      } else {
        console.log('❌ Error checking videos table:', error.message);
        return false;
      }
    }
    
    console.log('✅ Videos table exists');
    return true;
  } catch (error) {
    console.log('❌ Error checking videos table:', error.message);
    return false;
  }
}

async function checkTableColumns() {
  console.log('\n📋 Checking videos table columns...');
  
  try {
    // Try to insert a test record to check if all columns exist
    const testRecord = {
      input_text: 'test',
      script: 'test script',
      status: 'test',
      audio_url: 'test',
      captions_url: 'test',
      image_urls: { test: 'test' },
      storyboard_json: { test: 'test' },
      total_duration: 0
    };
    
    const { data, error } = await supabase
      .from('videos')
      .insert(testRecord)
      .select();
    
    if (error) {
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        console.log('❌ Missing columns detected:', error.message);
        return false;
      } else {
        console.log('❌ Error testing columns:', error.message);
        return false;
      }
    }
    
    console.log('✅ All required columns exist');
    
    // Clean up test record
    if (data && data[0]) {
      await supabase.from('videos').delete().eq('id', data[0].id);
      console.log('✅ Test record cleaned up');
    }
    
    return true;
  } catch (error) {
    console.log('❌ Error checking columns:', error.message);
    return false;
  }
}

async function checkStorageBuckets() {
  console.log('\n🪣 Checking storage buckets...');
  
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.log('❌ Error listing buckets:', error.message);
      return false;
    }
    
    console.log('📁 Available buckets:', buckets.map(b => b.id).join(', '));
    
    const assetsBucket = buckets.find(b => b.id === 'assets');
    
    if (assetsBucket) {
      console.log('✅ Assets bucket exists');
      console.log('   Public:', assetsBucket.public);
      console.log('   File size limit:', assetsBucket.fileSizeLimit);
      return true;
    } else {
      console.log('❌ Assets bucket does not exist');
      return false;
    }
  } catch (error) {
    console.log('❌ Error checking buckets:', error.message);
    return false;
  }
}

async function createAssetsBucket() {
  console.log('\n🔨 Creating assets bucket...');
  
  try {
    const { data, error } = await supabase.storage.createBucket('assets', {
      public: true,
      fileSizeLimit: 52428800, // 50MB
      allowedMimeTypes: ['image/*', 'audio/*', 'video/*', 'text/*', 'application/*']
    });
    
    if (error) {
      console.log('❌ Failed to create assets bucket:', error.message);
      return false;
    }
    
    console.log('✅ Assets bucket created successfully');
    return true;
  } catch (error) {
    console.log('❌ Error creating assets bucket:', error.message);
    return false;
  }
}

async function testStorageUpload() {
  console.log('\n🧪 Testing storage upload...');
  
  try {
    const testContent = 'test file content';
    const testPath = 'test/validation.txt';
    
    const { data, error } = await supabase.storage
      .from('assets')
      .upload(testPath, testContent, {
        contentType: 'text/plain',
        upsert: true
      });
    
    if (error) {
      console.log('❌ Storage upload test failed:', error.message);
      console.log('💡 This indicates RLS policy issues');
      console.log('💡 You need to run the supabase-storage-diagnostic.sql script in your Supabase SQL Editor');
      return false;
    }
    
    console.log('✅ Storage upload test successful');
    
    // Clean up test file
    await supabase.storage.from('assets').remove([testPath]);
    console.log('✅ Test file cleaned up');
    
    return true;
  } catch (error) {
    console.log('❌ Error testing storage upload:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Supabase setup verification...\n');
  
  // Step 1: Check connection
  const connectionOk = await checkSupabaseConnection();
  if (!connectionOk) {
    console.log('\n❌ Cannot proceed without Supabase connection');
    process.exit(1);
  }
  
  // Step 2: Check videos table
  const tableExists = await checkVideosTable();
  if (!tableExists) {
    console.log('\n❌ Videos table does not exist');
    console.log('💡 Please run the following SQL in your Supabase SQL Editor:');
    console.log(`
CREATE TABLE IF NOT EXISTS public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  input_text TEXT,
  script TEXT,
  status TEXT DEFAULT 'pending',
  audio_url TEXT,
  captions_url TEXT,
  image_urls JSONB,
  storyboard_json JSONB,
  total_duration INTEGER,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY IF NOT EXISTS "Allow all operations on videos"
ON public.videos
FOR ALL
USING (true)
WITH CHECK (true);
    `);
    process.exit(1);
  }
  
  // Step 3: Check table columns
  const columnsOk = await checkTableColumns();
  if (!columnsOk) {
    console.log('\n❌ Missing required columns in videos table');
    console.log('💡 Please run the following SQL in your Supabase SQL Editor:');
    console.log(`
ALTER TABLE public.videos 
ADD COLUMN IF NOT EXISTS audio_url TEXT,
ADD COLUMN IF NOT EXISTS captions_url TEXT,
ADD COLUMN IF NOT EXISTS image_urls JSONB,
ADD COLUMN IF NOT EXISTS storyboard_json JSONB,
ADD COLUMN IF NOT EXISTS total_duration INTEGER,
ADD COLUMN IF NOT EXISTS error_message TEXT;
    `);
    process.exit(1);
  }
  
  // Step 4: Check storage bucket
  let bucketExists = await checkStorageBuckets();
  if (!bucketExists) {
    console.log('\n🔨 Creating assets bucket...');
    bucketExists = await createAssetsBucket();
    if (!bucketExists) {
      console.log('\n❌ Failed to create assets bucket');
      process.exit(1);
    }
  }
  
  // Step 5: Test storage upload
  const uploadOk = await testStorageUpload();
  if (!uploadOk) {
    console.log('\n❌ Storage upload test failed');
    console.log('💡 This indicates RLS policy issues with the assets bucket');
    console.log('💡 Please run the supabase-storage-diagnostic.sql script in your Supabase SQL Editor');
    process.exit(1);
  }
  
  // Final summary
  console.log('\n🎉 SUPABASE SETUP COMPLETE!');
  console.log('==========================');
  console.log('✅ Connection: Working');
  console.log('✅ Videos table: Exists with all required columns');
  console.log('✅ Assets bucket: Created and configured');
  console.log('✅ Storage upload: Test successful');
  console.log('\n🚀 Your Supabase setup is ready for video generation!');
}

// Run the diagnostic
main().catch(error => {
  console.error('\n❌ Unexpected error:', error.message);
  process.exit(1);
}); 