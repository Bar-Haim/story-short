#!/usr/bin/env node

/**
 * 🧪 Test Process Video Script
 * 
 * This script tests the new process-video.cjs functionality
 * by finding a video and running the process on it.
 */

const { execSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path'); // Added missing import for path

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

// Find a test video
async function findTestVideo(supabase) {
  info('Searching for a test video...');
  
  // First, try to find a video with status 'script_generated' or 'assets_missing'
  const { data: testVideos, error } = await supabase
    .from('videos')
    .select('id, status, input_text, script, created_at')
    .in('status', ['script_generated', 'assets_missing', 'failed'])
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  if (testVideos && testVideos.length > 0) {
    const video = testVideos[0];
    success(`Found test video: ${video.id} (status: ${video.status})`);
    return video.id;
  }

  // If no test videos found, create a simple one
  info('No test videos found, creating a simple test video...');
  
  const testInput = 'Create a short video about the benefits of exercise and healthy living.';
  
  const { data: newVideo, error: createError } = await supabase
    .from('videos')
    .insert({
      input_text: testInput,
      status: 'script_generated',
      script: 'HOOK: Want to feel amazing every day?\nBODY: Exercise boosts your energy, mood, and health.\nCTA: Start moving today for a better tomorrow!'
    })
    .select('id')
    .single();

  if (createError) {
    throw new Error(`Failed to create test video: ${createError.message}`);
  }

  success(`Created test video: ${newVideo.id}`);
  return newVideo.id;
}

// Test the process-video script
async function testProcessVideo(videoId) {
  header('TESTING PROCESS-VIDEO SCRIPT');
  
  try {
    info(`Testing process-video.cjs with video ID: ${videoId}`);
    
    const processScriptPath = path.join(__dirname, 'process-video.cjs');
    const command = `node "${processScriptPath}" ${videoId}`;
    
    log(`${colors.cyan}Executing: ${command}${colors.reset}`);
    
    execSync(command, { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    success('Process-video script completed successfully!');
    
  } catch (scriptError) {
    error('Process-video script failed');
    error(`Script exited with code: ${scriptError.status || 'unknown'}`);
    
    if (scriptError.stdout) {
      log('Script output:', 'yellow');
      console.log(scriptError.stdout.toString());
    }
    
    if (scriptError.stderr) {
      log('Script errors:', 'red');
      console.log(scriptError.stderr.toString());
    }
    
    throw new Error('Process-video test failed');
  }
}

// Verify the video was processed correctly
async function verifyVideoProcessing(supabase, videoId) {
  header('VERIFYING VIDEO PROCESSING');
  
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

  } else if (video.status === 'failed') {
    error('Video processing failed');
    if (video.error_message) {
      error(`Error message: ${video.error_message}`);
    }
  } else {
    warning(`Video status is: ${video.status} (not completed)`);
  }
}

// Main test function
async function runTest() {
  try {
    header('PROCESS-VIDEO TEST SUITE');
    
    // Initialize Supabase
    info('Initializing Supabase client...');
    const supabase = initializeSupabase();
    success('Supabase client initialized');
    
    // Find or create test video
    const videoId = await findTestVideo(supabase);
    
    // Test the process-video script
    await testProcessVideo(videoId);
    
    // Verify the results
    await verifyVideoProcessing(supabase, videoId);
    
    header('TEST COMPLETED SUCCESSFULLY');
    success('All tests passed! The process-video script is working correctly.');
    
  } catch (error) {
    header('TEST FAILED');
    error(`Test failed: ${error.message}`);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.length > 0) {
  // If video ID provided, test with that specific video
  const videoId = args[0];
  header(`TESTING WITH SPECIFIC VIDEO: ${videoId}`);
  
  const supabase = initializeSupabase();
  testProcessVideo(videoId)
    .then(() => verifyVideoProcessing(supabase, videoId))
    .then(() => {
      header('TEST COMPLETED SUCCESSFULLY');
      success('Process-video script test passed!');
    })
    .catch(error => {
      header('TEST FAILED');
      error(`Test failed: ${error.message}`);
      process.exit(1);
    });
} else {
  // Run full test suite
  runTest();
} 