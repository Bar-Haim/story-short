# 🎬 FFmpeg Installation Guide for StoryShort

## Quick Installation (Recommended)

### Option 1: Using the PowerShell Script (Easiest)

1. **Open PowerShell as Administrator**
   - Press `Win + X` and select "Windows PowerShell (Admin)"

2. **Navigate to your project directory**
   ```powershell
   cd "C:\Users\haim4\Desktop\StoryShort MVP Development Plan\storyshort"
   ```

3. **Run the installation script**
   ```powershell
   .\install-ffmpeg.ps1
   ```

4. **Restart your terminal/PowerShell** after installation

5. **Verify installation**
   ```powershell
   ffmpeg -version
   ```

### Option 2: Manual Installation

#### Step 1: Download FFmpeg
1. Go to [https://ffmpeg.org/download.html](https://ffmpeg.org/download.html)
2. Click "Windows Builds" under "Get packages & executable files"
3. Download the latest release (e.g., "ffmpeg-master-latest-win64-gpl.zip")

#### Step 2: Extract and Install
1. **Create FFmpeg directory**
   ```powershell
   mkdir "$env:USERPROFILE\ffmpeg"
   mkdir "$env:USERPROFILE\ffmpeg\bin"
   ```

2. **Extract the downloaded zip file**
   - Extract the contents to a temporary location
   - Copy all files from the `bin` folder to `%USERPROFILE%\ffmpeg\bin`

3. **Add to PATH**
   ```powershell
   $currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
   $ffmpegPath = "$env:USERPROFILE\ffmpeg\bin"
   $newPath = "$currentPath;$ffmpegPath"
   [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
   ```

4. **Restart your terminal**

### Option 3: Using Chocolatey (If you have it installed)

1. **Install Chocolatey** (if not already installed)
   ```powershell
   Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
   ```

2. **Install FFmpeg**
   ```powershell
   choco install ffmpeg
   ```

## Verification

After installation, verify FFmpeg is working:

```powershell
ffmpeg -version
```

You should see output like:
```
ffmpeg version 6.1 Copyright (c) 2000-2023 the FFmpeg developers
built with gcc 13.2.0 (Rev10, Built by MSYS2 project)
...
```

## Troubleshooting

### Issue: "ffmpeg is not recognized as an internal or external command"

**Solution:**
1. **Check if FFmpeg is installed**
   ```powershell
   Test-Path "$env:USERPROFILE\ffmpeg\bin\ffmpeg.exe"
   ```

2. **If not found, reinstall using the script above**

3. **If found but still not working, manually add to PATH:**
   ```powershell
   $ffmpegPath = "$env:USERPROFILE\ffmpeg\bin"
   $currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
   if ($currentPath -notlike "*$ffmpegPath*") {
       $newPath = "$currentPath;$ffmpegPath"
       [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
       Write-Host "Added FFmpeg to PATH"
   }
   ```

4. **Restart your terminal completely**

### Issue: PowerShell execution policy error

**Solution:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Issue: Download fails

**Solution:**
1. Try downloading manually from [https://github.com/BtbN/FFmpeg-Builds/releases](https://github.com/BtbN/FFmpeg-Builds/releases)
2. Extract and follow the manual installation steps above

## Testing FFmpeg with StoryShort

Once FFmpeg is installed, you can test it with StoryShort:

1. **Start your development server**
   ```powershell
   npm run dev
   ```

2. **Generate a video** in the StoryShort app

3. **Check the console logs** - you should see:
   ```
   ✅ FFmpeg is available
   🎬 Running FFmpeg video composition...
   ```

## Alternative: Using FFmpeg in Docker (For Development)

If you prefer to use Docker:

```dockerfile
# Dockerfile
FROM node:18-alpine

# Install FFmpeg
RUN apk add --no-cache ffmpeg

# ... rest of your Dockerfile
```

## Support

If you continue having issues:

1. **Check the console logs** in your browser's developer tools
2. **Verify FFmpeg installation** with `ffmpeg -version`
3. **Restart your development server** after installing FFmpeg
4. **Check the StoryShort logs** for specific error messages

---

**Note:** FFmpeg is required for the video rendering feature. Without it, you can still generate scripts, storyboards, and assets, but final video rendering will fail. 