import { NextRequest, NextResponse } from 'next/server';
import { VideoService } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';

// Constants
const IMAGE_GEN_TIMEOUT = 60000; // 60 seconds timeout
const PLACEHOLDER_PATH = path.join(process.cwd(), 'public', 'placeholder.png');

// Supabase client (server-side, service role)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // NOT anon key
  { auth: { persistSession: false } }
);

// Brand-safe and non-violent prompt sanitization function
function sanitizePrompt(p: string) {
  // Remove brand names and violent/theft wording
  let sanitized = p
    .replace(/\b(spider-man|spiderman|marvel|dc|disney|pixar|nintendo|sony|microsoft|apple|google|amazon|netflix|youtube|facebook|instagram|twitter|x|tiktok)\b/gi, 'hero')
    .replace(/\b(thief|steal|stealing|robbery|burglary|theft|grab|grabbing|purse|wallet|phone|jewelry)\b/gi, 'person')
    .replace(/\b(violence|violent|fight|fighting|attack|attacking|punch|punching|kick|kicking|weapon|gun|knife)\b/gi, 'action')
    .replace(/\b(mask|masked|hood|hooded)\b/gi, 'costume');
  
  return [
    "Family-friendly, safe-for-work, no nudity, no violence, no sensitive content, no brands.",
    "Uplifting, wholesome, suitable for all ages, playful comic style.",
    sanitized
  ].join(" ");
}

// Provider functions (simplified versions from generate-preview-images)
async function providerGenerateImage(prompt: string): Promise<ArrayBuffer> {
  const startTime = Date.now();
  console.log(`[regenerate-scene] Using DALL-E 3 provider for prompt: ${prompt.substring(0, 50)}...`);
  
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
    if (text.includes('content_policy_violation')) {
      throw Object.assign(new Error('CONTENT_POLICY_VIOLATION'), { code: 'CONTENT_POLICY_VIOLATION', raw: text });
    }
    throw new Error(`OpenAI API error: ${response.status} ${text}`);
  }

  const data = await response.json();
  const base64Data = data.data[0].b64_json;
  
  if (!base64Data) throw new Error('No image data received from OpenAI');
  
  const buffer = Buffer.from(base64Data, 'base64');
  const timeTaken = Date.now() - startTime;
  console.log(`[regenerate-scene] DALL-E 3 image generated successfully in ${timeTaken}ms`);
  
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

async function providerFallbackImage(prompt: string): Promise<ArrayBuffer> {
  const startTime = Date.now();
  console.log(`[regenerate-scene] Using DALL-E 2 fallback provider for prompt: ${prompt.substring(0, 50)}...`);
  
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
      model: 'dall-e-2',
      prompt: sanitizedPrompt,
      n: 1,
      size: '1024x1024',
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
  console.log(`[regenerate-scene] DALL-E 2 fallback image generated successfully in ${timeTaken}ms`);
  
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

async function providerPlaceholderImage(): Promise<Buffer> {
  try {
    await fs.access(PLACEHOLDER_PATH);
    return await fs.readFile(PLACEHOLDER_PATH);
  } catch {
    // generate simple PNG buffer if file missing
    return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGBgAAAABQABJzQpGQAAAABJRU5ErkJggg==','base64');
  }
}

// Main image generation with fallback
async function generateImageWithFallback(prompt: string): Promise<{ buffer: ArrayBuffer; isPlaceholder: boolean; reason?: string }> {
  try {
    // Try with sanitized prompt first
    const sanitizedPrompt = sanitizePrompt(prompt);
    console.log(`[regenerate-scene] Attempting generation with sanitized prompt: ${sanitizedPrompt.substring(0, 100)}...`);
    
    const buffer = await providerGenerateImage(sanitizedPrompt);
    return { buffer, isPlaceholder: false };
  } catch (e: any) {
    if (e?.code === 'CONTENT_POLICY_VIOLATION') {
      console.warn(`[regenerate-scene] Content policy violation, trying DALL-E 2 fallback`);
      try {
        const buffer = await providerFallbackImage(prompt);
        return { buffer, isPlaceholder: false };
      } catch (fallbackError: any) {
        console.warn(`[regenerate-scene] DALL-E 2 fallback also failed:`, fallbackError.message);
        console.log(`[regenerate-scene] Using placeholder as final fallback`);
        const placeholderBuffer = await providerPlaceholderImage();
        return { 
          buffer: placeholderBuffer.buffer.slice(placeholderBuffer.byteOffset, placeholderBuffer.byteOffset + placeholderBuffer.byteLength) as ArrayBuffer,
          isPlaceholder: true,
          reason: 'content_policy_violation'
        };
      }
    }
    
    // For other errors, try fallback
    console.warn(`[regenerate-scene] Generation failed:`, e.message);
    try {
      const buffer = await providerFallbackImage(prompt);
      return { buffer, isPlaceholder: false };
    } catch (fallbackError: any) {
      console.warn(`[regenerate-scene] DALL-E 2 fallback failed:`, fallbackError.message);
      console.log(`[regenerate-scene] Using placeholder as final fallback`);
      const placeholderBuffer = await providerPlaceholderImage();
      return { 
        buffer: placeholderBuffer.buffer.slice(placeholderBuffer.byteOffset, placeholderBuffer.byteOffset + placeholderBuffer.byteLength) as ArrayBuffer,
        isPlaceholder: true,
        reason: 'generation_error'
      };
    }
  }
}

// Upload function
async function uploadImageAndGetPublicURL(path: string, buffer: Buffer, contentType='image/jpeg') {
  const bucket = 'renders-images';
  
  // Ensure bucket exists
  const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
  if (!listErr && !buckets?.some(b => b.name === bucket)) {
    await supabase.storage.createBucket(bucket, { public: true, fileSizeLimit: 5242880 });
  }
  
  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, buffer, { upsert: true, contentType });
  
  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }
  
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!urlData?.publicUrl) {
    throw new Error('No public URL returned after upload');
  }
  
  return urlData.publicUrl;
}

