#!/usr/bin/env node

/**
 * Batch Video Rendering Script
 * 
 * Processes multiple video jobs from Supabase in batch mode.
 * Can process videos by status or by providing a list of video IDs.
 * 
 * Usage: 
 *   node batch-render.js --status assets_generated
 *   node batch-render.js --ids file.txt
 *   node batch-render.js --ids "id1,id2,id3"
 */

import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
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
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Logging utilities
const log = (msg) => console.log(`\x1b[36m[📦 BATCH]\x1b[0m ${msg}`);
const success = (msg) => console.log(`\x1b[32m[✅ SUCCESS]\x1b[0m ${msg}`);
const error = (msg) => console.log(`\x1b[31m[❌ ERROR]\x1b[0m ${msg}`);
const warn = (msg) => console.log(`\x1b[33m[⚠️ WARN]\x1b[0m ${msg}`);
const info = (msg) => console.log(`\x1b[34m[ℹ️ INFO]\x1b[0m ${msg}`);

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--status' && i + 1 < args.length) {
      options.status = args[i + 1];
      i++;
    } else if (arg === '--ids' && i + 1 < args.length) {
      options.ids = args[i + 1];
      i++;
    } else if (arg === '--limit' && i + 1 < args.length) {
      options.limit = parseInt(args[i + 1]);
      i++;
    } else if (arg === '--delay' && i + 1 < args.length) {
      options.delay = parseInt(args[i + 1]);
      i++;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    }
  }
  
  return options;
}

function showHelp() {
  console.log(`
📦 StoryShort Batch Video Rendering

Usage:
  node batch-render.js --status <status>
  node batch-render.js --ids <file_or_list>
  node batch-render.js --status assets_generated --limit 5 --delay 10

Options:
  --status <status>     Process videos with specific status (e.g., assets_generated)
  --ids <file_or_list>  Process specific video IDs from file or comma-separated list
  --limit <number>      Maximum number of videos to process (default: 10)
  --delay <seconds>     Delay between jobs in seconds (default: 5)
  --dry-run            Show what would be processed without actually running
  --help, -h           Show this help message

Examples:
  # Process all videos with assets_generated status
  node batch-render.js --status assets_generated

  # Process specific video IDs from file
  node batch-render.js --ids video-ids.txt

  # Process specific video IDs from command line
  node batch-render.js --ids "id1,id2,id3"

  # Process with limits and delays
  node batch-render.js --status assets_generated --limit 3 --delay 10

  # Dry run to see what would be processed
  node batch-render.js --status assets_generated --dry-run
`);
}

// Get videos by status
async function getVideosByStatus(status, limit = 10) {
  log(`Fetching videos with status: ${status}`);
  
  try {
    const { data, error: fetchError } = await supabase
      .from('videos')
      .select('id, input_text, status, created_at')
      .eq('status', status)
      .order('created_at', { ascending: true })
      .limit(limit);
    
    if (fetchError) {
      throw new Error(`Failed to fetch videos: ${fetchError.message}`);
    }
    
    if (!data || data.length === 0) {
      warn(`No videos found with status: ${status}`);
      return [];
    }
    
    success(`Found ${data.length} videos with status: ${status}`);
    return data;
    
  } catch (err) {
    error(`Error fetching videos: ${err.message}`);
    return [];
  }
}

// Get video IDs from file or comma-separated list
async function getVideoIds(idsInput) {
  let videoIds = [];
  
  // Check if it's a file path
  if (fs.existsSync(idsInput)) {
    log(`Reading video IDs from file: ${idsInput}`);
    try {
      const content = fs.readFileSync(idsInput, 'utf8');
      videoIds = content.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#')); // Skip empty lines and comments
    } catch (err) {
      error(`Failed to read file: ${err.message}`);
      return [];
    }
  } else {
    // Treat as comma-separated list
    videoIds = idsInput.split(',').map(id => id.trim()).filter(id => id);
  }
  
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const validIds = videoIds.filter(id => uuidRegex.test(id));
  
  if (validIds.length !== videoIds.length) {
    warn(`Filtered out ${videoIds.length - validIds.length} invalid video IDs`);
  }
  
  success(`Found ${validIds.length} valid video IDs`);
  return validIds;
}

