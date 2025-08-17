# FFmpeg Rendering & Next.js Fixes

## Problem Summary

### Fix 1: FFmpeg Rendering Issue
- **Problem**: Videos were rendering in ~1 second because FFmpeg treated each still image as a single video frame
- **Root Cause**: Without explicit durations, the concat demuxer assumed one frame per image
- **Impact**: `-shortest` flag cut audio to match the tiny video stream, resulting in barely audible voiceover

### Fix 2: Next.js clientReferenceManifest Error
- **Problem**: "Invariant: Expected clientReferenceManifest to be defined" during development
- **Root Cause**: Transient dev-server compilation issues when navigating during server compilation
- **Impact**: 500 errors and broken user experience

## Solutions Implemented

### Fix 1: Proper Image Duration Handling

#### 1.1 Added Audio Duration Detection
```typescript
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
```

#### 1.2 Updated Images.txt Generation
```typescript
async function writeImagesTxt(imagePaths: string[], imagesTxtPath: string, audioDuration: number) {
  const imgs = imagePaths.length;
  const perImage = Math.max(1.5, audioDuration / imgs); // minimum 1.5s per image
  
  console.log(`[render] audio = ${audioDuration.toFixed(2)}s`);
  console.log(`[render] perImage = ${perImage.toFixed(3)}s (${imgs} images)`);
  
  const lines: string[] = ["ffconcat version 1.0"];
  for (let i = 0; i < imgs; i++) {
    lines.push(`file '${imagePaths[i].replace(/'/g, "'\\''")}'`);
    lines.push(`duration ${perImage.toFixed(3)}`);
  }
  // ffmpeg requires the *last file repeated* so the final duration is respected
  lines.push(`file '${imagePaths[imgs - 1].replace(/'/g, "'\\''")}'`);
  
  const content = lines.join('\n');
  await fs.promises.writeFile(imagesTxtPath, content, 'utf8');
}
```

#### 1.3 Removed -shortest Flag
- Removed `-shortest` from FFmpeg arguments since we now control durations explicitly
- Video duration now matches audio duration naturally

#### 1.4 Enhanced Logging
Added detailed logging to track:
- Audio duration detection
- Per-image duration calculation
- FFmpeg arguments and execution

### Fix 2: Robust JSON Parsing & Error Handling

#### 2.1 Protected Polling Logic
```typescript
async function pollUntilCompleted(videoId: string, timeoutMs = 180000, intervalMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`/api/video-status?id=${videoId}`, { cache: 'no-store' });
      if (!res.ok) {
        console.warn(`[poll] HTTP ${res.status}, retrying in ${intervalMs}ms`);
        await new Promise(r => setTimeout(r, intervalMs));
        continue;
      }
      
      const json = await res.json();
      const st = json?.data?.status;
      if (st === 'completed' && json?.data?.final_video_url) return json.data.final_video_url as string;
      if (st?.includes('failed')) throw new Error(json?.data?.error_message || 'render_failed');
    } catch (e) {
      console.warn(`[poll] JSON parse error, retrying in ${intervalMs}ms:`, e);
      // Continue polling on JSON errors
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error('timeout_waiting_for_completed');
}
```

#### 2.2 Protected Error Response Parsing
```typescript
if (!res.ok) {
  let err = {};
  try {
    err = await res.json();
  } catch (parseError) {
    console.warn('[finalize] Failed to parse error response:', parseError);
  }
  throw new Error(err?.error || `render_start_failed:${res.status}`);
}
```

### Fix 3: Development Server Management

#### 3.1 Clean & Restart Scripts
Created batch and PowerShell scripts to clean `.next` directory and restart dev server:

**Windows Batch (clean-and-restart.bat):**
```batch
@echo off
echo Cleaning .next directory...
if exist .next rmdir /s /q .next
echo Starting dev server...
npm run dev
```

**PowerShell (clean-and-restart.ps1):**
```powershell
Write-Host "Cleaning .next directory..." -ForegroundColor Yellow
if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next"
    Write-Host ".next directory removed" -ForegroundColor Green
} else {
    Write-Host ".next directory not found" -ForegroundColor Gray
}

Write-Host "Starting dev server..." -ForegroundColor Yellow
npm run dev
```

## Testing the Fixes

### 1. Test Video Rendering
1. Create a new video with script and images
2. Wait for assets to generate
3. Click "Finalize" to start rendering
4. **Expected Result**: Video duration ≈ audio duration, voiceover audible throughout

### 2. Check Console Logs
Look for these log messages during rendering:
```
[render] audio = 27.66s
[render] perImage = 4.61s (6 images)
[render] images.txt written with ffconcat version 1.0 + durations
```

### 3. Verify Images.txt Content
Check the generated `images.txt` file in `renders/[id]/temp/`:
```
ffconcat version 1.0
file 'scene-01.jpg'
duration 4.610
file 'scene-02.jpg'
duration 4.610
...
file 'scene-06.jpg'
duration 4.610
file 'scene-06.jpg'
```

### 4. Test Finalize Page
1. Navigate to `/finalize/[id]`
2. Click "View Video"
3. **Expected Result**: Page loads without 500 errors

### 5. Handle Development Issues
If you encounter `clientReferenceManifest` errors:
1. Run `clean-and-restart.bat` or `clean-and-restart.ps1`
2. Wait for server to fully compile
3. Refresh the page

## Technical Details

### FFmpeg Concat Demuxer
- Uses `ffconcat version 1.0` format
- Each image gets explicit duration
- Last image is repeated to ensure final duration is respected
- Video output matches audio duration naturally

### Error Handling Strategy
- HTTP status checks before JSON parsing
- Try-catch around all JSON.parse() calls
- Graceful fallbacks for malformed responses
- Retry logic for transient failures

### Performance Improvements
- Audio duration detected once with ffprobe
- Per-image duration calculated mathematically
- Minimum 1.5s per image for better user experience
- Proper logging for debugging

## Files Modified

1. **`src/app/api/render/route.ts`**
   - Added `getAudioDurationSec()` function
   - Updated `writeImagesTxt()` for proper ffconcat format
   - Removed `-shortest` flag
   - Enhanced logging

2. **`src/app/wait/[id]/page.tsx`**
   - Protected JSON parsing in polling logic
   - Added error handling for malformed responses

3. **`clean-and-restart.bat`** (new)
   - Windows batch script for cleaning .next

4. **`clean-and-restart.ps1`** (new)
   - PowerShell script for cleaning .next

## Expected Outcomes

- ✅ Video duration matches audio duration
- ✅ Voiceover plays completely through the video
- ✅ No more 1-second video clips
- ✅ Robust error handling during development
- ✅ Graceful recovery from JSON parsing errors
- ✅ Better debugging information in console logs

## Next Steps

1. Test the fixes with a new video generation
2. Monitor console logs for the new duration information
3. Verify video playback duration matches expectations
4. Use clean-and-restart scripts if development issues persist
5. Consider upgrading to Next.js 15.4.x if issues continue 