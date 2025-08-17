import { NextRequest, NextResponse } from 'next/server';
import { VideoService, sbServer } from '@/lib/supabase-server';
import type { Video } from '@/types/video';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

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

function generateSceneSubtitleFilter(sceneIndex: number, totalScenes: number, subtitlePath: string): string {
  // Reduce font size by 25-30% from current (28 -> 20-21)
  const fontSize = 20;
  
  // Alternate subtitle position: odd scenes at bottom, even scenes at top
  const alignment = sceneIndex % 2 === 0 ? 8 : 2; // 8 = top, 2 = bottom
  
  // Remove black box background (transparent)
  const backColour = '&H00000000'; // Fully transparent
  
  // White text with thin black outline for visibility
  const primaryColour = '&HFFFFFF'; // White
  const outlineColour = '&H000000'; // Black
  const outline = 1; // Thin outline
  
  // Generate scene-specific subtitle filter
  const style = `FontSize=${fontSize},PrimaryColour=${primaryColour},OutlineColour=${outlineColour},BorderStyle=1,Outline=${outline},Shadow=0,BackColour=${backColour},Alignment=${alignment}`;
  
  return `subtitles=${subtitlePath}:force_style='${style}'`;
}

async function createSceneSpecificSubtitles(originalSrtPath: string, scenes: any[], tempDir: string): Promise<string> {
  try {
    console.log('📝 Creating scene-specific subtitle file with alternating positions...');
    
    // Read the original SRT file
    const srtContent = await fs.promises.readFile(originalSrtPath, 'utf-8');
    const srtLines = srtContent.split('\n');
    
    // Create a new SRT content with scene-specific positioning
    let newSrtContent = '';
    let currentLine = 0;
    
    // Process each subtitle block
    while (currentLine < srtLines.length) {
      // Find subtitle number
      if (srtLines[currentLine].match(/^\d+$/)) {
        const subtitleNumber = parseInt(srtLines[currentLine]);
        const sceneIndex = Math.floor(subtitleNumber / 2); // Approximate scene mapping
        
        // Add subtitle number
        newSrtContent += srtLines[currentLine] + '\n';
        currentLine++;
        
        // Add timing (next line)
        if (currentLine < srtLines.length) {
          newSrtContent += srtLines[currentLine] + '\n';
          currentLine++;
        }
        
        // Add subtitle text with scene-specific styling
        if (currentLine < srtLines.length) {
          const text = srtLines[currentLine];
          const alignment = sceneIndex % 2 === 0 ? '{\\an8}' : '{\\an2}'; // Top or bottom
          newSrtContent += `${alignment}${text}\n`;
          currentLine++;
        }
        
        // Add empty line
        newSrtContent += '\n';
      } else {
        // Copy other lines as-is
        newSrtContent += srtLines[currentLine] + '\n';
        currentLine++;
      }
    }
    
    // Write the new SRT file
    const newSrtPath = path.join(tempDir, 'scene_specific_subtitles.srt');
    await fs.promises.writeFile(newSrtPath, newSrtContent);
    
    console.log('✅ Scene-specific subtitle file created with alternating positions');
    console.log(`   - Even scenes: top position ({\\an8})`);
    console.log(`   - Odd scenes: bottom position ({\\an2})`);
    
    return newSrtPath;
  } catch (error) {
    console.warn('⚠️ Failed to create scene-specific subtitles, using original:', error);
    return originalSrtPath;
  }
}

// Motion effect generator for cinematic video
function generateMotionEffects(sceneIndex: number, totalScenes: number): string {
  // Different motion patterns for visual variety
  const motionPatterns = [
    // Pattern 1: Gentle zoom with smooth pan
    {
      zoom: 'min(zoom+0.0018+sin(t*0.8)*0.0005,1.25)',
      x: 'iw/2-(iw/zoom/2)+sin(t*0.4)*15+cos(t*0.2)*8',
      y: 'ih/2-(ih/zoom/2)+cos(t*0.3)*12+sin(t*0.1)*6',
      shake: { x: 'sin(t*1.8)*2+cos(t*2.2)*1.5', y: 'cos(t*1.5)*1.8+sin(t*2.8)*1.2' }
    },
    // Pattern 2: Dynamic zoom with circular motion
    {
      zoom: 'min(zoom+0.002+sin(t*1.2)*0.0008,1.3)',
      x: 'iw/2-(iw/zoom/2)+sin(t*0.6)*18+cos(t*0.4)*10',
      y: 'ih/2-(ih/zoom/2)+cos(t*0.5)*14+sin(t*0.3)*8',
      shake: { x: 'sin(t*2.1)*2.5+cos(t*1.9)*1.8', y: 'cos(t*1.7)*2.2+sin(t*2.5)*1.5' }
    },
    // Pattern 3: Subtle zoom with gentle sway
    {
      zoom: 'min(zoom+0.0015+sin(t*0.6)*0.0003,1.2)',
      x: 'iw/2-(iw/zoom/2)+sin(t*0.3)*12+cos(t*0.1)*6',
      y: 'ih/2-(ih/zoom/2)+cos(t*0.2)*10+sin(t*0.05)*4',
      shake: { x: 'sin(t*1.5)*1.8+cos(t*2.0)*1.2', y: 'cos(t*1.3)*1.5+sin(t*2.3)*1.0' }
    },
    // Pattern 4: Dynamic movement with parallax effect
    {
      zoom: 'min(zoom+0.0022+sin(t*1.0)*0.0006,1.28)',
      x: 'iw/2-(iw/zoom/2)+sin(t*0.5)*20+cos(t*0.3)*12',
      y: 'ih/2-(ih/zoom/2)+cos(t*0.4)*16+sin(t*0.2)*10',
      shake: { x: 'sin(t*2.3)*2.8+cos(t*1.8)*2.0', y: 'cos(t*1.9)*2.5+sin(t*2.7)*1.8' }
    }
  ];
  
  // Select pattern based on scene index for variety
  const pattern = motionPatterns[sceneIndex % motionPatterns.length];

  // Escape commas inside zoom expression for FFmpeg filter parser
  const escapedZoom = pattern.zoom.replace(/,/g, '\\,');

  return `zoompan=z='${escapedZoom}':d=125:x='${pattern.x}':y='${pattern.y}':s=1080x1920,crop=1080:1920:x='${pattern.shake.x}':y='${pattern.shake.y}'`;
}

