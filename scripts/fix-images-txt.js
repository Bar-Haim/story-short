#!/usr/bin/env node

/**
 * 🛠️ Fix Images.txt Script
 * 
 * This script provides a complete solution for the missing images.txt issue.
 * It generates the images.txt file for a specific video and provides
 * the correct FFmpeg command for rendering.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RENDERS_DIR = path.join(__dirname, '../renders');

// Validate environment
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getVideoData(videoId) {
  console.log(`📊 Fetching video data for: ${videoId}`);
  
  try {
    const { data: video, error } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();
    
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    
    if (!video) {
      throw new Error('Video not found');
    }
    
    console.log(`✅ Video found:`);
    console.log(`   - Title: ${video.title || 'Untitled'}`);
    console.log(`   - Status: ${video.status}`);
    console.log(`   - Images: ${video.image_urls?.length || 0}`);
    console.log(`   - Audio: ${video.audio_url ? 'Yes' : 'No'}`);
    console.log(`   - Captions: ${video.captions_url ? 'Yes' : 'No'}`);
    
    return video;
  } catch (error) {
    console.error(`❌ Error fetching video: ${error.message}`);
    throw error;
  }
}

async function downloadImage(imageUrl, outputPath) {
  console.log(`📥 Downloading image: ${path.basename(outputPath)}`);
  
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(buffer));
    
    // Validate file was created
    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
      throw new Error('Downloaded file is empty or missing');
    }
    
    console.log(`✅ Image downloaded: ${outputPath} (${fs.statSync(outputPath).size} bytes)`);
    return outputPath;
  } catch (error) {
    console.error(`❌ Error downloading image: ${error.message}`);
    throw error;
  }
}

async function downloadAudio(audioUrl, outputPath) {
  console.log(`📥 Downloading audio: ${path.basename(outputPath)}`);
  
  try {
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(buffer));
    
    // Validate file was created
    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
      throw new Error('Downloaded file is empty or missing');
    }
    
    console.log(`✅ Audio downloaded: ${outputPath} (${fs.statSync(outputPath).size} bytes)`);
    return outputPath;
  } catch (error) {
    console.error(`❌ Error downloading audio: ${error.message}`);
    throw error;
  }
}

function createImagesTxtContent(imagePaths, scenes) {
  console.log(`📋 Creating images.txt content...`);
  
  const content = imagePaths.map((imgPath, index) => {
    const scene = scenes[index];
    const duration = scene?.duration || 3;
    
    // Validate duration
    if (duration <= 0 || duration > 20) {
      throw new Error(`Invalid duration for scene ${index + 1}: ${duration} seconds`);
    }
    
    // Convert Windows path to Unix-style and escape properly
    const normalizedPath = imgPath.replace(/\\/g, '/');
    
    console.log(`   📄 Scene ${index + 1}: ${path.basename(imgPath)} (${duration}s)`);
    
    return `file '${normalizedPath}'\nduration ${duration}`;
  }).join('\n');
  
  console.log(`✅ Images.txt content created (${content.length} characters)`);
  return content;
}

function validateImagesTxtFormat(content) {
  console.log(`🔍 Validating images.txt format...`);
  
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    throw new Error('Images.txt content is empty');
  }
  
  // Validate FFmpeg concat format
  for (let i = 0; i < lines.length; i += 2) {
    const fileLine = lines[i];
    const durationLine = lines[i + 1];
    
    if (!fileLine.startsWith('file ')) {
      throw new Error(`Line ${i + 1}: Expected 'file ' but got '${fileLine}'`);
    }
    
    if (durationLine && !durationLine.startsWith('duration ')) {
      throw new Error(`Line ${i + 2}: Expected 'duration ' but got '${durationLine}'`);
    }
    
    // Check if file path is quoted
    const fileMatch = fileLine.match(/file '(.+)'/);
    if (!fileMatch) {
      throw new Error(`Line ${i + 1}: File path should be quoted`);
    }
  }
  
  console.log(`✅ Images.txt format is valid`);
  return true;
}

async function fixImagesTxt(videoId) {
  console.log(`🎬 Fixing images.txt for video: ${videoId}`);
  console.log(`==============================================\n`);
  
  try {
    // 1. Get video data from database
    const video = await getVideoData(videoId);
    
    if (!video.image_urls || video.image_urls.length === 0) {
      throw new Error('No images found for this video');
    }
    
    if (!video.storyboard_json?.scenes) {
      throw new Error('No storyboard scenes found for this video');
    }
    
    const scenes = video.storyboard_json.scenes;
    const imageUrls = video.image_urls;
    
    console.log(`\n📊 Processing ${imageUrls.length} images and ${scenes.length} scenes...`);
    
    // 2. Create video directory structure
    const videoDir = path.join(RENDERS_DIR, videoId);
    const imagesDir = path.join(videoDir, 'images');
    const audioDir = path.join(videoDir, 'audio');
    
    if (!fs.existsSync(videoDir)) {
      fs.mkdirSync(videoDir, { recursive: true });
      console.log(`📁 Created video directory: ${videoDir}`);
    }
    
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
      console.log(`📁 Created images directory: ${imagesDir}`);
    }
    
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
      console.log(`📁 Created audio directory: ${audioDir}`);
    }
    
    // 3. Download images
    console.log(`\n📥 Downloading images...`);
    const imagePaths = [];
    
    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      const imageFilename = `scene_${i + 1}.png`;
      const imagePath = path.join(imagesDir, imageFilename);
      
      try {
        await downloadImage(imageUrl, imagePath);
        imagePaths.push(imagePath);
      } catch (error) {
        console.error(`❌ Failed to download image ${i + 1}: ${error.message}`);
        throw error;
      }
    }
    
    // 4. Download audio if available
    let audioPath = null;
    if (video.audio_url) {
      console.log(`\n📥 Downloading audio...`);
      const audioFilename = 'audio.mp3';
      audioPath = path.join(audioDir, audioFilename);
      
      try {
        await downloadAudio(video.audio_url, audioPath);
      } catch (error) {
        console.error(`❌ Failed to download audio: ${error.message}`);
        // Don't throw error, continue without audio
        audioPath = null;
      }
    }
    
    // 5. Create images.txt content
    console.log(`\n📋 Creating images.txt...`);
    const imagesTxtContent = createImagesTxtContent(imagePaths, scenes);
    
    // 6. Validate format
    validateImagesTxtFormat(imagesTxtContent);
    
    // 7. Save images.txt file
    const imagesTxtPath = path.join(videoDir, 'images.txt');
    fs.writeFileSync(imagesTxtPath, imagesTxtContent);
    
    console.log(`\n✅ Images.txt created successfully!`);
    console.log(`📄 File: ${imagesTxtPath}`);
    console.log(`📄 Size: ${fs.statSync(imagesTxtPath).size} bytes`);
    
    // 8. Display content preview
    console.log(`\n📄 Content preview:`);
    const previewLines = imagesTxtContent.split('\n').slice(0, 6);
    previewLines.forEach(line => console.log(`   ${line}`));
    if (imagesTxtContent.split('\n').length > 6) {
      console.log(`   ...`);
    }
    
    // 9. Generate FFmpeg commands
    console.log(`\n🎬 FFmpeg Commands:`);
    console.log(`==================`);
    
    // Basic command
    const outputPath = path.join(videoDir, 'final_video.mp4');
    console.log(`\n📹 Basic rendering command:`);
    console.log(`ffmpeg -y -f concat -safe 0 -i "${imagesTxtPath}" -i "${audioPath || 'audio.mp3'}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -shortest "${outputPath}"`);
    
    // Advanced command with motion effects
    console.log(`\n🎬 Advanced rendering with motion effects:`);
    const advancedCommand = `ffmpeg -y -f concat -safe 0 -i "${imagesTxtPath}" -i "${audioPath || 'audio.mp3'}" -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,zoompan=z='min(zoom+0.0015+(sin(t*0.6)*0.0003),1.2)':d=125:x='iw/2-(iw/zoom/2)+sin(t*0.3)*12+cos(t*0.15)*6+sin(t*0.9)*3':y='ih/2-(ih/zoom/2)+cos(t*0.25)*10+sin(t*0.08)*5+cos(t*0.7)*2':s=1080x1920,crop=1080:1920:x='sin(t*1.5)*1.5+cos(t*1.8)*1.2+sin(t*2.5)*0.6':y='cos(t*1.2)*1.5+sin(t*2.2)*1.0+cos(t*2.4)*0.5',eq=contrast=1.08:saturation=1.03:brightness=0.01,vignette=PI/4,noise=c0s=0.1:allf=t" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -shortest -movflags +faststart "${outputPath}"`;
    console.log(advancedCommand);
    
    // 10. Create a batch script for easy rendering
    const batchScriptPath = path.join(videoDir, 'render.bat');
    const batchContent = `@echo off
echo 🎬 Rendering video for ${videoId}...
echo.

echo 📹 Basic rendering...
ffmpeg -y -f concat -safe 0 -i "images.txt" -i "audio/audio.mp3" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -shortest "final_video.mp4"

echo.
echo ✅ Rendering complete!
echo 📄 Output: final_video.mp4
pause
`;
    
    fs.writeFileSync(batchScriptPath, batchContent);
    console.log(`\n📄 Batch script created: ${batchScriptPath}`);
    
    // 11. Summary
    console.log(`\n📊 Summary:`);
    console.log(`==========`);
    console.log(`✅ Video ID: ${videoId}`);
    console.log(`✅ Images downloaded: ${imagePaths.length}`);
    console.log(`✅ Audio downloaded: ${audioPath ? 'Yes' : 'No'}`);
    console.log(`✅ Images.txt created: ${imagesTxtPath}`);
    console.log(`✅ Batch script created: ${batchScriptPath}`);
    console.log(`✅ Ready for FFmpeg rendering!`);
    
    return {
      success: true,
      videoId,
      imagesTxtPath,
      imagePaths,
      audioPath,
      batchScriptPath,
      content: imagesTxtContent
    };
    
  } catch (error) {
    console.error(`\n❌ Error fixing images.txt: ${error.message}`);
    throw error;
  }
}

// Main execution
async function main() {
  const videoId = process.argv[2];
  
  if (!videoId) {
    console.error('❌ Usage: node scripts/fix-images-txt.js <videoId>');
    console.error('   Example: node scripts/fix-images-txt.js fe8a32f9-4c51-4830-99c5-d8e3d24a02aa');
    console.error('\n💡 To find available video IDs, check the renders directory or your database.');
    process.exit(1);
  }
  
  try {
    await fixImagesTxt(videoId);
    console.log(`\n🎉 Success! Images.txt has been fixed for video ${videoId}`);
    console.log(`\n💡 Next steps:`);
    console.log(`   1. Navigate to: renders/${videoId}/`);
    console.log(`   2. Run: render.bat (Windows) or use the FFmpeg command directly`);
    console.log(`   3. Check the generated final_video.mp4 file`);
  } catch (error) {
    console.error(`\n💥 Failed to fix images.txt: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { fixImagesTxt }; 