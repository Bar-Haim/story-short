import { NextRequest, NextResponse } from 'next/server';
import { VideoService, sbServer } from '@/lib/supabase-server';
import { parseScriptSections, toPlainNarration } from '@/lib/script';
import { ttsGenerateBuffer } from '@/lib/providers/tts';
import { generateTTS } from '@/lib/tts';
import { generateCaptions } from '@/lib/captions';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { softenImagePrompt, addSafePrefix, isContentPolicyViolation } from '@/lib/safety';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

type Scene = { prompt: string; index: number };

function hasResponseData(e: unknown): e is { response?: { data?: unknown } } {
  return typeof e === 'object' && e !== null && 'response' in e;
}

function toErrorDetails(e: unknown) {
  if (e instanceof Error) {
    return {
      message: e.message,
      stack: e.stack,
      responseData: hasResponseData(e) ? (e as any).response?.data : undefined,
      cause: (e as any)?.cause,
    };
  }
  return { message: typeof e === 'string' ? e : JSON.stringify(e), stack: undefined, responseData: undefined, cause: undefined };
}

const withRetry = async <T>(op: () => Promise<T>, max = 3, baseDelay = 500): Promise<T> => {
  let last: Error | undefined;
  for (let i = 1; i <= max; i++) {
    try { return await op(); }
    catch (err: unknown) {
      const d = toErrorDetails(err);
      last = err instanceof Error ? err : new Error(d.message);
      console.error(`[assets][retry] attempt ${i}/${max} failed`, d);
      if (i < max) {
        const wait = baseDelay * Math.pow(2, i - 1);
        await new Promise(r => setTimeout(r, wait));
      }
    }
  }
  throw last ?? new Error('operation failed after retries');
};

// === Provider hooks ===
async function generateImageBufferForPrompt(scene: Scene): Promise<Buffer> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) throw new Error('OpenAI API key not configured');

  console.log(`[assets][image] Generating image for scene ${scene.index + 1}: ${scene.prompt.substring(0, 50)}...`);

  // Add safe prefix to reduce policy trips
  const safePrompt = addSafePrefix(scene.prompt);
  
  // First try with original prompt (already "safe" prompts pass)
  try {
    return await providerGenerateImage(safePrompt);
  } catch (e: any) {
    const msg = String(e?.message || e);
    const blocked = isContentPolicyViolation(e);
    if (!blocked) throw e; // rethrow other errors

    // retry once with softened prompt
    const softened = softenImagePrompt(scene.prompt);
    if (softened === scene.prompt) throw e; // nothing to soften

    try {
      console.log(`[assets][image] Retrying scene ${scene.index + 1} with softened prompt: ${softened.substring(0, 50)}...`);
      return await providerGenerateImage(addSafePrefix(softened));
    } catch (e2: any) {
      // final failure → bubble up with a scene-specific message
      const finalMsg = `Image blocked by content filter. Please edit the prompt to be family-friendly.\nOriginal: "${scene.prompt}"\nSoftened tried: "${softened}"`;
      const err = new Error(finalMsg);
      (err as any).code = 'content_policy_violation';
      throw err;
    }
  }
}

async function providerGenerateImage(prompt: string): Promise<Buffer> {
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
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const base64Data = data.data[0].b64_json;
  
  if (!base64Data) throw new Error('No image data received from OpenAI');
  
  return Buffer.from(base64Data, 'base64');
}

async function uploadImageAndGetPublicURL(videoId: string, scene: Scene, buf: Buffer): Promise<string> {
  const supabase = sbServer();
  const path = `videos/${videoId}/images/scene-${scene.index + 1}.jpg`;
  
  const { error: uploadError } = await supabase.storage
    .from('renders-images')
    .upload(path, buf, { upsert: true, contentType: 'image/jpeg' });
  
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const { data: urlData } = supabase.storage.from('renders-images').getPublicUrl(path);
  const url = urlData?.publicUrl;
  if (!url) throw new Error('failed_to_get_public_url');
  return url;
}

async function ensureAudio(videoId: string, scriptText: string): Promise<string> {
  console.log('[assets][audio] Generating audio...');

  // Parse script sections and convert to plain narration (no labels)
  const sections = parseScriptSections(scriptText);
  const narration = toPlainNarration(sections);
  
  console.log('[assets][audio] Plain narration (no labels):', narration.substring(0, 100) + '...');

  // Generate TTS using new voice and provider
  const audioBuffer = await ttsGenerateBuffer({ text: narration });
  const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });

  const supabase = sbServer();
  const audioBucket = 'renders-audio';
  const audioPath = `videos/${videoId}/audio.mp3`;
  
  const { error: uploadError } = await supabase.storage
    .from(audioBucket)
    .upload(audioPath, audioBlob, { contentType: 'audio/mpeg', upsert: true });

  if (uploadError) throw new Error(`Audio upload failed: ${uploadError.message}`);

  const { data: urlData } = supabase.storage.from(audioBucket).getPublicUrl(audioPath);
  return urlData.publicUrl;
}

