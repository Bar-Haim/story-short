const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findVideosToRender() {
  try {
    console.log('🔍 Checking for videos ready for rendering...');
    
    // Find videos that are ready for rendering (assets_generated status)
    const { data: videos, error } = await supabase
      .from('videos')
      .select('*')
      .eq('status', 'assets_generated')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ Database query failed:', error);
      return;
    }

    if (!videos || videos.length === 0) {
      console.log('❌ No videos with assets_generated status found');
      
      // Check for other statuses
      const { data: allVideos, error: allError } = await supabase
        .from('videos')
        .select('id, status, input_text, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      if (allError) {
        console.error('❌ Failed to fetch all videos:', allError);
        return;
      }

      console.log('\n📋 Available videos:');
      allVideos?.forEach(video => {
        console.log(`   ${video.id} - ${video.status} - "${video.input_text?.substring(0, 50)}..."`);
      });
      return;
    }

    console.log(`✅ Found ${videos.length} video(s) ready for rendering:`);
    videos.forEach(video => {
      console.log(`\n📋 Video ${video.id}:`);
      console.log(`   Status: ${video.status}`);
      console.log(`   Input: "${video.input_text?.substring(0, 50)}..."`);
      console.log(`   Audio: ${video.audio_url ? '✅' : '❌'}`);
      console.log(`   Images: ${video.image_urls?.length || 0} images`);
      console.log(`   Captions: ${video.captions_url ? '✅' : '❌'}`);
      console.log(`   Created: ${video.created_at}`);
    });

    // Return the first video ID for rendering
    if (videos.length > 0) {
      console.log(`\n🎬 Ready to render video: ${videos[0].id}`);
      return videos[0].id;
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findVideosToRender(); 