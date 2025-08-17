#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: '.env.local' });

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

function log(message: string, color: keyof typeof colors = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}
function info(message: string) { log(`ℹ️  ${message}`, 'cyan'); }
function success(message: string) { log(`✅ ${message}`, 'green'); }
function warning(message: string) { log(`⚠️  ${message}`, 'yellow'); }
function error(message: string) { log(`❌ ${message}`, 'red'); }
function header(message: string) {
  log(`\n${colors.bright}${colors.blue}${'='.repeat(60)}${colors.reset}`);
  log(`${colors.bright}${colors.blue}${message}${colors.reset}`);
  log(`${colors.bright}${colors.blue}${'='.repeat(60)}${colors.reset}\n`);
}
function separator() {
  log(`${colors.yellow}${'-'.repeat(60)}${colors.reset}\n`);
}

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

function initializeSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  info('Initializing Supabase client...');
  return createClient(supabaseUrl, supabaseServiceKey);
}

async function fetchLatestVideo(supabase: any): Promise<Video | null> {
  info('Fetching most recent video with status = "assets_generated"...');
  try {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('status', 'assets_generated')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error) {
      if (error.code === 'PGRST116') {
        warning('No videos found with status = "assets_generated"');
        return null;
      }
      throw error;
    }
    success(`Found video: ${data.id}`);
    info(`Created at: ${data.created_at}`);
    info(`Input text: ${data.input_text?.substring(0, 100)}${data.input_text && data.input_text.length > 100 ? '...' : ''}`);
    return data as Video;
  } catch (err) {
    error('Failed to fetch video from database');
    console.error('Database error:', err);
    throw err;
  }
}

async function processVideo(videoId: string): Promise<void> {
  info(`Processing video: ${videoId}`);
  try {
    const renderScriptPath = path.join(__dirname, 'render-validated.cjs');
    const command = `node "${renderScriptPath}" ${videoId}`;
    log(`${colors.cyan}Executing: ${command}${colors.reset}`);
    separator();
    execSync(command, { stdio: 'inherit', cwd: process.cwd() });
    success(`Video ${videoId} processed successfully!`);
    separator();
  } catch (processError: any) {
    error(`Failed to process video ${videoId}`);
    error(`Process exited with code: ${processError.status || 'unknown'}`);
    if (processError.stdout) {
      log('Process output:', 'yellow');
      console.log(processError.stdout.toString());
    }
    if (processError.stderr) {
      log('Process errors:', 'red');
      console.log(processError.stderr.toString());
    }
    throw processError;
  }
}

async function main() {
  try {
    header('PROCESS LATEST VIDEO');
    info('Starting video processing pipeline...');
    const supabase = initializeSupabase();
    success('Supabase client initialized');
    const video = await fetchLatestVideo(supabase);
    if (!video) {
      warning('No videos available for processing');
      info('Make sure you have videos with status = "assets_generated" in your database');
      process.exit(0);
    }
    await processVideo(video.id);
    header('PROCESSING COMPLETED');
    success(`Latest video (${video.id}) has been processed successfully!`);
    log('Check Supabase for the updated video status and final video URL.', 'green');
  } catch (err) {
    error('PROCESSING FAILED');
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

main();