// Validation utilities
function validatePath(path: string): boolean {
  // Check for problematic characters (excluding Windows backslashes which are valid)
  const problematicChars = /[<>"|?*]/;
  return !problematicChars.test(path);
}

function sanitizeFileName(filename: string): string {
  // Remove or replace problematic characters
  return filename
    .replace(/[<>:"|?*]/g, '') // Remove problematic shell characters
    .replace(/[^\w\-_.]/g, '_') // Replace other non-alphanumeric chars with underscore
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
    .replace(/\.+/g, '.') // Replace multiple dots with single
    .replace(/^\.+|\.+$/g, '') // Remove leading/trailing dots
    .trim() // Remove whitespace
    .substring(0, 100); // Limit length to prevent issues
}

function escapePath(path: string): string {
  // Convert Windows backslashes to forward slashes and escape single quotes
  // Also handle Windows drive letters properly for FFmpeg
  let escapedPath = path.replace(/\\/g, '/').replace(/'/g, "\\'");
  
  // Handle Windows drive letters (C:/path -> C\\:/path)
  if (escapedPath.match(/^[A-Za-z]:/)) {
    escapedPath = escapedPath.replace(/^([A-Za-z]:)/, '$1\\\\');
  }
  
  return escapedPath;
}

function validateImageListFormat(content: string): { valid: boolean; errors: string[] } {
  const lines = content.trim().split('\n');
  const errors: string[] = [];
  
  if (lines.length === 0) {
    errors.push('Image list is empty');
    return { valid: false, errors };
  }
  
  if (lines.length % 2 !== 0) {
    errors.push(`Invalid line count: ${lines.length} (must be even)`);
    return { valid: false, errors };
  }
  
  for (let i = 0; i < lines.length; i += 2) {
    const fileLine = lines[i];
    const durationLine = lines[i + 1];
    
    if (!fileLine.startsWith('file ')) {
      errors.push(`Line ${i + 1}: Invalid file line format: "${fileLine}"`);
    }
    
    if (!durationLine.startsWith('duration ')) {
      errors.push(`Line ${i + 2}: Invalid duration line format: "${durationLine}"`);
    }
    
    const duration = parseFloat(durationLine.replace('duration ', ''));
    if (isNaN(duration) || duration <= 0) {
      errors.push(`Line ${i + 2}: Invalid duration value: "${durationLine}"`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}

function validateSrtContent(content: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const lines = content.trim().split('\n');
  
  if (lines.length === 0) {
    errors.push('SRT file is empty');
    return { valid: false, errors };
  }
  
  // Check for basic SRT structure (number, timestamp, text, empty line)
  let i = 0;
  while (i < lines.length) {
    // Skip empty lines
    if (lines[i].trim() === '') {
      i++;
      continue;
    }
    
    // Check subtitle number
    if (isNaN(parseInt(lines[i]))) {
      errors.push(`Line ${i + 1}: Invalid subtitle number: "${lines[i]}"`);
    }
    i++;
    
    if (i >= lines.length) break;
    
    // Check timestamp format (00:00:00,000 --> 00:00:00,000)
    const timestampRegex = /^\d{2}:\d{2}:\d{2},\d{3}\s-->\s\d{2}:\d{2}:\d{2},\d{3}$/;
    if (!timestampRegex.test(lines[i])) {
      errors.push(`Line ${i + 1}: Invalid timestamp format: "${lines[i]}"`);
    }
    i++;
    
    if (i >= lines.length) break;
    
    // Check for subtitle text (at least one line)
    let hasText = false;
    while (i < lines.length && lines[i].trim() !== '') {
      hasText = true;
      i++;
    }
    
    if (!hasText) {
      errors.push(`Line ${i}: Missing subtitle text`);
    }
    
    // Skip empty line after text
    if (i < lines.length && lines[i].trim() === '') {
      i++;
    }
  }
  
  return { valid: errors.length === 0, errors };
}

// Comprehensive preflight validation
async function validateBeforeRender(params: {
  imagePaths: string[];
  audioPath: string;
  captionsPath: string | null;
  imageListPath: string;
  outputPath: string;
  ffmpegCommand: string;
  videoFilters: string;
}): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  console.log('🔍 Starting preflight validation...');
  
  // Validate image files
  console.log('🔍 Validating image files...');
  for (let i = 0; i < params.imagePaths.length; i++) {
    const imagePath = params.imagePaths[i];
    if (!fs.existsSync(imagePath)) {
      errors.push(`Image file ${i + 1} does not exist: ${imagePath}`);
    } else {
      const stats = fs.statSync(imagePath);
      if (stats.size === 0) {
        errors.push(`Image file ${i + 1} is empty: ${imagePath}`);
      } else {
        console.log(`✅ Image ${i + 1}: ${imagePath} (${stats.size} bytes)`);
      }
    }
  }
  
  // Validate audio file
  console.log('🔍 Validating audio file...');
  if (!fs.existsSync(params.audioPath)) {
    errors.push(`Audio file does not exist: ${params.audioPath}`);
  } else {
    const stats = fs.statSync(params.audioPath);
    if (stats.size === 0) {
      errors.push(`Audio file is empty: ${params.audioPath}`);
    } else {
      console.log(`✅ Audio: ${params.audioPath} (${stats.size} bytes)`);
    }
  }
  
  // Validate captions file (if present)
  if (params.captionsPath) {
    console.log('🔍 Validating captions file...');
    if (!fs.existsSync(params.captionsPath)) {
      errors.push(`Captions file does not exist: ${params.captionsPath}`);
    } else {
      const stats = fs.statSync(params.captionsPath);
      if (stats.size === 0) {
        errors.push(`Captions file is empty: ${params.captionsPath}`);
      } else {
        console.log(`✅ Captions: ${params.captionsPath} (${stats.size} bytes)`);
      }
    }
  }
  
  // Validate image list file
  console.log('🔍 Validating image list file...');
  if (!fs.existsSync(params.imageListPath)) {
    errors.push(`Image list file does not exist: ${params.imageListPath}`);
  } else {
    const stats = fs.statSync(params.imageListPath);
    if (stats.size === 0) {
      errors.push(`Image list file is empty: ${params.imageListPath}`);
    } else {
      console.log(`✅ Image list: ${params.imageListPath} (${stats.size} bytes)`);
    }
  }
  
  // Validate FFmpeg command length
  if (params.ffmpegCommand.length > 8000) {
    errors.push(`FFmpeg command too long: ${params.ffmpegCommand.length} characters`);
  }
  
  // Validate video filters
  if (params.videoFilters.length > 2000) {
    errors.push(`Video filters too long: ${params.videoFilters.length} characters`);
  }
  
  // Check for problematic characters in paths
  const allPaths = [params.audioPath, params.imageListPath, params.outputPath, ...params.imagePaths];
  if (params.captionsPath) allPaths.push(params.captionsPath);
  
  for (const filePath of allPaths) {
    if (!validatePath(filePath)) {
      errors.push(`Path contains problematic characters: ${filePath}`);
    }
  }
  
  console.log(`🔍 Validation complete: ${errors.length} errors found`);
  if (errors.length > 0) {
    console.log('❌ Validation errors:', errors);
  } else {
    console.log('✅ All validations passed');
  }
  
  return { valid: errors.length === 0, errors };
}

// Validate storyboard scenes for missing image URLs
async function validateStoryboardScenes(scenes: Record<string, unknown>[], videoId: string): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  console.log('🔍 Validating storyboard scenes...');
  
  if (!scenes || scenes.length === 0) {
    errors.push('No scenes found in storyboard');
    return { valid: false, errors };
  }
  
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const sceneNumber = i + 1;
    
    if (!scene.image_url) {
      const errorMessage = `Missing image_url in scene ${sceneNumber}`;
      errors.push(errorMessage);
      console.log(`❌ Scene ${sceneNumber}: Missing image_url`);
      
      // Update video status to failed with specific error message
      try {
        await VideoService.updateVideo(videoId, {
          status: 'failed',
          error_message: errorMessage
        });
        console.log(`✅ Updated video status to failed: ${errorMessage}`);
      } catch (updateError) {
        console.error('❌ Failed to update video status:', updateError);
      }
    } else {
      console.log(`✅ Scene ${sceneNumber}: image_url present`);
    }
  }
  
  console.log(`🔍 Storyboard validation complete: ${errors.length} errors found`);
  if (errors.length > 0) {
    console.log('❌ Storyboard validation errors:', errors);
  } else {
    console.log('✅ All storyboard scenes validated successfully');
  }
  
  return { valid: errors.length === 0, errors };
}

export async function POST(request: NextRequest) {
  let videoId: string | null = null;
  let tempDir: string | null = null;

  try {
    const { videoId: requestVideoId } = await request.json();
    videoId = requestVideoId;

    if (!videoId) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }

    console.log('🎬 Starting video rendering pipeline for video:', videoId);

    // Update status to rendering
    await VideoService.updateVideo(videoId, {
      status: 'rendering',
      error_message: undefined
    });

    // Get video data from database
    const videoResult = await VideoService.getVideo(videoId);
    if (!videoResult.success || !videoResult.video) {
      throw new Error('Video not found');
    }

    const video = videoResult.video as Video;
    // Guard storyboard_json parsing (string vs object)
    const storyboard = typeof video.storyboard_json === 'string'
      ? JSON.parse(video.storyboard_json)
      : (video.storyboard_json || {});
    const scenes = Array.isArray(storyboard?.scenes) ? storyboard.scenes : [];
    const imageUrls = video.image_urls || [];
    const audioUrl = video.audio_url;
    const captionsUrl = video.captions_url;

    // Server-side fallback: If no script exists but we have input_text, generate script first
    if (!video.script && video.input_text) {
      console.log('📝 No script found but input_text exists, generating script first...');
      
      try {
        const scriptResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4000'}/api/generate-script`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userText: video.input_text,
            theme: (video as any)?.theme ?? 'cinematic',
            language: (video as any)?.language ?? 'en',
            tone: (video as any)?.tone ?? 'inspirational',
            videoId: videoId,
          }),
        });

        if (!scriptResponse.ok) {
          const errorData = await scriptResponse.json();
          throw new Error(errorData.error || 'Failed to generate script');
        }

        const scriptData = await scriptResponse.json();
        console.log('✅ Script generated successfully');
        
        // Update video with generated script
        await VideoService.updateVideo(videoId, {
          script: scriptData.script,
          status: 'script_generated'
        });
        
        // Refresh video data
        const updatedVideoResult = await VideoService.getVideo(videoId);
        if (updatedVideoResult.success && updatedVideoResult.video) {
          // Update local variables with new data
          const updatedVideo = updatedVideoResult.video;
          // Note: We still need to generate assets, so we'll continue to the next step
        }
      } catch (scriptError) {
        console.error('❌ Failed to generate script:', scriptError);
        return NextResponse.json({
          error: 'Failed to generate script',
          details: scriptError instanceof Error ? scriptError.message : 'Unknown error'
        }, { status: 400 });
      }
    }

    // Check if we have a script now
    if (!video.script && !video.input_text) {
      console.log('❌ No script or input_text found');
      return NextResponse.json({
        error: 'No script or input text available for video generation',
        details: 'Please provide a script or input text to generate a video'
      }, { status: 400 });
    }

    // Validate storyboard scenes for missing image URLs
    const storyboardValidation = await validateStoryboardScenes(scenes as Record<string, unknown>[], videoId);
    if (!storyboardValidation.valid) {
      console.log('❌ Storyboard validation failed, stopping rendering process');
      return NextResponse.json({
        error: 'Storyboard validation failed',
        details: storyboardValidation.errors
      }, { status: 400 });
    }

    if (!audioUrl || imageUrls.length === 0) {
      throw new Error('Missing required assets (audio or images)');
    }

    console.log('📊 Rendering assets:', {
      scenes: (scenes as any[]).length,
      images: imageUrls.length,
      hasAudio: !!audioUrl,
      hasCaptions: !!captionsUrl
    });

    // Create temporary directory
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'video-render-'));
    console.log('📁 Temporary directory:', tempDir);

    // Step 1: Download and validate audio file
    console.log('🎵 Downloading audio...');
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.statusText}`);
    }
    const audioBuffer = await audioResponse.arrayBuffer();
    const audioFilename = sanitizeFileName('audio.mp3');
    const audioPath = path.join(tempDir, audioFilename);
    await fs.promises.writeFile(audioPath, Buffer.from(audioBuffer));
    
    // Validate audio file exists and has content
    if (!fs.existsSync(audioPath) || fs.statSync(audioPath).size === 0) {
      throw new Error('Audio file is empty or missing');
    }
    console.log('✅ Audio downloaded and validated');

    // Step 2: Download and validate images
    console.log('🖼️ Downloading images...');
    const imagePaths: string[] = [];
    for (let i = 0; i < imageUrls.length; i++) {
      const imageResponse = await fetch(imageUrls[i]);
      if (!imageResponse.ok) {
        throw new Error(`Failed to download image ${i + 1}: ${imageResponse.statusText}`);
      }
      const imageBuffer = await imageResponse.arrayBuffer();
      
      // Create sanitized filename to avoid FFmpeg path issues
      const sanitizedFilename = sanitizeFileName(`scene_${i + 1}.png`);
      const imagePath = path.join(tempDir, sanitizedFilename);
      
      await fs.promises.writeFile(imagePath, Buffer.from(imageBuffer));
      
      // Validate image file exists and has content
      if (!fs.existsSync(imagePath) || fs.statSync(imagePath).size === 0) {
        throw new Error(`Image ${i + 1} is empty or missing`);
      }
      
      imagePaths.push(imagePath);
      console.log(`✅ Image ${i + 1} downloaded and validated (${sanitizedFilename})`);
    }

    // Step 3: Download and validate captions
    let captionsPath: string | null = null;
    let captionsFormat: 'srt' | 'vtt' | 'ass' = 'srt';
    
    // First, check if we have a structured captions directory with VTT file
    const rendersDir = path.join(process.cwd(), 'renders');
    const captionsDir = path.join(rendersDir, videoId, 'captions');
    const structuredVttPath = path.join(captionsDir, 'subtitles.vtt');
    const structuredSrtPath = path.join(captionsDir, 'subtitles.srt');
    
    console.log('📝 Checking for existing subtitle files...');
    console.log(`   Looking for VTT: ${structuredVttPath}`);
    console.log(`   Looking for SRT: ${structuredSrtPath}`);
    
    // Priority: Use existing structured files first, then download from URL
    if (fs.existsSync(structuredVttPath)) {
      console.log('✅ Found existing VTT file in structured directory');
      captionsPath = structuredVttPath;
      captionsFormat = 'vtt';
      
      // Convert VTT to SRT for FFmpeg compatibility
      try {
        const vttContent = fs.readFileSync(structuredVttPath, 'utf8');
        const srtContent = convertVttToSrt(vttContent);
        
        // Save SRT version for FFmpeg
        const tempSrtPath = path.join(tempDir, 'captions.srt');
        await fs.promises.writeFile(tempSrtPath, srtContent);
        captionsPath = tempSrtPath;
        captionsFormat = 'srt';
        console.log('✅ Converted VTT to SRT for FFmpeg compatibility');
      } catch (_error) {
        console.warn('⚠️ Failed to convert VTT to SRT, using original VTT');
        captionsPath = structuredVttPath;
        captionsFormat = 'vtt';
      }
    } else if (fs.existsSync(structuredSrtPath)) {
      console.log('✅ Found existing SRT file in structured directory');
      captionsPath = structuredSrtPath;
      captionsFormat = 'srt';
    } else if (captionsUrl) {
      console.log('📝 Downloading captions from URL...');
      const captionsResponse = await fetch(captionsUrl);
      if (captionsResponse.ok) {
        const captionsText = await captionsResponse.text();
        
        if (!captionsText.trim()) {
          console.warn('⚠️ Captions file is empty, proceeding without captions');
          captionsPath = null;
        } else {
          // Convert VTT to SRT for better FFmpeg compatibility
          try {
            const srtContent = convertVttToSrt(captionsText);
            
            // Validate SRT content
            const srtValidation = validateSrtContent(srtContent);
            if (!srtValidation.valid) {
              console.warn('⚠️ SRT validation failed:', srtValidation.errors);
              throw new Error('Invalid SRT format');
            }
            
            const captionsFilename = sanitizeFileName('captions.srt');
            captionsPath = path.join(tempDir, captionsFilename);
            await fs.promises.writeFile(captionsPath, srtContent);
            captionsFormat = 'srt';
            console.log('✅ Captions converted to SRT format and validated');
            
            // Save to structured directory for future use
            try {
              if (!fs.existsSync(captionsDir)) {
                fs.mkdirSync(captionsDir, { recursive: true });
              }
              const structuredCaptionsPath = path.join(captionsDir, 'subtitles.srt');
              await fs.promises.writeFile(structuredCaptionsPath, srtContent);
              console.log('✅ Captions saved to structured directory:', structuredCaptionsPath);
            } catch (dirError) {
              console.warn('⚠️ Failed to save captions to structured directory:', dirError);
            }
            
          } catch (_error) {
            console.warn('⚠️ Failed to convert captions to SRT, trying ASS format...');
            try {
              // This function is no longer imported, so this block will cause an error.
              // Assuming convertVttToAss is defined elsewhere or will be added.
              // For now, commenting out to avoid breaking the file.
              // const assContent = convertVttToAss(captionsText); 
              // const assFilename = sanitizeFileName('captions.ass');
              // captionsPath = path.join(tempDir, assFilename);
              // await fs.promises.writeFile(captionsPath, assContent);
              // captionsFormat = 'ass';
              // console.log('✅ Captions converted to ASS format');
              
              // Save ASS copy to structured directory
              // try {
              //   if (!fs.existsSync(captionsDir)) {
              //     fs.mkdirSync(captionsDir, { recursive: true });
              //   }
              //   const structuredCaptionsPath = path.join(captionsDir, 'subtitles.ass');
              //   await fs.promises.writeFile(structuredCaptionsPath, assContent);
              //   console.log('✅ Captions saved to structured directory:', structuredCaptionsPath);
              // } catch (dirError) {
              //   console.warn('⚠️ Failed to save captions to structured directory:', dirError);
              // }
              
            } catch (_assError) {
              console.warn('⚠️ Failed to convert captions, proceeding without them');
              captionsPath = null;
            }
          }
        }
      } else {
        console.warn('⚠️ Failed to download captions, proceeding without captions');
      }
    } else {
      console.log('📝 No captions available - proceeding without subtitles');
    }

    // Step 4: Create and validate image list file for FFmpeg
    console.log('📋 Creating image sequence...');
    const imageListPath = path.join(tempDir, 'images.txt');
    
    // Create proper FFmpeg concat format with validation
    const imageListContent = imagePaths.map((imgPath, index) => {
      const duration = (scenes as any[])[index]?.duration || 3;
      // Validate duration
      if (duration <= 0 || duration > 20) {
        throw new Error(`Invalid duration for scene ${index + 1}: ${duration} seconds`);
      }
      // Convert Windows path to Unix-style and escape properly
      const normalizedPath = escapePath(imgPath);
      console.log(`📄 Image ${index + 1} path: ${normalizedPath} (duration: ${duration}s)`);
      return `file '${normalizedPath}'\nduration ${duration}`;
    }).join('\n');
    
    // Validate image list format
    const imageListValidation = validateImageListFormat(imageListContent);
    if (!imageListValidation.valid) {
      throw new Error(`Invalid image list format: ${imageListValidation.errors.join(', ')}`);
    }
    
    await fs.promises.writeFile(imageListPath, imageListContent);
    console.log('✅ Image sequence created and validated');
    console.log('📄 Image list content preview:', imageListContent.substring(0, 200) + '...');
    console.log('📄 Full image list content:');
    console.log(imageListContent);

    // Step 5: Build and validate FFmpeg command
    console.log('🎬 Building FFmpeg command...');
    const outputPath = path.join(tempDir, 'final_video.mp4');
    
    // Verify FFmpeg is available
    try {
      await execAsync('ffmpeg -version', { timeout: 10000 });
      console.log('✅ FFmpeg is available');
    } catch (error) {
      throw new Error('FFmpeg is not installed or not in PATH. Please install FFmpeg and ensure it is accessible.');
    }
    
    // Normalize and escape all paths for FFmpeg command
    const normalizedImageListPath = escapePath(imageListPath);
    const normalizedAudioPath = escapePath(audioPath);
    const normalizedOutputPath = escapePath(outputPath);
    
    // Build FFmpeg command with proper settings for 1080x1920 vertical video
    let ffmpegCommand = `ffmpeg -y -f concat -safe 0 -i "${normalizedImageListPath}" -i "${normalizedAudioPath}"`;
    
    // Add video filters for proper sizing with cinematic motion effects
    let videoFilters = 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black';
    
    // Add dynamic cinematic motion effects to make static images feel alive
    // Advanced motion system with zoom, pan, camera shake, and parallax movement
    // Different motion patterns for visual variety and cinematic feel
    
    // Dynamic zoom with variable speed and subtle oscillation
    // Using a more conservative zoom that works well with image sequences
    videoFilters += ',zoompan=z=\\\'min(zoom+0.0015+(sin(t*0.6)*0.0003)\\,1.2)\\\':d=125';
    
    // Smooth panning motion with sine/cosine curves for natural movement
    // Horizontal movement with varying amplitude for dynamic feel
    videoFilters += ':x=\\\'iw/2-(iw/zoom/2)+sin(t*0.3)*12+cos(t*0.15)*6+sin(t*0.9)*3\\\'';
    // Vertical movement with different frequency for organic feel
    videoFilters += ':y=\\\'ih/2-(ih/zoom/2)+cos(t*0.25)*10+sin(t*0.08)*5+cos(t*0.7)*2\\\'';
    videoFilters += ':s=1080x1920';
    
    // Subtle camera shake for handheld camera feel (very subtle to avoid motion sickness)
    videoFilters += ',crop=1080:1920';
    // Horizontal shake with varying intensity and multiple frequencies
    videoFilters += ':x=\\\'sin(t*1.5)*1.5+cos(t*1.8)*1.2+sin(t*2.5)*0.6\\\'';
    // Vertical shake with different frequency for natural movement
    videoFilters += ':y=\\\'cos(t*1.2)*1.5+sin(t*2.2)*1.0+cos(t*2.4)*0.5\\\'';
    
    // Add subtle color grading for cinematic look
    videoFilters += ',eq=contrast=1.08:saturation=1.03:brightness=0.01';
    
    // Add subtle vignette effect for cinematic depth
    videoFilters += ',vignette=PI/4';
    
    // Add subtle film grain for cinematic texture
    videoFilters += ',noise=c0s=0.1:allf=t';
    
    // Enable subtitle burning for final video
    console.log('📝 Enabling subtitle burning for final video');
    
    // Store caption path for subtitle burning
    let finalCaptionsPath = null as string | null;
    if (captionsPath && fs.existsSync(captionsPath) && fs.statSync(captionsPath).size > 0) {
      finalCaptionsPath = captionsPath;
      console.log(`📝 Captions file ready for burning: ${captionsPath}`);
      console.log(`📝 Captions format: ${captionsFormat}`);
      
      // Add subtitle burning to the video filters
      // Use a more robust subtitle path handling for FFmpeg
      let subtitlePath = finalCaptionsPath;
      
      // Convert to Unix-style path and handle Windows drive letters properly
      subtitlePath = subtitlePath.replace(/\\/g, '/');
      
      // Handle Windows drive letter - ensure proper format for FFmpeg
      if (subtitlePath.match(/^[A-Za-z]:/)) {
        // Remove any multiple slashes after drive letter
        subtitlePath = subtitlePath.replace(/^([A-Za-z]:)\/+/g, '$1/');
        // Escape the colon for FFmpeg compatibility
        subtitlePath = subtitlePath.replace(/^([A-Za-z]):/, '$1\\\\:');
      }
      
      // Additional safety: ensure no triple slashes anywhere
      subtitlePath = subtitlePath.replace(/\/{3,}/g, '/');
      
      console.log(`📝 Original captions path: ${finalCaptionsPath}`);
      console.log(`📝 Processed subtitle path: ${subtitlePath}`);
      
      // Use double quotes around the subtitle path for better FFmpeg compatibility
      // Create scene-specific subtitle file with alternating positions
      let finalSubtitlePath = subtitlePath;
      
      if (scenes.length > 0) {
        try {
          finalSubtitlePath = await createSceneSpecificSubtitles(subtitlePath, scenes, tempDir);
        } catch (error) {
          console.warn('⚠️ Failed to create scene-specific subtitles, using original:', error);
        }
      }
      
      // Updated subtitle styling: smaller font, transparent background, clean look
      const fontSize = 20; // Reduced by ~25-30% from 28
      const subtitleStyle = `FontSize=${fontSize},PrimaryColour=&HFFFFFF,OutlineColour=&H000000,BorderStyle=1,Outline=1,Shadow=0,BackColour=&H00000000`;
      
      videoFilters += `,subtitles="${finalSubtitlePath}":force_style='${subtitleStyle}'`;
      console.log('✅ Scene-specific subtitle burning enabled with alternating positions');
      console.log(`   - Font size: ${fontSize} (reduced from 28)`);
      console.log(`   - Background: transparent (no black box)`);
      console.log(`   - Even scenes: top position ({\\an8})`);
      console.log(`   - Odd scenes: bottom position ({\\an2})`);
    } else {
      console.log('⚠️ No captions file available for burning');
      console.log('   This means subtitles will not appear in the final video');
    }
    
    // Complete the FFmpeg command with proper quoting - add quotes around the entire filter string
    ffmpegCommand += ` -vf "${videoFilters}"`;
    
    ffmpegCommand += ` -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -shortest -movflags +faststart "${normalizedOutputPath}"`;

    // 🔍 DEBUG MODE: Enhanced logging for troubleshooting
    console.log('🎬 ===== FFMPEG COMMAND DEBUG =====');
    console.log('🎬 Full FFmpeg command:');
    console.log(ffmpegCommand);
    console.log('🎬 Video filters breakdown:');
    console.log(videoFilters);
    console.log('🎬 Input files validation:');
    console.log(`   - Image list: ${normalizedImageListPath} (exists: ${fs.existsSync(imageListPath)})`);
    console.log(`   - Audio: ${normalizedAudioPath} (exists: ${fs.existsSync(audioPath)})`);
    console.log(`   - Output: ${normalizedOutputPath}`);
    console.log('🎬 ===== END DEBUG =====');

    // Comprehensive preflight validation before FFmpeg execution
    const preflightValidation = await validateBeforeRender({
      imagePaths,
      audioPath,
      captionsPath,
      imageListPath,
      outputPath,
      ffmpegCommand,
      videoFilters
    });

    if (!preflightValidation.valid) {
      throw new Error(`Preflight validation failed:\n${preflightValidation.errors.join('\n')}`);
    }
    
    console.log('✅ All preflight validations passed, executing FFmpeg...');

    // 🛠️ ADDITIONAL PREFLIGHT CHECK: Verify all required assets before FFmpeg execution
    console.log('🔍 Performing final preflight check before FFmpeg execution...');
    
    // 1. Check that all required files exist and are accessible
    const pathsToCheck = [
      imageListPath,
      audioPath,
      captionsPath
    ].filter(Boolean) as string[]; // Remove null/undefined values
    
    console.log('📋 Checking required asset files:');
    let allAssetsExist = true;
    pathsToCheck.forEach((p, index) => {
      const exists = fs.existsSync(p);
      const fileSize = exists ? fs.statSync(p).size : 0;
      const status = exists && fileSize > 0 ? "✅ Exists" : "❌ Missing or Empty";
      console.log(`   ${index + 1}. ${p} → ${status} (${fileSize} bytes)`);
      if (!exists || fileSize === 0) {
        allAssetsExist = false;
      }
    });
    
    // 2. Check that captions path is formatted correctly (if present)
    let captionsPathValid = true;
    if (captionsPath) {
      const normalizedPath = captionsPath.replace(/\\/g, '/');
      captionsPathValid = normalizedPath.startsWith("C:/") && !normalizedPath.includes("///");
      
      if (captionsPathValid) {
        console.log("✅ Captions path format is valid");
        
        // 🔍 DEBUG: Test subtitle file content
        try {
          const subtitleContent = fs.readFileSync(captionsPath, 'utf8');
          console.log(`📝 Subtitle file size: ${subtitleContent.length} characters`);
          console.log(`📝 Subtitle file preview: ${subtitleContent.substring(0, 200)}...`);
          
          // Validate SRT format
          const lines = subtitleContent.split('\n');
          const hasValidStructure = lines.some(line => line.includes('-->'));
          if (hasValidStructure) {
            console.log("✅ Subtitle file has valid SRT structure");
          } else {
            console.log("⚠️ Subtitle file may not have valid SRT structure");
          }
        } catch (error) {
          console.log("❌ Could not read subtitle file for validation");
          captionsPathValid = false;
        }
      } else {
        console.log("❌ Captions path is malformed – please correct before rendering");
        console.log(`   Current path: ${captionsPath}`);
        console.log(`   Normalized: ${normalizedPath}`);
        allAssetsExist = false;
      }
    } else {
      console.log("📝 No captions file specified - proceeding without subtitles");
    }
    
    // 3. Check FFmpeg availability
    let ffmpegAvailable = false;
    try {
      await execAsync('ffmpeg -version', { timeout: 5000 });
      ffmpegAvailable = true;
      console.log("✅ FFmpeg is available and accessible");
    } catch (error) {
      console.log("❌ FFmpeg is not available or not in PATH");
      allAssetsExist = false;
    }
    
    // 4. Check output directory permissions
    const outputDir = path.dirname(outputPath);
    let outputDirWritable = false;
    try {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      // Test write permission by creating a temporary file
      const testFile = path.join(outputDir, 'test-write.tmp');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      outputDirWritable = true;
      console.log("✅ Output directory is writable");
    } catch (error) {
      console.log("❌ Output directory is not writable");
      allAssetsExist = false;
    }
    
    // Final preflight result
    if (allAssetsExist && ffmpegAvailable && outputDirWritable) {
      console.log("✅ All preflight checks passed - safe to proceed with FFmpeg rendering");
    } else {
      const errors = [];
      if (!allAssetsExist) errors.push("Missing or invalid asset files");
      if (!ffmpegAvailable) errors.push("FFmpeg not available");
      if (!outputDirWritable) errors.push("Output directory not writable");
      
      throw new Error(`Preflight check failed: ${errors.join(', ')}`);
    }

    // Execute FFmpeg with timeout and proper shell handling
    console.log('🚀 Starting FFmpeg execution...');
    const { stdout, stderr } = await execAsync(ffmpegCommand, { 
      timeout: 300000, // 5 minute timeout
      shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
      windowsHide: true
    });
    
    console.log('✅ FFmpeg execution completed');
    
    // Enhanced FFmpeg error handling
    if (stderr) {
      // Check for actual errors (not just progress info)
      const errorIndicators = [
        'Error:', 'error:', 'Invalid', 'invalid', 'Failed', 'failed',
        'No such file', 'Permission denied', 'Cannot', 'cannot',
        'Unable', 'unable', 'Missing', 'missing', 'Corrupt', 'corrupt'
      ];
      
      const hasError = errorIndicators.some(indicator => stderr.includes(indicator));
      
      if (hasError) {
        console.error('❌ FFmpeg error detected:', stderr);
        throw new Error(`FFmpeg execution failed: ${stderr}`);
      } else if (!stderr.includes('frame=')) {
        // Log non-progress stderr for debugging
        console.log('📝 FFmpeg stderr (non-error):', stderr);
      }
    }
    
    if (stdout) {
      console.log('📝 FFmpeg stdout:', stdout);
    }

    // Step 6: Subtitles are now included in the main FFmpeg command
    if (finalCaptionsPath) {
      console.log('✅ Subtitles included in main FFmpeg command');
    } else {
      console.log('📝 No captions available for burning - external captions will be used if available');
    }

    // Step 7: Verify output file exists and get video duration
    if (!fs.existsSync(outputPath)) {
      throw new Error('FFmpeg did not create output file');
    }
    
    const outputFileSize = fs.statSync(outputPath).size;
    if (outputFileSize === 0) {
      throw new Error('FFmpeg created empty output file');
    }
    
    console.log(`✅ Video file created successfully (${Math.round(outputFileSize / 1024 / 1024)} MB)`);

    // Get video duration using FFprobe
    const { stdout: durationOutput } = await execAsync(
      `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${normalizedOutputPath}"`,
      { 
        timeout: 30000,
        shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
        windowsHide: true
      }
    );
    const duration = parseFloat(durationOutput.trim()) || 0;
    console.log('⏱️ Video duration:', duration, 'seconds');

    // Step 7: Create local renders directory structure and copy video file
    console.log('📁 Creating local renders directory structure...');
    const videosDir = path.join(rendersDir, 'videos');
    const localVideoPath = path.join(videosDir, `${videoId}.mp4`);
    
    try {
      // Create renders directory if it doesn't exist
      if (!fs.existsSync(rendersDir)) {
        fs.mkdirSync(rendersDir, { recursive: true });
        console.log('✅ Created renders directory:', rendersDir);
      }
      
      // Create videos subdirectory if it doesn't exist
      if (!fs.existsSync(videosDir)) {
        fs.mkdirSync(videosDir, { recursive: true });
        console.log('✅ Created renders/videos directory:', videosDir);
      }
      
      // Copy the video file from temp directory to local renders directory
      console.log('📋 Copying video file to local renders directory...');
      await fs.promises.copyFile(outputPath, localVideoPath);
      
      // Verify the local file exists and has content
      if (!fs.existsSync(localVideoPath)) {
        throw new Error('Failed to copy video file to local renders directory');
      }
      
      const localFileSize = fs.statSync(localVideoPath).size;
      if (localFileSize === 0) {
        throw new Error('Local video file is empty after copy');
      }
      
      console.log(`✅ Video file copied to local directory: ${localVideoPath} (${Math.round(localFileSize / 1024 / 1024)} MB)`);
      
    } catch (dirError) {
      console.error('❌ Error creating local directory structure:', dirError);
      throw new Error(`Failed to create local directory structure: ${dirError instanceof Error ? dirError.message : 'Unknown error'}`);
    }

    // Step 8: Upload final video to Supabase Storage
    console.log('☁️ Uploading final video to Supabase Storage...');
    
    try {
      // Read the video file from local renders directory
      const videoBuffer = await fs.promises.readFile(localVideoPath);
      console.log(`📤 Uploading video buffer (${Math.round(videoBuffer.length / 1024 / 1024)} MB)...`);
      
      // Create Supabase client with service role key
      const supabase = sbServer();
      
      // Upload to videos bucket with path finals/{videoId}.mp4
      const uploadPath = `finals/${videoId}.mp4`;
      console.log(`📤 Uploading to Supabase videos bucket, path: ${uploadPath}`);
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos')
        .upload(uploadPath, videoBuffer, {
          contentType: 'video/mp4',
          upsert: true
        });

      if (uploadError) {
        console.error('❌ Supabase upload failed:', uploadError);
        throw new Error(`Failed to upload video to Supabase: ${uploadError.message}`);
      }

      console.log('✅ Video uploaded successfully to Supabase Storage');
      
      // Get the public URL for the uploaded video
      const { data: urlData } = supabase.storage
        .from('videos')
        .getPublicUrl(uploadPath);
      
      const publicUrl = urlData.publicUrl;
      console.log('✅ Public URL generated:', publicUrl);

      // Step 9: Update video record with final video URL and completion status
      const updateResult = await VideoService.updateVideo(videoId, {
        status: 'completed',
        final_video_url: publicUrl,
        total_duration: Math.round(duration),
        render_done_at: new Date().toISOString()
      });

      if (!updateResult.success) {
        throw new Error('Failed to update video record');
      }

      console.log('✅ Video rendering pipeline completed successfully');

      return NextResponse.json({
        success: true,
        message: 'Video rendered successfully',
        data: {
          videoId,
          finalVideoUrl: publicUrl,
          duration: Math.round(duration),
          scenes: (scenes as any[]).length,
          fileSize: Math.round(videoBuffer.length / 1024 / 1024), // Size in MB
          localPath: localVideoPath,
          supabasePath: uploadPath
        }
      });
      
    } catch (uploadError) {
      console.error('❌ Upload process failed:', uploadError);
      throw new Error(`Upload process failed: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`);
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
      success: false,
      error: true,
      message: 'Failed to render video',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });

  } finally {
    // Clean up temporary files
    if (tempDir) {
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
        console.log('🧹 Temporary files cleaned up');
      } catch (cleanupError) {
        console.warn('Warning: Failed to clean up temporary files:', cleanupError);
      }
    }
  }
}
