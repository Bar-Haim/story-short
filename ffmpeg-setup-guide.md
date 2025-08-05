# 🎬 FFmpeg Setup Guide for Video Rendering

## Overview
This guide will help you set up FFmpeg to render final videos with burned-in subtitles for the StoryShort application.

## 🚀 Quick Setup

### Windows
1. **Download FFmpeg**:
   - Go to https://ffmpeg.org/download.html
   - Click "Windows Builds" → "Windows builds from gyan.dev"
   - Download the latest release (ffmpeg-git-full.7z)

2. **Install FFmpeg**:
   - Extract the downloaded file
   - Copy the `ffmpeg.exe` file to `C:\ffmpeg\bin\`
   - Add `C:\ffmpeg\bin\` to your system PATH

3. **Verify Installation**:
   ```cmd
   ffmpeg -version
   ```

### macOS
```bash
# Using Homebrew
brew install ffmpeg

# Verify installation
ffmpeg -version
```

### Linux (Ubuntu/Debian)
```bash
# Install FFmpeg
sudo apt update
sudo apt install ffmpeg

# Verify installation
ffmpeg -version
```

## 🔧 Configuration

### Environment Variables
Add FFmpeg to your system PATH:

**Windows**:
1. Open System Properties → Advanced → Environment Variables
2. Edit the "Path" variable
3. Add `C:\ffmpeg\bin\`
4. Restart your terminal

**macOS/Linux**:
```bash
# Add to ~/.bashrc or ~/.zshrc
export PATH="/usr/local/bin:$PATH"
```

### Verify FFmpeg is Accessible
```bash
# Test FFmpeg command
ffmpeg -version

# Test subtitle support
ffmpeg -filters | grep subtitle
```

## 🎬 Video Rendering Features

### What FFmpeg Does in StoryShort:
1. **Image Concatenation**: Combines multiple images into a video sequence
2. **Audio Sync**: Synchronizes audio with the image sequence
3. **Subtitle Burning**: Permanently embeds VTT captions into the video
4. **Quality Optimization**: Uses H.264 codec with optimal settings
5. **Mobile Optimization**: Creates vertical (9:16) videos for mobile platforms

### FFmpeg Command Breakdown:
```bash
ffmpeg -y \
  -f concat -safe 0 -i "images.txt" \
  -i "audio.mp3" \
  -vf "subtitles='captions.vtt':force_style='FontSize=24,PrimaryColour=&Hffffff,OutlineColour=&H000000,BackColour=&H80000000,Bold=1,Shadow=1'" \
  -c:v libx264 -preset fast -crf 23 \
  -c:a aac -b:a 128k \
  -shortest \
  "final_video.mp4"
```

**Parameters Explained**:
- `-y`: Overwrite output file without asking
- `-f concat`: Use concatenation demuxer for image sequence
- `-safe 0`: Allow absolute paths in concat file
- `-i "images.txt"`: Input file list for images
- `-i "audio.mp3"`: Audio input file
- `-vf "subtitles=..."`: Video filter for subtitle burning
- `-c:v libx264`: Use H.264 video codec
- `-preset fast`: Encoding speed preset
- `-crf 23`: Constant Rate Factor for quality (18-28 is good)
- `-c:a aac`: Use AAC audio codec
- `-b:a 128k`: Audio bitrate
- `-shortest`: End when shortest input ends
- `"final_video.mp4"`: Output file

## 🎨 Subtitle Styling

### Current Style Settings:
- **Font Size**: 24px
- **Primary Color**: White (#ffffff)
- **Outline Color**: Black (#000000)
- **Background**: Semi-transparent black
- **Bold**: Enabled
- **Shadow**: Enabled

### Customize Subtitle Style:
You can modify the subtitle style in `/src/app/api/render-video/route.ts`:

```typescript
// Example: Larger, more visible subtitles
ffmpegCommand += ` -vf "subtitles='${captionsPath}':force_style='FontSize=32,PrimaryColour=&Hffffff,OutlineColour=&H000000,BackColour=&H80000000,Bold=1,Shadow=2,Outline=2'"`;

