import { NextRequest, NextResponse } from 'next/server';
import { VideoService, sbServer } from '@/lib/supabase-server';
import { softenImagePrompt, addSafePrefix, isContentPolicyViolation } from '@/lib/safety';
import pLimit from 'p-limit';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Constants
const IMAGE_GEN_TIMEOUT = 60000; // 60 seconds timeout
const PLACEHOLDER_PATH = path.join(process.cwd(), 'public', 'placeholder.png');

// Supabase client (server-side, service role)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // NOT anon key
  { auth: { persistSession: false } }
);

// Safe prompt sanitization function
function sanitizePrompt(p: string) {
  return [
    "Family-friendly, safe-for-work, no nudity, no violence, no sensitive content.",
    "Uplifting, wholesome, suitable for all ages.",
    p
  ].join(" ");
}

// === Provider abstraction with DALL-E 3 as primary ===
async function providerGenerateImage(prompt: string): Promise<ArrayBuffer> {
  const startTime = Date.now();
  console.log(`[preview-images] Using DALL-E 3 provider for prompt: ${prompt.substring(0, 50)}...`);
  
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) throw new Error('OpenAI API key not configured');

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: `${prompt} Cinematic vertical composition, 1080x1920, high quality, detailed`,
      n: 1,
      size: '1024x1792',
      quality: 'standard',
      response_format: 'b64_json',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    // fail-fast hard errors so we can fallback
    if (text.includes('billing_hard_limit_reached') || 
        text.includes('content_policy_violation') ||
        text.includes('quota_exceeded') ||
        text.includes('rate_limit_exceeded')) {
      throw Object.assign(new Error('HARD_FAIL'), { code: 'HARD_FAIL', raw: text });
    }
    throw new Error(`OpenAI API error: ${response.status} ${text}`);
  }

  const data = await response.json();
  const base64Data = data.data[0].b64_json;
  
  if (!base64Data) throw new Error('No image data received from OpenAI');
  
  const buffer = Buffer.from(base64Data, 'base64');
  const timeTaken = Date.now() - startTime;
  console.log(`[preview-images] DALL-E 3 image generated successfully in ${timeTaken}ms`);
  
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

// Fallback provider using DALL-E 2
async function providerFallbackImage(prompt: string): Promise<ArrayBuffer> {
  const startTime = Date.now();
  console.log(`[preview-images] Using DALL-E 2 fallback provider for prompt: ${prompt.substring(0, 50)}...`);
  
  // Use sanitized prompt for fallback as well
  const sanitizedPrompt = sanitizePrompt(prompt);

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) throw new Error('OpenAI API key not configured');

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-2', // Use DALL-E 2 as fallback (more permissive)
      prompt: sanitizedPrompt,
      n: 1,
      size: '1024x1024', // Square format as fallback
      response_format: 'b64_json',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Fallback provider failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  const base64Data = data.data[0].b64_json;
  
  if (!base64Data) throw new Error('No image data received from fallback provider');
  
  const buffer = Buffer.from(base64Data, 'base64');
  const timeTaken = Date.now() - startTime;
  console.log(`[preview-images] DALL-E 2 fallback image generated successfully in ${timeTaken}ms`);
  
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

// Placeholder image provider that never crashes
async function providerPlaceholderImage(): Promise<Buffer> {
  try {
    await fs.access(PLACEHOLDER_PATH);
    return await fs.readFile(PLACEHOLDER_PATH);
  } catch {
    // generate simple PNG buffer (solid color) if file missing
    const w=1080,h=1920;
    const size=w*h*4;
    const raw = Buffer.alloc(size, 0xEE); // light gray RGBA
    // Minimal PNG encoder shortcut via sharp if available, else JPEG via canvas-less fallback
    // Simpler: return JPEG from raw using data URI conversion in another provider if present.
    // For stability here, return a tiny 1x1 PNG prebuilt buffer:
    return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGBgAAAABQABJzQpGQAAAABJRU5ErkJggg==','base64');
  }
}

