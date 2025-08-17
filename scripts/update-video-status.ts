// scripts/update-video-status.ts
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  const videoId = 'a81f75b8-be46-40f7-b6cb-18d5033b738b';
  
  console.log(`🔄 Updating video status: ${videoId}`);
  console.log('=====================================');

  try {
    const { error } = await supabase
      .from('videos')
      .update({
        status: 'assets_generated',
        error_message: null
      })
      .eq('id', videoId);

    if (error) {
      console.error('❌ Failed to update video status:', error);
      process.exit(1);
    }

    console.log('✅ Video status updated successfully to assets_generated');
    console.log('✅ Video is now ready for rendering');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

main(); 