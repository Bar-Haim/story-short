import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { fileURLToPath } from 'url';
import path from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import fs from 'fs';
import axios from 'axios';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import FormData from 'form-data';

dotenv.config();

// 🟡 טוען את ה־storyboard.json
const storyboardPath = path.join(__dirname, '../storyboard/story.json');

if (!fs.existsSync(storyboardPath)) {
  console.error('❌ storyboard/story.json not found.');
  process.exit(1);
}

const storyboard = JSON.parse(fs.readFileSync(storyboardPath, 'utf-8'));

// 🟡 מוודא שה־voiceId קיים
const voiceId = storyboard.voiceId;
if (!voiceId) {
  console.error('❌ voiceId is missing in storyboard/story.json.');
  process.exit(1);
}

// 🟡 מאחד את כל הטקסטים לסקריפט אחד
interface Scene {
  text: string;
}

const text = (storyboard.scenes as Scene[])?.map(scene => scene.text).join(' ') || '';
if (!text) {
  console.error('❌ No scene texts found in storyboard.');
  process.exit(1);
}

// 🟡 הגדרות סביבתיות
const elevenApiKey = process.env.ELEVENLABS_API_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!elevenApiKey || !supabaseUrl || !supabaseKey || !openaiApiKey) {
  console.error('❌ Missing required environment variables:');
  if (!elevenApiKey) console.error('   - ELEVENLABS_API_KEY');
  if (!supabaseUrl) console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseKey) console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  if (!openaiApiKey) console.error('   - OPENAI_API_KEY');
  process.exit(1);
}

// 🟡 נתיבי קבצים
const videoId = crypto.randomUUID();
const outputDir = path.join(__dirname, `../renders/${videoId}`);
const audioPath = path.join(outputDir, 'audio.mp3');
const captionsVttPath = path.join(outputDir, 'captions.vtt');
const captionsSrtPath = path.join(outputDir, 'captions.srt');

// 🟡 חיבור ל־Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// ✅ פונקציית יצירת TTS
async function generateTTS(text: string) {
  console.log('🎤 Generating TTS audio...');
  console.log(`   Voice ID: ${voiceId}`);
  console.log(`   Text length: ${text.length} characters`);
  
  try {
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

    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(audioPath, response.data);
    console.log('✅ TTS audio saved at', audioPath);
  } catch (error: any) {
    console.error('❌ TTS generation failed:');
    if (error.response?.data?.error?.message) {
      console.error(`   Error: ${error.response.data.error.message}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
    throw error;
  }
}

async function transcribeAudio() {
  console.log(' Transcribing audio to captions...');
  
  // Validate audio file exists
  if (!fs.existsSync(audioPath)) {
    const error = `Audio file not found at: ${audioPath}`;
    console.error(`❌ ${error}`);
    throw new Error(error);
  }
  
  // Validate audio file size
  const audioStats = fs.statSync(audioPath);
  if (audioStats.size === 0) {
    const error = `Audio file is empty: ${audioPath}`;
    console.error(`❌ ${error}`);
    throw new Error(error);
  }
  
  console.log(`   Audio file: ${audioPath}`);
  console.log(`   File size: ${audioStats.size} bytes`);
  
  try {
    // Create form data with proper structure
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioPath), {
      filename: 'audio.mp3',
      contentType: 'audio/mpeg'
    });
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'vtt');
    
    console.log('   Sending request to OpenAI Whisper API...');
    
    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          ...formData.getHeaders()
        },
        timeout: 60000 // 60 second timeout
      }
    );
    
    if (!response.data) {
      throw new Error('Empty response from Whisper API');
    }
    
    // Save VTT captions
    fs.writeFileSync(captionsVttPath, response.data);
    console.log('✅ Captions VTT saved');
    
    // Convert VTT to SRT using FFmpeg
    console.log('🔄 Converting VTT to SRT format...');
    execSync(`ffmpeg -i "${captionsVttPath}" "${captionsSrtPath}"`);
    console.log('✅ Captions SRT converted');
    
  } catch (error: any) {
    console.error('❌ Audio transcription failed:');
    
    if (error.response?.data?.error?.message) {
      console.error(`   OpenAI Error: ${error.response.data.error.message}`);
    } else if (error.response?.status) {
      console.error(`   HTTP ${error.response.status}: ${error.response.statusText}`);
      if (error.response.data) {
        console.error(`   Response: ${JSON.stringify(error.response.data)}`);
      }
    } else if (error.code === 'ENOTFOUND') {
      console.error('   Network Error: Could not connect to OpenAI API');
    } else if (error.code === 'ECONNABORTED') {
      console.error('   Timeout Error: Request took too long');
    } else {
      console.error(`   Error: ${error.message}`);
    }
    
    throw error;
  }
}

async function uploadToSupabase() {
  console.log('☁️ Uploading files to Supabase...');
  
  try {
    const audioData = fs.readFileSync(audioPath);
    const srtData = fs.readFileSync(captionsSrtPath);

    const { data: audioUpload, error: audioError } = await supabase.storage
      .from('videos')
      .upload(`${videoId}/audio.mp3`, audioData, { contentType: 'audio/mpeg' });

    const { data: srtUpload, error: srtError } = await supabase.storage
      .from('videos')
      .upload(`${videoId}/captions.srt`, srtData, { contentType: 'text/plain' });

    if (audioError || srtError) {
      console.error('❌ Supabase upload failed:');
      if (audioError) console.error(`   Audio upload: ${audioError.message}`);
      if (srtError) console.error(`   SRT upload: ${srtError.message}`);
      throw new Error('Supabase upload failed');
    }

    console.log('✅ Files uploaded to Supabase successfully');
  } catch (error: any) {
    console.error('❌ Supabase upload failed:', error.message);
    throw error;
  }
}

(async () => {
  const startTime = Date.now();
  console.log('🎬 Starting TTS rendering process...');
  console.log(`   Video ID: ${videoId}`);
  
  try {
    await generateTTS(text);
    await transcribeAudio();
    await uploadToSupabase();
    
    const duration = Date.now() - startTime;
    console.log('\n🎉 TTS rendering completed successfully!');
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Video ID: ${videoId}`);
    console.log(`   Voice ID: ${voiceId}`);
    
  } catch (error: any) {
    console.error('\n❌ TTS pipeline failed:', error.message);
    process.exit(1);
  }
})();
