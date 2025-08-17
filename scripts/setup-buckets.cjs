#!/usr/bin/env node

/**
 * 🪣 Supabase Storage Bucket Setup Script
 * 
 * This script ensures that required storage buckets exist:
 * - assets: for general assets
 * - videos: for final rendered videos
 * - renders-images: for storyboard images
 * - renders-audio: for TTS audio files
 * - renders-captions: for VTT caption files
 * - renders-videos: for final rendered videos
 * 
 * Creates buckets if they don't exist, with public access
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Logging functions with colors
function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function info(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function header(message) {
  log(`\n${colors.bright}${colors.blue}${'='.repeat(60)}${colors.reset}`);
  log(`${colors.bright}${colors.blue}${message}${colors.reset}`);
  log(`${colors.bright}${colors.blue}${'='.repeat(60)}${colors.reset}\n`);
}

// Initialize Supabase client
function initializeSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

// Check if bucket exists
async function bucketExists(supabase, bucketName) {
  try {
    const { data: list, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      error(`Failed to list buckets: ${listError.message}`);
      return false;
    }
    
    const exists = list.some(bucket => bucket.name === bucketName);
    return exists;
  } catch (err) {
    error(`Error checking bucket "${bucketName}": ${err.message}`);
    return false;
  }
}

// Create bucket if it doesn't exist
async function ensureBucketExists(supabase, bucketName) {
  info(`Checking if bucket "${bucketName}" exists...`);
  
  const exists = await bucketExists(supabase, bucketName);
  
  if (exists) {
    success(`Bucket "${bucketName}" already exists. Skipping creation.`);
    return true;
  }
  
  info(`Creating bucket "${bucketName}"...`);
  
  try {
    const { error: createError } = await supabase.storage.createBucket(bucketName, {
      public: true,
      allowedMimeTypes: null,
      fileSizeLimit: null
    });
    
    if (createError) {
      error(`Failed to create bucket "${bucketName}": ${createError.message}`);
      return false;
    }
    
    success(`Bucket "${bucketName}" created successfully with public access.`);
    return true;
  } catch (err) {
    error(`Error creating bucket "${bucketName}": ${err.message}`);
    return false;
  }
}

// Test bucket functionality
async function testBucketFunctionality(supabase, bucketName) {
  info(`Testing bucket "${bucketName}" functionality...`);
  
  try {
    // Test upload
    const testContent = `Test file created at ${new Date().toISOString()}`;
    const testFileName = `test-${Date.now()}.txt`;
    
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(testFileName, testContent, {
        contentType: 'text/plain',
        upsert: true
      });
    
    if (uploadError) {
      error(`Upload test failed for bucket "${bucketName}": ${uploadError.message}`);
      return false;
    }
    
    success(`Upload test passed for bucket "${bucketName}"`);
    
    // Test download
    const { data: downloadData, error: downloadError } = await supabase.storage
      .from(bucketName)
      .download(testFileName);
    
    if (downloadError) {
      error(`Download test failed for bucket "${bucketName}": ${downloadError.message}`);
      return false;
    }
    
    success(`Download test passed for bucket "${bucketName}"`);
    
    // Test public URL
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(testFileName);
    
    if (urlData.publicUrl) {
      success(`Public URL test passed for bucket "${bucketName}"`);
    } else {
      warning(`Public URL test failed for bucket "${bucketName}"`);
    }
    
    // Clean up test file
    const { error: deleteError } = await supabase.storage
      .from(bucketName)
      .remove([testFileName]);
    
    if (deleteError) {
      warning(`Failed to clean up test file in bucket "${bucketName}": ${deleteError.message}`);
    } else {
      success(`Test file cleaned up from bucket "${bucketName}"`);
    }
    
    return true;
    
  } catch (err) {
    error(`Bucket functionality test failed for "${bucketName}": ${err.message}`);
    return false;
  }
}

// Main setup function
async function setupBuckets() {
  try {
    header('SUPABASE STORAGE BUCKET SETUP');
    
    // Initialize Supabase
    info('Initializing Supabase client...');
    const supabase = initializeSupabase();
    success('Supabase client initialized');
    
    // Define required buckets according to spec
    const requiredBuckets = [
      'assets',           // General assets (legacy)
      'videos',          // Final rendered videos (legacy)
      'renders-images',  // Storyboard images (spec requirement)
      'renders-audio',   // TTS audio files (spec requirement)
      'renders-captions', // VTT caption files (spec requirement)
      'renders-videos'   // Final rendered videos (spec requirement)
    ];
    
    // Ensure each bucket exists
    for (const bucketName of requiredBuckets) {
      const created = await ensureBucketExists(supabase, bucketName);
      if (!created) {
        error(`Failed to ensure bucket "${bucketName}" exists`);
        continue;
      }
      
      // Test bucket functionality
      const testPassed = await testBucketFunctionality(supabase, bucketName);
      if (!testPassed) {
        warning(`Bucket "${bucketName}" functionality test failed`);
      }
    }
    
    header('BUCKET SETUP COMPLETED');
    success('All required buckets have been checked and created if needed.');
    info('Buckets are ready for use by the video processing system.');
    info('Spec buckets: renders-images, renders-audio, renders-captions, renders-videos');
    
  } catch (setupError) {
    header('BUCKET SETUP FAILED');
    error(`Setup failed: ${setupError.message}`);
    process.exit(1);
  }
}

// Run the setup
setupBuckets(); 