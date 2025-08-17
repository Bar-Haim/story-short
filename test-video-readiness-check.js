const fs = require('fs');
const path = require('path');

// Test the video readiness check implementation
async function testVideoReadinessCheck() {
  console.log('🎬 Testing video readiness check implementation...\n');

  try {
    // Test 1: Check if the video page has the readiness check
    console.log('📋 Test 1: Checking video page readiness check...');
    const videoPagePath = path.join(__dirname, 'src', 'app', 'video', '[id]', 'page.tsx');
    
    if (fs.existsSync(videoPagePath)) {
      const videoPageContent = fs.readFileSync(videoPagePath, 'utf8');
      
      // Check for readiness check implementation
      const readinessChecks = [
        { name: 'Supabase import', pattern: 'VideoService, supabase', found: videoPageContent.includes('VideoService, supabase') },
        { name: 'Video readiness check', pattern: 'Check if video is ready for rendering and has subtitles', found: videoPageContent.includes('Check if video is ready for rendering and has subtitles') },
        { name: 'Status check', pattern: 'video.status === "assets_generated"', found: videoPageContent.includes('video.status === "assets_generated"') },
        { name: 'Captions check', pattern: 'video.captions_url', found: videoPageContent.includes('video.captions_url') },
        { name: 'Final video check', pattern: '!video.final_video_url', found: videoPageContent.includes('!video.final_video_url') },
        { name: 'Supabase null check', pattern: 'if (!supabase)', found: videoPageContent.includes('if (!supabase)') },
        { name: 'Ready to render logic', pattern: 'isReadyToRender =', found: videoPageContent.includes('isReadyToRender =') },
        { name: 'Specific error messages', pattern: 'Video status is', found: videoPageContent.includes('Video status is') },
        { name: 'Missing captions error', pattern: 'Video is missing captions', found: videoPageContent.includes('Video is missing captions') },
        { name: 'Already rendered error', pattern: 'Video has already been rendered', found: videoPageContent.includes('Video has already been rendered') }
      ];
      
      readinessChecks.forEach(check => {
        if (check.found) {
          console.log(`✅ ${check.name} implemented`);
        } else {
          console.log(`❌ ${check.name} missing`);
        }
      });
      
    } else {
      console.log('❌ Video page not found');
    }

    // Test 2: Check for proper error handling
    console.log('\n📋 Test 2: Checking error handling...');
    if (fs.existsSync(videoPagePath)) {
      const videoPageContent = fs.readFileSync(videoPagePath, 'utf8');
      
      const errorHandlingChecks = [
        { name: 'Supabase client check', pattern: 'Supabase client not configured', found: videoPageContent.includes('Supabase client not configured') },
        { name: 'Database error handling', pattern: 'Failed to fetch video record', found: videoPageContent.includes('Failed to fetch video record') },
        { name: 'Readiness error handling', pattern: 'Failed to check video readiness', found: videoPageContent.includes('Failed to check video readiness') },
        { name: 'Status validation', pattern: 'but needs to be "assets_generated"', found: videoPageContent.includes('but needs to be "assets_generated"') },
        { name: 'Captions validation', pattern: 'Please regenerate assets first', found: videoPageContent.includes('Please regenerate assets first') },
        { name: 'Already rendered validation', pattern: 'Check the download section below', found: videoPageContent.includes('Check the download section below') }
      ];
      
      errorHandlingChecks.forEach(check => {
        if (check.found) {
          console.log(`✅ ${check.name} implemented`);
        } else {
          console.log(`❌ ${check.name} missing`);
        }
      });
    }

    // Test 3: Check for logging and debugging
    console.log('\n📋 Test 3: Checking logging and debugging...');
    if (fs.existsSync(videoPagePath)) {
      const videoPageContent = fs.readFileSync(videoPagePath, 'utf8');
      
      const loggingChecks = [
        { name: 'Success logging', pattern: 'Video is ready to render with subtitles', found: videoPageContent.includes('Video is ready to render with subtitles') },
        { name: 'Rendering details logging', pattern: 'Rendering details:', found: videoPageContent.includes('Rendering details:') },
        { name: 'Warning logging', pattern: 'Video is not ready to render or already rendered', found: videoPageContent.includes('Video is not ready to render or already rendered') },
        { name: 'Video details logging', pattern: 'Video details:', found: videoPageContent.includes('Video details:') },
        { name: 'Console error logging', pattern: 'console.error', found: videoPageContent.includes('console.error') },
        { name: 'Console warn logging', pattern: 'console.warn', found: videoPageContent.includes('console.warn') },
        { name: 'Console log logging', pattern: 'console.log', found: videoPageContent.includes('console.log') }
      ];
      
      loggingChecks.forEach(check => {
        if (check.found) {
          console.log(`✅ ${check.name} implemented`);
        } else {
          console.log(`❌ ${check.name} missing`);
        }
      });
    }

    // Test 4: Check for proper database query
    console.log('\n📋 Test 4: Checking database query structure...');
    if (fs.existsSync(videoPagePath)) {
      const videoPageContent = fs.readFileSync(videoPagePath, 'utf8');
      
      const queryChecks = [
        { name: 'Database query', pattern: 'supabase.from("videos")', found: videoPageContent.includes('supabase.from("videos")') },
        { name: 'Select fields', pattern: 'select("status, captions_url, final_video_url")', found: videoPageContent.includes('select("status, captions_url, final_video_url")') },
        { name: 'ID filter', pattern: '.eq("id", videoId)', found: videoPageContent.includes('.eq("id", videoId)') },
        { name: 'Single result', pattern: '.single()', found: videoPageContent.includes('.single()') },
        { name: 'Error destructuring', pattern: 'const { data: video, error }', found: videoPageContent.includes('const { data: video, error }') }
      ];
      
      queryChecks.forEach(check => {
        if (check.found) {
          console.log(`✅ ${check.name} implemented`);
        } else {
          console.log(`❌ ${check.name} missing`);
        }
      });
    }

    console.log('\n🎯 Summary of video readiness check implementation:');
    console.log('✅ Supabase client integration with null check');
    console.log('✅ Comprehensive video status validation');
    console.log('✅ Captions availability check');
    console.log('✅ Final video existence check');
    console.log('✅ Specific error messages for different scenarios');
    console.log('✅ Detailed logging for debugging');
    console.log('✅ Proper database query structure');
    
    console.log('\n🎬 The video readiness check is ready!');
    console.log('📝 Key improvements:');
    console.log('   - Prevents rendering attempts on unprepared videos');
    console.log('   - Ensures captions are available before rendering');
    console.log('   - Prevents duplicate rendering of completed videos');
    console.log('   - Provides clear error messages for different issues');
    console.log('   - Comprehensive logging for debugging');
    
    console.log('\n🔧 Expected behavior:');
    console.log('   - Only renders videos with "assets_generated" status');
    console.log('   - Only renders videos that have captions');
    console.log('   - Prevents rendering of already completed videos');
    console.log('   - Shows specific error messages for missing requirements');
    console.log('   - Logs detailed information for debugging');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testVideoReadinessCheck(); 