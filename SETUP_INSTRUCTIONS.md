# 🚀 Auto Video Render Setup Instructions

## 📋 **Prerequisites**

Before using the auto-render script, you need to install and configure the following:

### 1. **FFmpeg Installation**
FFmpeg is required for video rendering. Install it on Windows:

#### **Option A: Using Chocolatey (Recommended)**
```powershell
# Install Chocolatey first (if not installed)
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install FFmpeg
choco install ffmpeg
```

#### **Option B: Manual Installation**
1. Download FFmpeg from: https://ffmpeg.org/download.html#build-windows
2. Extract to a folder (e.g., `C:\ffmpeg`)
3. Add `C:\ffmpeg\bin` to your system PATH environment variable

#### **Verify Installation**
```powershell
ffmpeg -version
```

### 2. **Node.js Installation**
Node.js is required for Supabase integration:

#### **Using Chocolatey**
```powershell
choco install nodejs
```

#### **Manual Installation**
1. Download from: https://nodejs.org/
2. Install with default settings
3. Verify installation:
```powershell
node --version
npm --version
```

### 3. **PowerShell Execution Policy**
Allow script execution:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## 🔐 **Environment Setup**

### 1. **Get Supabase Credentials**

You need two values from your Supabase project:

1. **Project URL**: Found in your Supabase dashboard under Settings > API
2. **Service Role Key**: Found in your Supabase dashboard under Settings > API > Project API keys

### 2. **Create Environment File**

Create a file named `.env.local` in your project root directory:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Optional: Other API keys if needed
ELEVENLABS_API_KEY=your-elevenlabs-key
OPENAI_API_KEY=your-openai-key
```

### 3. **Verify Environment File**

The script will automatically load and validate these environment variables.

## 📁 **Project Structure**

Ensure your project has this structure:
```
storyshort/
├── .env.local                    # Environment variables
├── auto-render-video.ps1         # Main script
├── renders/                      # Video output directory
│   └── {video-id}/              # Individual video directories
│       ├── images/              # Downloaded images
│       ├── audio/               # Downloaded audio
│       ├── captions/            # Downloaded captions
│       ├── images.txt           # FFmpeg concat file
│       └── final_video.mp4      # Rendered video
└── scripts/                     # Node.js scripts
```

## 🎬 **Usage Instructions**

### **Basic Commands**

#### **1. List Available Videos**
```powershell
.\auto-render-video.ps1 -ListVideos
```
This shows all videos available in Supabase with their status and assets.

#### **2. Render a Specific Video**
```powershell
.\auto-render-video.ps1 -VideoId f04df512-ee66-48f2-b8e6-e2fac9f3e6da
```
Replace `f04df512-ee66-48f2-b8e6-e2fac9f3e6da` with an actual video ID.

#### **3. Render All Videos**
```powershell
.\auto-render-video.ps1 -RenderAll
```
This processes all available videos in sequence.

#### **4. Show Help**
```powershell
.\auto-render-video.ps1
```
Shows usage instructions and available commands.

### **Advanced Usage**

#### **Custom Environment File**
```powershell
.\auto-render-video.ps1 -VideoId <VIDEO_ID> -EnvironmentFile ".env.production"
```

## 🔍 **What the Script Does**

### **For Each Video:**

1. **📁 Check Local Files**
   - Looks for existing `images.txt`, `audio.mp3`, and caption files
   - Reports what's missing and what exists

2. **📥 Download Missing Assets**
   - Fetches video metadata from Supabase
   - Downloads images, audio, and captions if missing
   - Creates proper directory structure

3. **📄 Generate images.txt**
   - Creates FFmpeg concat file with correct format
   - Uses scene durations from storyboard data
   - Converts paths to Unix format for FFmpeg

4. **🎬 Render Video**
   - Runs FFmpeg with optimal settings
   - Burns in subtitles if available
   - Creates `final_video.mp4` in the video directory

5. **📊 Report Results**
   - Shows success/failure status
   - Reports file sizes and processing time
   - Provides clear error messages if something fails

## 🛠️ **Troubleshooting**

### **Common Issues**

#### **1. "FFmpeg not found"**
- Install FFmpeg and add to PATH
- Restart PowerShell after installation
- Verify with `ffmpeg -version`

#### **2. "Environment file not found"**
- Create `.env.local` file in project root
- Ensure correct file name and location
- Check file permissions

#### **3. "Missing required environment variable"**
- Verify Supabase URL and key in `.env.local`
- Check for typos in variable names
- Ensure no extra spaces around `=` signs

#### **4. "Database error"**
- Verify Supabase credentials
- Check internet connection
- Ensure Supabase project is active

#### **5. "Download failed"**
- Check internet connection
- Verify Supabase storage permissions
- Ensure video assets exist in database

### **Debug Mode**

For detailed debugging, you can modify the script to show more information:

```powershell
# Add this line to see detailed FFmpeg output
$process = Start-Process -FilePath "ffmpeg" -ArgumentList $ffmpegArgs[1..($ffmpegArgs.Length-1)] -Wait -PassThru -NoNewWindow -RedirectStandardOutput "ffmpeg.log" -RedirectStandardError "ffmpeg-error.log"
```

## 📊 **Performance Tips**

### **For Large Numbers of Videos:**

1. **Batch Processing**: Use `-RenderAll` for multiple videos
2. **Parallel Processing**: The script processes videos sequentially for stability
3. **Storage Space**: Ensure sufficient disk space for downloaded assets
4. **Network**: Good internet connection for downloading assets

### **Expected File Sizes:**
- **Images**: 2-4 MB each (PNG format)
- **Audio**: 400-800 KB (MP3 format)
- **Captions**: 1-5 KB (SRT format)
- **Final Video**: 2-10 MB (MP4 format)

## 🔄 **Automation Examples**

### **Scheduled Rendering**
Create a Windows Task Scheduler job to run the script automatically:

```powershell
# Create a scheduled task (run as administrator)
SCHTASKS /CREATE /SC DAILY /TN "StoryShort Render" /TR "powershell.exe -File C:\path\to\auto-render-video.ps1 -RenderAll" /ST 02:00
```

### **Batch File for Easy Access**
Create `render.bat` in your project root:

```batch
@echo off
powershell.exe -ExecutionPolicy Bypass -File "%~dp0auto-render-video.ps1" %*
pause
```

## 📞 **Support**

If you encounter issues:

1. **Check the logs**: The script provides detailed output
2. **Verify prerequisites**: Ensure FFmpeg and Node.js are installed
3. **Test environment**: Run `.\auto-render-video.ps1 -ListVideos` first
4. **Check file permissions**: Ensure the script can write to the renders directory

## 🎯 **Success Indicators**

When everything is working correctly, you should see:

- ✅ Environment variables loaded successfully
- ✅ FFmpeg is available
- ✅ Found X valid videos
- ✅ Video found: X images, audio: Yes, captions: Yes
- ✅ All required files already exist (or download progress)
- ✅ Created images.txt with X images
- ✅ Video rendered successfully: final_video.mp4 (X MB)

---

**Ready to start?** Run `.\auto-render-video.ps1 -ListVideos` to see your available videos! 🚀 