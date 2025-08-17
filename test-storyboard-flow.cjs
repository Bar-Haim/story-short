#!/usr/bin/env node

/**
 * 🧪 Test Storyboard Generation Flow
 * 
 * This script tests the complete flow:
 * 1. Generate script
 * 2. Verify storyboard generation is triggered
 * 3. Check that assets generation only runs if storyboard succeeds
 */

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

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

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function info(message) {
  log(`ℹ️ ${message}`, 'cyan');
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function warning(message) {
  log(`⚠️ ${message}`, 'yellow');
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

async function testStoryboardFlow() {
  try {
    info('🧪 Testing Storyboard Generation Flow');
    
    // Step 1: Generate script
    info('📝 Step 1: Generating script...');
    
    const scriptResponse = await fetch('http://localhost:4000/api/generate-script', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputText: 'Create a short video about the benefits of exercise',
        theme: 'fitness',
        language: 'english',
        tone: 'motivational'
      }),
    });

    if (!scriptResponse.ok) {
      const errorData = await scriptResponse.json();
      error(`Script generation failed: ${JSON.stringify(errorData, null, 2)}`);
      return;
    }

    const scriptData = await scriptResponse.json();
    success('Script generated successfully');
    info(`Video ID: ${scriptData.videoId}`);
    info(`Script length: ${scriptData.script?.length || 0} characters`);
    
    const videoId = scriptData.videoId;
    
    // Step 2: Wait a moment for storyboard generation to start
    info('⏳ Step 2: Waiting for storyboard generation...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 3: Check video status
    info('🔍 Step 3: Checking video status...');
    
    const statusResponse = await fetch(`http://localhost:4000/api/video-status?id=${videoId}`);
    
    if (!statusResponse.ok) {
      const errorData = await statusResponse.json();
      error(`Status check failed: ${JSON.stringify(errorData, null, 2)}`);
      return;
    }
    
    const statusData = await statusResponse.json();
    info(`Current status: ${statusData.status}`);
    info(`Error message: ${statusData.error_message || 'None'}`);
    
    if (statusData.status === 'storyboard_generated') {
      success('Storyboard generation completed successfully!');
      info(`Storyboard scenes: ${statusData.storyboard_json?.scenes?.length || 0}`);
    } else if (statusData.status === 'storyboard_failed') {
      error('Storyboard generation failed');
      info(`Error: ${statusData.error_message}`);
    } else {
      warning(`Unexpected status: ${statusData.status}`);
    }
    
    // Step 4: Try to trigger asset generation (should fail if storyboard failed)
    info('🖼️ Step 4: Testing asset generation guard...');
    
    const assetsResponse = await fetch('http://localhost:4000/api/generate-assets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoId: videoId,
        script: scriptData.script,
        voiceId: 'Dslrhjl3ZpzrctukrQSN',
      }),
    });

    if (!assetsResponse.ok) {
      const errorData = await assetsResponse.json();
      if (errorData.reason === 'no_storyboard') {
        success('✅ Asset generation guard working correctly - blocked due to missing storyboard');
        info(`Reason: ${errorData.reason}`);
        info(`Status: ${errorData.status}`);
      } else {
        error(`Asset generation failed: ${JSON.stringify(errorData, null, 2)}`);
      }
    } else {
      success('Asset generation started successfully');
    }
    
  } catch (err) {
    error(`Test failed: ${err.message}`);
    console.error(err);
  }
}

// Run the test
testStoryboardFlow(); 