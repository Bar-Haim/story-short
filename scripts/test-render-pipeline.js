#!/usr/bin/env node

/**
 * Test Script for StoryShort Video Rendering Pipeline
 * 
 * This script validates the setup and can test the rendering pipeline
 * with a sample video ID to ensure everything is working correctly.
 * 
 * Usage: node test-render-pipeline.js [videoId]
 */

import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '..');

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: path.join(projectRoot, '.env.local') });

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Logging utilities
const log = (msg) => console.log(`\x1b[36m[🧪 TEST]\x1b[0m ${msg}`);
const success = (msg) => console.log(`\x1b[32m[✅ PASS]\x1b[0m ${msg}`);
const error = (msg) => console.log(`\x1b[31m[❌ FAIL]\x1b[0m ${msg}`);
const warn = (msg) => console.log(`\x1b[33m[⚠️ WARN]\x1b[0m ${msg}`);
const info = (msg) => console.log(`\x1b[34m[ℹ️ INFO]\x1b[0m ${msg}`);

// Test functions
async function testEnvironment() {
  log('Testing environment setup...');
  
  // Check environment variables
  if (!supabaseUrl) {
    error('NEXT_PUBLIC_SUPABASE_URL is not set');
    return false;
  }
  success('NEXT_PUBLIC_SUPABASE_URL is set');
  
  if (!supabaseServiceKey) {
    error('SUPABASE_SERVICE_ROLE_KEY is not set');
    return false;
  }
  success('SUPABASE_SERVICE_ROLE_KEY is set');
  
  return true;
}

async function testSupabaseConnection() {
  log('Testing Supabase connection...');
  
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Test connection by fetching a single record
    const { data, error: fetchError } = await supabase
      .from('videos')
      .select('id')
      .limit(1);
    
    if (fetchError) {
      error(`Supabase connection failed: ${fetchError.message}`);
      return false;
    }
    
    success('Supabase connection successful');
    info(`Found ${data?.length || 0} video records in database`);
    return true;
    
  } catch (err) {
    error(`Supabase connection error: ${err.message}`);
    return false;
  }
}

async function testFFmpegInstallation() {
  log('Testing FFmpeg installation...');
  
  try {
    const { stdout } = await execAsync('ffmpeg -version', { timeout: 10000 });
    
    // Extract version from output
    const versionMatch = stdout.match(/ffmpeg version ([^\s]+)/);
    if (versionMatch) {
      success(`FFmpeg is installed: ${versionMatch[1]}`);
    } else {
      success('FFmpeg is installed (version info not available)');
    }
    
    return true;
    
  } catch (err) {
    error('FFmpeg is not installed or not in PATH');
    info('Please install FFmpeg: https://ffmpeg.org/download.html');
    return false;
  }
}

async function testFFprobeInstallation() {
  log('Testing FFprobe installation...');
  
  try {
    const { stdout } = await execAsync('ffprobe -version', { timeout: 10000 });
    
    // Extract version from output
    const versionMatch = stdout.match(/ffprobe version ([^\s]+)/);
    if (versionMatch) {
      success(`FFprobe is installed: ${versionMatch[1]}`);
    } else {
      success('FFprobe is installed (version info not available)');
    }
    
    return true;
    
  } catch (err) {
    error('FFprobe is not installed or not in PATH');
    info('FFprobe usually comes with FFmpeg installation');
    return false;
  }
}

async function testFileSystemPermissions() {
  log('Testing file system permissions...');
  
  try {
    const tempDir = path.join(process.cwd(), 'test-temp');
    
    // Test directory creation
    await fs.promises.mkdir(tempDir, { recursive: true });
    success('Can create directories');
    
    // Test file writing
    const testFile = path.join(tempDir, 'test.txt');
    await fs.promises.writeFile(testFile, 'test content');
    success('Can write files');
    
    // Test file reading
    const content = await fs.promises.readFile(testFile, 'utf8');
    if (content === 'test content') {
      success('Can read files');
    } else {
      error('File content mismatch');
      return false;
    }
    
    // Test file deletion
    await fs.promises.unlink(testFile);
    await fs.promises.rmdir(tempDir);
    success('Can delete files and directories');
    
    return true;
    
  } catch (err) {
    error(`File system test failed: ${err.message}`);
    return false;
  }
}

