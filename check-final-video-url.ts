// Script to check if final_video_url is being saved correctly in the database
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: '.env.local' });

interface VideoRecord {
  id: string;
  status: string;
  final_video_url: string | null;
  audio_url: string | null;
  captions_url: string | null;
  image_urls: string[] | null;
  total_duration: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string | null;
}

async function checkFinalVideoUrl(videoId: string) {
  console.log('🔍 Checking final_video_url in database...');
  console.log(`📋 Target Video ID: ${videoId}`);
  
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
  
  try {
    console.log(`🔍 Querying video with ID: ${videoId}`);
    
    // Query the videos table
    const { data: video, error } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        console.log('⚠️ Video not found in the database.');
        console.log(`   Video ID: ${videoId}`);
        console.log(`   Error: ${error.message}`);
        return;
      } else {
        console.error('❌ Database query failed:', error);
        return;
      }
    }
    
    if (!video) {
      console.log('⚠️ Video not found in the database.');
      console.log(`   Video ID: ${videoId}`);
      return;
    }
    
    const videoRecord = video as VideoRecord;
    console.log('✅ Video found in database');
    
    console.log('\n📋 Video Details:');
    console.log(`   ID: ${videoRecord.id}`);
    console.log(`   Status: ${videoRecord.status}`);
    console.log(`   Created: ${videoRecord.created_at}`);
    console.log(`   Updated: ${videoRecord.updated_at || 'Never'}`);
    
    // Check final_video_url specifically
    console.log('\n🎬 Final Video URL Analysis:');
    const finalVideoUrl = videoRecord.final_video_url;
    
    if (!finalVideoUrl) {
      console.log('❌ Video exists but no final video URL yet.');
      console.log('   This means the video rendering may not have completed successfully');
      
      // Show other asset status for context
      console.log('\n📊 Asset Status:');
      console.log(`   Audio URL: ${videoRecord.audio_url ? '✅ Set' : '❌ Missing'}`);
      console.log(`   Captions URL: ${videoRecord.captions_url ? '✅ Set' : '❌ Missing'}`);
      console.log(`   Image URLs: ${videoRecord.image_urls?.length || 0} images`);
      console.log(`   Total Duration: ${videoRecord.total_duration || 'Not set'}`);
      console.log(`   Error Message: ${videoRecord.error_message || 'None'}`);
      
      // Provide context based on status
      if (videoRecord.status === 'assets_generated') {
        console.log('\n💡 Context: Video has assets but rendering may have failed.');
        console.log('   Possible causes:');
        console.log('   - FFmpeg not installed');
        console.log('   - Rendering process failed');
        console.log('   - Network issues during upload');
      } else if (videoRecord.status === 'script_generated') {
        console.log('\n💡 Context: Video only has script, assets not generated yet.');
      } else if (videoRecord.status === 'failed') {
        console.log('\n💡 Context: Video generation failed.');
        console.log(`   Error: ${videoRecord.error_message}`);
      }
      
    } else {
      console.log('✅ Final video URL: ' + finalVideoUrl);
      
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
          console.log('❌ URL is not accessible:', fetchError instanceof Error ? fetchError.message : 'Unknown error');
        }
        
      } catch (urlError) {
        console.log('❌ URL format is invalid:', urlError instanceof Error ? urlError.message : 'Unknown error');
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking final_video_url:', error);
  }
}

// Get videoId from command line arguments or use default
function getVideoId(): string {
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    return args[0];
  }
  
  // Default video IDs to check (from our previous analysis)
  const defaultVideoIds = [
    '0b0ecde9-d14b-4d50-b4b0-72e79f43f39b',  // The one you originally asked about
    '885d05fc-26fa-4017-91b4-25e9a394da32',  // Has assets_generated status
    '26ab34c4-5539-43f4-8b2e-f2ebe9f99203'   // Has script_generated status
  ];
  
  console.log('📝 No video ID provided. Checking default video IDs...\n');
  
  return defaultVideoIds[0]; // Use the first one as default
}

// Main execution
async function main() {
  const videoId = getVideoId();
  
  if (process.argv.length > 2) {
    // If multiple video IDs provided, check them all
    const videoIds = process.argv.slice(2);
    console.log(`🔍 Checking ${videoIds.length} video(s)...\n`);
    
    for (const id of videoIds) {
      console.log(`\n${'='.repeat(60)}`);
      await checkFinalVideoUrl(id);
      console.log(`${'='.repeat(60)}\n`);
    }
  } else {
    // Check single video ID
    await checkFinalVideoUrl(videoId);
  }
}

// Run the script
main().catch(console.error); 