import { NextRequest, NextResponse } from 'next/server';
import { VideoService, StorageService, sbServer } from '@/lib/supabase-server';
import type { Video } from '@/types/video';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

// Job locking mechanism to prevent duplicate renders
const activeRenders = new Map<string, { startedAt: Date; status: 'rendering' | 'completed' | 'failed' }>();

// Windows-safe path escaping for subtitles filter
function escapeSrtPathForFilter(p: string): string {
  // Windows-safe for subtitles filter: backslashes -> forward slashes, escape drive colon
  return p.replace(/\\/g, '/').replace(':', '\\:');
}

// Build video filter strings
function buildVideoFilter(includeSubtitles: boolean, srtPath?: string): string {
  const vfParts = [
    "scale=1080:1920:force_original_aspect_ratio=decrease",
    "pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black",
    "zoompan=z='min(zoom+0.0015,1.2)':d=125:x='iw/2-(iw/zoom/2)+sin(t*0.3)*12':y='ih/2-(ih/zoom/2)+cos(t*0.2)*10':s=1080x1920",
  ];
  
  if (includeSubtitles && srtPath) {
    const srt = escapeSrtPathForFilter(srtPath);
    vfParts.push(
      `subtitles=filename='${srt}':charenc=UTF-8:force_style='FontSize=20,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,BorderStyle=1,Outline=1'`
    );
  }
  
  return vfParts.join(',');
}

// Build FFmpeg arguments with proper ordering
function buildFfmpegArgs({ imagesTxt, audioMp3, outMp4, includeSubtitles, srtPath }: {
  imagesTxt: string; 
  audioMp3: string; 
  outMp4: string; 
  includeSubtitles: boolean; 
  srtPath?: string;
}): string[] {
  const vf = buildVideoFilter(includeSubtitles, srtPath);
  
  // ✅ Order matters: first all inputs (-i ... -i ...), then -vf, then output
  return [
    "-y",
    "-f", "concat", "-safe", "0", "-i", imagesTxt,
    "-i", audioMp3,
    "-vf", vf,
    "-c:v", "libx264", "-preset", "fast", "-crf", "23",
    "-c:a", "aac", "-b:a", "128k",
    "-shortest", "-movflags", "+faststart",
    outMp4,
  ];
}

// Graceful fallback if subtitle burn fails
async function renderWithFallback(ctx: {
  imagesTxt: string; 
  audioMp3: string; 
  outMp4: string; 
  srtPath?: string;
}): Promise<{ burnedSubs: boolean }> {
  const tryArgs = (withSubs: boolean) => buildFfmpegArgs({ ...ctx, includeSubtitles: withSubs });

  try {
    // Log the exact FFmpeg command for debugging
    if (process.env.NODE_ENV !== 'production') {
      console.log("[ffmpeg] args:", tryArgs(Boolean(ctx.srtPath)).join(' '));
    }
    
    await execAsync("ffmpeg", tryArgs(Boolean(ctx.srtPath)), { 
      timeout: 600000, // 10 minute timeout
      windowsHide: true 
    });
  } catch (err: any) {
    const msg = String(err?.stderr || err?.message || "");
    console.warn(`⚠️ FFmpeg with subtitles failed:`, msg);
    
    // Retry without subtitles if filter/path fails
    if (/subtitles|Option vf|Error opening input files/i.test(msg)) {
      console.log(`🔄 Retrying FFmpeg without subtitles...`);
      
      if (process.env.NODE_ENV !== 'production') {
        console.log("[ffmpeg] fallback args:", tryArgs(false).join(' '));
      }
      
      await execAsync("ffmpeg", tryArgs(false), { 
        timeout: 600000, // 10 minute timeout
        windowsHide: true 
      });
      
      return { burnedSubs: false };
    }
    throw err;
  }
  
  return { burnedSubs: Boolean(ctx.srtPath) };
}