// Get video details for specific IDs
async function getVideosByIds(videoIds) {
  log(`Fetching details for ${videoIds.length} videos`);
  
  try {
    const { data, error: fetchError } = await supabase
      .from('videos')
      .select('id, input_text, status, created_at')
      .in('id', videoIds);
    
    if (fetchError) {
      throw new Error(`Failed to fetch videos: ${fetchError.message}`);
    }
    
    if (!data || data.length === 0) {
      warn('No videos found with provided IDs');
      return [];
    }
    
    success(`Found ${data.length} videos with provided IDs`);
    return data;
    
  } catch (err) {
    error(`Error fetching videos: ${err.message}`);
    return [];
  }
}

// Run rendering job for a single video
async function runRenderingJob(videoId) {
  log(`Starting rendering job for video: ${videoId}`);
  
  try {
    const { stdout, stderr } = await execAsync(
      `node scripts/render-job.js ${videoId}`,
      { 
        timeout: 600000, // 10 minute timeout per job
        shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
        windowsHide: true
      }
    );
    
    if (stderr && stderr.includes('ERROR')) {
      throw new Error(`Rendering failed: ${stderr}`);
    }
    
    success(`Rendering completed for video: ${videoId}`);
    return { success: true, videoId, output: stdout };
    
  } catch (err) {
    error(`Rendering failed for video ${videoId}: ${err.message}`);
    return { success: false, videoId, error: err.message };
  }
}

// Sleep function for delays
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main batch processing function
async function processBatch(videos, options) {
  const { delay = 5, dryRun = false } = options;
  
  log(`Starting batch processing of ${videos.length} videos`);
  
  if (dryRun) {
    log('DRY RUN MODE - No actual processing will occur');
    console.log('\n📋 Videos that would be processed:');
    videos.forEach((video, index) => {
      console.log(`${index + 1}. ${video.id} - "${video.input_text?.substring(0, 50)}..." (${video.status})`);
    });
    return;
  }
  
  const results = {
    total: videos.length,
    successful: 0,
    failed: 0,
    details: []
  };
  
  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    const videoId = video.id;
    
    console.log(`\n${'='.repeat(60)}`);
    log(`Processing video ${i + 1}/${videos.length}: ${videoId}`);
    info(`Input: ${video.input_text?.substring(0, 50)}...`);
    
    const result = await runRenderingJob(videoId);
    results.details.push(result);
    
    if (result.success) {
      results.successful++;
    } else {
      results.failed++;
    }
    
    // Add delay between jobs (except for the last one)
    if (i < videos.length - 1 && delay > 0) {
      log(`Waiting ${delay} seconds before next job...`);
      await sleep(delay * 1000);
    }
  }
  
  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  log('BATCH PROCESSING COMPLETED');
  console.log(`📊 Results Summary:`);
  console.log(`   Total videos: ${results.total}`);
  console.log(`   Successful: ${results.successful}`);
  console.log(`   Failed: ${results.failed}`);
  console.log(`   Success rate: ${Math.round((results.successful / results.total) * 100)}%`);
  
  if (results.failed > 0) {
    console.log(`\n❌ Failed videos:`);
    results.details
      .filter(r => !r.success)
      .forEach(r => console.log(`   - ${r.videoId}: ${r.error}`));
  }
  
  return results;
}

// Main execution
async function main() {
  const options = parseArgs();
  
  if (!options.status && !options.ids) {
    error('Please specify either --status or --ids option');
    showHelp();
    process.exit(1);
  }
  
  let videos = [];
  
  try {
    if (options.status) {
      // Process videos by status
      videos = await getVideosByStatus(options.status, options.limit || 10);
    } else if (options.ids) {
      // Process specific video IDs
      const videoIds = await getVideoIds(options.ids);
      if (videoIds.length === 0) {
        error('No valid video IDs found');
        process.exit(1);
      }
      
      // Apply limit if specified
      const limitedIds = options.limit ? videoIds.slice(0, options.limit) : videoIds;
      videos = await getVideosByIds(limitedIds);
    }
    
    if (videos.length === 0) {
      warn('No videos to process');
      process.exit(0);
    }
    
    // Process the batch
    const results = await processBatch(videos, options);
    
    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0);
    
  } catch (error) {
    error(`Batch processing failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the batch processor
main().catch((error) => {
  error(`Unhandled error: ${error.message}`);
  process.exit(1);
}); 