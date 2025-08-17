#!/usr/bin/env node

/**
 * Asset Generation Worker
 * 
 * Standalone Node.js script that can generate assets in the background
 * without being subject to Vercel's function timeout limits.
 * 
 * Usage: node scripts/assets-job.js <videoId>
 */

const { createClient } = require('@supabase/supabase-js');

// Environment setup
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;
const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

if (!supabaseUrl || !supabaseServiceRole || !openaiApiKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRole);

// Utility functions
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const withTimeout = (promise, timeoutMs) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
};

const withRetry = async (operation, maxRetries = 3, baseDelayMs = 1000) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.log(`[worker/retry] Attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        console.log(`[worker/retry] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
};

// Image generation function
async function generateImage(prompt, videoId, sceneIndex) {
  console.log(`[worker/image] Generating image for scene ${sceneIndex + 1}: ${prompt.substring(0, 50)}...`);
  
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: `Create a high-quality, cinematic image: ${prompt}`,
      n: 1,
      size: '1024x1792', // 9:16 aspect ratio
      response_format: 'b64_json',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const base64Data = data.data[0].b64_json;
  
  // Convert base64 to buffer
  const buffer = Buffer.from(base64Data, 'base64');
  
  // Upload to Supabase Storage
  const bucket = 'renders-images';
  const scenePath = `${videoId}/scene-${sceneIndex + 1}.jpg`;
  
  const { error: uploadError } = await supabase
    .storage
    .from(bucket)
    .upload(scenePath, buffer, { 
      contentType: 'image/jpeg', 
      upsert: true 
    });

  if (uploadError) {
    throw new Error(`Image upload failed: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(scenePath);
  console.log(`[worker/image] Scene ${sceneIndex + 1} uploaded successfully`);
  
  return urlData.publicUrl;
}

// Audio generation function
async function generateAudio(script, videoId) {
  console.log('[worker/audio] Generating audio...');
  
  if (!elevenLabsApiKey) {
    console.warn('[worker/audio] No ElevenLabs API key, using placeholder');
    return `https://placeholder-audio.mp3`;
  }

  const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJgB', {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': elevenLabsApiKey,
    },
    body: JSON.stringify({
      text: script,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs API error: ${response.status}`);
  }

  const audioBuffer = await response.arrayBuffer();
  
  // Upload to Supabase Storage
  const audioPath = `${videoId}/audio.mp3`;
  const { error: uploadError } = await supabase
    .storage
    .from('renders-audio')
    .upload(audioPath, audioBuffer, { 
      contentType: 'audio/mpeg', 
      upsert: true 
    });

  if (uploadError) {
    throw new Error(`Audio upload failed: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage.from('renders-audio').getPublicUrl(audioPath);
  console.log('[worker/audio] Audio uploaded successfully');
  
  return urlData.publicUrl;
}

// Captions generation function
async function generateCaptions(script, videoId) {
  console.log('[worker/captions] Generating captions...');
  
  // Simple VTT format generation
  const vttContent = `WEBVTT

00:00:00.000 --> 00:00:30.000
${script}
`;

  const captionsPath = `${videoId}/captions.vtt`;
  const { error: uploadError } = await supabase
    .storage
    .from('renders-captions')
    .upload(captionsPath, vttContent, { 
      contentType: 'text/vtt', 
      upsert: true 
    });

  if (uploadError) {
    throw new Error(`Captions upload failed: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage.from('renders-captions').getPublicUrl(captionsPath);
  console.log('[worker/captions] Captions uploaded successfully');
  
  return urlData.publicUrl;
}

// Main worker function
async function processAssets(videoId) {
  console.log(`[worker] Starting asset generation for video ${videoId}`);
  
  try {
    // Update status to indicate worker is processing
    await supabase
      .from('videos')
      .update({
        status: 'assets_generating',
        assets_started_at: new Date().toISOString(),
        error_message: 'Worker processing...'
      })
      .eq('id', videoId);

    // Load video data
    const { data: video, error: fetchError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();

    if (fetchError || !video) {
      throw new Error(`Failed to load video: ${fetchError?.message || 'Not found'}`);
    }

    console.log('[worker] Video loaded, checking storyboard...');
    
    const storyboard = typeof video.storyboard_json === 'string' 
      ? JSON.parse(video.storyboard_json) 
      : (video.storyboard_json || {});
    
    const scenes = Array.isArray(storyboard?.scenes) ? storyboard.scenes : [];
    const scenesCount = scenes.length;

    if (scenesCount === 0) {
      throw new Error('No storyboard scenes available');
    }

    console.log(`[worker] storyboard loaded: ${scenesCount} scenes`);

    // Initialize progress
    await supabase
      .from('videos')
      .update({
        progress: JSON.stringify({
          imagesDone: 0,
          imagesTotal: scenesCount,
          audioDone: false,
          captionsDone: false
        }),
        error_message: null
      })
      .eq('id', videoId);

    // Generate images with concurrency limit of 2
    console.log(`[worker] Starting ${scenesCount} images with concurrency limit 2`);
    const imageUrls = new Array(scenesCount).fill(null);
    
    const imageTasks = scenes.map((scene, i) => async () => {
      console.log(`[worker] started image ${i + 1}/${scenesCount}`);
      
      const prompt = scene.image_prompt?.trim() ||
                    scene.description?.trim() ||
                    scene.text?.trim() ||
                    `Visual for scene ${i + 1}: ${video.script?.slice(0, 80) || 'cinematic shot'}`;

      const imageUrl = await withRetry(
        () => withTimeout(generateImage(prompt, videoId, i), 90000),
        3,
        2000
      );
      
      imageUrls[i] = imageUrl;
      
      // Update progress
      const completedCount = imageUrls.filter(url => url !== null).length;
      const percent = Math.min(100, Math.round((completedCount / scenesCount) * 100));
      
      await supabase
        .from('videos')
        .update({
          image_urls: imageUrls.filter(url => url !== null),
          image_upload_progress: percent,
          images_generated: completedCount,
          updated_at: new Date().toISOString(),
          progress: JSON.stringify({
            imagesDone: completedCount,
            imagesTotal: scenesCount,
            audioDone: false,
            captionsDone: false
          })
        })
        .eq('id', videoId);
      
      console.log(`[worker] images_done counter: ${completedCount}/${scenesCount}`);
      return imageUrl;
    });
    
    // Execute with manual concurrency control
    const results = [];
    const executing = [];
    const concurrencyLimit = 2;
    
    for (const task of imageTasks) {
      const taskPromise = task().then(result => {
        results.push(result);
        executing.splice(executing.indexOf(taskPromise), 1);
      });
      
      executing.push(taskPromise);
      
      if (executing.length >= concurrencyLimit) {
        await Promise.race(executing);
      }
    }
    
    await Promise.all(executing);
    console.log(`[worker] All ${scenesCount} images completed`);

    // Generate audio
    const audioUrl = await generateAudio(video.script || '', videoId);
    
    await supabase
      .from('videos')
      .update({
        progress: JSON.stringify({
          imagesDone: scenesCount,
          imagesTotal: scenesCount,
          audioDone: true,
          captionsDone: false
        })
      })
      .eq('id', videoId);

    // Generate captions
    const captionsUrl = await generateCaptions(video.script || '', videoId);
    
    // Final update
    await supabase
      .from('videos')
      .update({
        status: 'assets_generated',
        audio_url: audioUrl,
        captions_url: captionsUrl,
        image_urls: imageUrls,
        image_upload_progress: 100,
        images_generated: scenesCount,
        assets_done_at: new Date().toISOString(),
        progress: JSON.stringify({
          imagesDone: scenesCount,
          imagesTotal: scenesCount,
          audioDone: true,
          captionsDone: true
        })
      })
      .eq('id', videoId);

    console.log(`[worker] final assets status: assets_generated`);
    console.log('[worker] Asset generation completed successfully');

    // Trigger render
    const renderUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4000';
    fetch(`${renderUrl}/api/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId }),
    }).catch(() => {}); // Fire and forget

    return { success: true, videoId, imageUrls, audioUrl, captionsUrl };

  } catch (error) {
    console.error('[worker] ERROR:', error);
    
    // Update database with error
    await supabase
      .from('videos')
      .update({
        status: 'assets_failed',
        error_message: `Worker error: ${error.message}`
      })
      .eq('id', videoId);

    throw error;
  }
}

// Command line interface
async function main() {
  const videoId = process.argv[2];
  
  if (!videoId) {
    console.error('Usage: node scripts/assets-job.js <videoId>');
    process.exit(1);
  }

  try {
    const result = await processAssets(videoId);
    console.log('✅ Worker completed successfully:', result);
    process.exit(0);
  } catch (error) {
    console.error('❌ Worker failed:', error);
    process.exit(1);
  }
}

// Export for potential module use
if (require.main === module) {
  main();
} else {
  module.exports = { processAssets };
}