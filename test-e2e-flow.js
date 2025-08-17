#!/usr/bin/env node

/**
 * 🧪 Test End-to-End Flow
 * 
 * This script tests the complete flow from script generation to video completion
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

// Create test video
async function createTestVideo(supabase) {
  info('Creating test video for E2E flow...');
  
  const testInput = 'Create a short video about the benefits of exercise and healthy living.';
  const testScript = 'HOOK: Want to feel amazing every day?\nBODY: Exercise boosts your energy, mood, and health.\nCTA: Start moving today for a better tomorrow!';
  
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

// Process video using CLI
async function processVideo(videoId) {
  header('PROCESSING VIDEO WITH CLI');
  
  try {
    info(`Processing video: ${videoId}`);
    
    const { execSync } = require('child_process');
    const path = require('path');
    
    const processScriptPath = path.join(__dirname, 'scripts', 'process-video.cjs');
    const command = `node "${processScriptPath}" ${videoId}`;
    
    log(`${colors.cyan}Executing: ${command}${colors.reset}`);
    
    execSync(command, { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    success('Video processing completed successfully!');
    return true;
    
  } catch (scriptError) {
    error('Video processing failed');
    error(`Script exited with code: ${scriptError.status || 'unknown'}`);
    return false;
  }
}

// Verify final video
async function verifyVideo(supabase, videoId) {
  header('VERIFYING FINAL VIDEO');
  
  info(`Checking final status of video: ${videoId}`);
  
  const { data: video, error } = await supabase
    .from('videos')
    .select('*')
    .eq('id', videoId)
    .single();

  if (error || !video) {
    throw new Error(`Failed to fetch video: ${error?.message || 'Video not found'}`);
  }

  info(`Final status: ${video.status}`);
  
  if (video.status === 'completed') {
    success('Video processing completed successfully!');
    
    // Check for required assets
    const checks = [
      { name: 'Audio URL', value: video.audio_url, required: true },
      { name: 'Captions URL', value: video.captions_url, required: true },
      { name: 'Storyboard JSON', value: video.storyboard_json, required: true },
      { name: 'Final Video URL', value: video.final_video_url, required: false },
      { name: 'Total Duration', value: video.total_duration, required: false }
    ];

    checks.forEach(check => {
      if (check.required && !check.value) {
        error(`Missing required field: ${check.name}`);
      } else if (check.value) {
        success(`${check.name}: Present`);
      } else {
        warning(`${check.name}: Not present (optional)`);
      }
    });

    // Check storyboard scenes
    if (video.storyboard_json?.scenes) {
      const scenes = video.storyboard_json.scenes;
      success(`Storyboard has ${scenes.length} scenes`);
      
      scenes.forEach((scene, index) => {
        if (scene.image_url) {
          success(`Scene ${index + 1}: image_url present`);
        } else {
          error(`Scene ${index + 1}: missing image_url`);
        }
      });
    }

    if (video.final_video_url) {
      success(`Final video URL: ${video.final_video_url}`);
    }

  } else if (video.status === 'failed') {
    error('Video processing failed');
    if (video.error_message) {
      error(`Error message: ${video.error_message}`);
    }
    return false;
  } else {
    warning(`Video status is: ${video.status} (not completed)`);
    return false;
  }

  return true;
}

// Main test function
async function runTest() {
  try {
    header('END-TO-END FLOW TEST');
    
    // Initialize Supabase
    info('Initializing Supabase client...');
    const supabase = initializeSupabase();
    success('Supabase client initialized');
    
    // Create test video
    const videoId = await createTestVideo(supabase);
    
    // Process video using CLI
    const processingSuccess = await processVideo(videoId);
    if (!processingSuccess) {
      throw new Error('Video processing failed');
    }
    
    // Verify final video
    const verificationSuccess = await verifyVideo(supabase, videoId);
    
    if (verificationSuccess) {
      header('TEST COMPLETED SUCCESSFULLY');
      success('End-to-end flow test passed! Video was processed completely.');
      success(`Video ID: ${videoId}`);
    } else {
      header('TEST FAILED');
      error('End-to-end flow test failed. Video processing did not complete successfully.');
      process.exit(1);
    }
    
  } catch (testError) {
    header('TEST FAILED');
    error(`Test failed: ${testError.message}`);
    process.exit(1);
  }
}

// Run the test
runTest(); 