async function testVideoRecord(videoId) {
  log(`Testing video record: ${videoId}`);
  
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Fetch video record
    const { data, error: fetchError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();
    
    if (fetchError || !data) {
      error(`Video not found: ${fetchError?.message || 'No data returned'}`);
      return false;
    }
    
    success('Video record found');
    info(`Input text: ${data.input_text?.substring(0, 50)}...`);
    info(`Status: ${data.status}`);
    
    // Check required fields
    const requiredFields = [
      { field: 'audio_url', value: data.audio_url },
      { field: 'storyboard_json', value: data.storyboard_json }
    ];
    
    for (const { field, value } of requiredFields) {
      if (!value) {
        error(`Missing required field: ${field}`);
        return false;
      }
      success(`Required field present: ${field}`);
    }
    
    // Check storyboard structure
    if (data.storyboard_json?.scenes) {
      const scenes = data.storyboard_json.scenes;
      success(`Storyboard has ${scenes.length} scenes`);
      
      // Check each scene
      const missingImageErrors = [];
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        if (!scene.image_url) {
          const errorMessage = `Missing image_url in scene ${i + 1}`;
          missingImageErrors.push(errorMessage);
          error(`Scene ${i + 1} missing image_url`);
        } else {
          success(`Scene ${i + 1}: image_url present`);
        }
        if (!scene.duration || scene.duration <= 0) {
          warn(`Scene ${i + 1} has invalid duration: ${scene.duration}`);
        }
      }
      
      // If any missing image URLs found, update video status to failed
      if (missingImageErrors.length > 0) {
        error('Storyboard validation failed, updating video status to failed');
        
        try {
          await supabase
            .from('videos')
            .update({ 
              status: 'failed',
              error_message: missingImageErrors[0] // Use first error as primary message
            })
            .eq('id', videoId);
          
          success(`Updated video status to failed: ${missingImageErrors[0]}`);
        } catch (updateError) {
          error(`Failed to update video status: ${updateError.message}`);
        }
        
        return false;
      }
    } else {
      error('Storyboard missing scenes array');
      return false;
    }
    
    // Check optional fields
    if (data.captions_url) {
      success('Captions URL present');
    } else {
      info('No captions URL (optional)');
    }
    
    return true;
    
  } catch (err) {
    error(`Video record test failed: ${err.message}`);
    return false;
  }
}