async function generateImageBufferForPrompt(prompt: string): Promise<ArrayBuffer> {
  try {
    // Use sanitized prompt for all provider calls
    const sanitizedPrompt = sanitizePrompt(prompt);
    console.log(`[preview-images] Using sanitized prompt: ${sanitizedPrompt.substring(0, 100)}...`);
    
    return await providerGenerateImage(sanitizedPrompt);
  } catch (e: any) {
    if (e?.code === 'HARD_FAIL') {
      // immediately try fallback
      console.log(`[preview-images] Hard failure detected, switching to DALL-E 2 fallback provider`);
      try {
        return await providerFallbackImage(prompt);
      } catch (fallbackError: any) {
        console.warn(`[preview-images] DALL-E 2 fallback also failed:`, fallbackError.message);
        console.log(`[preview-images] Using placeholder image as final fallback`);
        const placeholderBuffer = await providerPlaceholderImage();
        return placeholderBuffer.buffer.slice(placeholderBuffer.byteOffset, placeholderBuffer.byteOffset + placeholderBuffer.byteLength) as ArrayBuffer;
      }
    }
    // for soft failures, you can rethrow to let withRetry handle
    throw e;
  }
}

// Timeout wrapper
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

// === Image generation helper with comprehensive fallback ===
async function generateImageBufferForPromptWithFallback(prompt: string): Promise<ArrayBuffer> {
  console.log(`[preview-images] Generating image for prompt: ${prompt.substring(0, 50)}...`);

  // Use sanitized prompt for primary generation
  const sanitizedPrompt = sanitizePrompt(prompt);
  
  // First try with sanitized prompt
  try {
    return await generateImageBufferForPrompt(sanitizedPrompt);
  } catch (e: any) {
    const blocked = isContentPolicyViolation(e);
    if (!blocked) {
      console.warn(`[preview-images] Non-policy error, trying DALL-E 2 fallback:`, e.message);
      try {
        return await providerFallbackImage(prompt);
      } catch (fallbackError: any) {
        console.warn(`[preview-images] DALL-E 2 fallback failed:`, fallbackError.message);
        console.log(`[preview-images] Using placeholder image as final fallback`);
        const placeholderBuffer = await providerPlaceholderImage();
        return placeholderBuffer.buffer.slice(placeholderBuffer.byteOffset, placeholderBuffer.byteOffset + placeholderBuffer.byteLength) as ArrayBuffer;
      }
    }

    // retry once with softened prompt
    const softened = softenImagePrompt(prompt);
    if (softened === prompt) {
      console.warn(`[preview-images] Prompt cannot be softened, trying DALL-E 2 fallback`);
      try {
        return await providerFallbackImage(prompt);
      } catch (fallbackError: any) {
        console.warn(`[preview-images] DALL-E 2 fallback failed:`, fallbackError.message);
        console.log(`[preview-images] Using placeholder image as final fallback`);
        const placeholderBuffer = await providerPlaceholderImage();
        return placeholderBuffer.buffer.slice(placeholderBuffer.byteOffset, placeholderBuffer.byteOffset + placeholderBuffer.byteLength) as ArrayBuffer;
      }
    }

    try {
      console.log(`[preview-images] Retrying with softened prompt: ${softened.substring(0, 50)}...`);
      return await generateImageBufferForPrompt(softened);
    } catch (e2: any) {
      console.warn(`[preview-images] Softened prompt also failed, trying DALL-E 2 fallback`);
      try {
        return await providerFallbackImage(prompt);
      } catch (fallbackError: any) {
        console.warn(`[preview-images] DALL-E 2 fallback failed:`, fallbackError.message);
        console.log(`[preview-images] Using placeholder image as final fallback`);
        const placeholderBuffer = await providerPlaceholderImage();
        return placeholderBuffer.buffer.slice(placeholderBuffer.byteOffset, placeholderBuffer.byteOffset + placeholderBuffer.byteLength) as ArrayBuffer;
      }
    }
  }
}

// Reliable upload with retries + bucket auto-create
async function ensureBucket(name: string) {
  const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) return; // ignore silently
  if (!buckets?.some(b => b.name === name)) {
    await supabase.storage.createBucket(name, { public: true, fileSizeLimit: 5242880 });
    // allow public read by default
  }
}

async function sleep(ms:number){ return new Promise(r=>setTimeout(r,ms)); }

async function uploadImageAndGetPublicURL(path: string, buffer: Buffer, contentType='image/jpeg') {
  const bucket = 'renders-images';
  await ensureBucket(bucket);
  const attempts = 3;
  let lastErr: any;

  for (let i = 1; i <= attempts; i++) {
    const { error: uploadError } =
      await supabase.storage.from(bucket).upload(path, buffer, { upsert: true, contentType });

    if (!uploadError) {
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      if (urlData?.publicUrl) return urlData.publicUrl;
      lastErr = new Error('No public URL returned');
    } else {
      lastErr = uploadError;
    }

    console.warn(`[upload-retry] attempt ${i} failed: ${lastErr?.message || lastErr}`);
    await sleep(500 * i); // backoff: 500ms, 1s, 1.5s
  }
  throw new Error(`Upload failed after retries: ${lastErr?.message || lastErr}`);
}

