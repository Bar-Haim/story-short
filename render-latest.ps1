# Enhanced Video Rendering Script with Subtitle Burning
# Fixed file path handling, subtitle burning, and comprehensive validation

param(
    [string]$VideoId = "",
    [switch]$Debug = $false
)

# Configuration
$basePath = "C:\Users\haim4\Desktop\StoryShort MVP Development Plan\storyshort\renders"
$ffmpegPath = "ffmpeg"

# Enhanced logging function
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $color = switch ($Level) {
        "ERROR" { "Red" }
        "WARN" { "Yellow" }
        "SUCCESS" { "Green" }
        default { "White" }
    }
    Write-Host "[$timestamp] [$Level] $Message" -ForegroundColor $color
}

# Function to escape paths for FFmpeg
function Escape-FFmpegPath {
    param([string]$Path)
    
    # Convert Windows backslashes to forward slashes
    $escapedPath = $Path -replace '\\', '/'
    
    # Handle Windows drive letters properly
    if ($escapedPath -match '^[A-Za-z]:/') {
        $escapedPath = $escapedPath -replace '^([A-Za-z]):/', '$1\\:/'
    }
    
    # Escape single quotes
    $escapedPath = $escapedPath -replace "'", "\\'"
    
    return $escapedPath
}

# Function to validate file existence and size
function Test-FileValid {
    param([string]$FilePath, [string]$FileType)
    
    if (-not (Test-Path $FilePath)) {
        Write-Log "Missing $FileType file: $FilePath" "ERROR"
        return $false
    }
    
    $fileSize = (Get-Item $FilePath).Length
    if ($fileSize -eq 0) {
        Write-Log "$FileType file is empty: $FilePath" "ERROR"
        return $false
    }
    
    Write-Log "$FileType file validated: $FilePath ($([math]::Round($fileSize/1MB, 2)) MB)" "SUCCESS"
    return $true
}

