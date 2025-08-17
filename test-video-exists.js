// Test script to check if video exists in database
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkVideo(videoId) {
  console.log(`🔍 Checking video with ID: ${videoId}`);
  
  try {
    // Check if video exists
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();

    if (error) {
      console.error('❌ Error fetching video:', error);
      return;
    }

    if (!data) {
      console.error('❌ Video not found in database');
      return;
    }

    console.log('✅ Video found in database!');
    console.log('\n📋 Video Details:');
    console.log(`   ID: ${data.id}`);
    console.log(`   Status: ${data.status}`);
    console.log(`   Input Text: ${data.input_text?.substring(0, 50)}...`);
    console.log(`   Script: ${data.script ? 'Present' : 'Missing'}`);
    console.log(`   Audio URL: ${data.audio_url ? 'Present' : 'Missing'}`);
    console.log(`   Captions URL: ${data.captions_url ? 'Present' : 'Missing'}`);
    console.log(`   Image URLs: ${data.image_urls?.length || 0} images`);
    console.log(`   Storyboard: ${data.storyboard_json ? 'Present' : 'Missing'}`);
    console.log(`   Error Message: ${data.error_message || 'None'}`);
    console.log(`   Created: ${data.created_at}`);
    console.log(`   Updated: ${data.updated_at}`);

    // Check if all required fields are present
    const requiredFields = ['script', 'audio_url', 'captions_url', 'image_urls', 'storyboard_json'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      console.log(`\n⚠️ Missing required fields: ${missingFields.join(', ')}`);
    } else {
      console.log('\n✅ All required fields are present');
    }

    // Check if video should be accessible
    const validStatuses = ['assets_generated', 'completed', 'rendering'];
    const hasAssets = data.audio_url && data.captions_url && data.image_urls && data.image_urls.length > 0;
    
    if (validStatuses.includes(data.status)) {
      console.log(`\n✅ Video status "${data.status}" is valid for viewing`);
    } else if (hasAssets) {
      console.log(`\n✅ Video has assets despite status "${data.status}" - should be viewable`);
    } else {
      console.log(`\n⚠️ Video status "${data.status}" might not be ready for viewing`);
      console.log(`   Valid statuses: ${validStatuses.join(', ')}`);
    }

  } catch (error) {
    console.error('❌ Exception checking video:', error);
  }
}

// Test with the video ID from script generation (this should be the correct one)
const videoId = '26ab34c4-5539-43f4-8b2e-f2ebe9f99203';
checkVideo(videoId); 