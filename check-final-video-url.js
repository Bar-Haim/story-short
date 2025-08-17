// Script to check if final_video_url is being saved correctly in the database
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

async function checkFinalVideoUrl() {
  console.log('🔍 Checking final_video_url in database...');
  
  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing required environment variables:');
    console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '✅ Set' : '❌ Missing');
    return;
  }
  
  console.log('✅ Environment variables verified');
  
  // Create Supabase client
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  console.log('✅ Supabase client created with service role key');
  
  // Video ID to check
  const videoId = '0b0ecde9-d14b-4d50-b4b0-72e79f43f39b';
  
  try {
    console.log(`🔍 Querying video with ID: ${videoId}`);
    
    // Query the videos table
    const { data: video, error } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();
    
    if (error) {
      console.error('❌ Database query failed:', error);
      return;
    }
    
    if (!video) {
      console.error('❌ Video not found in database');
      return;
    }
    
    console.log('✅ Video found in database');
    console.log('\n📋 Video Details:');
    console.log(`   ID: ${video.id}`);
    console.log(`   Status: ${video.status}`);
    console.log(`   Input Text: ${video.input_text?.substring(0, 50)}...`);
    console.log(`   Created: ${video.created_at}`);
    console.log(`   Updated: ${video.updated_at}`);
    
    // Check final_video_url specifically
    console.log('\n🎬 Final Video URL Analysis:');
    const finalVideoUrl = video.final_video_url;
    
    if (!finalVideoUrl) {
      console.log('❌ final_video_url is NULL or empty');
      console.log('   This means the video rendering may not have completed successfully');
    } else {
      console.log(`✅ final_video_url is set: ${finalVideoUrl}`);
      
      // Validate URL format
      try {
        const url = new URL(finalVideoUrl);
        console.log('✅ URL format is valid');
        console.log(`   Protocol: ${url.protocol}`);
        console.log(`   Host: ${url.host}`);
        console.log(`   Path: ${url.pathname}`);
        
        // Check if it's a Supabase URL
        if (url.host.includes('supabase.co')) {
          console.log('✅ URL is from Supabase');
          
          // Check if it's a videos bucket URL
          if (url.pathname.includes('/videos/')) {
            console.log('✅ URL points to videos bucket');
          } else {
            console.log('⚠️ URL does not point to videos bucket');
          }
          
          // Check if it's a finals path
          if (url.pathname.includes('/finals/')) {
            console.log('✅ URL uses correct finals path');
          } else {
            console.log('⚠️ URL does not use finals path');
          }
          
        } else {
          console.log('⚠️ URL is not from Supabase');
        }
        
        // Test if the URL is accessible
        console.log('\n🔗 Testing URL accessibility...');
        try {
          const response = await fetch(finalVideoUrl, { method: 'HEAD' });
          if (response.ok) {
            console.log('✅ URL is accessible (HTTP 200)');
            console.log(`   Content-Type: ${response.headers.get('content-type')}`);
            console.log(`   Content-Length: ${response.headers.get('content-length')} bytes`);
          } else {
            console.log(`⚠️ URL returned HTTP ${response.status}`);
          }
        } catch (fetchError) {
          console.log('❌ URL is not accessible:', fetchError.message);
        }
        
      } catch (urlError) {
        console.log('❌ URL format is invalid:', urlError.message);
      }
    }
    
    // Check other related fields
    console.log('\n📊 Related Fields:');
    console.log(`   audio_url: ${video.audio_url ? '✅ Set' : '❌ Missing'}`);
    console.log(`   captions_url: ${video.captions_url ? '✅ Set' : '❌ Missing'}`);
    console.log(`   image_urls: ${video.image_urls?.length || 0} images`);
    console.log(`   total_duration: ${video.total_duration || 'Not set'}`);
    console.log(`   error_message: ${video.error_message || 'None'}`);
    
    // Check if video has all required assets
    const hasAudio = !!video.audio_url;
    const hasImages = video.image_urls && video.image_urls.length > 0;
    const hasFinalVideo = !!video.final_video_url;
    
    console.log('\n🎯 Asset Status:');
    console.log(`   Audio: ${hasAudio ? '✅' : '❌'}`);
    console.log(`   Images: ${hasImages ? '✅' : '❌'}`);
    console.log(`   Final Video: ${hasFinalVideo ? '✅' : '❌'}`);
    
    if (hasAudio && hasImages && !hasFinalVideo) {
      console.log('\n⚠️ Video has assets but no final_video_url');
      console.log('   This suggests the rendering process may have failed');
    } else if (hasFinalVideo) {
      console.log('\n✅ Video rendering appears to be complete');
    }
    
  } catch (error) {
    console.error('❌ Error checking final_video_url:', error);
  }
}

checkFinalVideoUrl(); 