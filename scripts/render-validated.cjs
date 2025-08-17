#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

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

// Main validation and rendering function
async function renderValidated(videoId) {
  try {
    // Validate input
    if (!videoId) {
      error('Video ID is required');
      console.log('Usage: node scripts/render-validated.js <videoId>');
      process.exit(1);
    }

    header(`VALIDATION & RENDERING PIPELINE - Video ID: ${videoId}`);

    // Step 1: Run validation
    header('STEP 1: VALIDATION');
    info('Running test-render-pipeline.js to validate video job...');
    
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
      
      log('\nValidation failed. Rendering will not proceed.', 'red');
      log('Please fix the validation issues before attempting to render.', 'yellow');
      process.exit(1);
    }

    // Step 2: Run rendering
    header('STEP 2: RENDERING');
    info('Validation passed! Proceeding with video rendering...');
    
    try {
      const renderScriptPath = path.join(__dirname, 'render-job.js');
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
      
      process.exit(1);
    }

    // Final success message
    header('PIPELINE COMPLETED SUCCESSFULLY');
    success(`Video ID ${videoId} has been validated and rendered successfully!`);
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
  header('VIDEO VALIDATION & RENDERING PIPELINE');
  log('This script validates a video job and renders it if validation passes.', 'cyan');
  log('\nUsage:', 'bright');
  log('  node scripts/render-validated.js <videoId>', 'white');
  log('\nExample:', 'bright');
  log('  node scripts/render-validated.js abc123-def456-ghi789', 'white');
  log('\nProcess:', 'bright');
  log('  1. Runs test-render-pipeline.js to validate the video job', 'cyan');
  log('  2. If validation passes, runs render-job.js to render the video', 'cyan');
  log('  3. If validation fails, stops and reports the issues', 'red');
  log('\nThis ensures safe, validated rendering in production environments.', 'green');
  process.exit(0);
}

// Run the main function
renderValidated(videoId); 