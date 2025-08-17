# 🎬 StoryShort Video Processing Pipeline

## Overview

This document describes the bulletproof video processing system that provides a single entry point for processing videos from start to finish. The system automatically generates missing assets, validates everything, and renders the final video.

## 🚀 Quick Start

### Process a Single Video
```bash
npm run process:one <videoId>
```

### Test the System
```bash
npm run test:process
```

## 📁 New Files

### 1. `scripts/process-video.cjs`
**Main entry point** for video processing. This script:
- Loads environment variables and initializes Supabase
- Fetches video by ID
- Generates missing assets (audio, captions, images)
- Validates all assets are present
- Renders the final video
- Updates database with results

**Usage:**
```bash
node scripts/process-video.cjs <videoId>
```

### 2. `scripts/generate-assets-for-video.ts`
**Asset generation helper** that provides:
- `ensureAudio(video)`: Generates TTS audio using ElevenLabs
- `ensureCaptions(video)`: Creates SRT captions from script
- `ensureImages(video)`: Generates images for each scene with fallback
- `ensureAllAssets(video)`: Runs all asset generation in parallel

**Features:**
- Retry logic with exponential backoff
- Fallback to placeholder images if generation fails
- Automatic upload to Supabase Storage
- Database updates after each asset

## 🔄 Processing Flow

### Step 1: Initialization
- Load `.env.local` environment variables
- Initialize Supabase client with service role
- Validate required environment variables

### Step 2: Fetch Video
- Retrieve video record by ID
- Validate video exists
- Check current status

### Step 3: Asset Generation
**Only runs if status is: `['failed', 'script_generated', 'assets_missing']`**

1. **Script Validation**
   - Ensure `script` or `input_text` exists
   - Fail with clear message if missing

2. **Audio Generation**
   - Generate TTS using ElevenLabs API
   - Upload to Supabase Storage
   - Update `audio_url` in database

3. **Caption Generation**
   - Create SRT captions from script
   - Upload to Supabase Storage
   - Update `captions_url` in database

4. **Image Generation**
   - Generate images for each scene using OpenAI DALL-E
   - Fallback to placeholder if generation fails
   - Upload to Supabase Storage
   - Update `storyboard_json` with image URLs

5. **Status Update**
   - Set status to `'assets_generated'`

### Step 4: Validation
- Run `test-render-pipeline.js` to validate all assets
- Check audio_url, captions_url, and storyboard scenes
- Fail with clear error message if validation fails

### Step 5: Rendering
- Run `render-validated.cjs` to create final video
- Update status to `'completed'` on success
- Update status to `'failed'` with error message on failure

## 🛠️ Environment Requirements

### Required Environment Variables
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# APIs
ELEVENLABS_API_KEY=your_elevenlabs_key
OPENAI_API_KEY=your_openai_key
OPENROUTER_API_KEY=your_openrouter_key
```

### Supabase Storage Buckets
Ensure these buckets exist:
- `audio` - for TTS audio files
- `captions` - for SRT caption files  
- `images` - for generated images
- `videos` - for final rendered videos

## 📊 Video Status Flow

```
script_generated → assets_generated → completed
     ↓                    ↓              ↓
   failed ←─────────── failed ←─────── failed