// Example: Different colors
ffmpegCommand += ` -vf "subtitles='${captionsPath}':force_style='FontSize=28,PrimaryColour=&Hffff00,OutlineColour=&H000000,BackColour=&H80000000,Bold=1,Shadow=1'"`;
```

## 🧪 Testing FFmpeg

### Test Basic Functionality:
```bash
# Create a test video
ffmpeg -f lavfi -i testsrc=duration=5:size=1080x1920:rate=1 -c:v libx264 test_video.mp4

# Add test audio
ffmpeg -f lavfi -i "sine=frequency=1000:duration=5" test_audio.mp3

# Combine video and audio
ffmpeg -i test_video.mp4 -i test_audio.mp3 -c:v copy -c:a aac -shortest test_final.mp4
```

### Test Subtitle Burning:
```bash
# Create test VTT file
echo "WEBVTT

00:00:01.000 --> 00:00:03.000
Test subtitle

00:00:03.000 --> 00:00:05.000
Another test subtitle" > test.vtt

# Burn subtitles into video
ffmpeg -i test_video.mp4 -vf "subtitles=test.vtt:force_style='FontSize=24,PrimaryColour=&Hffffff,OutlineColour=&H000000,BackColour=&H80000000,Bold=1,Shadow=1'" test_with_subs.mp4
```

## 🚨 Troubleshooting

### Common Issues:

1. **FFmpeg not found**:
   ```bash
   # Check if FFmpeg is in PATH
   which ffmpeg
   
   # If not found, add to PATH or use full path
   /usr/local/bin/ffmpeg -version
   ```

2. **Subtitle burning fails**:
   ```bash
   # Check if subtitle filter is available
   ffmpeg -filters | grep subtitle
   
   # Test with a simple subtitle file
   ffmpeg -i input.mp4 -vf "subtitles=test.vtt" output.mp4
   ```

3. **Permission denied**:
   ```bash
   # Make sure FFmpeg is executable
   chmod +x /usr/local/bin/ffmpeg
   
   # Check file permissions
   ls -la /usr/local/bin/ffmpeg
   ```

4. **Memory issues with large videos**:
   ```bash
   # Use lower quality settings
   -crf 28 -preset ultrafast
   
   # Or process in smaller chunks
   ```

### Debug Mode:
Enable verbose logging in the render-video API:
```typescript
// Add to ffmpeg command for debugging
ffmpegCommand += ' -loglevel debug';
```

## 📊 Performance Optimization

### For Production:
1. **Use hardware acceleration** (if available):
   ```bash
   # NVIDIA GPU
   -c:v h264_nvenc
   
   # Intel GPU
   -c:v h264_qsv
   
   # AMD GPU
   -c:v h264_amf
   ```

2. **Optimize for web**:
   ```bash
   -movflags +faststart
   ```

3. **Reduce file size**:
   ```bash
   -crf 28  # Higher CRF = smaller file
   -preset slower  # Better compression
   ```

## ✅ Verification Checklist

- [ ] FFmpeg installed and accessible via command line
- [ ] Subtitle filter available (`ffmpeg -filters | grep subtitle`)
- [ ] Test video creation works
- [ ] Test subtitle burning works
- [ ] Environment variables set correctly
- [ ] Application can call FFmpeg successfully
- [ ] Output videos play correctly with burned-in subtitles

## 🎉 Success!

Once FFmpeg is properly configured, your StoryShort application will be able to:
- ✅ Generate high-quality vertical videos
- ✅ Burn subtitles permanently into videos
- ✅ Create professional-looking final outputs
- ✅ Optimize videos for mobile platforms
- ✅ Provide downloadable MP4 files

The video rendering will happen automatically when users click "Render Final Video" in the dedicated video page! 