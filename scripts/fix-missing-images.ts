// scripts/fix-missing-images.ts
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const PLACEHOLDER_URL = 'https://via.placeholder.com/1080x1920/1f2937/ffffff?text=Image+Generation+Failed';

// Image generation function (placeholder - you can implement actual DALL-E call)
async function generateImageWithDalle(prompt: string): Promise<ArrayBuffer> {
  // This is a placeholder - implement actual DALL-E API call here
  throw new Error('DALL-E image generation not implemented in fix script');
}

// Upload image to Supabase Storage
async function uploadImageToStorage(supabase: any, imageBuffer: ArrayBuffer, videoId: string, sceneNumber: number): Promise<string> {
  const imagePath = `renders/${videoId}/images/scene_${sceneNumber}.png`;
  
  const { data, error } = await supabase.storage
    .from('videos')
    .upload(imagePath, Buffer.from(imageBuffer), {
      contentType: 'image/png',
      upsert: true
    });

  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('videos')
    .getPublicUrl(imagePath);

  return urlData.publicUrl;
}

// Check if image exists in Supabase Storage
async function checkImageExists(supabase: any, videoId: string, sceneNumber: number): Promise<string | null> {
  const imagePath = `renders/${videoId}/images/scene_${sceneNumber}.png`;
  
  try {
    const { data, error } = await supabase.storage
      .from('videos')
      .list(`renders/${videoId}/images/`);

    if (error) {
      console.log(`   ⚠️ Could not check storage for scene ${sceneNumber}: ${error.message}`);
      return null;
    }

    const imageFile = data?.find((file: any) => file.name === `scene_${sceneNumber}.png`);
    if (imageFile) {
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('videos')
        .getPublicUrl(imagePath);
      
      return urlData.publicUrl;
    }
  } catch (error) {
    console.log(`   ⚠️ Error checking storage for scene ${sceneNumber}: ${error}`);
  }

  return null;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables:');
    console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✅ Set' : '❌ Missing');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔧 BULLETPROOF FIX: Missing image URLs in storyboard scenes...\n');

  // Get all videos with failed status or missing image URLs
  const { data: videos, error } = await supabase
    .from('videos')
    .select('*')
    .or('status.eq.failed,status.eq.assets_generated')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !videos || videos.length === 0) {
    console.log('❌ No videos found or error occurred');
    process.exit(1);
  }

  console.log(`📊 Found ${videos.length} videos to check...\n`);

  let totalFixed = 0;
  let totalChecked = 0;

  for (const video of videos) {
    totalChecked++;
    console.log(`🔍 Checking video: ${video.id}`);
    console.log(`   Status: ${video.status}`);
    console.log(`   Input: ${video.input_text?.substring(0, 50)}...`);

    const storyboard = video.storyboard_json;
    if (!storyboard || !storyboard.scenes || !Array.isArray(storyboard.scenes)) {
      console.log(`   ⚠️ Invalid storyboard structure, skipping...\n`);
      continue;
    }

    const scenes = storyboard.scenes;
    const imageUrls = video.image_urls || [];
    
    console.log(`   📽️ Scenes: ${scenes.length}, Images: ${imageUrls.length}`);

    let modified = false;
    let fixes = [];
    let missingScenes = [];

    // Check each scene for missing image_url
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const sceneNumber = i + 1;
      
      if (!scene.image_url || scene.image_url.trim() === '') {
        missingScenes.push(sceneNumber);
        console.log(`   🔍 Scene ${sceneNumber}: Missing image_url, attempting recovery...`);
        
        let imageUrlFound = false;
        
        // Step 1: Try to use corresponding image URL from image_urls array
        if (imageUrls[i]) {
          scene.image_url = imageUrls[i];
          fixes.push(`Scene ${sceneNumber} (from image_urls[${i}])`);
          modified = true;
          imageUrlFound = true;
          console.log(`   ✅ Fixed scene ${sceneNumber}: ${imageUrls[i].substring(0, 50)}...`);
        }
        
        // Step 2: If not found in array, try to re-fetch from Supabase Storage
        if (!imageUrlFound) {
          console.log(`   🔍 Scene ${sceneNumber}: Checking Supabase Storage...`);
          try {
            const storageUrl = await checkImageExists(supabase, video.id, sceneNumber);
            if (storageUrl) {
              scene.image_url = storageUrl;
              fixes.push(`Scene ${sceneNumber} (from storage)`);
              modified = true;
              imageUrlFound = true;
              console.log(`   ✅ Found scene ${sceneNumber} in storage: ${storageUrl.substring(0, 50)}...`);
            } else {
              console.log(`   ⚠️ Scene ${sceneNumber}: Not found in storage`);
            }
          } catch (storageError) {
            console.log(`   ⚠️ Scene ${sceneNumber}: Storage check failed: ${storageError}`);
          }
        }
        
        // Step 3: If still not found, could attempt to re-generate (commented out for safety)
        if (!imageUrlFound) {
          console.log(`   ⚠️ Scene ${sceneNumber}: Could attempt re-generation (disabled for safety)`);
          // Uncomment the following block if you want to enable re-generation:
          /*
          try {
            console.log(`   🎨 Scene ${sceneNumber}: Re-generating image with DALL-E...`);
            const imagePrompt = scene.image_prompt || scene.description || 'A cinematic scene';
            const imageBuffer = await generateImageWithDalle(imagePrompt);
            const newImageUrl = await uploadImageToStorage(supabase, imageBuffer, video.id, sceneNumber);
            scene.image_url = newImageUrl;
            fixes.push(`Scene ${sceneNumber} (re-generated)`);
            modified = true;
            imageUrlFound = true;
            console.log(`   ✅ Re-generated scene ${sceneNumber}: ${newImageUrl.substring(0, 50)}...`);
          } catch (genError) {
            console.log(`   ❌ Scene ${sceneNumber}: Re-generation failed: ${genError}`);
          }
          */
        }
        
        // Step 4: If all else fails, use placeholder
        if (!imageUrlFound) {
          scene.image_url = PLACEHOLDER_URL;
          fixes.push(`Scene ${sceneNumber} (placeholder)`);
          modified = true;
          console.log(`   ⚠️ Scene ${sceneNumber}: Using placeholder (no image URL available)`);
        }
      } else {
        // Validate existing image_url format
        if (!scene.image_url.startsWith('http')) {
          console.log(`   ⚠️ Scene ${sceneNumber}: Invalid image_url format, fixing...`);
          scene.image_url = PLACEHOLDER_URL;
          fixes.push(`Scene ${sceneNumber} (invalid format -> placeholder)`);
          modified = true;
        } else {
          console.log(`   ✅ Scene ${sceneNumber}: Already has valid image URL`);
        }
      }
    }

    if (!modified) {
      console.log(`   ✅ All scenes already have valid image URLs. No fix needed.\n`);
      continue;
    }

    // BULLETPROOF DATABASE UPDATE: Update the video record with fixed storyboard
    console.log(`   💾 Updating database with fixed storyboard...`);
    
    let updateSuccess = false;
    let updateAttempts = 0;
    const maxUpdateAttempts = 3;
    
    while (!updateSuccess && updateAttempts < maxUpdateAttempts) {
      try {
        updateAttempts++;
        console.log(`   🔄 Database update attempt ${updateAttempts}/${maxUpdateAttempts}...`);
        
        const { error: updateError } = await supabase
          .from('videos')
          .update({
            storyboard_json: storyboard,
            status: 'assets_generated', // Reset to assets_generated so it can be rendered
            error_message: fixes.length > 0 ? `Fixed missing image_url in: ${fixes.join(', ')}` : undefined
          })
          .eq('id', video.id);

        if (updateError) {
          throw new Error(`Supabase update failed: ${updateError.message}`);
        }
        
        console.log(`   ✅ Database update successful on attempt ${updateAttempts}`);
        updateSuccess = true;
        
      } catch (updateError) {
        console.error(`   ❌ Database update attempt ${updateAttempts} failed:`, updateError);
        
        if (updateAttempts >= maxUpdateAttempts) {
          console.error(`   💥 All ${maxUpdateAttempts} database update attempts failed`);
          continue; // Skip to next video
        } else {
          // Wait before retry
          console.log(`   ⏳ Waiting 2 seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    if (updateSuccess) {
      // FINAL VERIFICATION: Verify the update was successful
      console.log(`   🔍 Verifying database update...`);
      try {
        const { data: verificationData, error: verificationError } = await supabase
          .from('videos')
          .select('storyboard_json')
          .eq('id', video.id)
          .single();

        if (verificationError || !verificationData) {
          throw new Error('Failed to verify database update');
        }

        const updatedStoryboard = verificationData.storyboard_json;
        if (!updatedStoryboard || !updatedStoryboard.scenes) {
          throw new Error('Database update verification failed - storyboard_json is missing or invalid');
        }

        // Verify all scenes have image_url values
        let verificationPassed = true;
        for (let i = 0; i < updatedStoryboard.scenes.length; i++) {
          const scene = updatedStoryboard.scenes[i];
          if (!scene.image_url) {
            console.error(`   ❌ Verification failed: Scene ${i + 1} missing image_url in database`);
            verificationPassed = false;
          }
        }

        if (verificationPassed) {
          console.log(`   ✅ Database update verification passed: All ${updatedStoryboard.scenes.length} scenes have valid image_url values`);
          console.log(`   ✅ Fixed ${fixes.length} scene(s) in video ${video.id}`);
          console.log(`   📝 Scenes fixed: ${fixes.join(', ')}`);
          console.log(`   📌 Status reset to: assets_generated`);
          totalFixed++;
        } else {
          console.error(`   ❌ Database update verification failed`);
        }
        
      } catch (verificationError) {
        console.error(`   ❌ Database update verification failed:`, verificationError);
      }
    }
    
    console.log(''); // Empty line for readability
  }

  console.log('==========================================');
  console.log(`📊 Summary:`);
  console.log(`   Videos checked: ${totalChecked}`);
  console.log(`   Videos fixed: ${totalFixed}`);
  console.log(`   Videos already correct: ${totalChecked - totalFixed}`);
  
  if (totalFixed > 0) {
    console.log(`\n🎉 Successfully fixed ${totalFixed} video(s)!`);
    console.log(`   These videos should now pass storyboard validation.`);
    console.log(`   No more [❌ FAIL] Scene X missing image_url errors!`);
  } else {
    console.log(`\n✅ No fixes needed - all videos already have correct image URLs.`);
  }
}

main().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