# Function to validate SRT content
function Test-SrtContent {
    param([string]$SrtPath)
    
    try {
        $content = Get-Content $SrtPath -Raw
        $lines = $content -split "`n"
        
        # Check for basic SRT structure
        $hasTimestamps = $lines | Where-Object { $_ -match '\d{2}:\d{2}:\d{2},\d{3}\s-->\s\d{2}:\d{2}:\d{2},\d{3}' }
        
        if ($hasTimestamps.Count -eq 0) {
            Write-Log "SRT file lacks valid timestamps" "ERROR"
            return $false
        }
        
        Write-Log "SRT content validated with $($hasTimestamps.Count) subtitle entries" "SUCCESS"
        return $true
    }
    catch {
        Write-Log "Failed to validate SRT content: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

# Function to validate images.txt format
function Test-ImagesTxtContent {
    param([string]$ImagesTxtPath)
    
    try {
        $content = Get-Content $ImagesTxtPath -Raw
        $lines = $content -split "`n" | Where-Object { $_.Trim() -ne "" }
        
        if ($lines.Count -eq 0) {
            Write-Log "Images.txt file is empty" "ERROR"
            return $false
        }
        
        if ($lines.Count % 2 -ne 0) {
            Write-Log "Images.txt has invalid line count (must be even)" "ERROR"
            return $false
        }
        
        # Check format: file 'path' followed by duration
        for ($i = 0; $i -lt $lines.Count; $i += 2) {
            if (-not ($lines[$i] -match "^file\s+'.*'$")) {
                Write-Log "Invalid file line format at line $($i + 1): $($lines[$i])" "ERROR"
                return $false
            }
            
            if (-not ($lines[$i + 1] -match "^duration\s+\d+(\.\d+)?$")) {
                Write-Log "Invalid duration line format at line $($i + 2): $($lines[$i + 1])" "ERROR"
                return $false
            }
        }
        
        Write-Log "Images.txt format validated with $($lines.Count / 2) image entries" "SUCCESS"
        return $true
    }
    catch {
        Write-Log "Failed to validate images.txt content: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

# Main execution
try {
    Write-Log "🎬 Starting enhanced video rendering with subtitle burning..." "INFO"
    
    # Step 1: Find the target video directory
    if ($VideoId -ne "") {
        $targetFolder = Join-Path $basePath $VideoId
        if (-not (Test-Path $targetFolder)) {
            Write-Log "Specified video ID not found: $VideoId" "ERROR"
            exit 1
        }
        Write-Log "Using specified video ID: $VideoId" "INFO"
    } else {
        # Find the latest folder
        $latestFolder = Get-ChildItem -Path $basePath | 
            Where-Object { $_.PSIsContainer -and $_.Name -ne "videos" -and $_.Name -ne "test-images-txt" -and $_.Name -ne "test-video-123" } | 
            Sort-Object LastWriteTime -Descending | 
            Select-Object -First 1
        
        if (-not $latestFolder) {
            Write-Log "No valid render folders found in $basePath" "ERROR"
            exit 1
        }
        
        $targetFolder = $latestFolder.FullName
        Write-Log "Using latest video folder: $($latestFolder.Name)" "INFO"
    }
    
    # Step 2: Build file paths with proper directory structure
    $imagesTxt = Join-Path $targetFolder "images.txt"
    $audioFile = Join-Path $targetFolder "audio" "audio.mp3"
    $captionsFile = Join-Path $targetFolder "captions" "subtitles.srt"
    $outputFile = Join-Path $targetFolder "final_video_with_subtitles.mp4"
    
    Write-Log "📁 File paths configured:" "INFO"
    Write-Log "   Images list: $imagesTxt" "INFO"
    Write-Log "   Audio file: $audioFile" "INFO"
    Write-Log "   Captions file: $captionsFile" "INFO"
    Write-Log "   Output file: $outputFile" "INFO"
    
    # Step 3: Comprehensive file validation
    Write-Log "🔍 Starting comprehensive file validation..." "INFO"
    
    $allFilesValid = $true
    
    # Validate images.txt
    if (-not (Test-FileValid $imagesTxt "Images list")) {
        $allFilesValid = $false
    } elseif (-not (Test-ImagesTxtContent $imagesTxt)) {
        $allFilesValid = $false
    }
    
    # Validate audio file
    if (-not (Test-FileValid $audioFile "Audio")) {
        $allFilesValid = $false
    }
    
    # Validate captions file
    if (-not (Test-FileValid $captionsFile "Captions")) {
        Write-Log "Captions file missing - proceeding without subtitles" "WARN"
        $captionsFile = $null
    } elseif (-not (Test-SrtContent $captionsFile)) {
        Write-Log "Captions file invalid - proceeding without subtitles" "WARN"
        $captionsFile = $null
    }
    
    if (-not $allFilesValid) {
        Write-Log "File validation failed - cannot proceed with rendering" "ERROR"
        exit 1
    }
    
    # Step 4: Check FFmpeg availability
    Write-Log "🔧 Checking FFmpeg availability..." "INFO"
    try {
        $ffmpegVersion = & $ffmpegPath -version 2>&1 | Select-Object -First 1
        if ($ffmpegVersion -match "ffmpeg version") {
            Write-Log "FFmpeg available: $ffmpegVersion" "SUCCESS"
        } else {
            throw "FFmpeg not found"
        }
    }
    catch {
        Write-Log "FFmpeg is not available or not in PATH" "ERROR"
        Write-Log "Please install FFmpeg and ensure it's accessible" "ERROR"
        exit 1
    }
    
    # Step 5: Build enhanced FFmpeg command
    Write-Log "🎬 Building enhanced FFmpeg command..." "INFO"
    
    # Escape paths for FFmpeg
    $escapedImagesTxt = Escape-FFmpegPath $imagesTxt
    $escapedAudioFile = Escape-FFmpegPath $audioFile
    $escapedOutputFile = Escape-FFmpegPath $outputFile
    
    # Base FFmpeg command
    $ffmpegCmd = "$ffmpegPath -y -f concat -safe 0 -i `"$escapedImagesTxt`" -i `"$escapedAudioFile`""
    
    # Build video filters
    $videoFilters = @()
    
    # 1. Scale and pad for 1080x1920 vertical video
    $videoFilters += "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black"
    
    # 2. Add cinematic motion effects
    $videoFilters += "zoompan=z='min(zoom+0.0015+sin(t*0.6)*0.0003,1.2)':d=125:x='iw/2-(iw/zoom/2)+sin(t*0.3)*12+cos(t*0.15)*6+sin(t*0.9)*3':y='ih/2-(ih/zoom/2)+cos(t*0.25)*10+sin(t*0.08)*5+cos(t*0.7)*2':s=1080x1920"
    
    # 3. Add subtle camera shake
    $videoFilters += "crop=1080:1920:x='sin(t*1.5)*1.5+cos(t*1.8)*1.2+sin(t*2.5)*0.6':y='cos(t*1.2)*1.5+sin(t*2.2)*1.0+cos(t*2.4)*0.5'"
    
    # 4. Add cinematic color grading
    $videoFilters += "eq=contrast=1.08:saturation=1.03:brightness=0.01"
    
    # 5. Add subtle vignette
    $videoFilters += "vignette=PI/4"
    
    # 6. Add subtitle burning if captions are available
    if ($captionsFile) {
        $escapedCaptionsFile = Escape-FFmpegPath $captionsFile
        # Updated subtitle styling: smaller font, transparent background, alternating positions
        $videoFilters += "subtitles=`"$escapedCaptionsFile`":force_style='FontSize=20,PrimaryColour=`"`&Hffffff`",OutlineColour=`"`&H000000`",BackColour=`"`&H00000000`",Outline=1,Shadow=0,BorderStyle=1,MarginV=50'"
        Write-Log "📝 Subtitle burning enabled with new styling" "SUCCESS"
    } else {
        Write-Log "📝 No captions available - rendering without subtitles" "WARN"
    }
    
    # Combine all filters
    $filterString = $videoFilters -join ","
    $ffmpegCmd += " -vf `"$filterString`""
    
    # Add encoding settings
    $ffmpegCmd += " -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -shortest -movflags +faststart"
    
    # Add output file
    $ffmpegCmd += " `"$escapedOutputFile`""
    
    # Step 6: Debug mode output
    if ($Debug) {
        Write-Log "🔍 DEBUG MODE - Full FFmpeg command:" "INFO"
        Write-Log $ffmpegCmd "INFO"
        Write-Log "🔍 Video filters breakdown:" "INFO"
        $videoFilters | ForEach-Object { Write-Log "   $_" "INFO" }
    }
    
    # Step 7: Execute FFmpeg
    Write-Log "🚀 Executing FFmpeg rendering..." "INFO"
    Write-Log "This may take several minutes depending on video length..." "INFO"
    
    $startTime = Get-Date
    $result = Invoke-Expression $ffmpegCmd 2>&1
    $endTime = Get-Date
    $duration = $endTime - $startTime
    
    # Step 8: Check results
    if ($LASTEXITCODE -eq 0) {
        if (Test-Path $outputFile) {
            $fileSize = (Get-Item $outputFile).Length
            $fileSizeMB = [math]::Round($fileSize / 1MB, 2)
            
            Write-Log "✅ Video rendered successfully!" "SUCCESS"
            Write-Log "📁 Output file: $outputFile" "SUCCESS"
            Write-Log "📊 File size: $fileSizeMB MB" "SUCCESS"
            Write-Log "⏱️ Rendering time: $($duration.Minutes)m $($duration.Seconds)s" "SUCCESS"
            
            if ($captionsFile) {
                Write-Log "📝 Subtitles successfully burned into video" "SUCCESS"
            }
            
            # Get video duration using FFprobe
            try {
                $durationCmd = "$ffmpegPath -v quiet -show_entries format=duration -of csv=p=0 `"$escapedOutputFile`""
                $videoDuration = Invoke-Expression $durationCmd 2>&1
                if ($videoDuration -match '^\d+\.?\d*$') {
                    $minutes = [math]::Floor([double]$videoDuration / 60)
                    $seconds = [math]::Floor([double]$videoDuration % 60)
                    Write-Log "⏱️ Video duration: ${minutes}m ${seconds}s" "SUCCESS"
                }
            }
            catch {
                Write-Log "Could not determine video duration" "WARN"
            }
        } else {
            Write-Log "❌ FFmpeg completed but output file not found" "ERROR"
            exit 1
        }
    } else {
        Write-Log "❌ FFmpeg rendering failed with exit code $LASTEXITCODE" "ERROR"
        Write-Log "FFmpeg output:" "ERROR"
        Write-Log $result "ERROR"
        exit 1
    }
    
    Write-Log "🎉 Video rendering pipeline completed successfully!" "SUCCESS"
    
}
catch {
    Write-Log "❌ Unexpected error: $($_.Exception.Message)" "ERROR"
    Write-Log "Stack trace: $($_.ScriptStackTrace)" "ERROR"
    exit 1
} 