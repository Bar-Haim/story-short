#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: '.env.local' });

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
function log(message: string, color: keyof typeof colors = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function info(message: string) {
  log(`ℹ️  ${message}`, 'cyan');
}

function success(message: string) {
  log(`✅ ${message}`, 'green');
}

function warning(message: string) {
  log(`⚠️  ${message}`, 'yellow');
}

function error(message: string) {
  log(`❌ ${message}`, 'red');
}

function header(message: string) {
  log(`\n${colors.bright}${colors.blue}${'='.repeat(60)}${colors.reset}`);
  log(`${colors.bright}${colors.blue}${message}${colors.reset}`);
  log(`${colors.bright}${colors.blue}${'='.repeat(60)}${colors.reset}\n`);
}

function separator() {
  log(`${colors.yellow}${'-'.repeat(60)}${colors.reset}\n`);
}

// Fail helper for terminating on fatal errors
const fail = (msg: string): never => {
  error(msg);
  process.exit(1); // אם לא רוצים לצאת: throw new Error(msg)
};

// Video interface matching the database schema
interface Video {
  id: string;
  status: string;
  input_text: string;
  script: string | null;
  storyboard_json: any | null;
  audio_url: string | null;
  captions_url: string | null;
  image_urls: string[] | null;
  total_duration: number | null;
  final_video_url: string | null;
  error_message: string | null;
  image_upload_progress: number | null;
  theme?: string;
  language?: string;
  tone?: string;
  user_id?: string;
  created_at: string;
  updated_at: string;
}

// Initialize Supabase client
function initializeSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  info('Initializing Supabase client...');
  return createClient(supabaseUrl, supabaseServiceKey);
}

// Test the fallback mechanism for a specific video
async function testFallbackMechanism(videoId: string) {
  try {
    header(`TESTING FALLBACK MECHANISM - Video ID: ${videoId}`);
    info('Testing the enhanced image generation fallback mechanism...');
    
    // Step 1: Initialize Supabase
    const supabase = initializeSupabase();
    success('Supabase client initialized');
    
    // Step 2: Fetch video data
    info(`Fetching video data for ID: ${videoId}`);
    const { data: video, error: dbError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();

    if (dbError) {
      fail(`Failed to fetch video: ${dbError.message}`);
    }

    success(`Found video: ${(video as Video).id}`);
    info(`Status: ${(video as Video).status}`);
    const inputText = (video as Video).input_text;
    info(`Input text: ${inputText?.substring(0, 100)}${inputText && inputText.length > 100 ? '...' : ''}`);
    
    // Step 3: Analyze storyboard structure
    if (!(video as Video).storyboard_json) {
      fail('No storyboard_json found');
    }

    const storyboard = (video as Video).storyboard_json;
    const scenes = storyboard.scenes || [];
    const imageUrls = (video as Video).image_urls || [];

    info(`Found ${scenes.length} scenes and ${imageUrls.length} image URLs`);
    
    separator();
    info('Analyzing storyboard scenes for image_url values:');
    
    let scenesWithImages = 0;
    let scenesWithMissingImages = 0;
    let scenesWithPlaceholders = 0;
    const placeholderPattern = /placeholder\.com/;

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const hasImageUrl = scene.image_url && typeof scene.image_url === 'string';
      
      if (hasImageUrl) {
        if (placeholderPattern.test(scene.image_url)) {
          scenesWithPlaceholders++;
          warning(`Scene ${i + 1}: Has placeholder image URL`);
        } else {
          scenesWithImages++;
          success(`Scene ${i + 1}: Has valid image URL`);
        }
      } else {
        scenesWithMissingImages++;
        fail(`Scene ${i + 1}: Missing image URL`);
      }
    }
    
    separator();
    info('Fallback Mechanism Test Results:');
    info(`- Total scenes: ${scenes.length}`);
    info(`- Scenes with valid images: ${scenesWithImages}`);
    info(`- Scenes with placeholder images: ${scenesWithPlaceholders}`);
    info(`- Scenes missing image URLs: ${scenesWithMissingImages}`);
    
    // Step 4: Check error messages for fallback warnings
    if ((video as Video).error_message) {
      separator();
      info('Error messages analysis:');
      const errorLines = (video as Video).error_message!.split(';');
      let fallbackWarnings = 0;
      
      for (const line of errorLines) {
        if (line.includes('placeholder image') || line.includes('failed after') || line.includes('attempts')) {
          fallbackWarnings++;
          warning(`Found fallback warning: ${line.trim()}`);
        }
      }
      
      if (fallbackWarnings > 0) {
        success(`Found ${fallbackWarnings} fallback mechanism warnings in error messages`);
      } else {
        info('No fallback mechanism warnings found in error messages');
      }
    }
    
    // Step 5: Overall assessment
    separator();
    header('FALLBACK MECHANISM ASSESSMENT');
    
    if (scenesWithMissingImages === 0) {
      success('✅ All scenes have image_url values - Fallback mechanism working correctly');
    } else {
      fail(`❌ ${scenesWithMissingImages} scenes still missing image_url values`);
    }
    
    if (scenesWithPlaceholders > 0) {
      warning(`⚠️ ${scenesWithPlaceholders} scenes using placeholder images`);
      info('This indicates the fallback mechanism was triggered for failed image generation');
    }
    
    if ((video as Video).error_message && (video as Video).error_message!.includes('placeholder')) {
      success('✅ Fallback warnings properly logged in video record');
    }
    
    // Step 6: Recommendations
    separator();
    info('Recommendations:');
    
    if (scenesWithMissingImages > 0) {
      log('1. Run the fix-storyboard-images script to populate missing image_url values', 'yellow');
      log(`   npx tsx scripts/fix-storyboard-images.ts ${videoId}`, 'white');
    }
    
    if (scenesWithPlaceholders > 0) {
      log('2. Consider regenerating images for scenes with placeholders', 'yellow');
      log('   The fallback mechanism worked, but you may want to retry image generation', 'cyan');
    }
    
    if ((video as Video).status === 'assets_generated') {
      success('3. Video is ready for rendering with current assets');
    } else {
      warning(`3. Video status is "${(video as Video).status}" - may need further processing`);
    }
    
  } catch (err) {
    error('TEST FAILED');
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const videoId = args[0];

// Show usage if no arguments provided
if (args.length === 0) {
  header('TEST FALLBACK MECHANISM');
  log('This script tests the enhanced fallback mechanism for image generation.', 'cyan');
  log('\nUsage:', 'bright');
  log('  npx tsx scripts/test-fallback-mechanism.ts <videoId>', 'white');
  log('\nExample:', 'bright');
  log('  npx tsx scripts/test-fallback-mechanism.ts a81f75b8-be46-40f7-b6cb-18d5033b738b', 'white');
  log('\nWhat it tests:', 'bright');
  log('  1. Checks if all scenes have image_url values', 'cyan');
  log('  2. Identifies scenes using placeholder images', 'cyan');
  log('  3. Analyzes error messages for fallback warnings', 'cyan');
  log('  4. Provides recommendations for fixing issues', 'cyan');
  log('\nThis helps validate that the fallback mechanism is working correctly.', 'green');
  process.exit(0);
}

// Run the test
testFallbackMechanism(videoId);
