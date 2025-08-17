// scripts/validate-rendering-readiness.ts
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

interface ValidationResult {
  videoId: string;
  ready: boolean;
  errors: string[];
  warnings: string[];
  details: {
    hasStoryboard: boolean;
    sceneCount: number;
    validImageUrls: number;
    hasAudio: boolean;
    hasCaptions: boolean;
    status: string;
  };
}

async function validateVideoReadiness(supabase: any, videoId: string): Promise<ValidationResult> {
  const result: ValidationResult = {
    videoId,
    ready: false,
    errors: [],
    warnings: [],
    details: {
      hasStoryboard: false,
      sceneCount: 0,
      validImageUrls: 0,
      hasAudio: false,
      hasCaptions: false,
      status: ''
    }
  };

  try {
    // Fetch video data
    const { data: video, error } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();

    if (error || !video) {
      result.errors.push(`Video not found: ${error?.message || 'No data returned'}`);
      return result;
    }

    result.details.status = video.status;

    // ✅ 1. Check if storyboard_json has 1+ scenes
    if (!video.storyboard_json || !video.storyboard_json.scenes || !Array.isArray(video.storyboard_json.scenes)) {
      result.errors.push('storyboard_json is missing or invalid');
      return result;
    }

    result.details.hasStoryboard = true;
    result.details.sceneCount = video.storyboard_json.scenes.length;

    if (video.storyboard_json.scenes.length === 0) {
      result.errors.push('storyboard_json has 0 scenes');
      return result;
    }

    // ✅ 2. Check each scene has a valid image_url
    const scenes = video.storyboard_json.scenes;
    let validImageUrls = 0;

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const sceneNumber = i + 1;

      if (!scene.image_url || scene.image_url.trim() === '') {
        result.errors.push(`Scene ${sceneNumber} missing image_url`);
      } else if (!scene.image_url.startsWith('http')) {
        result.errors.push(`Scene ${sceneNumber} has invalid image_url format (not HTTP URL)`);
      } else if (scene.image_url.includes('placeholder.com')) {
        result.warnings.push(`Scene ${sceneNumber} using placeholder image`);
      } else {
        validImageUrls++;
      }
    }

    result.details.validImageUrls = validImageUrls;

    // ✅ 3. Check audio exists
    if (!video.audio_url || video.audio_url.trim() === '') {
      result.errors.push('Audio URL is missing');
    } else {
      result.details.hasAudio = true;
    }

    // ✅ 4. Check captions exist
    if (!video.captions_url || video.captions_url.trim() === '') {
      result.warnings.push('Captions URL is missing (optional but recommended)');
    } else {
      result.details.hasCaptions = true;
    }

    // ✅ 5. Check status is ready for rendering
    const readyStatuses = ['assets_generated', 'assets_fixed'];
    if (!readyStatuses.includes(video.status)) {
      result.errors.push(`Status '${video.status}' is not ready for rendering. Expected: ${readyStatuses.join(' or ')}`);
    }

    // Determine if video is ready
    result.ready = result.errors.length === 0;

    return result;

  } catch (error) {
    result.errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return result;
  }
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🎯 RENDERING READINESS VALIDATION');
  console.log('==================================\n');

  // Get video ID from command line or use a default
  const videoId = process.argv[2];
  
  if (!videoId) {
    console.error('❌ Usage: npx tsx scripts/validate-rendering-readiness.ts <videoId>');
    console.error('Example: npx tsx scripts/validate-rendering-readiness.ts a81f75b8-be46-40f7-b6cb-18d5033b738b');
    process.exit(1);
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(videoId)) {
    console.error('❌ Invalid video ID format. Expected UUID format.');
    process.exit(1);
  }

  console.log(`🔍 Validating video: ${videoId}\n`);

  const result = await validateVideoReadiness(supabase, videoId);

  // Display results
  console.log('📊 VALIDATION RESULTS:');
  console.log('======================');
  console.log(`Video ID: ${result.videoId}`);
  console.log(`Status: ${result.details.status}`);
  console.log(`Ready for rendering: ${result.ready ? '✅ YES' : '❌ NO'}`);
  console.log('');

  console.log('📋 DETAILS:');
  console.log('------------');
  console.log(`✅ Storyboard present: ${result.details.hasStoryboard ? 'Yes' : 'No'}`);
  console.log(`📽️ Scene count: ${result.details.sceneCount}`);
  console.log(`🖼️ Valid image URLs: ${result.details.validImageUrls}/${result.details.sceneCount}`);
  console.log(`🎵 Audio present: ${result.details.hasAudio ? 'Yes' : 'No'}`);
  console.log(`📝 Captions present: ${result.details.hasCaptions ? 'Yes' : 'No'}`);
  console.log('');

  if (result.errors.length > 0) {
    console.log('❌ ERRORS (must be fixed):');
    console.log('---------------------------');
    result.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });
    console.log('');
  }

  if (result.warnings.length > 0) {
    console.log('⚠️ WARNINGS (should be addressed):');
    console.log('----------------------------------');
    result.warnings.forEach((warning, index) => {
      console.log(`${index + 1}. ${warning}`);
    });
    console.log('');
  }

  if (result.ready) {
    console.log('🎉 VALIDATION PASSED!');
    console.log('=====================');
    console.log('✅ All requirements met for rendering');
    console.log('✅ No more [❌ FAIL] Scene X missing image_url errors');
    console.log('✅ Video is ready to be processed by the rendering pipeline');
    console.log('');
    console.log('🚀 You can now run:');
    console.log(`   npm run render:job ${videoId}`);
    console.log(`   node scripts/render-job.js ${videoId}`);
  } else {
    console.log('💥 VALIDATION FAILED!');
    console.log('=====================');
    console.log('❌ Video is not ready for rendering');
    console.log('❌ Please fix the errors above before attempting to render');
    console.log('');
    console.log('🔧 To fix missing image URLs, run:');
    console.log('   npx tsx scripts/fix-missing-images.ts');
  }

  console.log('');
  console.log('==================================');
}

main().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
}); 