```

## 🧪 Testing

### Test Commands

1. **Test with specific video:**
   ```bash
   npm run test:process <videoId>
   ```

2. **Test with auto-created video:**
   ```bash
   npm run test:process
   ```

3. **Test standalone rendering:**
   ```bash
   node scripts/render-validated.cjs <videoId>
   ```

4. **Test validation only:**
   ```bash
   node scripts/test-render-pipeline.js <videoId>
   ```

### Test Coverage
- ✅ Environment validation
- ✅ Supabase connection
- ✅ Asset generation (audio, captions, images)
- ✅ Database updates
- ✅ Validation pipeline
- ✅ Rendering pipeline
- ✅ Error handling and status updates

## 🔧 Error Handling

### Exit Codes
- `0`: Success
- `1`: Error (with detailed message)

### Error Types
1. **Missing Environment Variables**
   - Clear message about which variables are missing

2. **Video Not Found**
   - Validates video ID exists in database

3. **Asset Generation Failures**
   - Retry logic with exponential backoff
   - Fallback mechanisms for images
   - Clear error messages for debugging

4. **Validation Failures**
   - Detailed output from test-render-pipeline.js
   - Specific asset validation errors

5. **Rendering Failures**
   - Full output from render-validated.cjs
   - FFmpeg error details

## 🎯 Acceptance Criteria

### ✅ Given a new video with status 'script_generated':
Running `npm run process:one <videoId>` should:

1. **Generate missing assets**
   - Create TTS audio if missing
   - Generate SRT captions if missing
   - Create images for each scene if missing

2. **Update status to 'assets_generated'**
   - After all assets are successfully created

3. **Validate everything**
   - Confirm all required assets exist
   - Run full validation pipeline

4. **Render final video**
   - Execute rendering pipeline
   - Upload final video to storage

5. **Update status to 'completed'**
   - Set final_video_url and total_duration
   - Clear any error messages

### ✅ Error Handling
- If any step fails → status = 'failed' with clear error_message
- Re-running the command is idempotent (skips existing assets)
- No manual steps or alerts required

### ✅ UI/UX Fixes
- "Start Creating Video" button routes to `/create` instead of showing alert
- Server routes return JSON errors only (no window.alert)
- Frontend shows toast/snackbar for user feedback

## 🔄 Idempotency

The system is designed to be idempotent:
- **Existing assets are skipped** - only missing assets are generated
- **Database updates are safe** - no duplicate entries
- **Status tracking** - prevents duplicate processing
- **Error recovery** - can restart from any point

## 📈 Performance

### Asset Generation Times
- **Audio**: ~10-30 seconds (depending on script length)
- **Captions**: ~1-2 seconds (instant generation)
- **Images**: ~10-20 seconds per scene (with retry logic)
- **Rendering**: ~30-60 seconds (depending on video length)

### Parallel Processing
- Audio, captions, and images are generated in parallel
- Each asset type has independent retry logic
- Failed assets don't block other asset generation

## 🚨 Troubleshooting

### Common Issues

1. **Missing API Keys**
   ```bash
   # Check environment variables
   npm run test:process
   ```

2. **Supabase Connection Issues**
   ```bash
   # Verify Supabase setup
   node scripts/test-render-pipeline.js
   ```

3. **Asset Generation Failures**
   ```bash
   # Check API quotas and keys
   npm run test:apis
   ```

4. **Rendering Failures**
   ```bash
   # Verify FFmpeg installation
   ffmpeg -version
   ```

### Debug Mode
Add `DEBUG=true` to environment for verbose logging:
```bash
DEBUG=true npm run process:one <videoId>
```

## 🔮 Future Enhancements

### Planned Features
- [ ] Batch processing multiple videos
- [ ] Progress callbacks for UI integration
- [ ] Custom voice selection per video
- [ ] Advanced image generation prompts
- [ ] Video quality settings
- [ ] Background job processing

### Integration Points
- [ ] Webhook notifications on completion
- [ ] Email notifications for failed jobs
- [ ] Dashboard for monitoring job status
- [ ] API endpoints for programmatic access

---

## 📝 Usage Examples

### Basic Usage
```bash
# Process a specific video
npm run process:one abc123-def456-ghi789

# Test the system
npm run test:process

# Find available videos
npm run find:videos
```

### Advanced Usage
```bash
# Process with debug output
DEBUG=true npm run process:one <videoId>

# Test validation only
node scripts/test-render-pipeline.js <videoId>

# Test rendering only
node scripts/render-validated.cjs <videoId>
```

This system provides a robust, bulletproof solution for video processing with comprehensive error handling, retry logic, and clear status tracking. 