#!/usr/bin/env node

/**
 * StoryShort Video Rendering Pipeline
 * 
 * End-to-end video rendering script that processes a single video job from Supabase.
 * 
 * Usage: node render-job.js <videoId>
 * 
 * Features:
 * - Downloads audio, captions, and images from Supabase
 * - Creates temporary working directory
 * - Generates images.txt automatically
 * - Runs FFmpeg with cinematic filters and burned-in subtitles
 * - Uploads final video to Supabase storage
 * - Updates video status in database
 * - Comprehensive error handling and logging
 */

import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '..');

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: path.join(projectRoot, '.env.local') });

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Logging utilities
const log = (msg) => console.log(`\x1b[36m[🎬 RENDER]\x1b[0m ${msg}`);
const success = (msg) => console.log(`\x1b[32m[✅ SUCCESS]\x1b[0m ${msg}`);
const error = (msg) => console.log(`\x1b[31m[❌ ERROR]\x1b[0m ${msg}`);
const warn = (msg) => console.log(`\x1b[33m[⚠️ WARN]\x1b[0m ${msg}`);
const info = (msg) => console.log(`\x1b[34m[ℹ️ INFO]\x1b[0m ${msg}`);

// Utility functions
function sanitizeFileName(filename) {
  return filename
    .replace(/[<>:"|?*]/g, '')
    .replace(/[^\w\-_.]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/\.+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .trim()
    .substring(0, 100);
}

function escapePath(path) {
  let escapedPath = path.replace(/\\/g, '/').replace(/'/g, "\\'");
  if (escapedPath.match(/^[A-Za-z]:/)) {
    escapedPath = escapedPath.replace(/^([A-Za-z]:)/, '$1\\\\');
  }
  return escapedPath;
}

function escapeSubtitlesPathForFFmpeg(p) {
  // Normalize to forward slashes
  let s = p.replace(/\\/g, '/');
  // Escape drive letter colon (C: -> C\:)
  s = s.replace(/^([A-Za-z]):/, '$1\\:');
  // Escape single quotes inside path (rare)
  s = s.replace(/'/g, "\\'");
  return s;
}

function convertVttToSrt(vttContent) {
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

  return srtContent.trim();
}

// Main rendering function
async function renderVideo(videoId) {
  let tempDir = null;
  let videoData = null;

  try {
    log(`Starting rendering pipeline for video: ${videoId}`);

    // Step 1: Fetch video data from Supabase
    log('Fetching video data from Supabase...');
    const { data, error: fetchError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();

    if (fetchError || !data) {
      throw new Error(`Video not found: ${fetchError?.message || 'No data returned'}`);
    }

    videoData = data;
    info(`Video found: ${videoData.input_text?.substring(0, 50)}...`);

    // Check if video has required assets
    if (!videoData.audio_url) {
      throw new Error('Video missing audio URL');
    }

    if (!videoData.storyboard_json?.scenes || videoData.storyboard_json.scenes.length === 0) {
      throw new Error('Video missing storyboard data');
    }

    // Validate storyboard scenes for missing image URLs
    log('Validating storyboard scenes...');
    const scenes = videoData.storyboard_json.scenes;
    const missingImageErrors = [];
    
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const sceneNumber = i + 1;
      
      if (!scene.image_url) {
        const errorMessage = `Missing image_url in scene ${sceneNumber}`;
        missingImageErrors.push(errorMessage);
        error(`Scene ${sceneNumber}: Missing image_url`);
      } else {
        info(`Scene ${sceneNumber}: image_url present`);
      }
    }
    
    if (missingImageErrors.length > 0) {
      error('Storyboard validation failed, updating video status to failed');
      
      // Update video status to failed with specific error message
      try {
        await supabase
          .from('videos')
          .update({ 
            status: 'failed',
            error_message: missingImageErrors[0] // Use first error as primary message
          })
          .eq('id', videoId);
        
        success(`Updated video status to failed: ${missingImageErrors[0]}`);
      } catch (updateError) {
        error(`Failed to update video status: ${updateError.message}`);
      }
      
      throw new Error(`Storyboard validation failed: ${missingImageErrors.join(', ')}`);
    }
    
    success(`All ${scenes.length} storyboard scenes validated successfully`);

    // Step 2: Update status to rendering
    log('Updating video status to rendering...');
    await supabase
      .from('videos')
      .update({ 
        status: 'rendering',
        error_message: null 
      })
      .eq('id', videoId);

    // Step 3: Create temporary working directory
    log('Creating temporary working directory...');
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), `video-render-${videoId}-`));
    info(`Temporary directory: ${tempDir}`);

    // Create subdirectories
    const audioDir = path.join(tempDir, 'audio');
    const captionsDir = path.join(tempDir, 'captions');
    const imagesDir = path.join(tempDir, 'images');
    
    await fs.promises.mkdir(audioDir, { recursive: true });
    await fs.promises.mkdir(captionsDir, { recursive: true });
    await fs.promises.mkdir(imagesDir, { recursive: true });

    // Step 4: Download audio file
    log('Downloading audio file...');
    const audioResponse = await fetch(videoData.audio_url);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.statusText}`);
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const audioPath = path.join(audioDir, 'audio.mp3');
    await fs.promises.writeFile(audioPath, Buffer.from(audioBuffer));
    
    const audioStats = fs.statSync(audioPath);
    if (audioStats.size === 0) {
      throw new Error('Downloaded audio file is empty');
    }
    success(`Audio downloaded: ${Math.round(audioStats.size / 1024)} KB`);

    // Step 5: Download and process captions
    let captionsPath = null;
    if (videoData.captions_url) {
      log('Downloading captions file...');
      try {
        const captionsResponse = await fetch(videoData.captions_url);
        if (captionsResponse.ok) {
          const captionsText = await captionsResponse.text();
          
          if (captionsText.trim()) {
            // Convert VTT to SRT if needed
            const srtContent = captionsText.includes('WEBVTT') 
              ? convertVttToSrt(captionsText)
              : captionsText;
            
            captionsPath = path.join(captionsDir, 'subtitles.srt');
            await fs.promises.writeFile(captionsPath, srtContent);
            
            const captionsStats = fs.statSync(captionsPath);
            success(`Captions downloaded: ${Math.round(captionsStats.size / 1024)} KB`);
          } else {
            warn('Captions file is empty, proceeding without subtitles');
          }
        } else {
          warn(`Failed to download captions: ${captionsResponse.statusText}`);
        }
      } catch (captionsError) {
        warn(`Error downloading captions: ${captionsError.message}`);
      }
    } else {
      info('No captions URL provided, proceeding without subtitles');
    }

    // Step 6: Download images from storyboard
    log('Downloading images from storyboard...');
    const imagePaths = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const imageUrl = scene.image_url;
      
      if (!imageUrl) {
        throw new Error(`Scene ${i + 1} missing image URL`);
      }

      try {
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          throw new Error(`Failed to download image ${i + 1}: ${imageResponse.statusText}`);
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        const imageFilename = sanitizeFileName(`scene_${i + 1}.png`);
        const imagePath = path.join(imagesDir, imageFilename);
        
        await fs.promises.writeFile(imagePath, Buffer.from(imageBuffer));
        
        const imageStats = fs.statSync(imagePath);
        if (imageStats.size === 0) {
          throw new Error(`Downloaded image ${i + 1} is empty`);
        }
        
        imagePaths.push(imagePath);
        info(`Image ${i + 1} downloaded: ${Math.round(imageStats.size / 1024)} KB`);
      } catch (imageError) {
        throw new Error(`Failed to download image ${i + 1}: ${imageError.message}`);
      }
    }

    success(`All ${imagePaths.length} images downloaded successfully`);

    // Step 7: Generate images.txt file
    log('Generating images.txt file...');
    const imageListPath = path.join(tempDir, 'images.txt');
    
    const imageListContent = imagePaths.map((imgPath, index) => {
      const duration = scenes[index]?.duration || 3;
      const normalizedPath = escapePath(imgPath);
      return `file '${normalizedPath}'\nduration ${duration}`;
    }).join('\n');

    await fs.promises.writeFile(imageListPath, imageListContent);
    success('Images.txt file generated');

    // Step 8: Build FFmpeg command with cinematic effects
    log('Building FFmpeg command...');
    const outputPath = path.join(tempDir, 'final_video.mp4');
    
    // Verify FFmpeg is available
    try {
      await execAsync('ffmpeg -version', { timeout: 10000 });
    } catch (ffmpegError) {
      throw new Error('FFmpeg is not installed or not in PATH. Please install FFmpeg and ensure it is accessible.');
    }

    // Normalize paths for FFmpeg
    const normalizedImageListPath = escapePath(imageListPath);
    const normalizedAudioPath = escapePath(audioPath);
    const normalizedOutputPath = escapePath(outputPath);

    // Build video filters with cinematic effects
    let videoFilters = 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black';
    
    // Add simple zoompan effect (simplified to avoid syntax errors)
    videoFilters += ',zoompan=z=\'min(zoom+0.0015,1.2)\':d=125:x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\':s=1080x1920';
    
    // Add color grading and effects
    videoFilters += ',eq=contrast=1.08:saturation=1.03:brightness=0.01';
    videoFilters += ',vignette=PI/4';

    // Add subtitle burning if captions are available
    let addSubs = false;
    if (captionsPath && fs.existsSync(captionsPath)) {
      const size = fs.statSync(captionsPath).size;
      if (size >= 8) addSubs = true; // tiny/empty files are ignored
    }

    // Append subtitles safely using filename= and escaped colon
    if (addSubs) {
      const subPath = escapeSubtitlesPathForFFmpeg(captionsPath);
      // Updated subtitle styling: smaller font, transparent background, alternating positions
      videoFilters += `,subtitles=filename='${subPath}':charenc=UTF-8:force_style='FontSize=20,PrimaryColour=&Hffffff,OutlineColour=&H000000,BackColour=&H00000000,Outline=1,Shadow=0,BorderStyle=1,MarginV=50'`;
      info('Subtitles will be burned into video with new styling');
    } else {
      info('No usable subtitles file (missing or empty) — skipping burn-in');
    }

    // Build complete FFmpeg command
    let ffmpegCommand = `ffmpeg -y -f concat -safe 0 -i "${normalizedImageListPath}" -i "${normalizedAudioPath}"`;
    ffmpegCommand += ` -vf "${videoFilters}"`;
    ffmpegCommand += ` -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -shortest -movflags +faststart "${normalizedOutputPath}"`;

    info('FFmpeg command built successfully');

    // Step 9: Execute FFmpeg
    log('Executing FFmpeg rendering...');
    const { stdout, stderr } = await execAsync(ffmpegCommand, { 
      timeout: 300000, // 5 minute timeout
      shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
      windowsHide: true
    });

    // Check for FFmpeg errors
    if (stderr) {
      const errorIndicators = [
        'Error:', 'error:', 'Invalid', 'invalid', 'Failed', 'failed',
        'No such file', 'Permission denied', 'Cannot', 'cannot',
        'Unable', 'unable', 'Missing', 'missing', 'Corrupt', 'corrupt'
      ];
      
      const hasError = errorIndicators.some(indicator => stderr.includes(indicator));
      
      if (hasError) {
        throw new Error(`FFmpeg execution failed: ${stderr}`);
      }
    }

    success('FFmpeg rendering completed');

    // Step 10: Verify output file
    if (!fs.existsSync(outputPath)) {
      throw new Error('FFmpeg did not create output file');
    }
    
    const outputFileSize = fs.statSync(outputPath).size;
    if (outputFileSize === 0) {
      throw new Error('FFmpeg created empty output file');
    }
    
    success(`Video file created: ${Math.round(outputFileSize / 1024 / 1024)} MB`);

    // Step 11: Get video duration
    const { stdout: durationOutput } = await execAsync(
      `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${normalizedOutputPath}"`,
      { 
        timeout: 30000,
        shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
        windowsHide: true
      }
    );
    const duration = parseFloat(durationOutput.trim()) || 0;
    info(`Video duration: ${duration} seconds`);

    // Step 12: Upload to Supabase Storage
    log('Uploading video to Supabase Storage...');
    const videoBuffer = await fs.promises.readFile(outputPath);
    const uploadPath = `finals/${videoId}.mp4`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('videos')
      .upload(uploadPath, videoBuffer, {
        contentType: 'video/mp4',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Failed to upload video to Supabase: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('videos')
      .getPublicUrl(uploadPath);
    
    const publicUrl = urlData.publicUrl;
    success('Video uploaded to Supabase Storage');

    // Step 13: Update video record
    log('Updating video record...');
    const { error: updateError } = await supabase
      .from('videos')
      .update({
        status: 'completed',
        final_video_url: publicUrl,
        total_duration: Math.round(duration)
      })
      .eq('id', videoId);

    if (updateError) {
      throw new Error(`Failed to update video record: ${updateError.message}`);
    }

    success('Video rendering pipeline completed successfully!');
    
    // Return success data
    return {
      success: true,
      videoId,
      finalVideoUrl: publicUrl,
      duration: Math.round(duration),
      scenes: scenes.length,
      fileSize: Math.round(videoBuffer.length / 1024 / 1024),
      supabasePath: uploadPath
    };

  } catch (renderError) {
    error(`Rendering failed: ${renderError.message}`);
    
    // Update video status to failed
    if (videoId) {
      try {
        await supabase
          .from('videos')
          .update({
            status: 'failed',
            error_message: renderError.message
          })
          .eq('id', videoId);
        warn('Video status updated to failed');
      } catch (updateError) {
        error(`Failed to update video status: ${updateError.message}`);
      }
    }

    throw renderError;

  } finally {
    // Clean up temporary files
    if (tempDir) {
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
        info('Temporary files cleaned up');
      } catch (cleanupError) {
        warn(`Failed to clean up temporary files: ${cleanupError.message}`);
      }
    }
  }
}

// Main execution
async function main() {
  const videoId = process.argv[2];

  if (!videoId) {
    error('Usage: node render-job.js <videoId>');
    error('Example: node render-job.js 123e4567-e89b-12d3-a456-426614174000');
    process.exit(1);
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(videoId)) {
    error('Invalid video ID format. Expected UUID format.');
    process.exit(1);
  }

  try {
    log(`Starting rendering job for video: ${videoId}`);
    
    const result = await renderVideo(videoId);
    
    console.log('\n🎉 RENDERING COMPLETED SUCCESSFULLY! 🎉');
    console.log('='.repeat(50));
    console.log(`Video ID: ${result.videoId}`);
    console.log(`Final URL: ${result.finalVideoUrl}`);
    console.log(`Duration: ${result.duration} seconds`);
    console.log(`Scenes: ${result.scenes}`);
    console.log(`File Size: ${result.fileSize} MB`);
    console.log(`Supabase Path: ${result.supabasePath}`);
    console.log('='.repeat(50));
    
    process.exit(0);
    
  } catch (mainError) {
    console.log('\n💥 RENDERING FAILED! 💥');
    console.log('='.repeat(50));
    console.log(`Error: ${mainError.message}`);
    console.log('='.repeat(50));
    
    process.exit(1);
  }
}

// Run the script
main().catch((unhandledError) => {
  error(`Unhandled error: ${unhandledError.message}`);
  process.exit(1);
}); 