// Convert VTT to SRT format
function convertVttToSrt(vttContent: string): string {
  const lines = vttContent.trim().split('\n');
  let srtContent = '';
  let subtitleNumber = 1;
  let i = 0;

  while (i < lines.length) {
    // Skip WEBVTT header and metadata
    if (lines[i].startsWith('WEBVTT') || lines[i].startsWith('NOTE') || lines[i].trim() === '') {
      i++;
      continue;
    }

    // Find timestamp line
    const timestampMatch = lines[i].match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s-->\s(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
    if (timestampMatch) {
      const startTime = `${timestampMatch[1]}:${timestampMatch[2]}:${timestampMatch[3]},${timestampMatch[4]}`;
      const endTime = `${timestampMatch[5]}:${timestampMatch[6]}:${timestampMatch[7]},${timestampMatch[8]}`;
      
      srtContent += `${subtitleNumber}\n`;
      srtContent += `${startTime} --> ${endTime}\n`;
      
      i++;
      // Get subtitle text
      while (i < lines.length && lines[i].trim() !== '') {
        srtContent += lines[i].trim() + '\n';
        i++;
      }
      srtContent += '\n';
      subtitleNumber++;
    } else {
      i++;
    }
  }

  return srtContent;
}

// Background rendering function
async function renderVideoInBackground(videoId: string, force: boolean = false) {
  let tempDir: string | null = null;
  
  try {
    console.log(`🎬 [${videoId}] Starting background video rendering...`);
    
    // Update status to rendering
    await VideoService.updateVideo(videoId, {
      status: 'rendering',
      render_progress: 0,
      error_message: undefined
    });

    // Get video data from database
    const videoResult = await VideoService.getVideo(videoId);
    if (!videoResult.success || !videoResult.video) {
      throw new Error('Video not found');
    }

    const video = videoResult.video as Video;
    const storyboard = typeof video.storyboard_json === 'string'
      ? JSON.parse(video.storyboard_json)
      : (video.storyboard_json || {});
    const scenes = Array.isArray(storyboard?.scenes) ? storyboard.scenes : [];
    const imageUrls = video.image_urls || [];
    const audioUrl = video.audio_url;
    const captionsUrl = video.captions_url;

    if (!audioUrl || imageUrls.length === 0) {
      throw new Error('Missing required assets (audio or images)');
    }

    console.log(`📊 [${videoId}] Rendering assets:`, {
      scenes: scenes.length,
      images: imageUrls.length,
      hasAudio: !!audioUrl,
      hasCaptions: !!captionsUrl
    });

    // Create temporary directory
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'video-render-'));
    console.log(`📁 [${videoId}] Temporary directory:`, tempDir);

    // Update progress
    await VideoService.updateVideo(videoId, { render_progress: 10 });

    // Step 1: Download audio
    console.log(`🎵 [${videoId}] Downloading audio...`);
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.statusText}`);
    }
    const audioBuffer = await audioResponse.arrayBuffer();
    const audioPath = path.join(tempDir, 'audio.mp3');
    await fs.promises.writeFile(audioPath, Buffer.from(audioBuffer));
    console.log(`✅ [${videoId}] Audio downloaded`);

    await VideoService.updateVideo(videoId, { render_progress: 20 });

    // Step 2: Download images
    console.log(`🖼️ [${videoId}] Downloading images...`);
    const imagePaths: string[] = [];
    for (let i = 0; i < imageUrls.length; i++) {
      const imageResponse = await fetch(imageUrls[i]);
      if (!imageResponse.ok) {
        throw new Error(`Failed to download image ${i + 1}: ${imageResponse.statusText}`);
      }
      const imageBuffer = await imageResponse.arrayBuffer();
      const imagePath = path.join(tempDir, `scene_${i + 1}.png`);
      await fs.promises.writeFile(imagePath, Buffer.from(imageBuffer));
      imagePaths.push(imagePath);
    }
    console.log(`✅ [${videoId}] Images downloaded`);

    await VideoService.updateVideo(videoId, { render_progress: 30 });

    // Step 3: Download captions if available
    let captionsPath: string | null = null;
    if (captionsUrl) {
      console.log(`📝 [${videoId}] Downloading captions...`);
      const captionsResponse = await fetch(captionsUrl);
      if (captionsResponse.ok) {
        const captionsText = await captionsResponse.text();
        if (captionsText.trim()) {
          const srtContent = convertVttToSrt(captionsText);
          captionsPath = path.join(tempDir, 'captions.srt');
          await fs.promises.writeFile(captionsPath, srtContent);
          console.log(`✅ [${videoId}] Captions downloaded and converted`);
        }
      }
    }

    await VideoService.updateVideo(videoId, { render_progress: 40 });

    // Step 4: Create image list for FFmpeg
    console.log(`📋 [${videoId}] Creating image sequence...`);
    const imageListPath = path.join(tempDir, 'images.txt');
    const imageListContent = imagePaths.map((imgPath, index) => {
      const duration = scenes[index]?.duration || 3;
      return `file '${imgPath.replace(/\\/g, '/')}'\nduration ${duration}`;
    }).join('\n');
    await fs.promises.writeFile(imageListPath, imageListContent);

    await VideoService.updateVideo(videoId, { render_progress: 50 });

    // Step 5: Execute FFmpeg with proper argument ordering and fallback
    console.log(`🎬 [${videoId}] Starting FFmpeg rendering...`);
    const outputPath = path.join(tempDir, 'final_video.mp4');
    
    // Use the new renderWithFallback function for robust subtitle handling
    const { burnedSubs } = await renderWithFallback({
      imagesTxt: imageListPath,
      audioMp3: audioPath,
      outMp4: outputPath,
      srtPath: captionsPath
    });
    
    console.log(`✅ [${videoId}] FFmpeg completed successfully. Subtitles burned: ${burnedSubs}`);

    await VideoService.updateVideo(videoId, { render_progress: 80 });

    // Step 6: Verify output file
    if (!fs.existsSync(outputPath)) {
      throw new Error('FFmpeg did not create output file');
    }
    
    const outputFileSize = fs.statSync(outputPath).size;
    if (outputFileSize === 0) {
      throw new Error('FFmpeg created empty output file');
    }

    await VideoService.updateVideo(videoId, { render_progress: 90 });

    // Step 7: Upload to Supabase using enhanced StorageService
    console.log(`☁️ [${videoId}] Uploading to Supabase...`);
    const videoBuffer = await fs.promises.readFile(outputPath);
    
    // Use enhanced StorageService for reliable upload with availability check
    const publicUrl = await StorageService.uploadVideo(videoId, videoBuffer);
    
    console.log(`✅ [${videoId}] Video uploaded and verified:`, publicUrl);

    // Step 9: Update database and mark as completed
    await VideoService.updateVideo(videoId, {
      status: 'completed',
      final_video_url: publicUrl,
      render_progress: 100,
      render_done_at: new Date().toISOString()
    });

    // Update job lock
    activeRenders.set(videoId, { startedAt: new Date(), status: 'completed' });

    console.log(`✅ [${videoId}] Video rendering completed successfully`);
    console.log(`🔗 [${videoId}] Final video URL: ${publicUrl}`);

  } catch (error) {
    console.error(`❌ [${videoId}] Video rendering failed:`, error);
    
    // Update database with error
    await VideoService.updateVideo(videoId, {
      status: 'render_failed',
      error_message: error instanceof Error ? error.message : 'Unknown error during video rendering',
      render_progress: 0
    });

    // Update job lock
    activeRenders.set(videoId, { startedAt: new Date(), status: 'failed' });

  } finally {
    // Clean up temporary files
    if (tempDir) {
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
        console.log(`🧹 [${videoId}] Temporary files cleaned up`);
      } catch (cleanupError) {
        console.warn(`⚠️ [${videoId}] Warning: Failed to clean up temporary files:`, cleanupError);
      }
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { videoId, force = false } = await request.json();

    if (!videoId) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }

    console.log(`🎬 [${videoId}] Render video request received, force: ${force}`);

    // Check if video already has a final video URL
    const video = await VideoService.getById(videoId);
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    if (video.final_video_url && !force) {
      console.log(`✅ [${videoId}] Video already completed, returning existing URL`);
      return NextResponse.json({
        status: 'completed',
        video_url: video.final_video_url
      }, { status: 200 });
    }

    // Check if render is already running
    const activeRender = activeRenders.get(videoId);
    if (activeRender && activeRender.status === 'rendering' && !force) {
      console.log(`⏳ [${videoId}] Render already in progress, returning 202`);
      return NextResponse.json({
        status: 'rendering',
        message: 'Video rendering already in progress'
      }, { status: 202 });
    }

    // Check if assets are ready
    const hasImages = Array.isArray(video.image_urls) && video.image_urls.length > 0;
    const hasAudio = !!video.audio_url;
    const hasCaptions = !!video.captions_url;
    
    if (!hasImages || !hasAudio) {
      return NextResponse.json({
        error: 'Assets not ready',
        details: {
          hasImages,
          hasAudio,
          hasCaptions
        }
      }, { status: 400 });
    }

    // Start background rendering
    console.log(`🚀 [${videoId}] Starting background rendering job...`);
    
    // Set job lock
    activeRenders.set(videoId, { startedAt: new Date(), status: 'rendering' });
    
    // Start background job (don't await)
    renderVideoInBackground(videoId, force).catch(error => {
      console.error(`❌ [${videoId}] Background rendering failed:`, error);
    });

    return NextResponse.json({
      status: 'rendering',
      message: 'Video rendering started in background'
    }, { status: 202 });

  } catch (error) {
    console.error('❌ Render video request failed:', error);
    return NextResponse.json({
      error: 'Failed to start video rendering',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
