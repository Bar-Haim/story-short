# FFmpeg Installation Guide for StoryShort

## 🚨 Critical Issue
The video rendering is currently failing because FFmpeg is not installed on your system. This guide will help you install FFmpeg properly.

## Error Message
```
'ffmpeg' is not recognized as an internal or external command, operable program or batch file.
```

## 📋 Installation Methods

### Method 1: Using Chocolatey (Recommended)

1. **Install Chocolatey** (if not already installed):
   ```powershell
   Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
   ```

2. **Install FFmpeg**:
   ```powershell
   choco install ffmpeg
   ```

3. **Restart your terminal** and verify installation:
   ```powershell
   ffmpeg -version
   ```

### Method 2: Manual Installation

1. **Download FFmpeg**:
   - Go to https://ffmpeg.org/download.html
   - Click "Windows Builds" 
   - Download the latest release (ffmpeg-master-latest-win64-gpl.zip)

2. **Extract and Setup**:
   - Extract the ZIP file to `C:\ffmpeg`
   - Add `C:\ffmpeg\bin` to your system PATH:
     - Open System Properties → Advanced → Environment Variables
     - Edit "Path" variable
     - Add `C:\ffmpeg\bin`
     - Click OK

3. **Restart your terminal** and verify:
   ```powershell
   ffmpeg -version
   ```

### Method 3: Using Winget

```powershell
winget install FFmpeg
```

## 🔧 Verification

After installation, test FFmpeg:

```powershell
# Test basic functionality
ffmpeg -version

# Test video processing (optional)
ffmpeg -f lavfi -i testsrc=duration=1:size=320x240:rate=1 -f lavfi -i sine=frequency=1000:duration=1 -c:v libx264 -c:a aac test.mp4
```

## 🚀 Restart StoryShort

After installing FFmpeg:

1. **Stop the development server** (Ctrl+C)
2. **Restart the server**:
   ```powershell
   npm run dev
   ```
3. **Test video rendering** by generating a new video

## 🐛 Troubleshooting

### FFmpeg not found after installation
- **Restart your terminal/command prompt**
- **Restart your IDE** (VS Code, etc.)
- **Check PATH**: `echo $env:PATH` (should include ffmpeg path)

### Permission issues
- Run PowerShell as Administrator
- Check Windows Defender/antivirus isn't blocking FFmpeg

### Version conflicts
- Uninstall any existing FFmpeg installations
- Use only one installation method

## 📝 Alternative: Use Docker (Advanced)

If you prefer containerized development:

```dockerfile
# Dockerfile
FROM node:18
RUN apt-get update && apt-get install -y ffmpeg
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
```

## ✅ Success Indicators

When FFmpeg is properly installed, you should see:
- ✅ `ffmpeg -version` returns version information
- ✅ Video rendering completes successfully
- ✅ Final MP4 files are generated with burned-in captions
- ✅ No "ffmpeg is not recognized" errors

## 🆘 Still Having Issues?

1. **Check system requirements**: Windows 10/11, PowerShell 5.1+
2. **Verify PATH**: FFmpeg should be in your system PATH
3. **Restart everything**: Terminal, IDE, development server
4. **Check logs**: Look for FFmpeg-related errors in the console

## 📞 Support

If you continue to have issues:
1. Check the console logs for specific error messages
2. Verify FFmpeg installation with `ffmpeg -version`
3. Try the video rendering process again

---

**Note**: FFmpeg is essential for video processing in StoryShort. Without it, the final video rendering step will fail. 