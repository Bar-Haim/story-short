import { NextRequest, NextResponse } from 'next/server';
import { StorageService, sbServer } from '@/lib/supabase-server';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { renderKenBurnsClip } from '@/lib/render/kenburns';

// Ken Burns configuration
const ENABLE_KB = String(process.env.RENDER_ENABLE_KENBURNS || '').toLowerCase() === 'true';
const KB_MAX_ZOOM = Number(process.env.KENBURNS_MAX_ZOOM ?? 1.12);
const KB_MIN_SEC = Number(process.env.KENBURNS_MIN_SEC_PER_IMAGE ?? 1.6);
const KB_FPS = Number(process.env.KENBURNS_FPS ?? 30);

// Windows-safe path helpers
const toFFPath = (p: string) => p.replace(/\\/g, '/'); // forward slashes
const toFilterPath = (p: string) => toFFPath(p).replace(/:/g, '\\:').replace(/'/g, "\\'");
const lf = (s: string) => s.replace(/\r\n/g, '\n');

type VideoRow = {
  id: string;
  status: string;
  image_urls?: string[];
  audio_url?: string | null;
  captions_url?: string | null;
  final_video_url?: string | null;
  error_message?: string | null;
  script_text?: string | null;
  storyboard_json?: any;
};

function toErr(e: unknown): Error {
  return e instanceof Error ? e : new Error(typeof e === 'string' ? e : JSON.stringify(e));
}

async function ensureDir(p: string) {
  await fs.promises.mkdir(p, { recursive: true });
}

async function downloadToFile(url: string, destPath: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download_failed: ${url} (${res.status})`);
  const ab = await res.arrayBuffer();
  await fs.promises.writeFile(destPath, Buffer.from(ab));
  return destPath;
}

async function getAudioDurationSec(audioPath: string): Promise<number> {
  const { spawn } = await import('node:child_process');
  return await new Promise((resolve, reject) => {
    const p = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=nw=1:nk=1',
      audioPath,
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



async function runFFmpegWithLogs(args: string[], cwd?: string, logPrefix?: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'inherit', 'pipe'], cwd });
    let errBuf = '';
    p.stderr.on('data', (d) => { errBuf += d.toString(); });
    p.on('error', reject);
    p.on('close', async (code) => {
      if (code === 0) return resolve();
      
      // Write full stderr to temp log file for debugging
      let logFilePath = '';
      if (errBuf) {
        try {
          const tempDir = path.join(process.cwd(), 'renders', 'temp-logs');
          await ensureDir(tempDir);
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          logFilePath = path.join(tempDir, `ffmpeg-error-${timestamp}.log`);
          await fs.promises.writeFile(logFilePath, `FFmpeg args: ${JSON.stringify(args)}\n\nStderr:\n${errBuf}`, 'utf8');
        } catch (e) {
          console.warn('[runFFmpegWithLogs] Failed to write error log:', e);
        }
      }
      
      // Include full stderr and args in error message
      const msg = `ffmpeg exited with code ${code}${logPrefix ? ` (${logPrefix})` : ''} | args: ${JSON.stringify(args)}${errBuf ? ` | full stderr: ${errBuf}` : ''}${logFilePath ? ` | error log: ${logFilePath}` : ''}`;
      reject(new Error(msg));
    });
  });
}

async function writeImagesTxt(imagePaths: string[], imagesTxtPath: string, audioDuration: number) {
  // Create proper ffconcat file with durations that sum to audio length
  const imgs = imagePaths.length;
  const perImage = Math.max(KB_MIN_SEC, audioDuration / imgs); // minimum KB_MIN_SEC per image
  
  console.log(`[render] audio = ${audioDuration.toFixed(2)}s`);
  console.log(`[render] perImage = ${perImage.toFixed(3)}s (${imgs} images)`);
  
  const lines: string[] = ["ffconcat version 1.0"];
  for (let i = 0; i < imgs; i++) {
    // Use absolute paths with forward slashes for Windows compatibility
    const absPath = toFFPath(path.resolve(imagePaths[i]));
    lines.push(`file '${absPath}'`);
    lines.push(`duration ${perImage.toFixed(3)}`);
  }
  // ffmpeg requires the *last file repeated* so the final duration is respected
  const lastAbsPath = toFFPath(path.resolve(imagePaths[imgs - 1]));
  lines.push(`file '${lastAbsPath}'`);
  
  // Ensure LF endings and add final newline per concat spec
  const content = lf(lines.join('\n')).trim() + '\n';
  await fs.promises.writeFile(imagesTxtPath, content, 'utf8');
  
  console.log(`[render] images.txt written with ffconcat version 1.0 + durations + absolute paths`);
}

async function assertFilesExist(paths: string[]) {
  for (const p of paths) {
    await fs.promises.access(p, fs.constants.R_OK).catch(() => {
      throw new Error(`missing_input:${path.basename(p)}`);
    });
  }
}

// Safe update helper that doesn't break the pipeline if columns don't exist
async function safeUpdate(supabase: any, videoId: string, patch: Record<string, any>) {
  try {
    const { error } = await supabase.from('videos').update(patch).eq('id', videoId);
    if (error) console.warn('[safeUpdate] warning:', error.message || error);
  } catch (e: any) {
    console.warn('[safeUpdate] threw:', e?.message ?? e);
  }
}

// Robust render function with VTT→SRT conversion and proper Windows support
async function renderVideo(
  videoId: string,
  audioUrl: string,
  captionsUrl: string,
  imageUrls: string[]
): Promise<{ duration: number; filePath: string }> {
  console.log('🎬 Starting robust video rendering...');
  
  // Progress update helper
  const updateProgress = async (progress: number) => {
    try {
      const supabase = sbServer();
      await safeUpdate(supabase, videoId, { progress });
    } catch (e) {
      console.warn('[progress] Failed to update:', e);
    }
  };
  
  // Prepare directories
  const renderDir = path.join(process.cwd(), 'renders', videoId);
  const tempDir = path.join(renderDir, 'temp');
  await ensureDir(tempDir);
  
  try {
    // 1) Download images → local numbered files
    console.log('📥 Downloading images...');
    await updateProgress(20);
    const localImages: string[] = [];
    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];
      // Allow png/jpg; default to .jpg
      const ext = url.toLowerCase().includes('.png') ? '.png' : '.jpg';
      const filePath = path.join(tempDir, `scene-${String(i + 1).padStart(2, '0')}${ext}`);
      await downloadToFile(url, filePath);
      localImages.push(filePath);
    }

    // 2) Download audio
    console.log('📥 Downloading audio...');
    await updateProgress(30);
    const audioPath = path.join(tempDir, 'audio.mp3');
    await downloadToFile(audioUrl, audioPath);

    // 3) Download captions (VTT or SRT)
    console.log('📥 Downloading captions...');
    await updateProgress(40);
    const isVtt = captionsUrl.toLowerCase().endsWith('.vtt');
    const vttPath = path.join(tempDir, 'captions.vtt');
    const srtPath = path.join(tempDir, 'captions.srt');

    if (isVtt) {
      await downloadToFile(captionsUrl, vttPath);
      // Convert VTT → SRT for libass
      console.log('🔄 Converting VTT → SRT...');
      await updateProgress(45);
      await runFFmpegWithLogs(['-y', '-i', vttPath, srtPath]);
    } else {
      // Already SRT
      await downloadToFile(captionsUrl, srtPath);
    }

    // 4) Build images.txt for concat
    console.log('📝 Creating images.txt...');
    await updateProgress(50);
    const imagesTxt = path.join(tempDir, 'images.txt');
    const audioDuration = await getAudioDurationSec(audioPath);
    await writeImagesTxt(localImages, imagesTxt, audioDuration);

    // 5) Harden input validation
    await assertFilesExist([audioPath, srtPath, imagesTxt, ...localImages]);
    
    // Ensure images.txt has trailing newline
    const txt = await fs.promises.readFile(imagesTxt, 'utf8');
    if (!txt.endsWith('\n')) await fs.promises.writeFile(imagesTxt, txt + '\n', 'utf8');

    // 6) DETAILED LOGGING (temp debugging)
    console.log('[render] imagesTxt =', imagesTxt);
    console.log('[render] audioPath =', audioPath);
    console.log('[render] srtPath   =', srtPath);
    const outputPath = path.join(tempDir, 'output.mp4');
    console.log('[render] output    =', outputPath);
    
    const imagesTxtPreview = await fs.promises.readFile(imagesTxt, 'utf8');
    console.log('[render] images.txt content:\n', imagesTxtPreview.split('\n').slice(0,10).join('\n'));

    // 7) Ken Burns motion processing (optional)
    const videoFromImagesPath = path.join(tempDir, 'slideshow.mp4');
    let useKenBurns = ENABLE_KB;
    
    if (useKenBurns) {
      try {
        console.log('🎬 Rendering Ken Burns motion clips...');
        await updateProgress(65);
        
        // 7a) Render per-image motion clips
        const clipPaths: string[] = [];
        const perImageSec = Math.max(KB_MIN_SEC, audioDuration / localImages.length);
        for (let i = 0; i < localImages.length; i++) {
          const img = localImages[i];
          const clip = path.join(tempDir, `kb-${String(i+1).padStart(2,'0')}.mp4`);
          const dir: ('in'|'out'|'panL'|'panR')[] = ['in','out','panL','panR'];
          const direction = dir[i % dir.length];
          
          console.log(`[kenburns] Rendering scene ${i+1}/${localImages.length} with ${direction} motion...`);
          await renderKenBurnsClip({
            imagePath: img,
            outPath: clip,
            width: 1080,
            height: 1920,
            fps: KB_FPS,
            seconds: perImageSec,
            maxZoom: KB_MAX_ZOOM,
            direction
          });
          clipPaths.push(clip);
        }

        // 7b) Concat the motion clips into one video (demuxer)
        console.log('🎬 Concatenating motion clips...');
        await updateProgress(70);
        const concatList = path.join(tempDir, 'kb-list.txt');
        await fs.promises.writeFile(
          concatList,
          clipPaths.map(p => `file '${toFFPath(p)}'`).join('\n') + '\n',
          'utf8'
        );

        // concat → slideshow.mp4 (no audio yet)
        await runFFmpegWithLogs([
          '-y',
          '-f','concat','-safe','0',
          '-i', toFFPath(concatList),
          '-c','copy',
          toFFPath(videoFromImagesPath)
        ], undefined, 'kenburns-concat');
        
        console.log('✅ Ken Burns motion clips rendered successfully');

      } catch (e) {
        console.warn('[kenburns] falling back to static images due to error:', e);
        // FALLBACK to existing static path
        useKenBurns = false;
      }
    }

    if (!useKenBurns) {
      // Static images flow - build slideshow.mp4 using existing concat demuxer
      console.log('🎬 Using static images (no motion)...');
      await updateProgress(65);
      await runFFmpegWithLogs([
        '-y',
        '-f','concat','-safe','0',
        '-i', toFFPath(imagesTxt),
        '-c:v','libx264','-preset','fast','-crf','23',
        toFFPath(videoFromImagesPath)
      ], undefined, 'static-images');
    }

    // 8) Run FFmpeg with enhanced args + logging
    console.log('🎬 Running FFmpeg with enhanced Windows support...');
    await updateProgress(75);
    
    // Build subtitles filter with proper Windows path escaping
    const srt = toFilterPath(srtPath); // absolute path with proper escaping
    const fontsDir = 'C\\:/Windows/Fonts'; // Windows fonts directory
    const subtitlesStyle = "FontSize=20," + // Reduced from 16 for better proportion
      "Outline=1," + // Thinner outline for cleaner look
      "Shadow=0," +
      "BorderStyle=1," + // No opaque box - transparent background
      "BackColour=&H00000000," + // Fully transparent background
      "PrimaryColour=&H00FFFFFF," + // White text
      "Alignment=2," + // Bottom-center alignment (will alternate per scene)
      "MarginV=80," + // Increased distance from bottom for mobile safety
      "MarginL=20," + // Left margin for mobile safety
      "MarginR=20," + // Right margin for mobile safety
      "WrapStyle=2"; // Smart wrapping for better line breaks
    
    const vf = `subtitles='${srt}':fontsdir='${fontsDir}':force_style='${subtitlesStyle}'`;

    // Build ffmpeg args array with proper Windows path handling
    const args = [
      '-y',
      '-nostdin', // prevents blocking in some shells
      '-i', toFFPath(videoFromImagesPath), // Use the slideshow video (motion or static)
      '-i', toFFPath(audioPath),
      '-vf', vf,
      '-c:v','libx264','-profile:v','high','-preset','medium','-crf','23',
      '-c:a','aac','-b:a','192k',
      '-shortest',
      '-movflags','+faststart',
      toFFPath(outputPath)
    ];

    // Add debug reporting if enabled
    if (process.env.DEBUG_FFMPEG === '1') {
      args.unshift('-report');
    }

    console.log('🔧 Enhanced FFmpeg args:', args);
    console.log('🔧 Video filter string:', vf);
    await runFFmpegWithLogs(args, undefined, 'final-render');

    // Verify output exists
    await fs.promises.access(outputPath, fs.constants.R_OK);
    
    // Get final video duration using spawn for consistency
    const durationArgs = ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', outputPath];
    const duration = await new Promise<number>((resolve, reject) => {
      const proc = spawn('ffprobe', durationArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      
      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });
      
      proc.on('close', (code) => {
        if (code === 0) {
          const dur = parseFloat(stdout.trim());
          resolve(isNaN(dur) ? 0 : dur);
        } else {
          reject(new Error(`ffprobe failed: ${stderr}`));
        }
      });
      
      proc.on('error', reject);
    });
    
    console.log(`✅ Video rendered successfully: ${duration}s`);
    await updateProgress(80);
    
    return {
      duration,
      filePath: outputPath
    };
    
  } catch (error) {
    console.error('❌ Video rendering failed:', error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  let videoId: string | undefined;
  try {
    const body = await req.json();
    videoId = body?.videoId;
    if (!videoId) return NextResponse.json({ ok: false, error: 'missing_videoId' }, { status: 400 });

    const supabase = sbServer();
    const { data: v, error: fetchError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .maybeSingle();
      
    if (fetchError || !v) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    }

    const video = v as VideoRow;

    // Strict gating: only render if assets are fully generated
    const imgs = Array.isArray(video.image_urls) ? video.image_urls : [];
    const ready = video.status === 'assets_generated' && imgs.length > 0 && !!video.audio_url && !!video.captions_url;
    if (!ready) {
      return NextResponse.json({ ok: false, error: 'assets_not_ready' }, { status: 409 });
    }

    // Move to rendering with progress
    await safeUpdate(supabase, videoId, { status: 'rendering', progress: 10, error_message: null });

    // Render the video
    const renderResult = await renderVideo(
      videoId,
      video.audio_url!,
      video.captions_url!,
      imgs
    );

    // Upload the rendered video
    console.log('📤 Uploading rendered video...');
    const videoBuffer = await fs.promises.readFile(renderResult.filePath);
    
    // Use the correct videos bucket with finals path as requested
    const uploadPath = `finals/${videoId}.mp4`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('videos')
      .upload(uploadPath, videoBuffer, {
        contentType: 'video/mp4',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Failed to upload rendered video: ${uploadError.message}`);
    }

    // Get the public URL for the uploaded video
    const { data: urlData } = supabase.storage
      .from('videos')
      .getPublicUrl(uploadPath);
    
    const publicUrl = urlData.publicUrl;
    if (!publicUrl) {
      throw new Error('Failed to generate public URL for uploaded video');
    }

    // Update database with final video URL and duration (save as integer seconds)
    const durationSeconds = Math.max(1, Math.round(renderResult.duration));
    
    // Store the clean public URL (without download parameter)
    // The download parameter will be handled by the download API endpoint
    await safeUpdate(supabase, videoId, { 
      status: 'completed', 
      final_video_url: publicUrl,
      total_duration: durationSeconds, // Save as integer seconds
      progress: 100,
      error_message: null 
    });

    return NextResponse.json({ ok: true, status: 'completed', final_video_url: publicUrl });
  } catch (e) {
    const err = toErr(e);
    if (videoId) {
      const supabase = sbServer();
      await safeUpdate(supabase, videoId, { status: 'render_failed', error_message: err.message.slice(0, 900) });
    }
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
} 