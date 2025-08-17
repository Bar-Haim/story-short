#!/usr/bin/env node

/**
 * 🧪 Test Auto-Processing Script
 * 
 * This script tests the auto-processing functionality by:
 * 1. Creating a test video with script_generated status
 * 2. Triggering auto-processing via API
 * 3. Monitoring status changes
 */

const { createClient } = require('@supabase/supabase-js');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

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

// Create test video
async function createTestVideo(supabase) {
  info('Creating test video for auto-processing...');
  
  const testInput = 'Create a short video about the benefits of meditation and mindfulness.';
  const testScript = 'HOOK: Want to find peace in a busy world?\nBODY: Meditation helps you stay calm and focused.\nCTA: Start your mindfulness journey today!';
  
  const { data: newVideo, error: createError } = await supabase
    .from('videos')
    .insert({
      input_text: testInput,
      status: 'script_generated',
      script: testScript
    })
    .select('id')
    .single();

  if (createError) {
    throw new Error(`Failed to create test video: ${createError.message}`);
  }

  success(`Created test video: ${newVideo.id}`);
  return newVideo.id;
}

// Test auto-processing API
async function testAutoProcessing(videoId) {
  header('TESTING AUTO-PROCESSING API');
  
  try {
    info(`Testing auto-processing for video: ${videoId}`);
    
    const response = await fetch(`http://localhost:4000/api/process-video?id=${videoId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      success('Auto-processing API call successful');
      info(`Response: ${data.message}`);
      return true;
    } else {
      error('Auto-processing API call failed');
      error(`Status: ${response.status}`);
      error(`Response: ${JSON.stringify(data)}`);
      return false;
    }
    
  } catch (apiError) {
    error(`Auto-processing API error: ${apiError.message}`);
    return false;
  }
}

// Monitor status changes
async function monitorStatus(videoId, maxAttempts = 20) {
  header('MONITORING STATUS CHANGES');
  
  let attempts = 0;
  let lastStatus = '';
  
  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`http://localhost:4000/api/video-status?id=${videoId}`);
      const data = await response.json();
      
      if (data.success) {
        if (data.status !== lastStatus) {
          info(`Status changed: ${lastStatus} → ${data.status}`);
          lastStatus = data.status;
        }
        
        info(`Current status: ${data.status} (${data.progress}%) - ${data.stage}`);
        
        if (data.status === 'completed') {
          success('Video processing completed successfully!');
          return true;
        } else if (data.status === 'failed') {
          error(`Video processing failed: ${data.error_message}`);
          return false;
        }
      }
      
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
      
    } catch (error) {
      error(`Status monitoring error: ${error.message}`);
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  warning('Status monitoring timed out');
  return false;
}

// Main test function
async function runTest() {
  try {
    header('AUTO-PROCESSING TEST SUITE');
    
    // Initialize Supabase
    info('Initializing Supabase client...');
    const supabase = initializeSupabase();
    success('Supabase client initialized');
    
    // Create test video
    const videoId = await createTestVideo(supabase);
    
    // Test auto-processing API
    const apiSuccess = await testAutoProcessing(videoId);
    if (!apiSuccess) {
      throw new Error('Auto-processing API test failed');
    }
    
    // Monitor status changes
    const processingSuccess = await monitorStatus(videoId);
    
    if (processingSuccess) {
      header('TEST COMPLETED SUCCESSFULLY');
      success('Auto-processing test passed! Video was processed automatically.');
    } else {
      header('TEST FAILED');
      error('Auto-processing test failed. Video processing did not complete successfully.');
      process.exit(1);
    }
    
  } catch (testError) {
    header('TEST FAILED');
    error(`Test failed: ${testError.message}`);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.length > 0) {
  // If video ID provided, test with that specific video
  const videoId = args[0];
  header(`TESTING AUTO-PROCESSING WITH SPECIFIC VIDEO: ${videoId}`);
  
  testAutoProcessing(videoId)
    .then(success => {
      if (success) {
        return monitorStatus(videoId);
      }
      return false;
    })
    .then(processingSuccess => {
      if (processingSuccess) {
        header('TEST COMPLETED SUCCESSFULLY');
        success('Auto-processing test passed!');
      } else {
        header('TEST FAILED');
        error('Auto-processing test failed');
        process.exit(1);
      }
    })
    .catch(testError => {
      header('TEST FAILED');
      error(`Test failed: ${testError.message}`);
      process.exit(1);
    });
} else {
  // Run full test suite
  runTest();
} 