#!/usr/bin/env node

/**
 * Supabase Storage Setup Script
 * 
 * Ensures that the required storage buckets exist and are configured correctly
 * for public access with proper CORS settings.
 */

const { createClient } = require('@supabase/supabase-js');

// Environment setup
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRole) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRole);

const requiredBuckets = [
  {
    name: 'renders-images',
    public: true,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    fileSizeLimit: 10485760, // 10MB
  },
  {
    name: 'renders-audio',
    public: true,
    allowedMimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav'],
    fileSizeLimit: 52428800, // 50MB
  },
  {
    name: 'renders-captions',
    public: true,
    allowedMimeTypes: ['text/vtt', 'text/plain'],
    fileSizeLimit: 1048576, // 1MB
  },
  {
    name: 'renders-videos',
    public: true,
    allowedMimeTypes: ['video/mp4', 'video/quicktime'],
    fileSizeLimit: 104857600, // 100MB
  }
];

async function setupBucket(bucketConfig) {
  const { name, public: isPublic, allowedMimeTypes, fileSizeLimit } = bucketConfig;
  
  console.log(`\n📁 Setting up bucket: ${name}`);
  
  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error(`❌ Failed to list buckets: ${listError.message}`);
      return false;
    }
    
    const existingBucket = buckets.find(b => b.name === name);
    
    if (!existingBucket) {
      console.log(`  Creating new bucket: ${name}`);
      
      const { data, error } = await supabase.storage.createBucket(name, {
        public: isPublic,
        allowedMimeTypes,
        fileSizeLimit
      });
      
      if (error) {
        console.error(`  ❌ Failed to create bucket: ${error.message}`);
        return false;
      }
      
      console.log(`  ✅ Created bucket: ${name}`);
    } else {
      console.log(`  ✅ Bucket exists: ${name}`);
      
      // Update bucket to ensure it's public if needed
      if (isPublic && !existingBucket.public) {
        console.log(`  🔧 Making bucket public: ${name}`);
        
        const { error: updateError } = await supabase.storage.updateBucket(name, {
          public: true
        });
        
        if (updateError) {
          console.error(`  ❌ Failed to make bucket public: ${updateError.message}`);
          return false;
        }
        
        console.log(`  ✅ Made bucket public: ${name}`);
      }
    }
    
    // Test upload and public URL generation
    console.log(`  🧪 Testing bucket: ${name}`);
    
    const testFileName = `test-${Date.now()}.txt`;
    const testContent = 'Test file for bucket verification';
    
    const { error: uploadError } = await supabase.storage
      .from(name)
      .upload(testFileName, testContent, {
        contentType: 'text/plain',
        upsert: true
      });
    
    if (uploadError) {
      console.error(`  ❌ Test upload failed: ${uploadError.message}`);
      return false;
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage.from(name).getPublicUrl(testFileName);
    
    if (!urlData.publicUrl) {
      console.error(`  ❌ Failed to generate public URL`);
      return false;
    }
    
    console.log(`  ✅ Public URL: ${urlData.publicUrl.substring(0, 80)}...`);
    
    // Clean up test file
    await supabase.storage.from(name).remove([testFileName]);
    
    console.log(`  ✅ Bucket ${name} is ready`);
    return true;
    
  } catch (error) {
    console.error(`  ❌ Error setting up bucket ${name}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Setting up Supabase Storage buckets...\n');
  
  let allSuccess = true;
  
  for (const bucketConfig of requiredBuckets) {
    const success = await setupBucket(bucketConfig);
    allSuccess = allSuccess && success;
  }
  
  console.log('\n' + '='.repeat(50));
  
  if (allSuccess) {
    console.log('✅ All storage buckets are ready!');
    console.log('\n📋 CORS Configuration Note:');
    console.log('Supabase automatically handles CORS for public buckets.');
    console.log('If you encounter CORS issues, check your Supabase project settings.');
    
    console.log('\n🔧 Path Structure:');
    console.log('Images: videos/{videoId}/images/scene-{n}.jpg');
    console.log('Audio:  videos/{videoId}/audio.mp3');
    console.log('Captions: videos/{videoId}/captions.vtt');
    console.log('Videos: videos/{videoId}/final.mp4');
    
  } else {
    console.log('❌ Some buckets failed to set up properly.');
    console.log('Please check your Supabase configuration and try again.');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });
}

module.exports = { setupBucket, requiredBuckets };