# StoryShort Video Rendering Pipeline

A comprehensive end-to-end video rendering script that processes single video jobs from Supabase with cinematic effects and burned-in subtitles.

## 🚀 Features

- **Complete Pipeline**: Downloads assets, creates temporary directories, renders with FFmpeg, and uploads to Supabase
- **Cinematic Effects**: Dynamic zoom, pan, camera shake, color grading, and vignette effects
- **Subtitle Burning**: Automatically burns captions into the video with professional styling
- **Error Handling**: Comprehensive error handling with status updates in database
- **Temporary Cleanup**: Automatic cleanup of temporary files after processing
- **Progress Logging**: Detailed colored logging for monitoring progress

## 📋 Prerequisites

### 1. Environment Setup
Ensure your `.env.local` file contains:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 2. FFmpeg Installation
FFmpeg must be installed and accessible in your system PATH.

**Windows:**
```bash
# Download from https://ffmpeg.org/download.html
# Add to PATH or install via chocolatey:
choco install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt update
sudo apt install ffmpeg
```

### 3. Node.js Dependencies
```bash
npm install
```

## 🎬 Usage

### Basic Usage
```bash
# Using npm script
npm run render:job <videoId>

# Direct execution
node scripts/render-job.js <videoId>
```

### Example
```bash
npm run render:job 123e4567-e89b-12d3-a456-426614174000
```

## 📊 Video Requirements

The script expects a video record in Supabase with the following fields:

### Required Fields
- `id`: UUID of the video
- `audio_url`: URL to the audio file (MP3)
- `storyboard_json.scenes`: Array of scenes with image URLs and durations

### Optional Fields
- `captions_url`: URL to captions file (VTT or SRT)
- `input_text`: Original input text (for logging)

### Example Video Record Structure
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "status": "assets_generated",
  "audio_url": "https://example.com/audio.mp3",
  "captions_url": "https://example.com/captions.vtt",
  "storyboard_json": {
    "scenes": [
      {
        "image_url": "https://example.com/scene1.png",
        "duration": 3
      },
      {
        "image_url": "https://example.com/scene2.png",
        "duration": 4
      }
    ]
  }
}
```

## 🔄 Pipeline Steps

1. **Fetch Video Data**: Retrieves video record from Supabase
2. **Update Status**: Sets status to 'rendering'
3. **Create Temp Directory**: Creates temporary working directory
4. **Download Audio**: Downloads audio file to `audio/audio.mp3`
5. **Download Captions**: Downloads and converts captions to SRT format
6. **Download Images**: Downloads all images from storyboard scenes
7. **Generate Images.txt**: Creates FFmpeg concat file with durations
8. **Build FFmpeg Command**: Constructs command with cinematic effects
9. **Execute FFmpeg**: Runs rendering with 5-minute timeout
10. **Upload to Supabase**: Uploads final video to `videos` bucket
11. **Update Database**: Sets status to 'completed' with final URL
12. **Cleanup**: Removes temporary files

## 🎨 Cinematic Effects

The script applies several cinematic effects to make static images feel dynamic:

### Motion Effects
- **Dynamic Zoom**: Gradual zoom with subtle oscillation
- **Smooth Panning**: Horizontal and vertical movement with sine/cosine curves
- **Camera Shake**: Subtle handheld camera effect
- **Parallax Movement**: Multi-frequency motion for depth

### Visual Effects
- **Color Grading**: Enhanced contrast and saturation
- **Vignette**: Subtle darkening around edges
- **Film Grain**: Light noise for cinematic texture

### Subtitle Styling
- **Font**: Arial, 28px, bold
- **Colors**: White text with black outline
- **Position**: Bottom margin with shadow
- **Background**: Semi-transparent black

## 📁 File Structure

```
Temporary Directory (auto-created):
├── audio/
│   └── audio.mp3
├── captions/
│   └── subtitles.srt
├── images/
│   ├── scene_1.png
│   ├── scene_2.png
│   └── ...
├── images.txt
└── final_video.mp4
```

## 🎯 Output

### Success Output
```
🎉 RENDERING COMPLETED SUCCESSFULLY! 🎉
==================================================
Video ID: 123e4567-e89b-12d3-a456-426614174000
Final URL: https://example.com/video.mp4
Duration: 15 seconds
Scenes: 5
File Size: 25 MB
Supabase Path: finals/123e4567-e89b-12d3-a456-426614174000.mp4
==================================================
```

### Database Updates
- `status`: 'completed'
- `final_video_url`: Public URL to the video
- `total_duration`: Video duration in seconds

## ❌ Error Handling

### Common Errors

1. **Video Not Found**
   ```
   ❌ ERROR Video not found: No data returned
   ```

2. **Missing Assets**
   ```
   ❌ ERROR Video missing audio URL
   ❌ ERROR Video missing storyboard data
   ```

3. **FFmpeg Not Found**
   ```
   ❌ ERROR FFmpeg is not installed or not in PATH
   ```

4. **Download Failures**
   ```
   ❌ ERROR Failed to download audio: 404 Not Found
   ```

### Error Recovery
- Script automatically updates video status to 'failed'
- Error message is stored in `error_message` field
- Temporary files are cleaned up
- Exit code 1 indicates failure

## 🔧 Troubleshooting

### FFmpeg Issues
```bash
# Test FFmpeg installation
ffmpeg -version

# Check if FFmpeg is in PATH
where ffmpeg  # Windows
which ffmpeg  # macOS/Linux
```

### Environment Issues
```bash
# Check environment variables
echo $NEXT_PUBLIC_SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY

# Test Supabase connection
node -e "
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log('Supabase client created successfully');
"
```

### Permission Issues
```bash
# Check write permissions in temp directory
node -e "console.log(require('os').tmpdir())"
```

## 📈 Performance

### Typical Processing Times
- **Short video (30s)**: 1-2 minutes
- **Medium video (60s)**: 2-3 minutes
- **Long video (120s)**: 4-5 minutes

### Resource Usage
- **CPU**: High during FFmpeg processing
- **Memory**: Moderate (depends on video length)
- **Disk**: Temporary files (cleaned up automatically)
- **Network**: Download assets + upload final video

## 🔒 Security

- Uses service role key for database access
- Temporary files are automatically cleaned up
- No sensitive data is logged
- Input validation for video ID format

## 🚀 Integration

### Trigger from Application
```javascript
// Example: Trigger rendering from your app
const { exec } = require('child_process');

function triggerRendering(videoId) {
  exec(`node scripts/render-job.js ${videoId}`, (error, stdout, stderr) => {
    if (error) {
      console.error('Rendering failed:', error);
      return;
    }
    console.log('Rendering completed:', stdout);
  });
}
```

### Batch Processing
```bash
# Process multiple videos
for videoId in $(cat video-ids.txt); do
  npm run render:job $videoId
  sleep 10  # Wait between jobs
done
```

## 📝 Logging

The script provides detailed colored logging:

- `[🎬 RENDER]`: Main pipeline steps
- `[✅ SUCCESS]`: Successful operations
- `[❌ ERROR]`: Errors and failures
- `[⚠️ WARN]`: Warnings and non-critical issues
- `[ℹ️ INFO]`: Informational messages

## 🤝 Contributing

When modifying the script:

1. Test with a small video first
2. Ensure FFmpeg command compatibility
3. Update error handling for new scenarios
4. Maintain backward compatibility
5. Update this README for new features

## 📄 License

This script is part of the StoryShort project and follows the same license terms. 