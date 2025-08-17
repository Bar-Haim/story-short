#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

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

function separator() {
  log(`${colors.yellow}${'-'.repeat(60)}${colors.reset}\n`);
}

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const { createClient } = require('@supabase/supabase-js');

function initializeSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

// Fetch video by ID
async function fetchVideo(supabase, videoId) {
  info(`Fetching video data for ID: ${videoId}`);
  
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('id', videoId)
    .single();

  if (error || !data) {
    throw new Error(`Video not found: ${error?.message || 'No data returned'}`);
  }

  success('Video record found');
  info(`Status: ${data.status}`);
  info(`Input text: ${data.input_text?.substring(0, 50)}...`);
  
  return data;
}

// Update video status
async function updateVideoStatus(supabase, videoId, status, errorMessage = null) {
  const updates = { status };
  if (errorMessage) {
    updates.error_message = errorMessage;
  }

  const { error } = await supabase
    .from('videos')
    .update(updates)
    .eq('id', videoId);

  if (error) {
    throw new Error(`Failed to update video status: ${error.message}`);
  }

  success(`Video status updated to: ${status}`);
}

// Validate that all required assets exist
function validateAssets(video) {
  info('Validating video assets...');

  // Check audio
  if (!video.audio_url) {
    throw new Error('Missing audio_url');
  }
  success('Audio URL present');

  // Check captions
  if (!video.captions_url) {
    throw new Error('Missing captions_url');
  }
  success('Captions URL present');

  // Check storyboard
  if (!video.storyboard_json?.scenes) {
    throw new Error('Missing storyboard_json.scenes');
  }
  success(`Storyboard has ${video.storyboard_json.scenes.length} scenes`);

  // Check each scene has image_url
  const scenes = video.storyboard_json.scenes;
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (!scene.image_url) {
      throw new Error(`Scene ${i + 1} missing image_url`);
    }
    success(`Scene ${i + 1}: image_url present`);
  }

  success('All assets validated successfully');
}

