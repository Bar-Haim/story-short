#!/usr/bin/env node

/**
 * 🛠️ Generate Images.txt Script
 * 
 * This script generates the images.txt file needed for FFmpeg video rendering.
 * It creates the proper concat format file from the video's images.
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

async function generateImagesTxt(videoId) {
  console.log(`🎬 Generating images.txt for video: ${videoId}`);
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
    
    if (!fs.existsSync(videoDir)) {
      fs.mkdirSync(videoDir, { recursive: true });
      console.log(`📁 Created video directory: ${videoDir}`);
    }
    
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
      console.log(`📁 Created images directory: ${imagesDir}`);
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
    
    // 4. Create images.txt content
    console.log(`\n📋 Creating images.txt...`);
    const imagesTxtContent = createImagesTxtContent(imagePaths, scenes);
    
    // 5. Validate format
    validateImagesTxtFormat(imagesTxtContent);
    
    // 6. Save images.txt file
    const imagesTxtPath = path.join(videoDir, 'images.txt');
    fs.writeFileSync(imagesTxtPath, imagesTxtContent);
    
    console.log(`\n✅ Images.txt created successfully!`);
    console.log(`📄 File: ${imagesTxtPath}`);
    console.log(`📄 Size: ${fs.statSync(imagesTxtPath).size} bytes`);
    
    // 7. Display content preview
    console.log(`\n📄 Content preview:`);
    const previewLines = imagesTxtContent.split('\n').slice(0, 6);
    previewLines.forEach(line => console.log(`   ${line}`));
    if (imagesTxtContent.split('\n').length > 6) {
      console.log(`   ...`);
    }
    
    // 8. Test FFmpeg command
    console.log(`\n🎬 Suggested FFmpeg command:`);
    const audioPath = video.audio_url ? path.join(videoDir, 'audio.mp3') : 'audio.mp3';
    const outputPath = path.join(videoDir, 'final_video.mp4');
    
    console.log(`ffmpeg -y -f concat -safe 0 -i "${imagesTxtPath}" -i "${audioPath}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -shortest "${outputPath}"`);
    
    return {
      success: true,
      imagesTxtPath,
      imagePaths,
      content: imagesTxtContent
    };
    
  } catch (error) {
    console.error(`\n❌ Error generating images.txt: ${error.message}`);
    throw error;
  }
}

// Main execution
async function main() {
  const videoId = process.argv[2];
  
  if (!videoId) {
    console.error('❌ Usage: node scripts/generate-images-txt.js <videoId>');
    console.error('   Example: node scripts/generate-images-txt.js fe8a32f9-4c51-4830-99c5-d8e3d24a02aa');
    process.exit(1);
  }
  
  try {
    await generateImagesTxt(videoId);
    console.log(`\n🎉 Success! Images.txt has been generated for video ${videoId}`);
  } catch (error) {
    console.error(`\n💥 Failed to generate images.txt: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { generateImagesTxt }; 