#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env.local
config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Logging functions with colors
function log(message: string, color: keyof typeof colors = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function info(message: string) {
  log(`ℹ️  ${message}`, 'cyan');
}

function success(message: string) {
  log(`✅ ${message}`, 'green');
}

function warning(message: string) {
  log(`⚠️  ${message}`, 'yellow');
}

function error(message: string) {
  log(`❌ ${message}`, 'red');
}

// Helper for safe error message formatting
const fmtErr = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Helper function to ensure scenes are properly parsed and validated
function ensureScenes(x: any): any[] {
  try {
    if (!x) return [];
    
    // Support both jsonb and string
    const sb = x;
    const parsed = typeof sb === "string" ? JSON.parse(sb) : sb;
    const scenes = Array.isArray(parsed?.scenes) ? parsed.scenes : [];
    
    // Runtime type guard for scenes items
    return scenes.filter((scene: any) => {
      return scene && 
             typeof scene.text === 'string' && 
             typeof scene.duration === 'number';
    });
  } catch (e) {
    console.error(`🔍 [ensureScenes] Error parsing scenes: ${fmtErr(e)}`);
    return [];
  }
}

// Video interface matching the database schema
interface Video {
  id: string;
  status: string;
  input_text: string;
  script: string | null;
  storyboard_json: any | null;
  audio_url: string | null;
  captions_url: string | null;
  image_urls: string[] | null;
  total_duration: number | null;
  final_video_url: string | null;
  error_message: string | null;
  image_upload_progress: number | null;
  theme?: string;
  language?: string;
  tone?: string;
  user_id?: string;
  created_at: string;
  updated_at: string;
}

// Initialize Supabase client
function initializeSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

// Retry function with exponential backoff
async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      warning(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

// Generate TTS audio using ElevenLabs
async function generateTTS(text: string, voiceId: string = 'Dslrhjl3ZpzrctukrQSN'): Promise<Buffer> {
  const elevenApiKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenApiKey) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  info(`Generating TTS audio for ${text.length} characters...`);
  
  const response = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.4,
        similarity_boost: 0.75
      }
    },
    {
      headers: {
        "xi-api-key": elevenApiKey,
        "Content-Type": "application/json"
      },
      responseType: 'arraybuffer'
    }
  );

  return Buffer.from(response.data);
}