// Run validation using test-render-pipeline.js
async function runValidation(videoId) {
  header('STEP 4: VALIDATION');
  info('Running validation pipeline...');
  
  try {
    const testScriptPath = path.join(__dirname, 'test-render-pipeline.js');
    const testCommand = `node "${testScriptPath}" ${videoId}`;
    
    log(`${colors.cyan}Executing: ${testCommand}${colors.reset}`);
    separator();
    
    execSync(testCommand, { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    success('Validation completed successfully!');
    separator();
    
  } catch (testError) {
    error('VALIDATION FAILED');
    error(`Test script exited with code: ${testError.status || 'unknown'}`);
    
    if (testError.stdout) {
      log('Test output:', 'yellow');
      console.log(testError.stdout.toString());
    }
    
    if (testError.stderr) {
      log('Test errors:', 'red');
      console.log(testError.stderr.toString());
    }
    
    throw new Error('Validation failed');
  }
}

// Run rendering using render-validated.cjs
async function runRendering(videoId) {
  header('STEP 5: RENDERING');
  info('Starting video rendering...');
  
  try {
    const renderScriptPath = path.join(__dirname, 'render-validated.cjs');
    const renderCommand = `node "${renderScriptPath}" ${videoId}`;
    
    log(`${colors.cyan}Executing: ${renderCommand}${colors.reset}`);
    separator();
    
    execSync(renderCommand, { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    success('Rendering completed successfully!');
    separator();
    
  } catch (renderError) {
    error('RENDERING FAILED');
    error(`Render script exited with code: ${renderError.status || 'unknown'}`);
    
    if (renderError.stdout) {
      log('Render output:', 'yellow');
      console.log(renderError.stdout.toString());
    }
    
    if (renderError.stderr) {
      log('Render errors:', 'red');
      console.log(renderError.stderr.toString());
    }
    
    throw new Error('Rendering failed');
  }
}

// Main processing function
async function processVideo(videoId) {
  try {
    // Validate input
    if (!videoId) {
      error('Video ID is required');
      console.log('Usage: node scripts/process-video.cjs <videoId>');
      process.exit(1);
    }

    header(`VIDEO PROCESSING PIPELINE - Video ID: ${videoId}`);

    // Step 1: Load environment and create Supabase client
    header('STEP 1: INITIALIZATION');
    info('Loading environment variables...');
    info('Initializing Supabase client...');
    const supabase = initializeSupabase();
    success('Supabase client initialized');
    separator();

    // Step 2: Fetch video record
    header('STEP 2: FETCH VIDEO');
    const video = await fetchVideo(supabase, videoId);
    separator();

    // Step 3: Check if assets need to be generated
    header('STEP 3: ASSET GENERATION');
    
    const needsAssets = ['failed', 'script_generated', 'assets_missing'].includes(video.status);
    
    if (needsAssets) {
      info('Assets need to be generated...');
      
      // 3.1: Ensure script exists
      if (!video.script && !video.input_text) {
        const errorMsg = 'No script or input_text available. User must provide initial content.';
        error(errorMsg);
        await updateVideoStatus(supabase, videoId, 'failed', errorMsg);
        process.exit(1);
      }
      success('Script validation passed');

      // 3.2-3.4: Generate missing assets using the TypeScript helper
      info('Generating missing assets...');
      
      try {
        // Import the asset generation functions
        const { ensureAllAssets } = require('./generate-assets-for-video.ts');
        
        const assets = await ensureAllAssets(video);
        
        // Update video with new assets
        const { error: updateError } = await supabase
          .from('videos')
          .update({
            audio_url: assets.audio_url,
            captions_url: assets.captions_url,
            storyboard_json: assets.storyboard_json,
            status: 'assets_generated'
          })
          .eq('id', videoId);

        if (updateError) {
          throw new Error(`Failed to update video with assets: ${updateError.message}`);
        }

        success('All assets generated and database updated');
        
        // Fetch updated video data
        const updatedVideo = await fetchVideo(supabase, videoId);
        video.audio_url = updatedVideo.audio_url;
        video.captions_url = updatedVideo.captions_url;
        video.storyboard_json = updatedVideo.storyboard_json;
        
      } catch (assetError) {
        const errorMsg = `Asset generation failed: ${assetError.message}`;
        error(errorMsg);
        await updateVideoStatus(supabase, videoId, 'failed', errorMsg);
        process.exit(1);
      }
      
    } else {
      info('Assets already exist, skipping generation');
      
      // If assets exist but status is not assets_generated, update status
      if (video.audio_url && video.captions_url && video.storyboard_json?.scenes) {
        const allScenesHaveImages = video.storyboard_json.scenes.every(scene => scene.image_url);
        if (allScenesHaveImages) {
          info('All assets present, updating status to assets_generated');
          await updateVideoStatus(supabase, videoId, 'assets_generated');
        }
      }
    }

    // Step 4: Validation
    try {
      validateAssets(video);
      await runValidation(videoId);
    } catch (validationError) {
      const errorMsg = `Validation failed: ${validationError.message}`;
      error(errorMsg);
      await updateVideoStatus(supabase, videoId, 'failed', errorMsg);
      process.exit(1);
    }

    // Step 5: Rendering
    try {
      // Update status to rendering
      await updateVideoStatus(supabase, videoId, 'rendering');
      
      await runRendering(videoId);
      
      // Update final status
      await updateVideoStatus(supabase, videoId, 'completed');
      
    } catch (renderingError) {
      const errorMsg = `Rendering failed: ${renderingError.message}`;
      error(errorMsg);
      await updateVideoStatus(supabase, videoId, 'failed', errorMsg);
      process.exit(1);
    }

    // Final success message
    header('PIPELINE COMPLETED SUCCESSFULLY');
    success(`Video ID ${videoId} has been processed successfully!`);
    log('The video is now available in Supabase storage.', 'green');

  } catch (error) {
    error('UNEXPECTED ERROR');
    console.error('An unexpected error occurred:', error);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const videoId = args[0];

// Show usage if no arguments provided
if (args.length === 0) {
  header('VIDEO PROCESSING PIPELINE');
  log('This script processes a video from start to finish, generating missing assets and rendering the final video.', 'cyan');
  log('\nUsage:', 'bright');
  log('  node scripts/process-video.cjs <videoId>', 'white');
  log('\nExample:', 'bright');
  log('  node scripts/process-video.cjs abc123-def456-ghi789', 'white');
  log('\nProcess:', 'bright');
  log('  1. Load environment and initialize Supabase', 'cyan');
  log('  2. Fetch video record by ID', 'cyan');
  log('  3. Generate missing assets (audio, captions, images)', 'cyan');
  log('  4. Validate all assets are present', 'cyan');
  log('  5. Render final video', 'cyan');
  log('\nThis ensures complete video processing with proper error handling.', 'green');
  process.exit(0);
}

// Run the main function
processVideo(videoId); 