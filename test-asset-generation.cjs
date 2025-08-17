#!/usr/bin/env node

/**
 * 🧪 Test Asset Generation Flow
 * 
 * This script tests the asset generation flow with an existing video
 * that has storyboard_json to verify the new logging and validation.
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

async function testAssetGeneration() {
  try {
    info('🧪 Testing Asset Generation Flow');
    
    // Use the video ID from the successful test earlier
    const videoId = '7a7ed250-a9c1-4c84-a9ae-82ebdb8a02ce';
    
    info(`Testing with videoId: ${videoId}`);
    
         // Test the generate-assets API
     const response = await fetch('http://localhost:4000/api/generate-assets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoId: videoId,
        script: 'HOOK: Want to feel amazing every day?\nBODY: Exercise boosts your energy, mood, and health.\nCTA: Start moving today for a better tomorrow!',
        voiceId: 'Dslrhjl3ZpzrctukrQSN',
      }),
    });

    info(`Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      error(`API Error: ${JSON.stringify(errorData, null, 2)}`);
      return;
    }

    const data = await response.json();
    success('Asset generation test completed');
    info(`Response data: ${JSON.stringify(data, null, 2)}`);
    
  } catch (err) {
    error(`Test failed: ${err.message}`);
    console.error(err);
  }
}

// Run the test
testAssetGeneration(); 