export async function POST(req: NextRequest) {
  try {
    const { videoId, sceneIndex } = await req.json();
    
    if (!videoId || sceneIndex === undefined) {
      return NextResponse.json({ ok: false, error: 'Missing videoId or sceneIndex' }, { status: 400 });
    }
    
    // Get video data
    const video = await VideoService.getById(videoId);
    if (!video) {
      return NextResponse.json({ ok: false, error: 'Video not found' }, { status: 404 });
    }
    
    // Validate scene index
    const scenes = video.storyboard_json?.scenes || [];
    if (sceneIndex < 0 || sceneIndex >= scenes.length) {
      return NextResponse.json({ ok: false, error: 'Invalid scene index' }, { status: 400 });
    }
    
    const scene = scenes[sceneIndex];
    if (!scene.image_prompt) {
      return NextResponse.json({ ok: false, error: 'Scene has no image prompt' }, { status: 400 });
    }
    
    console.log(`[regenerate-scene] Regenerating scene ${sceneIndex + 1} for video ${videoId}`);
    console.log(`[regenerate-scene] Original prompt: "${scene.image_prompt.substring(0, 100)}..."`);
    
    // Generate new image with fallback
    const { buffer, isPlaceholder, reason } = await generateImageWithFallback(scene.image_prompt);
    
    // Upload the new image
    const imagePath = `videos/${videoId}/images/scene-${sceneIndex + 1}.jpg`;
    const bufferForUpload = Buffer.from(buffer);
    const newImageUrl = await uploadImageAndGetPublicURL(imagePath, bufferForUpload);
    
    // Update the image_urls array
    const currentImageUrls = [...(video.image_urls || [])];
    currentImageUrls[sceneIndex] = newImageUrl;
    
    // Update scene status in storyboard
    const updatedStoryboard = { ...video.storyboard_json };
    updatedStoryboard.scenes[sceneIndex] = {
      ...updatedStoryboard.scenes[sceneIndex],
      image_url: newImageUrl,
      placeholder_used: isPlaceholder,
      reason: reason || undefined
    };
    
    // Update database
    await VideoService.updateVideo(videoId, {
      image_urls: currentImageUrls,
      storyboard_json: updatedStoryboard
    });
    
    // Log the result
    if (isPlaceholder) {
      console.log(`[regenerate-scene] Scene ${sceneIndex + 1} regeneration failed, using placeholder. Reason: ${reason}`);
    } else {
      console.log(`[regenerate-scene] Scene ${sceneIndex + 1} successfully regenerated: ${newImageUrl.substring(0, 50)}...`);
    }
    
    return NextResponse.json({
      ok: true,
      scene_index: sceneIndex,
      new_image_url: newImageUrl,
      is_placeholder: isPlaceholder,
      reason: reason,
      message: isPlaceholder 
        ? `Scene regeneration failed, using placeholder. Reason: ${reason}`
        : 'Scene successfully regenerated'
    });
    
  } catch (e: any) {
    console.error('[regenerate-scene] Error:', e);
    return NextResponse.json({ 
      ok: false, 
      error: String(e?.message || e) 
    }, { status: 500 });
  }
} 