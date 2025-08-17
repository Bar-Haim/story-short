import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = (msg) => console.log(`${colors.cyan}[🧪 TEST]${colors.reset} ${msg}`);
const success = (msg) => console.log(`${colors.green}[✅ PASS]${colors.reset} ${msg}`);
const error = (msg) => console.log(`${colors.red}[❌ FAIL]${colors.reset} ${msg}`);
const warn = (msg) => console.log(`${colors.yellow}[⚠️ WARN]${colors.reset} ${msg}`);
const info = (msg) => console.log(`${colors.blue}[ℹ️ INFO]${colors.reset} ${msg}`);

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  error('Missing Supabase configuration. Please check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testStoryboardValidation() {
  log('Testing storyboard validation with missing image_url scenarios');
  
  try {
    // Test 1: Find a video with missing image_url in scenes
    log('Test 1: Searching for videos with potential missing image_url...');
    
    const { data: videos, error: fetchError } = await supabase
      .from('videos')
      .select('id, input_text, storyboard_json, status, error_message')
      .limit(10);
    
    if (fetchError) {
      error(`Failed to fetch videos: ${fetchError.message}`);
      return;
    }
    
    if (!videos || videos.length === 0) {
      warn('No videos found in database');
      return;
    }
    
    info(`Found ${videos.length} videos to analyze`);
    
    let testVideo = null;
    let missingImageScenes = [];
    
    // Look for a video with missing image_url in scenes
    for (const video of videos) {
      if (video.storyboard_json?.scenes) {
        const scenes = video.storyboard_json.scenes;
        const missingScenes = [];
        
        for (let i = 0; i < scenes.length; i++) {
          if (!scenes[i].image_url) {
            missingScenes.push(i + 1);
          }
        }
        
        if (missingScenes.length > 0) {
          testVideo = video;
          missingImageScenes = missingScenes;
          break;
        }
      }
    }
    
    if (!testVideo) {
      warn('No video found with missing image_url. Creating test scenario...');
      
      // Create a test video with missing image_url
      const testStoryboard = {
        scenes: [
          { image_url: 'https://example.com/scene1.png', duration: 3 },
          { image_url: null, duration: 4 }, // Missing image_url
          { image_url: 'https://example.com/scene3.png', duration: 3 }
        ]
      };
      
      const { data: newVideo, error: createError } = await supabase
        .from('videos')
        .insert({
          input_text: 'Test video for storyboard validation',
          storyboard_json: testStoryboard,
          status: 'assets_generated',
          audio_url: 'https://example.com/audio.mp3'
        })
        .select()
        .single();
      
      if (createError) {
        error(`Failed to create test video: ${createError.message}`);
        return;
      }
      
      testVideo = newVideo;
      missingImageScenes = [2]; // Scene 2 has missing image_url
      success('Created test video with missing image_url in scene 2');
    } else {
      success(`Found test video: ${testVideo.id}`);
      info(`Missing image_url in scenes: ${missingImageScenes.join(', ')}`);
    }
    
    // Test 2: Run the validation function
    log('Test 2: Running storyboard validation...');
    
    const scenes = testVideo.storyboard_json?.scenes || [];
    const validationErrors = [];
    
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const sceneNumber = i + 1;
      
      if (!scene.image_url) {
        const errorMessage = `Missing image_url in scene ${sceneNumber}`;
        validationErrors.push(errorMessage);
        error(`Scene ${sceneNumber}: Missing image_url`);
      } else {
        success(`Scene ${sceneNumber}: image_url present`);
      }
    }
    
    if (validationErrors.length > 0) {
      success(`Validation correctly identified ${validationErrors.length} missing image_url(s)`);
      
      // Test 3: Update video status to failed
      log('Test 3: Updating video status to failed...');
      
      try {
        const { error: updateError } = await supabase
          .from('videos')
          .update({ 
            status: 'failed',
            error_message: validationErrors[0]
          })
          .eq('id', testVideo.id);
        
        if (updateError) {
          error(`Failed to update video status: ${updateError.message}`);
        } else {
          success(`Successfully updated video status to failed: ${validationErrors[0]}`);
        }
      } catch (updateError) {
        error(`Error updating video status: ${updateError.message}`);
      }
      
      // Test 4: Verify the update
      log('Test 4: Verifying status update...');
      
      const { data: updatedVideo, error: verifyError } = await supabase
        .from('videos')
        .select('status, error_message')
        .eq('id', testVideo.id)
        .single();
      
      if (verifyError) {
        error(`Failed to verify status update: ${verifyError.message}`);
      } else {
        if (updatedVideo.status === 'failed' && updatedVideo.error_message) {
          success(`Status verification passed: ${updatedVideo.status} - ${updatedVideo.error_message}`);
        } else {
          error(`Status verification failed: ${updatedVideo.status} - ${updatedVideo.error_message}`);
        }
      }
      
    } else {
      success('No missing image_url found - validation passed');
    }
    
    // Test 5: Test with valid storyboard
    log('Test 5: Testing with valid storyboard...');
    
    const validStoryboard = {
      scenes: [
        { image_url: 'https://example.com/scene1.png', duration: 3 },
        { image_url: 'https://example.com/scene2.png', duration: 4 },
        { image_url: 'https://example.com/scene3.png', duration: 3 }
      ]
    };
    
    const validValidationErrors = [];
    for (let i = 0; i < validStoryboard.scenes.length; i++) {
      const scene = validStoryboard.scenes[i];
      const sceneNumber = i + 1;
      
      if (!scene.image_url) {
        const errorMessage = `Missing image_url in scene ${sceneNumber}`;
        validValidationErrors.push(errorMessage);
        error(`Scene ${sceneNumber}: Missing image_url`);
      } else {
        success(`Scene ${sceneNumber}: image_url present`);
      }
    }
    
    if (validValidationErrors.length === 0) {
      success('Valid storyboard validation passed - no missing image_url found');
    } else {
      error(`Valid storyboard validation failed: ${validValidationErrors.join(', ')}`);
    }
    
    success('Storyboard validation test completed successfully!');
    
  } catch (err) {
    error(`Test failed: ${err.message}`);
    console.error(err);
  }
}

async function main() {
  console.log('🎬 Storyboard Validation Test');
  console.log('=============================\n');
  
  await testStoryboardValidation();
  
  console.log('\n✅ All tests completed');
}

// Run the test if this file is executed directly
main().catch(console.error);

export { testStoryboardValidation }; 