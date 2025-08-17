import { NextRequest, NextResponse } from 'next/server';
import { VideoService, sbServer } from '@/lib/supabase-server';
import type { Video } from '@/types/video';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

// Job locking mechanism to prevent duplicate renders
const activeRenders = new Map<string, { startedAt: Date; status: 'rendering' | 'completed' | 'failed' }>();

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

    // Step 5: Execute FFmpeg
    console.log(`🎬 [${videoId}] Starting FFmpeg rendering...`);
    const outputPath = path.join(tempDir, 'final_video.mp4');
    
    // Build FFmpeg command
    let ffmpegCommand = `ffmpeg -y -f concat -safe 0 -i "${imageListPath}" -i "${audioPath}"`;
    
    // Add video filters for 1080x1920 vertical video
    let videoFilters = 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black';
    
    // Add motion effects
    videoFilters += ',zoompan=z=\'min(zoom+0.0015,1.2)\':d=125:x=\'iw/2-(iw/zoom/2)+sin(t*0.3)*12\':y=\'ih/2-(ih/zoom/2)+cos(t*0.2)*10\':s=1080x1920';
    
    // Add captions if available
    if (captionsPath) {
      videoFilters += `,subtitles="${captionsPath.replace(/\\/g, '/')}":force_style='FontSize=20,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,BorderStyle=1,Outline=1'`;
    }
    
    ffmpegCommand += ` -vf "${videoFilters}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -shortest -movflags +faststart "${outputPath}"`;

    console.log(`🚀 [${videoId}] Executing FFmpeg...`);
    await execAsync(ffmpegCommand, { 
      timeout: 600000, // 10 minute timeout
      shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash'
    });

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

    // Step 7: Upload to Supabase
    console.log(`☁️ [${videoId}] Uploading to Supabase...`);
    const videoBuffer = await fs.promises.readFile(outputPath);
    const supabase = sbServer();
    
    const uploadPath = `renders-videos/videos/${videoId}/final.mp4`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('videos')
      .upload(uploadPath, videoBuffer, {
        contentType: 'video/mp4',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Failed to upload video: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('videos')
      .getPublicUrl(uploadPath);
    
    const publicUrl = urlData.publicUrl;

    // Step 8: Wait for object availability
    console.log(`⏳ [${videoId}] Waiting for object availability...`);
    let isAvailable = false;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max
    
    while (!isAvailable && attempts < maxAttempts) {
      try {
        const headResponse = await fetch(publicUrl, { method: 'HEAD' });
        if (headResponse.ok) {
          isAvailable = true;
          console.log(`✅ [${videoId}] Video is now available`);
        }
      } catch (error) {
        // Continue waiting
      }
      
      if (!isAvailable) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      }
    }

    if (!isAvailable) {
      throw new Error('Video upload completed but object is not yet available');
    }

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