// Upload file to Supabase Storage
async function uploadToStorage(
  supabase: any,
  bucket: string,
  filePath: string,
  contentType: string
): Promise<string> {
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, fileBuffer, {
      contentType,
      upsert: true
    });

  if (error) {
    throw new Error(`Failed to upload to storage: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

// Generate SRT captions from script
function generateSRTCaptions(script: string): string {
  const sentences = script.split(/[.!?]+/).filter(s => s.trim());
  let srtContent = '';
  let counter = 1;
  let currentTime = 0;
  
  for (const sentence of sentences) {
    const duration = Math.max(2, sentence.length * 0.1); // Rough estimate
    const startTime = formatSRTTime(currentTime);
    const endTime = formatSRTTime(currentTime + duration);
    
    srtContent += `${counter}\n`;
    srtContent += `${startTime} --> ${endTime}\n`;
    srtContent += `${sentence.trim()}\n\n`;
    
    currentTime += duration;
    counter++;
  }
  
  return srtContent;
}

function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

// Generate image using OpenAI
async function generateImage(prompt: string): Promise<Buffer> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  info(`Generating image for prompt: ${prompt.substring(0, 50)}...`);
  
  const response = await axios.post(
    'https://api.openai.com/v1/images/generations',
    {
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      response_format: "b64_json"
    },
    {
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.data.data?.[0]?.b64_json) {
    throw new Error('No image data received from OpenAI');
  }

  return Buffer.from(response.data.data[0].b64_json, 'base64');
}

// Placeholder image generation (fallback)
function generatePlaceholderImage(width: number = 1024, height: number = 1024): Buffer {
  // Create a simple SVG placeholder
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f0f0f0"/>
      <text x="50%" y="50%" font-family="Arial" font-size="24" fill="#666" text-anchor="middle" dy=".3em">
        Image Placeholder
      </text>
    </svg>
  `;
  
  return Buffer.from(svg);
}

// Ensure audio exists and is uploaded
export async function ensureAudio(video: Video): Promise<{ audio_url: string }> {
  const supabase = initializeSupabase();
  
  if (video.audio_url) {
    success('Audio already exists');
    return { audio_url: video.audio_url };
  }

  info('Generating audio...');
  
  try {
    const scriptText = (video.script ?? video.input_text ?? '').trim();
    if (!scriptText) {
      throw new Error('No script or input_text available for TTS');
    }
    const audioBuffer = await retry(() => generateTTS(scriptText));
    
    // Save to temporary file
    const tempDir = path.join(__dirname, '../renders', video.id);
    fs.mkdirSync(tempDir, { recursive: true });
    const audioPath = path.join(tempDir, 'audio.mp3');
    fs.writeFileSync(audioPath, audioBuffer);
    
    // Upload to Supabase Storage
    const audioUrl = await uploadToStorage(supabase, 'assets', audioPath, 'audio/mpeg');
    
    // Update database
    await supabase
      .from('videos')
      .update({ audio_url: audioUrl })
      .eq('id', video.id);
    
    success('Audio generated and uploaded successfully');
    return { audio_url: audioUrl };
    
  } catch (err) {
    error(`Audio generation failed: ${fmtErr(err)}`);
    throw err;
  }
}

// Ensure captions exist and are uploaded
export async function ensureCaptions(video: Video): Promise<{ captions_url: string }> {
  const supabase = initializeSupabase();
  
  if (video.captions_url) {
    success('Captions already exist');
    return { captions_url: video.captions_url };
  }

  if (!video.script) {
    throw new Error('No script available for caption generation');
  }

  info('Generating captions...');
  
  try {
    const srtContent = generateSRTCaptions(video.script);
    
    // Save to temporary file
    const tempDir = path.join(__dirname, '../renders', video.id);
    fs.mkdirSync(tempDir, { recursive: true });
    const captionsPath = path.join(tempDir, 'captions.srt');
    fs.writeFileSync(captionsPath, srtContent);
    
    // Upload to Supabase Storage
    const captionsUrl = await uploadToStorage(supabase, 'assets', captionsPath, 'text/plain');
    
    // Update database
    await supabase
      .from('videos')
      .update({ captions_url: captionsUrl })
      .eq('id', video.id);
    
    success('Captions generated and uploaded successfully');
    return { captions_url: captionsUrl };
    
  } catch (err) {
    error(`Caption generation failed: ${fmtErr(err)}`);
    throw err;
  }
}

// Ensure images exist for each scene
export async function ensureImages(video: Video): Promise<{ storyboard_json: any }> {
  const supabase = initializeSupabase();
  
  // Add detailed logging before throwing
  console.log(`🔍 [ensureImages] videoId: ${video.id}`);
  console.log(`🔍 [ensureImages] typeof storyboard_json: ${typeof video.storyboard_json}`);
  console.log(`🔍 [ensureImages] storyboard_json first 200 chars: ${JSON.stringify(video.storyboard_json).substring(0, 200)}`);
  console.log(`🔍 [ensureImages] scenes length: ${video.storyboard_json?.scenes?.length || 0}`);
  
  // Use the helper function to ensure scenes are properly parsed
  const scenes = ensureScenes(video.storyboard_json);
  
  if (scenes.length === 0) {
    // Re-check the DB row by id (no caching), and include columns: status, storyboard_json, error_message
    console.log(`🔍 [ensureImages] No scenes found, re-checking DB for videoId: ${video.id}`);
    
    try {
      const { data: row, error } = await supabase
        .from('videos')
        .select('status, storyboard_json, error_message')
        .eq('id', video.id)
        .single();
      
      if (error) {
        console.error(`🔍 [ensureImages] DB re-check failed: ${fmtErr(error)}`);
        throw new Error(`Database error when re-checking video ${video.id}: ${fmtErr(error)}`);
      }
      
      if (!row) {
        throw new Error(`Video ${video.id} not found in database`);
      }
      
      console.log(`🔍 [ensureImages] DB re-check - status: ${row.status}, error_message: ${row.error_message}`);
      console.log(`🔍 [ensureImages] DB re-check - storyboard_json type: ${typeof row.storyboard_json}`);
      
      const recheckedScenes = ensureScenes(row.storyboard_json);
      console.log(`🔍 [ensureImages] DB re-check - scenes length: ${recheckedScenes.length}`);
      
      if (recheckedScenes.length === 0) {
        throw new Error(`No storyboard scenes for videoId=${video.id}. status=${row.status}.`);
      }
      
      // Use the rechecked scenes
      console.log(`🔍 [ensureImages] Using rechecked scenes: ${recheckedScenes.length} scenes found`);
    } catch (dbError) {
      console.error(`🔍 [ensureImages] Database re-check failed: ${fmtErr(dbError)}`);
      throw new Error(`No storyboard scenes for videoId=${video.id}. Database error: ${fmtErr(dbError)}`);
    }
  }
  const updatedScenes = [...scenes];
  let hasChanges = false;

  info(`Checking ${scenes.length} scenes for missing images...`);

  for (let i = 0; i < updatedScenes.length; i++) {
    const scene = updatedScenes[i];
    
    if (scene.image_url) {
      success(`Scene ${i + 1}: image already exists`);
      continue;
    }

    info(`Generating image for scene ${i + 1}...`);
    
    try {
      // Generate image prompt from scene text
      const imagePrompt = scene.text || `Scene ${i + 1} of a video`;
      
      const imageBuffer = await retry(() => generateImage(imagePrompt));
      
      // Save to temporary file
      const tempDir = path.join(__dirname, '../renders', video.id);
      fs.mkdirSync(tempDir, { recursive: true });
      const imagePath = path.join(tempDir, `scene_${i + 1}.png`);
      fs.writeFileSync(imagePath, imageBuffer);
      
      // Upload to Supabase Storage
      const imageUrl = await uploadToStorage(supabase, 'assets', imagePath, 'image/png');
      
      // Update scene
      updatedScenes[i] = { ...scene, image_url: imageUrl };
      hasChanges = true;
      
      success(`Scene ${i + 1}: image generated and uploaded`);
      
    } catch (err) {
      warning(`Scene ${i + 1}: image generation failed, using placeholder`);
      
      try {
        // Generate placeholder image
        const placeholderBuffer = generatePlaceholderImage();
        
        // Save and upload placeholder
        const tempDir = path.join(__dirname, '../renders', video.id);
        fs.mkdirSync(tempDir, { recursive: true });
        const imagePath = path.join(tempDir, `scene_${i + 1}_placeholder.png`);
        fs.writeFileSync(imagePath, placeholderBuffer);
        
        const imageUrl = await uploadToStorage(supabase, 'assets', imagePath, 'image/svg+xml');
        
        // Update scene with placeholder
        updatedScenes[i] = { ...scene, image_url: imageUrl };
        hasChanges = true;
        
        success(`Scene ${i + 1}: placeholder image uploaded`);
        
      } catch (placeholderError) {
        error(`Scene ${i + 1}: failed to create placeholder: ${fmtErr(placeholderError)}`);
        throw new Error(`Failed to generate image for scene ${i + 1}`);
      }
    }
  }

  if (hasChanges) {
    // Update database with new storyboard
    const updatedStoryboard = { ...video.storyboard_json, scenes: updatedScenes };
    
    await supabase
      .from('videos')
      .update({ storyboard_json: updatedStoryboard })
      .eq('id', video.id);
    
    success('Storyboard updated with new images');
  }

  return { storyboard_json: { ...video.storyboard_json, scenes: updatedScenes } };
}

// Main function to ensure all assets exist
export async function ensureAllAssets(video: Video): Promise<{
  audio_url: string;
  captions_url: string;
  storyboard_json: any;
}> {
  info(`Ensuring all assets exist for video ${video.id}...`);
  
  const [audioResult, captionsResult, imagesResult] = await Promise.all([
    ensureAudio(video),
    ensureCaptions(video),
    ensureImages(video)
  ]);
  
  success('All assets generated successfully');
  
  return {
    audio_url: audioResult.audio_url,
    captions_url: captionsResult.captions_url,
    storyboard_json: imagesResult.storyboard_json
  };
} 