async function testAssetDownloads(videoId) {
  log(`Testing asset downloads for video: ${videoId}`);
  
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Fetch video record
    const { data, error: fetchError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();
    
    if (fetchError || !data) {
      error('Cannot test downloads: video not found');
      return false;
    }
    
    // Test audio download
    if (data.audio_url) {
      try {
        const audioResponse = await fetch(data.audio_url);
        if (audioResponse.ok) {
          const audioBuffer = await audioResponse.arrayBuffer();
          success(`Audio download successful: ${Math.round(audioBuffer.byteLength / 1024)} KB`);
        } else {
          error(`Audio download failed: ${audioResponse.status} ${audioResponse.statusText}`);
          return false;
        }
      } catch (err) {
        error(`Audio download error: ${err.message}`);
        return false;
      }
    }
    
    // Test captions download
    if (data.captions_url) {
      try {
        const captionsResponse = await fetch(data.captions_url);
        if (captionsResponse.ok) {
          const captionsText = await captionsResponse.text();
          success(`Captions download successful: ${captionsText.length} characters`);
        } else {
          warn(`Captions download failed: ${captionsResponse.status} ${captionsResponse.statusText}`);
        }
      } catch (err) {
        warn(`Captions download error: ${err.message}`);
      }
    }
    
    // Test image downloads
    if (data.storyboard_json?.scenes) {
      const scenes = data.storyboard_json.scenes;
      let successCount = 0;
      let failCount = 0;
      
      for (let i = 0; i < Math.min(scenes.length, 3); i++) { // Test first 3 images
        const scene = scenes[i];
        if (scene.image_url) {
          try {
            const imageResponse = await fetch(scene.image_url);
            if (imageResponse.ok) {
              const imageBuffer = await imageResponse.arrayBuffer();
              success(`Image ${i + 1} download successful: ${Math.round(imageBuffer.byteLength / 1024)} KB`);
              successCount++;
            } else {
              error(`Image ${i + 1} download failed: ${imageResponse.status} ${imageResponse.statusText}`);
              failCount++;
            }
          } catch (err) {
            error(`Image ${i + 1} download error: ${err.message}`);
            failCount++;
          }
        }
      }
      
      if (successCount > 0) {
        success(`Image downloads: ${successCount} successful, ${failCount} failed`);
      } else {
        error('All image downloads failed');
        return false;
      }
    }
    
    return true;
    
  } catch (err) {
    error(`Asset download test failed: ${err.message}`);
    return false;
  }
}

async function runAllTests(videoId = null) {
  console.log('🧪 StoryShort Rendering Pipeline Test Suite');
  console.log('='.repeat(50));
  
  const tests = [
    { name: 'Environment Setup', fn: testEnvironment },
    { name: 'Supabase Connection', fn: testSupabaseConnection },
    { name: 'FFmpeg Installation', fn: testFFmpegInstallation },
    { name: 'FFprobe Installation', fn: testFFprobeInstallation },
    { name: 'File System Permissions', fn: testFileSystemPermissions }
  ];
  
  let passedTests = 0;
  let totalTests = tests.length;
  
  // Run basic tests
  for (const test of tests) {
    log(`Running: ${test.name}`);
    const result = await test.fn();
    if (result) {
      passedTests++;
    }
    console.log('');
  }
  
  // Run video-specific tests if videoId provided
  if (videoId) {
    totalTests += 2;
    
    log('Running video-specific tests...');
    console.log('');
    
    const videoTests = [
      { name: 'Video Record Validation', fn: () => testVideoRecord(videoId) },
      { name: 'Asset Download Test', fn: () => testAssetDownloads(videoId) }
    ];
    
    for (const test of videoTests) {
      log(`Running: ${test.name}`);
      const result = await test.fn();
      if (result) {
        passedTests++;
      }
      console.log('');
    }
  }
  
  // Summary
  console.log('='.repeat(50));
  console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    success('All tests passed! Rendering pipeline is ready to use.');
    console.log('');
    console.log('🚀 You can now run the rendering pipeline with:');
    console.log(`   npm run render:job ${videoId || '<videoId>'}`);
  } else {
    error('Some tests failed. Please fix the issues before running the rendering pipeline.');
    console.log('');
    console.log('🔧 Common fixes:');
    console.log('   - Install FFmpeg and add to PATH');
    console.log('   - Check environment variables in .env.local');
    console.log('   - Ensure Supabase credentials are correct');
    console.log('   - Verify video record exists and has required assets');
  }
  
  return passedTests === totalTests;
}

// Main execution
async function main() {
  const videoId = process.argv[2];
  
  if (videoId) {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(videoId)) {
      error('Invalid video ID format. Expected UUID format.');
      console.log('Example: node test-render-pipeline.js 123e4567-e89b-12d3-a456-426614174000');
      process.exit(1);
    }
  }
  
  try {
    const allPassed = await runAllTests(videoId);
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    error(`Test suite failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the test suite
main().catch((error) => {
  error(`Unhandled error: ${error.message}`);
  process.exit(1);
}); 