#!/usr/bin/env node

/**
 * 🔍 Find Valid Videos Script
 * 
 * This script searches Supabase for videos that have images and audio,
 * so we can use them to generate proper images.txt files.
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate environment
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function findValidVideos() {
  console.log('🔍 Searching for valid videos in Supabase...');
  console.log('==========================================\n');
  
  try {
    // Get all videos with their assets
    const { data: videos, error } = await supabase
      .from('videos')
      .select('id, status, image_urls, audio_url, captions_url, created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    
    if (!videos || videos.length === 0) {
      console.log('❌ No videos found in database');
      return [];
    }
    
    console.log(`📊 Found ${videos.length} videos in database\n`);
    
    // Filter for videos with complete assets
    const validVideos = videos.filter(video => {
      const hasImages = video.image_urls && video.image_urls.length > 0;
      const hasAudio = !!video.audio_url;
      const hasCaptions = !!video.captions_url;
      
      return hasImages && hasAudio;
    });
    
    console.log(`✅ Found ${validVideos.length} videos with complete assets:\n`);
    
    validVideos.forEach((video, index) => {
      console.log(`${index + 1}. 📹 Video ID: ${video.id}`);
      console.log(`   📊 Status: ${video.status}`);
      console.log(`   🖼️ Images: ${video.image_urls?.length || 0}`);
      console.log(`   🎵 Audio: ${video.audio_url ? 'Yes' : 'No'}`);
      console.log(`   📝 Captions: ${video.captions_url ? 'Yes' : 'No'}`);
      console.log(`   📅 Created: ${new Date(video.created_at).toLocaleString()}`);
      console.log('');
    });
    
    // Show videos missing assets
    const incompleteVideos = videos.filter(video => {
      const hasImages = video.image_urls && video.image_urls.length > 0;
      const hasAudio = !!video.audio_url;
      return !hasImages || !hasAudio;
    });
    
    if (incompleteVideos.length > 0) {
      console.log(`⚠️ Found ${incompleteVideos.length} videos with missing assets:\n`);
      
      incompleteVideos.forEach((video, index) => {
        const missing = [];
        if (!video.image_urls || video.image_urls.length === 0) missing.push('images');
        if (!video.audio_url) missing.push('audio');
        if (!video.captions_url) missing.push('captions');
        
        console.log(`${index + 1}. 📹 Video ID: ${video.id}`);
        console.log(`   📊 Status: ${video.status}`);
        console.log(`   ❌ Missing: ${missing.join(', ')}`);
        console.log('');
      });
    }
    
    return validVideos;
    
  } catch (error) {
    console.error(`❌ Error searching for videos: ${error.message}`);
    throw error;
  }
}

async function testVideoAccess(videoId) {
  console.log(`🔍 Testing access to video: ${videoId}`);
  
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
    console.log(`   - Status: ${video.status}`);
    console.log(`   - Images: ${video.image_urls?.length || 0}`);
    console.log(`   - Audio: ${video.audio_url ? 'Yes' : 'No'}`);
    console.log(`   - Captions: ${video.captions_url ? 'Yes' : 'No'}`);
    
    // Test image URLs
    if (video.image_urls && video.image_urls.length > 0) {
      console.log(`\n🖼️ Testing image URLs...`);
      for (let i = 0; i < Math.min(3, video.image_urls.length); i++) {
        const imageUrl = video.image_urls[i];
        try {
          const response = await fetch(imageUrl, { method: 'HEAD' });
          if (response.ok) {
            console.log(`   ✅ Image ${i + 1}: Accessible (${response.headers.get('content-length')} bytes)`);
          } else {
            console.log(`   ❌ Image ${i + 1}: HTTP ${response.status}`);
          }
        } catch (error) {
          console.log(`   ❌ Image ${i + 1}: ${error.message}`);
        }
      }
    }
    
    // Test audio URL
    if (video.audio_url) {
      console.log(`\n🎵 Testing audio URL...`);
      try {
        const response = await fetch(video.audio_url, { method: 'HEAD' });
        if (response.ok) {
          console.log(`   ✅ Audio: Accessible (${response.headers.get('content-length')} bytes)`);
        } else {
          console.log(`   ❌ Audio: HTTP ${response.status}`);
        }
      } catch (error) {
        console.log(`   ❌ Audio: ${error.message}`);
      }
    }
    
    return video;
    
  } catch (error) {
    console.error(`❌ Error testing video access: ${error.message}`);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    const validVideos = await findValidVideos();
    
    if (validVideos.length === 0) {
      console.log('❌ No valid videos found. Please generate some videos first.');
      process.exit(1);
    }
    
    // Test the first valid video
    const firstVideo = validVideos[0];
    console.log(`\n🧪 Testing access to first valid video: ${firstVideo.id}`);
    console.log('==================================================\n');
    
    await testVideoAccess(firstVideo.id);
    
    console.log(`\n💡 Next steps:`);
    console.log(`==============`);
    console.log(`1. Use this video ID to generate images.txt:`);
    console.log(`   npm run fix:images-txt ${firstVideo.id}`);
    console.log(`\n2. Or use any of these valid video IDs:`);
    validVideos.slice(0, 5).forEach((video, index) => {
      console.log(`   ${index + 1}. ${video.id} (${video.image_urls?.length || 0} images)`);
    });
    
  } catch (error) {
    console.error(`\n💥 Error: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { findValidVideos, testVideoAccess }; 