import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findVideoToRender() {
  try {
    console.log('🔍 Finding a video ready for rendering...');
    
    // First, try to find videos with assets_generated status
    const { data: videos, error } = await supabase
      .from('videos')
      .select('*')
      .eq('status', 'assets_generated')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ Database query failed:', error);
      return null;
    }

    if (!videos || videos.length === 0) {
      console.log('❌ No videos with assets_generated status found');
      
      // Check for any videos with assets
      const { data: allVideos, error: allError } = await supabase
        .from('videos')
        .select('id, status, input_text, audio_url, image_urls')
        .not('audio_url', 'is', null)
        .not('image_urls', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5);

      if (allError) {
        console.error('❌ Failed to fetch videos:', allError);
        return null;
      }

      if (!allVideos || allVideos.length === 0) {
        console.log('❌ No videos with assets found');
        return null;
      }

      console.log('\n📋 Found videos with assets:');
      allVideos.forEach(video => {
        console.log(`   ${video.id} - ${video.status} - "${video.input_text?.substring(0, 50)}..."`);
      });

      // Use the first video with assets
      const videoToRender = allVideos[0];
      console.log(`\n🎬 Using video: ${videoToRender.id}`);
      return videoToRender.id;
    }

    console.log(`✅ Found ${videos.length} video(s) ready for rendering:`);
    videos.forEach(video => {
      console.log(`\n📋 Video ${video.id}:`);
      console.log(`   Status: ${video.status}`);
      console.log(`   Input: "${video.input_text?.substring(0, 50)}..."`);
      console.log(`   Audio: ${video.audio_url ? '✅' : '❌'}`);
      console.log(`   Images: ${video.image_urls?.length || 0} images`);
    });

    // Return the first video ID for rendering
    if (videos.length > 0) {
      console.log(`\n🎬 Ready to render video: ${videos[0].id}`);
      return videos[0].id;
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  return null;
}

findVideoToRender(); 