// Parallel image generation with progress tracking and concurrency control
async function generateImagesInParallel(
  videoId: string, 
  scenes: Array<{ text: string; image_prompt: string }>, 
  existingUrls: (string | null)[]
): Promise<{ imageUrls: (string | null)[]; progress: number; hardFailures: number; placeholdersUsed: number; sceneStatuses: any[] }> {
  const imageUrls = [...existingUrls];
  const totalScenes = scenes.length;
  
  // Find scenes that need generation
  const scenesToGenerate: Array<{ index: number; prompt: string }> = [];
  for (let i = 0; i < totalScenes; i++) {
    if (!imageUrls[i]) {
      scenesToGenerate.push({
        index: i,
        prompt: scenes[i].image_prompt
      });
    }
  }
  
  if (scenesToGenerate.length === 0) {
    return { imageUrls, progress: totalScenes, hardFailures: 0, placeholdersUsed: 0, sceneStatuses: [] };
  }
  
  console.log(`[preview-images] Generating ${scenesToGenerate.length} images in parallel...`);
  
  // Track progress in real-time
  let completedCount = existingUrls.filter(Boolean).length;
  let hardFailures = 0;
  let placeholdersUsed = 0;
  const sceneStatuses: any[] = [];
  
  // Limit concurrency to 2-3 rather than 6 at once
  const limit = pLimit(3);
  
  // Generate all images in parallel with individual progress tracking and timeouts
  const generationPromises = scenesToGenerate.map(async (scene) => {
    try {
      const buf = await limit(() => withTimeout(
        generateImageBufferForPromptWithFallback(scene.prompt), 
        IMAGE_GEN_TIMEOUT // 60 second timeout
      ));
      
      // Check if this is a placeholder (simple heuristic based on size)
      const isPlaceholder = buf.byteLength < 10000; // Placeholder images are typically smaller
      if (isPlaceholder) {
        placeholdersUsed++;
        // Track scene status for placeholder usage
        sceneStatuses.push({
          sceneIndex: scene.index,
          placeholder_used: true,
          reason: 'generated_placeholder'
        });
      }
      
      // Convert ArrayBuffer to Buffer for upload
      const buffer = Buffer.from(buf);
      const publicUrl = await uploadImageAndGetPublicURL(`videos/${videoId}/images/scene-${scene.index + 1}.jpg`, buffer);
      
      // Update progress in real-time
      completedCount++;
      const progressPercent = Math.round((completedCount / totalScenes) * 100);
      
      await VideoService.updateVideo(videoId, {
        image_upload_progress: progressPercent
      });
      
      return { index: scene.index, url: publicUrl, success: true, isPlaceholder };
    } catch (error: any) {
      console.error(`[preview-images] Failed to generate image for scene ${scene.index + 1}:`, error);
      
      // Log the error but don't stop the pipeline
      if (error?.code === 'HARD_FAIL') {
        hardFailures++;
        console.warn(`[preview-images] Scene ${scene.index + 1} failed with hard failure, using placeholder`);
        sceneStatuses.push({
          sceneIndex: scene.index,
          placeholder_used: true,
          reason: 'hard_failure'
        });
      } else if (isContentPolicyViolation(error)) {
        console.warn(`[preview-images] Scene ${scene.index + 1} blocked by content policy, using placeholder`);
        sceneStatuses.push({
          sceneIndex: scene.index,
          placeholder_used: true,
          reason: 'content_policy_violation'
        });
      } else {
        console.warn(`[preview-images] Scene ${scene.index + 1} failed with error: ${error.message}, using placeholder`);
        sceneStatuses.push({
          sceneIndex: scene.index,
          placeholder_used: true,
          reason: 'generation_error'
        });
      }
      
      // Use placeholder for this scene so the process can continue
      try {
        const placeholderBuf = await providerPlaceholderImage();
        const placeholderUrl = await uploadImageAndGetPublicURL(`videos/${videoId}/images/scene-${scene.index + 1}.jpg`, placeholderBuf);
        placeholdersUsed++;
        
        console.warn(`[preview-images] using generated placeholder for scene ${scene.index + 1}`);
        
        // Update progress
        completedCount++;
        const progressPercent = Math.round((completedCount / totalScenes) * 100);
        
        await VideoService.updateVideo(videoId, {
          image_upload_progress: progressPercent
        });
        
        return { index: scene.index, url: placeholderUrl, success: true, isPlaceholder: true };
      } catch (placeholderError: any) {
        console.error(`[preview-images] Even placeholder failed for scene ${scene.index + 1}:`, placeholderError);
        return { index: scene.index, url: null, success: false, error: 'placeholder_failed' };
      }
    }
  });
  
  // Wait for all generations to complete
  const results = await Promise.allSettled(generationPromises);
  
  // Process results and update imageUrls
  let successCount = 0;
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.success) {
      imageUrls[result.value.index] = result.value.url;
      successCount++;
    }
  }
  
  const finalProgress = Math.round(((existingUrls.filter(Boolean).length + successCount) / totalScenes) * 100);
  
  console.log(`[preview-images] Generation complete: ${successCount} successful, ${placeholdersUsed} placeholders used, ${hardFailures} hard failures`);
  
  return { imageUrls, progress: finalProgress, hardFailures, placeholdersUsed, sceneStatuses };
}

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    const v = await VideoService.getById(id);
    
    if (!v) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    }

    // Only run when storyboard exists
    if (v.status !== 'storyboard_generated' && v.status !== 'script_approved') {
      return NextResponse.json({ ok: false, error: `invalid_status:${v.status}` }, { status: 409 });
    }

    const scenes = (v.storyboard_json?.scenes ?? []) as Array<{ text: string; image_prompt: string }>;
    const existingUrls: (string | null)[] = (v.image_urls ?? []).slice();
    
    // Initialize progress
    await VideoService.updateVideo(id, {
      image_upload_progress: existingUrls.filter(Boolean).length
    });

    // Generate images in parallel
    const { imageUrls, progress, hardFailures, placeholdersUsed, sceneStatuses } = await generateImagesInParallel(id, scenes, existingUrls);
    
    // Update final state
    await VideoService.updateVideo(id, {
      image_urls: imageUrls,
      image_upload_progress: progress
    });

    // Update scene statuses in storyboard_json if we have placeholder information
    if (sceneStatuses.length > 0) {
      const updatedStoryboard = { ...v.storyboard_json };
      if (!updatedStoryboard.scenes) {
        updatedStoryboard.scenes = scenes;
      }
      
      // Update each scene with placeholder status
      sceneStatuses.forEach((status) => {
        if (updatedStoryboard.scenes[status.sceneIndex]) {
          updatedStoryboard.scenes[status.sceneIndex] = {
            ...updatedStoryboard.scenes[status.sceneIndex],
            placeholder_used: status.placeholder_used,
            reason: status.reason
          };
        }
      });
      
      // Update database with scene status information
      await VideoService.updateVideo(id, {
        storyboard_json: updatedStoryboard
      });
      
      console.log(`[preview-images] Updated ${sceneStatuses.length} scenes with placeholder status information`);
    }

    // Surface why it's slow to the user (billing/content filters)
    if (hardFailures > 0) {
      // save a friendly banner into error_message so the UI shows it immediately
      await VideoService.updateVideo(id, {
        error_message:
          'Image provider error: billing hard limit reached. Switched to fallback engine for previews.',
      });
    }

    // Log summary with detailed information
    if (placeholdersUsed > 0) {
      console.log(`[preview-images] Summary: ${placeholdersUsed} scenes used placeholder images due to generation failures`);
      console.log(`[preview-images] Scene statuses:`, JSON.stringify(sceneStatuses, null, 2));
      
      // Log provider and prompt information for debugging
      sceneStatuses.forEach((status) => {
        const scene = scenes[status.sceneIndex];
        console.log(`[preview-images] Scene ${status.sceneIndex + 1}: ${status.reason} - Original prompt: "${scene.image_prompt.substring(0, 100)}..."`);
      });
    }

    const readyCount = imageUrls.filter(url => url && url.trim() !== '').length;
    
    // After all scenes finish, if at least one image_url exists (even placeholders), update DB status to 'assets_generated'
    if (readyCount > 0 && v.status === 'storyboard_generated') {
      console.log(`[preview-images] Transitioning to 'assets_generated' status with ${readyCount} images ready`);
      await VideoService.updateVideo(id, { status: 'assets_generated' });
    } else if (readyCount === 0) {
      console.log(`[preview-images] Staying at '${v.status}' status - no images generated`);
    }
    
    return NextResponse.json({
      ok: true,
      image_urls: imageUrls,
      ready: readyCount,
      total: scenes.length,
      progress,
      placeholders_used: placeholdersUsed,
      scene_statuses: sceneStatuses
    });

  } catch (e: any) {
    console.error('[preview-images] Error:', e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
} 