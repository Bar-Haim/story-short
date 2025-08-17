// Script to check a video with assets_generated status
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

async function checkAssetsVideo() {
  console.log('🔍 Checking video with assets_generated status...');
  
  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing required environment variables');
    return;
  }
  
  console.log('✅ Environment variables verified');
  
  // Create Supabase client
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  console.log('✅ Supabase client created with service role key');
  
  try {
    // Find a video with assets_generated status
    const { data: videos, error } = await supabase
      .from('videos')
      .select('*')
      .eq('status', 'assets_generated')
      .limit(1);
    
    if (error) {
      console.error('❌ Database query failed:', error);
      return;
    }
    
    if (!videos || videos.length === 0) {
      console.log('❌ No videos with assets_generated status found');
      return;
    }
    
    const video = videos[0];
    console.log(`✅ Found video with assets_generated status: ${video.id}`);
    
    console.log('\n📋 Video Details:');
    console.log(`   ID: ${video.id}`);
    console.log(`   Status: ${video.status}`);
    console.log(`   Input Text: ${video.input_text?.substring(0, 50)}...`);
    console.log(`   Created: ${video.created_at}`);
    console.log(`   Audio URL: ${video.audio_url ? '✅ Set' : '❌ Missing'}`);
    console.log(`   Captions URL: ${video.captions_url ? '✅ Set' : '❌ Missing'}`);
    console.log(`   Image URLs: ${video.image_urls?.length || 0} images`);
    console.log(`   Final Video URL: ${video.final_video_url ? '✅ Set' : '❌ Missing'}`);
    console.log(`   Total Duration: ${video.total_duration || 'Not set'}`);
    console.log(`   Error Message: ${video.error_message || 'None'}`);
    
    if (video.audio_url) {
      console.log(`   Audio URL: ${video.audio_url}`);
    }
    
    if (video.captions_url) {
      console.log(`   Captions URL: ${video.captions_url}`);
    }
    
    if (video.image_urls && video.image_urls.length > 0) {
      console.log(`   Image URLs (${video.image_urls.length}):`);
      video.image_urls.slice(0, 3).forEach((url, index) => {
        console.log(`     ${index + 1}. ${url}`);
      });
      if (video.image_urls.length > 3) {
        console.log(`     ... and ${video.image_urls.length - 3} more`);
      }
    }
    
    // Test if we can trigger rendering for this video
    console.log('\n🎬 Testing video rendering...');
    
    try {
      const response = await fetch('http://localhost:4000/api/render-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: video.id
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Render request successful:', result);
      } else {
        const errorText = await response.text();
        console.log(`❌ Render request failed (${response.status}):`, errorText);
      }
    } catch (fetchError) {
      console.log('❌ Could not reach render API:', fetchError.message);
      console.log('   Make sure the development server is running on localhost:4000');
    }
    
  } catch (error) {
    console.error('❌ Error checking assets video:', error);
  }
}

checkAssetsVideo(); 