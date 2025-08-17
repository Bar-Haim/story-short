// Script to list all videos in the database
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

async function listVideos() {
  console.log('📋 Listing all videos in database...');
  
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
    // Query all videos
    const { data: videos, error } = await supabase
      .from('videos')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Database query failed:', error);
      return;
    }
    
    if (!videos || videos.length === 0) {
      console.log('❌ No videos found in database');
      return;
    }
    
    console.log(`✅ Found ${videos.length} videos in database`);
    console.log('\n📋 Video List:');
    
    videos.forEach((video, index) => {
      console.log(`\n${index + 1}. Video ID: ${video.id}`);
      console.log(`   Status: ${video.status}`);
      console.log(`   Input Text: ${video.input_text?.substring(0, 50)}...`);
      console.log(`   Created: ${video.created_at}`);
      console.log(`   Updated: ${video.updated_at}`);
      console.log(`   Audio URL: ${video.audio_url ? '✅ Set' : '❌ Missing'}`);
      console.log(`   Captions URL: ${video.captions_url ? '✅ Set' : '❌ Missing'}`);
      console.log(`   Image URLs: ${video.image_urls?.length || 0} images`);
      console.log(`   Final Video URL: ${video.final_video_url ? '✅ Set' : '❌ Missing'}`);
      console.log(`   Total Duration: ${video.total_duration || 'Not set'}`);
      console.log(`   Error Message: ${video.error_message || 'None'}`);
      
      if (video.final_video_url) {
        console.log(`   Final Video URL: ${video.final_video_url}`);
      }
    });
    
    // Check for specific video IDs mentioned in logs
    const targetIds = [
      '0b0ecde9-d14b-4d50-b4b0-72e79f43f39b',
      '26ab34c4-5539-43f4-8b2e-f2ebe9f99203'
    ];
    
    console.log('\n🔍 Checking for specific video IDs:');
    targetIds.forEach(id => {
      const found = videos.find(v => v.id === id);
      if (found) {
        console.log(`✅ Found video ${id}:`);
        console.log(`   Status: ${found.status}`);
        console.log(`   Final Video URL: ${found.final_video_url || 'Not set'}`);
      } else {
        console.log(`❌ Video ${id} not found in database`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error listing videos:', error);
  }
}

listVideos(); 