// Helper functions for caption generation
async function getAudioDurationSec(file: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const p = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      file
    ]);
    let out = '', err = '';
    p.stdout.on('data', d => out += d.toString());
    p.stderr.on('data', d => err += d.toString());
    p.on('close', (code) => {
      if (code === 0) {
        const n = parseFloat(out.trim());
        resolve(isFinite(n) ? n : 0);
      } else {
        reject(new Error(err || `ffprobe exited with ${code}`));
      }
    });
  });
}

function splitIntoSentences(text: string): string[] {
  return text.replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function ts(t: number): string {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const ms = Math.round((t - Math.floor(t)) * 1000);
  const p = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${p(h)}:${p(m)}:${p(s)},${String(ms).padStart(3, '0')}`;
}

function wrapForSrt(text: string, max = 42) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line: string[] = [];
  
  for (const w of words) {
    const test = [...line, w].join(' ');
    if (test.length > max && line.length) {
      lines.push(line.join(' '));
      line = [w];
    } else {
      line.push(w);
    }
  }
  
  if (line.length) lines.push(line.join(' '));
  
  if (lines.length > 2) {
    const joined = lines.join(' ');
    const mid = Math.floor(joined.length / 2);
    const left = joined.slice(0, mid).trim();
    const right = joined.slice(mid).trim();
    return `${left}\n${right}`;
  }
  
  return lines.join('\n');
}

function buildSrt(text: string, total: number): string {
  const sentences = splitIntoSentences(text);
  const totalChars = sentences.reduce((a, s) => a + s.length, 0) || 1;
  const minSeg = 1.2;
  let t = 0;
  const out: string[] = [];

  if (sentences.length === 0) {
    out.push('1', `00:00:00,000 --> ${ts(total)}`, text || ' ', '');
    return out.join('\n');
  }

  sentences.forEach((sent, i) => {
    const share = sent.length / totalChars;
    let dur = Math.max(minSeg, total * share);
    if (i === sentences.length - 1) dur = Math.max(minSeg, total - t);
    const start = t;
    const end = Math.min(total, t + dur);
    t = end;

    const cueText = wrapForSrt(sent);
    out.push(String(i + 1), `${ts(start)} --> ${ts(end)}`, cueText, '');
  });
  return out.join('\n');
}

async function ensureCaptions(videoId: string, scriptText: string): Promise<string> {
  console.log('[assets][captions] Generating captions...');

  // Parse script sections and convert to plain narration (no labels)
  const sections = parseScriptSections(scriptText);
  const narration = toPlainNarration(sections);
  
  // First, we need to generate the audio to get its duration
  const audioBuffer = await ttsGenerateBuffer({ text: narration });
  
  // Save audio temporarily to measure duration
  const tempDir = path.join(process.cwd(), 'renders', videoId, 'temp');
  await fs.mkdir(tempDir, { recursive: true });
  const tempAudioPath = path.join(tempDir, 'temp-audio.mp3');
  await fs.writeFile(tempAudioPath, audioBuffer);
  
  // Get audio duration via ffprobe
  const audioDuration = await getAudioDurationSec(tempAudioPath);
  console.log(`[assets][captions] Audio duration: ${audioDuration.toFixed(2)}s`);
  
  // Clean up temp audio
  await fs.unlink(tempAudioPath);
  
  // Build SRT captions that span the full duration
  const srt = buildSrt(narration, audioDuration);
  
  console.log('[assets][captions] Generated SRT captions spanning full audio duration');

  const supabase = sbServer();
  const captionsBucket = 'renders-captions';
  const captionsPath = `videos/${videoId}/captions.srt`;
  
  const { error: uploadError } = await supabase.storage
    .from(captionsBucket)
    .upload(captionsPath, srt, { contentType: 'application/x-subrip', upsert: true });

  if (uploadError) throw new Error(`Captions upload failed: ${uploadError.message}`);

  const { data: urlData } = supabase.storage.from(captionsBucket).getPublicUrl(captionsPath);
  return urlData.publicUrl;
}

// Merge & dedupe image URLs by scene index if you store alongside (optional)
function mergeImageUrls(existing: string[] | null | undefined, newly: string[]): string[] {
  const set = new Set([...(existing ?? []), ...newly]);
  return Array.from(set);
}

export async function POST(req: NextRequest) {
  try {
    const { videoId } = await req.json();
    if (!videoId) return NextResponse.json({ ok: false, error: 'missing_videoId' }, { status: 400 });

    console.log(`[assets] Starting asset orchestration for videoId: ${videoId}`);

    const video = await VideoService.getById(videoId);
    if (!video) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

    console.log(`[assets] Current status: ${video.status}`);

    // Check if assets are already generated - return success if so
    if (video.status === 'assets_generated' || video.status === 'render_ready') {
      console.log(`[assets] Assets already generated (status: ${video.status}), returning success`);
      
      const hasImages = Array.isArray(video.image_urls) && video.image_urls.length > 0;
      const hasAudio = !!video.audio_url;
      const hasCaptions = !!video.captions_url;
      
      return NextResponse.json({
        ok: true,
        status: video.status,
        ran: { 
          images: false, 
          audio: false, 
          captions: false 
        },
        urls: {
          audio: video.audio_url || undefined,
          captions: video.captions_url || undefined
        },
        nextStatus: video.status,
        message: 'Assets already generated',
        note: 'Assets already generated',
        assets: {
          images: hasImages ? video.image_urls.length : 0,
          totalScenes: video.storyboard_json?.scenes?.length || 0,
          audio: hasAudio,
          captions: hasCaptions
        }
      }, { status: 200 });
    }

    // Check if we can proceed with asset generation
    const allowedStatuses = ['script_approved', 'storyboard_generated', 'assets_failed', 'assets_generating'];
    
    if (!allowedStatuses.includes(video.status)) {
      console.log(`[assets] Cannot generate assets in status: ${video.status}`);
      return NextResponse.json({ ok: false, error: `Cannot generate assets in status: ${video.status}` }, { status: 400 });
    }

    // Set status to generating if not already
    if (video.status !== 'assets_generating') {
      await VideoService.updateVideo(videoId, { status: 'assets_generating' });
      console.log('[assets] Status updated to assets_generating');
    }

    const storyboard = video.storyboard_json ?? video.storyboard;
    if (!storyboard?.scenes?.length) {
      await VideoService.updateVideo(videoId, { status: 'assets_failed', error_message: 'no_scenes' });
      return NextResponse.json({ ok: false, error: 'no_scenes' }, { status: 400 });
    }

    const totalScenes = storyboard.scenes.length as number;
    const existingUrls: string[] = Array.isArray(video.image_urls) ? video.image_urls : [];
    const existingCount = existingUrls.length;

    console.log(`[assets] Found ${totalScenes} scenes, ${existingCount} existing images`);

    // Handle dirty scenes (scenes that need regeneration due to edits)
    const dirtyScenes = Array.isArray(video.dirty_scenes) ? video.dirty_scenes : [];
    console.log(`[assets] Found ${dirtyScenes.length} dirty scenes:`, dirtyScenes);

    // Build list of scenes that need generation (missing + dirty)
    const scenesToGenerate: Scene[] = [];
    
    for (let i = 0; i < totalScenes; i++) {
      const needsGeneration = i >= existingCount || dirtyScenes.includes(i);
      if (needsGeneration) {
        const scene = storyboard.scenes[i];
        scenesToGenerate.push({
          index: i,
          prompt: scene.image_prompt || scene.prompt || scene.description || `Scene ${i + 1}`
        });
      }
    }

    console.log(`[assets] Need to generate ${scenesToGenerate.length} scenes (${totalScenes - existingCount} missing + ${dirtyScenes.length} dirty)`);

    // Generate images for all scenes that need generation
    const tasks = scenesToGenerate.map((scene) => withRetry(async () => {
      console.log(`[assets] Starting generation for scene ${scene.index + 1}`);
      const buf = await generateImageBufferForPrompt(scene);
      const url = await uploadImageAndGetPublicURL(videoId, scene, buf);
      console.log(`[assets] Completed scene ${scene.index + 1}: ${url.substring(0, 50)}...`);
      return { index: scene.index, url };
    }));

    console.log('[assets] Running Promise.allSettled for all image tasks...');
    const results = await Promise.allSettled(tasks);

    const successes = results
      .filter((r): r is PromiseFulfilledResult<{ index: number; url: string }> => r.status === 'fulfilled')
      .map(r => r.value)
      .sort((a,b) => a.index - b.index);

    const failures: Array<{ index: number; reason: string; code?: string }> = [];
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const msg = String((r.reason?.message) || r.reason);
        failures.push({ 
          index: scenesToGenerate[i].index, 
          reason: msg, 
          code: (r.reason?.code || '').toString() 
        });
      }
    });

    console.log(`[assets] Image generation completed: ${successes.length} success, ${failures.length} failures`);

    // Update image URLs at the correct indices (handle both missing and dirty scenes)
    const updatedUrls = [...existingUrls];
    
    // Ensure array is large enough for all scenes
    while (updatedUrls.length < totalScenes) {
      updatedUrls.push('');
    }
    
    // Update URLs for successfully generated scenes
    for (const success of successes) {
      updatedUrls[success.index] = success.url;
    }
    
    const mergedUrls = updatedUrls;

    // Persist partial progress (images_done counter)
    await VideoService.updateVideo(videoId, { image_urls: mergedUrls });

    const haveAllImages = mergedUrls.length === totalScenes && mergedUrls.every(url => url && url.trim() !== '');
    console.log(`[assets] Images complete: ${haveAllImages} (${mergedUrls.length}/${totalScenes})`);

    // Asset orchestration: Generate missing audio and captions proactively
    let audioUrl = video.audio_url;
    let captionsUrl = video.captions_url;
    let ranAudio = false;
    let ranCaptions = false;

    // Generate audio if missing
    if (!audioUrl) {
      try {
        console.log('[assets] Audio missing, generating TTS...');
        audioUrl = await withRetry(() => generateTTS(video));
        ranAudio = true;
        console.log('[assets] Audio generated successfully');
      } catch (error: any) {
        console.error('[assets] Audio generation failed:', error.message);
        // Continue with other assets, don't fail completely
      }
    } else {
      console.log('[assets] Audio exists, skipping generation');
    }

    // Generate captions if missing
    if (!captionsUrl) {
      try {
        console.log('[assets] Captions missing, generating SRT...');
        captionsUrl = await withRetry(() => generateCaptions(video));
        ranCaptions = true;
        console.log('[assets] Captions generated successfully');
      } catch (error: any) {
        console.error('[assets] Captions generation failed:', error.message);
        // Continue with other assets, don't fail completely
      }
    } else {
      console.log('[assets] Captions exist, skipping generation');
    }

    // If there are failures, set status assets_failed and store a helpful error_message
    if (failures.length > 0) {
      const failureScenes = failures.map(f => f.index + 1).join(', ');
      const errorMessage = `Images blocked for scenes: ${failureScenes}. Edit prompts to be family-friendly and retry.`;
      
      await VideoService.updateVideo(videoId, {
        status: 'assets_failed',
        error_message: errorMessage,
        image_urls: mergedUrls, // Save partial progress
        image_upload_progress: (mergedUrls?.filter(Boolean)?.length ?? 0),
      });
      
      return NextResponse.json({ 
        ok: false, 
        failures, 
        error: 'content_policy_violations',
        message: errorMessage
      }, { status: 200 }); // still 200 so UI can show details
    }

    // Determine next status based on asset completeness
    let nextStatus = 'assets_generating';
    let statusMessage = '';

    if (haveAllImages && !!audioUrl && !!captionsUrl) {
      nextStatus = 'render_ready';
      statusMessage = 'All assets ready for rendering';
    } else if (haveAllImages && (!!audioUrl || !!captionsUrl)) {
      nextStatus = 'assets_partial';
      statusMessage = 'Partial assets generated';
    } else if (!haveAllImages) {
      nextStatus = 'assets_failed';
      statusMessage = 'Image generation failed';
    }

    // Update video with current asset state
    await VideoService.updateVideo(videoId, {
      status: nextStatus,
      image_urls: mergedUrls,
      audio_url: audioUrl || null,
      captions_url: captionsUrl || null,
      dirty_scenes: [], // Clear dirty scenes since we've processed them
      error_message: statusMessage
    });

    // Prepare response with detailed information
    const response = {
      ok: true,
      ran: {
        audio: ranAudio,
        captions: ranCaptions
      },
      urls: {
        audio: audioUrl || undefined,
        captions: captionsUrl || undefined
      },
      nextStatus,
      message: statusMessage,
      assets: {
        images: mergedUrls.length,
        totalScenes,
        audio: !!audioUrl,
        captions: !!captionsUrl
      }
    };

    console.log('[assets] Asset orchestration completed:', response);
    return NextResponse.json(response);
    
  } catch (err: unknown) {
    const d = toErrorDetails(err);
    console.error('[generate-assets] fatal', d);
    return NextResponse.json({ ok: false, error: d.message, details: d.responseData }, { status: 500 });
  }
}