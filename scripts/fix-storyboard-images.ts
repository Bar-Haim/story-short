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

// Fetch video data from database
async function fetchVideo(supabase: any, videoId: string): Promise<Video | null> {
  info(`Fetching video data for ID: ${videoId}`);
  
  try {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        error(`Video with ID ${videoId} not found`);
        return null;
      }
      throw error;
    }

    success(`Found video: ${data.id}`);
    info(`Status: ${data.status}`);
    info(`Input text: ${data.input_text?.substring(0, 100)}${data.input_text && data.input_text.length > 100 ? '...' : ''}`);
    
    return data as Video;
  } catch (err) {
    error('Failed to fetch video from database');
    console.error('Database error:', err);
    throw err;
  }
}

// Analyze storyboard_json structure
function analyzeStoryboard(storyboard: any, imageUrls: string[] | null) {
  info('Analyzing storyboard structure...');
  
  if (!storyboard) {
    error('No storyboard_json found');
    return null;
  }

  if (!storyboard.scenes || !Array.isArray(storyboard.scenes)) {
    error('Invalid storyboard structure: missing or invalid scenes array');
    return null;
  }

  const scenes = storyboard.scenes;
  const totalScenes = scenes.length;
  const totalImages = imageUrls?.length || 0;

  info(`Found ${totalScenes} scenes and ${totalImages} image URLs`);

  // Check each scene for missing image_url
  const scenesWithMissingImages = [];
  const scenesWithImages = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const hasImageUrl = scene.image_url && typeof scene.image_url === 'string';
    const hasImagePrompt = scene.image_prompt && typeof scene.image_prompt === 'string';
    
    if (!hasImageUrl) {
      scenesWithMissingImages.push({
        index: i,
        scene: scene,
        hasImagePrompt
      });
    } else {
      scenesWithImages.push({
        index: i,
        scene: scene
      });
    }
  }

  return {
    totalScenes,
    totalImages,
    scenesWithMissingImages,
    scenesWithImages,
    canBeFixed: scenesWithMissingImages.length > 0 && totalImages > 0
  };
}

// Fix missing image URLs in storyboard
function fixStoryboardImages(storyboard: any, imageUrls: string[]): any {
  info('Fixing missing image URLs in storyboard...');
  
  if (!storyboard || !storyboard.scenes || !Array.isArray(storyboard.scenes)) {
    throw new Error('Invalid storyboard structure');
  }

  if (!imageUrls || imageUrls.length === 0) {
    throw new Error('No image URLs available to fix storyboard');
  }

  const fixedStoryboard = JSON.parse(JSON.stringify(storyboard)); // Deep clone
  const scenes = fixedStoryboard.scenes;
  let fixedCount = 0;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    
    if (!scene.image_url && imageUrls[i]) {
      scene.image_url = imageUrls[i];
      fixedCount++;
      success(`Fixed scene ${i + 1}: added image URL`);
    } else if (!scene.image_url && !imageUrls[i]) {
      warning(`Scene ${i + 1}: No image URL available at index ${i}`);
    } else if (scene.image_url) {
      info(`Scene ${i + 1}: Already has image URL`);
    }
  }

  success(`Fixed ${fixedCount} scenes with missing image URLs`);
  return fixedStoryboard;
}

// Update video record in database
async function updateVideo(supabase: any, videoId: string, updates: any): Promise<boolean> {
  info('Updating video record in database...');
  
  try {
    const { error } = await supabase
      .from('videos')
      .update(updates)
      .eq('id', videoId);

    if (error) {
      throw error;
    }

    success('Video record updated successfully');
    return true;
  } catch (err) {
    error('Failed to update video record');
    console.error('Update error:', err);
    return false;
  }
}

// Main function to fix storyboard images
async function fixStoryboardImagesForVideo(videoId: string) {
  try {
    header(`FIX STORYBOARD IMAGES - Video ID: ${videoId}`);
    info('Starting storyboard image fix process...');
    
    // Step 1: Initialize Supabase
    const supabase = initializeSupabase();
    success('Supabase client initialized');
    
    // Step 2: Fetch video data
    const video = await fetchVideo(supabase, videoId);
    if (!video) {
      error('Video not found');
      process.exit(1);
    }
    
    // Step 3: Analyze storyboard structure
    const analysis = analyzeStoryboard(video.storyboard_json, video.image_urls);
    if (!analysis) {
      error('Cannot analyze storyboard');
      process.exit(1);
    }
    
    separator();
    info(`Analysis Results:`);
    info(`- Total scenes: ${analysis.totalScenes}`);
    info(`- Total images: ${analysis.totalImages}`);
    info(`- Scenes with missing images: ${analysis.scenesWithMissingImages.length}`);
    info(`- Scenes with images: ${analysis.scenesWithImages.length}`);
    info(`- Can be fixed: ${analysis.canBeFixed ? 'Yes' : 'No'}`);
    separator();
    
    if (!analysis.canBeFixed) {
      if (analysis.scenesWithMissingImages.length === 0) {
        success('No missing image URLs found - storyboard is already correct');
        return;
      } else {
        error('Cannot fix storyboard: insufficient image URLs available');
        process.exit(1);
      }
    }
    
    // Step 4: Fix storyboard images
    const fixedStoryboard = fixStoryboardImages(video.storyboard_json, video.image_urls!);
    
    // Step 5: Update database
    const updateSuccess = await updateVideo(supabase, videoId, {
      storyboard_json: fixedStoryboard
    });
    
    if (!updateSuccess) {
      error('Failed to update video record');
      process.exit(1);
    }
    
    // Final success message
    header('STORYBOARD FIX COMPLETED');
    success(`Storyboard images fixed for video ${videoId}!`);
    log('The storyboard_json now contains proper image_url values for all scenes.', 'green');
    
  } catch (err) {
    error('STORYBOARD FIX FAILED');
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const videoId = args[0];

// Show usage if no arguments provided
if (args.length === 0) {
  header('FIX STORYBOARD IMAGES');
  log('This script fixes missing image URLs in storyboard_json for a specific video.', 'cyan');
  log('\nUsage:', 'bright');
  log('  npx tsx scripts/fix-storyboard-images.ts <videoId>', 'white');
  log('\nExample:', 'bright');
  log('  npx tsx scripts/fix-storyboard-images.ts a81f75b8-be46-40f7-b6cb-18d5033b738b', 'white');
  log('\nProcess:', 'bright');
  log('  1. Fetches video data from Supabase', 'cyan');
  log('  2. Analyzes storyboard_json structure', 'cyan');
  log('  3. Identifies scenes with missing image_url values', 'cyan');
  log('  4. Maps image_urls array to storyboard scenes', 'cyan');
  log('  5. Updates the video record with fixed storyboard_json', 'cyan');
  log('\nThis ensures the storyboard has proper image URLs for rendering.', 'green');
  process.exit(0);
}

// Run the main function
fixStoryboardImagesForVideo(videoId); 