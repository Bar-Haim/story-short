import { NextRequest, NextResponse } from 'next/server';
import { VideoService, StorageService } from '@/lib/supabase';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { videoId } = await request.json();

    if (!videoId) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }

    // Get video data from database
    const videoResult = await VideoService.getVideo(videoId);
    if (!videoResult.success || !videoResult.video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const video = videoResult.video;
    const scenes = video.storyboard_json?.scenes || [];
    const imageUrls = video.image_urls || [];
    const audioUrl = video.audio_url;
    const captionsUrl = video.captions_url;

    if (!audioUrl || imageUrls.length === 0) {
      return NextResponse.json({ error: 'Missing required assets (audio or images)' }, { status: 400 });
    }

    console.log('🎬 Starting video rendering with FFmpeg...');
    console.log(`📊 Scenes: ${scenes.length}, Images: ${imageUrls.length}`);

    // Create temporary directory
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'video-render-'));
    console.log('📁 Temporary directory:', tempDir);

    try {
      // Download audio file
      const audioResponse = await fetch(audioUrl);
      const audioBuffer = await audioResponse.arrayBuffer();
      const audioPath = path.join(tempDir, 'audio.mp3');
      await fs.promises.writeFile(audioPath, Buffer.from(audioBuffer));
      console.log('✅ Audio downloaded');

      // Download images
      const imagePaths: string[] = [];
      for (let i = 0; i < imageUrls.length; i++) {
        const imageResponse = await fetch(imageUrls[i]);
        const imageBuffer = await imageResponse.arrayBuffer();
        const imagePath = path.join(tempDir, `scene_${i + 1}.png`);
        await fs.promises.writeFile(imagePath, Buffer.from(imageBuffer));
        imagePaths.push(imagePath);
        console.log(`✅ Image ${i + 1} downloaded`);
      }

      // Download captions if available
      let captionsPath: string | null = null;
      if (captionsUrl) {
        const captionsResponse = await fetch(captionsUrl);
        const captionsText = await captionsResponse.text();
        captionsPath = path.join(tempDir, 'captions.vtt');
        await fs.promises.writeFile(captionsPath, captionsText);
        console.log('✅ Captions downloaded');
      }

      // Create image list file for FFmpeg
      const imageListPath = path.join(tempDir, 'images.txt');
      const imageListContent = imagePaths.map((imgPath, index) => {
        const duration = scenes[index]?.duration || 3;
        return `file '${imgPath}'\nduration ${duration}`;
      }).join('\n');
      await fs.promises.writeFile(imageListPath, imageListContent);
      console.log('✅ Image list created');

      // Build FFmpeg command
      const outputPath = path.join(tempDir, 'final_video.mp4');
      let ffmpegCommand = `ffmpeg -y -f concat -safe 0 -i "${imageListPath}" -i "${audioPath}"`;

      // Add subtitle burning if captions are available
      if (captionsPath) {
        ffmpegCommand += ` -vf "subtitles='${captionsPath}':force_style='FontSize=24,PrimaryColour=&Hffffff,OutlineColour=&H000000,BackColour=&H80000000,Bold=1,Shadow=1'"`;
      }

      ffmpegCommand += ` -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -shortest "${outputPath}"`;

      console.log('🎬 Running FFmpeg command:', ffmpegCommand);

      // Execute FFmpeg
      const { stdout, stderr } = await execAsync(ffmpegCommand);
      console.log('FFmpeg stdout:', stdout);
      if (stderr) console.log('FFmpeg stderr:', stderr);

      // Check if output file exists
      if (!fs.existsSync(outputPath)) {
        throw new Error('FFmpeg did not create output file');
      }

      // Upload final video to Supabase
      const videoBuffer = await fs.promises.readFile(outputPath);
      const videoUploadPath = `renders/${videoId}/final_video.mp4`;
      
      const uploadResult = await StorageService.uploadFile(
        videoUploadPath,
        Buffer.from(videoBuffer),
        'video/mp4'
      );

      if (!uploadResult.success) {
        throw new Error(`Failed to upload video: ${uploadResult.error}`);
      }

      // Update video record with final video URL
      const updateResult = await VideoService.updateVideo(videoId, {
        status: 'completed',
        final_video_url: uploadResult.url
      });

      if (!updateResult.success) {
        throw new Error('Failed to update video record');
      }

      console.log('✅ Video rendering completed successfully');

      return NextResponse.json({
        success: true,
        message: 'Video rendered successfully',
        data: {
          videoId,
          finalVideoUrl: uploadResult.url,
          duration: video.total_duration,
          scenes: scenes.length
        }
      });

    } finally {
      // Clean up temporary files
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
        console.log('🧹 Temporary files cleaned up');
      } catch (cleanupError) {
        console.warn('Warning: Failed to clean up temporary files:', cleanupError);
      }
    }

  } catch (error) {
    console.error('❌ Video rendering failed:', error);
    
    // Update video status to failed
    if (videoId) {
      await VideoService.updateVideo(videoId, {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error during video rendering'
      });
    }

    return NextResponse.json({
      error: true,
      message: 'Failed to render video',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 