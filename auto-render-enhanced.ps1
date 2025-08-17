# 🎬 Auto Video Render Script - Enhanced Version
# This script automates the complete video rendering process with queuing and monitoring

param(
    [Parameter(Mandatory=$false)]
    [string]$VideoId,
    
    [Parameter(Mandatory=$false)]
    [switch]$ListVideos,
    
    [Parameter(Mandatory=$false)]
    [switch]$RenderAll,
    
    [Parameter(Mandatory=$false)]
    [int]$MaxWorkers = 3,
    
    [Parameter(Mandatory=$false)]
    [string]$EnvironmentFile = ".env.local"
)

# 🔧 Configuration
$BasePath = Split-Path -Parent $PSScriptRoot
$RendersPath = Join-Path $BasePath "renders"

# 🎨 Console Colors
$Colors = @{
    Success = "Green"
    Error = "Red"
    Warning = "Yellow"
    Info = "Cyan"
    Header = "Magenta"
}

# 📊 Global State Management
$Global:RenderQueue = [System.Collections.Queue]::new()
$Global:JobStats = @{
    TotalQueued = 0
    TotalCompleted = 0
    TotalFailed = 0
    StartTime = Get-Date
}

# 📝 Logging Functions
function Write-Header {
    param([string]$Message)
    Write-Host "`n" -NoNewline
    Write-Host "=" * 80 -ForegroundColor $Colors.Header
    Write-Host " $Message" -ForegroundColor $Colors.Header
    Write-Host "=" * 80 -ForegroundColor $Colors.Header
}

function Write-Success {
    param([string]$Message)
    Write-Host "SUCCESS: $Message" -ForegroundColor $Colors.Success
}

function Write-Error {
    param([string]$Message)
    Write-Host "ERROR: $Message" -ForegroundColor $Colors.Error
}

function Write-Warning {
    param([string]$Message)
    Write-Host "WARNING: $Message" -ForegroundColor $Colors.Warning
}

function Write-Info {
    param([string]$Message)
    Write-Host "INFO: $Message" -ForegroundColor $Colors.Info
}

function Write-JobStatus {
    param([string]$VideoId, [string]$Status, [string]$Message = "")
    $timestamp = Get-Date -Format "HH:mm:ss"
    Write-Host "[$timestamp] [$Status] $VideoId $Message" -ForegroundColor $Colors.Info
}

# 🔐 Environment Setup
function Load-Environment {
    Write-Header "Loading Environment Variables"
    
    $envFile = Join-Path $BasePath $EnvironmentFile
    if (-not (Test-Path $envFile)) {
        Write-Error "Environment file not found: $envFile"
        Write-Info "Please create .env.local file with your Supabase credentials"
        exit 1
    }
    
    # Load environment variables from .env.local
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $name = $matches[1]
            $value = $matches[2]
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
    
    # Validate required environment variables
    $requiredVars = @("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")
    foreach ($var in $requiredVars) {
        if (-not [Environment]::GetEnvironmentVariable($var)) {
            Write-Error "Missing required environment variable: $var"
            exit 1
        }
    }
    
    Write-Success "Environment variables loaded successfully"
}

# 🔍 Supabase Functions
function Get-SupabaseVideos {
    Write-Header "Fetching Videos from Supabase"
    
    $supabaseUrl = [Environment]::GetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL")
    $supabaseKey = [Environment]::GetEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY")
    
    # Create Node.js script to fetch videos
    $nodeScript = @"
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient('$supabaseUrl', '$supabaseKey');

async function getVideos() {
    const { data: videos, error } = await supabase
        .from('videos')
        .select('id, status, image_urls, audio_url, captions_url, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
    
    if (error) {
        console.error('Database error:', error.message);
        process.exit(1);
    }
    
    const validVideos = videos.filter(video => 
        video.image_urls && video.image_urls.length > 0 && 
        video.audio_url
    );
    
    console.log(JSON.stringify(validVideos));
}

getVideos();
"@
    
    $tempScript = Join-Path $env:TEMP "get-videos.js"
    $nodeScript | Out-File -FilePath $tempScript -Encoding UTF8
    
    try {
        $result = node $tempScript 2>$null
        if ($LASTEXITCODE -eq 0) {
            $videos = $result | ConvertFrom-Json
            Write-Success "Found $($videos.Count) valid videos"
            return $videos
        } else {
            Write-Error "Failed to fetch videos from Supabase"
            return @()
        }
    } finally {
        if (Test-Path $tempScript) {
            Remove-Item $tempScript -Force
        }
    }
}

# 📥 Download Functions
function Download-File {
    param(
        [string]$Url,
        [string]$OutputPath,
        [string]$Description
    )
    
    Write-Info "Downloading $Description..."
    
    try {
        $webClient = New-Object System.Net.WebClient
        $webClient.DownloadFile($Url, $OutputPath)
        
        if (Test-Path $OutputPath) {
            $size = (Get-Item $OutputPath).Length
            Write-Success "$Description downloaded ($([math]::Round($size/1MB, 2)) MB)"
            return $true
        } else {
            Write-Error "Failed to download $Description"
            return $false
        }
    } catch {
        Write-Error "Error downloading $Description`: $($_.Exception.Message)"
        return $false
    } finally {
        if ($webClient) {
            $webClient.Dispose()
        }
    }
}

function Get-VideoAssets {
    param([string]$VideoId)
    
    Write-Header "Fetching Video Assets for $VideoId"
    
    $supabaseUrl = [Environment]::GetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL")
    $supabaseKey = [Environment]::GetEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY")
    
    $nodeScript = @"
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient('$supabaseUrl', '$supabaseKey');

async function getVideoAssets() {
    const { data: video, error } = await supabase
        .from('videos')
        .select('*')
        .eq('id', '$VideoId')
        .single();
    
    if (error) {
        console.error('Database error:', error.message);
        process.exit(1);
    }
    
    if (!video) {
        console.error('Video not found');
        process.exit(1);
    }
    
    console.log(JSON.stringify(video));
}

getVideoAssets();
"@
    
    $tempScript = Join-Path $env:TEMP "get-video-assets.js"
    $nodeScript | Out-File -FilePath $tempScript -Encoding UTF8
    
    try {
        $result = node $tempScript 2>$null
        if ($LASTEXITCODE -eq 0) {
            $video = $result | ConvertFrom-Json
            Write-Success "Video found: $($video.image_urls.Count) images, audio: $($video.audio_url -ne $null), captions: $($video.captions_url -ne $null)"
            return $video
        } else {
            Write-Error "Failed to fetch video assets"
            return $null
        }
    } finally {
        if (Test-Path $tempScript) {
            Remove-Item $tempScript -Force
        }
    }
}

# 📁 File Management Functions
function Test-VideoFiles {
    param([string]$VideoId)
    
    $videoPath = Join-Path $RendersPath $VideoId
    $imagesPath = Join-Path $videoPath "images"
    $audioPath = Join-Path $videoPath "audio"
    $captionsPath = Join-Path $videoPath "captions"
    
    $missing = @()
    $existing = @()
    
    # Check images.txt
    $imagesTxt = Join-Path $videoPath "images.txt"
    if (Test-Path $imagesTxt) {
        $existing += "images.txt"
    } else {
        $missing += "images.txt"
    }
    
    # Check audio.mp3
    $audioFile = Join-Path $audioPath "audio.mp3"
    if (Test-Path $audioFile) {
        $existing += "audio.mp3"
    } else {
        $missing += "audio.mp3"
    }
    
    # Check captions with subdirectory support
    $captionsSrt = Join-Path $captionsPath "captions.srt"
    $captionsVtt = Join-Path $captionsPath "captions.vtt"
    $captionsSrtRoot = Join-Path $videoPath "captions.srt"
    $captionsVttRoot = Join-Path $videoPath "captions.vtt"
    
    if (Test-Path $captionsSrt) {
        $existing += "captions.srt (subdirectory)"
    } elseif (Test-Path $captionsVtt) {
        $existing += "captions.vtt (subdirectory)"
    } elseif (Test-Path $captionsSrtRoot) {
        $existing += "captions.srt (root)"
    } elseif (Test-Path $captionsVttRoot) {
        $existing += "captions.vtt (root)"
    } else {
        $missing += "captions"
    }
    
    # Check images directory with subdirectory support
    if (Test-Path $imagesPath) {
        $imageFiles = Get-ChildItem -Path $imagesPath -Filter "*.png" | Measure-Object
        if ($imageFiles.Count -gt 0) {
            $existing += "$($imageFiles.Count) images (subdirectory)"
        } else {
            $missing += "images"
        }
    } else {
        # Check for images in root directory
        $imageFilesRoot = Get-ChildItem -Path $videoPath -Filter "*.png" | Measure-Object
        if ($imageFilesRoot.Count -gt 0) {
            $existing += "$($imageFilesRoot.Count) images (root)"
        } else {
            $missing += "images"
        }
    }
    
    return @{
        Missing = $missing
        Existing = $existing
        VideoPath = $videoPath
        ImagesPath = $imagesPath
        AudioPath = $audioPath
        CaptionsPath = $captionsPath
    }
}

function Create-VideoDirectories {
    param([string]$VideoId)
    
    $videoPath = Join-Path $RendersPath $VideoId
    $imagesPath = Join-Path $videoPath "images"
    $audioPath = Join-Path $videoPath "audio"
    $captionsPath = Join-Path $videoPath "captions"
    
    # Create directories if they don't exist
    @($videoPath, $imagesPath, $audioPath, $captionsPath) | ForEach-Object {
        if (-not (Test-Path $_)) {
            New-Item -ItemType Directory -Path $_ -Force | Out-Null
            Write-Info "Created directory: $_"
        }
    }
    
    return @{
        VideoPath = $videoPath
        ImagesPath = $imagesPath
        AudioPath = $audioPath
        CaptionsPath = $captionsPath
    }
}

function Download-VideoAssets {
    param(
        [object]$Video,
        [hashtable]$Paths
    )
    
    Write-Header "Downloading Video Assets"
    
    $success = $true
    
    # Download images
    if ($Video.image_urls -and $Video.image_urls.Count -gt 0) {
        Write-Info "Downloading $($Video.image_urls.Count) images..."
        for ($i = 0; $i -lt $Video.image_urls.Count; $i++) {
            $imageUrl = $Video.image_urls[$i]
            $imageFile = Join-Path $Paths.ImagesPath "scene_$($i + 1).png"
            
            if (-not (Test-Path $imageFile)) {
                if (-not (Download-File -Url $imageUrl -OutputPath $imageFile -Description "Image $($i + 1)")) {
                    $success = $false
                }
            } else {
                Write-Info "Image $($i + 1) already exists"
            }
        }
    }
    
    # Download audio
    if ($Video.audio_url) {
        $audioFile = Join-Path $Paths.AudioPath "audio.mp3"
        if (-not (Test-Path $audioFile)) {
            if (-not (Download-File -Url $Video.audio_url -OutputPath $audioFile -Description "Audio")) {
                $success = $false
            }
        } else {
            Write-Info "Audio already exists"
        }
    }
    
    # Download captions
    if ($Video.captions_url) {
        $captionsFile = Join-Path $Paths.CaptionsPath "captions.srt"
        if (-not (Test-Path $captionsFile)) {
            if (-not (Download-File -Url $Video.captions_url -OutputPath $captionsFile -Description "Captions")) {
                $success = $false
            }
        } else {
            Write-Info "Captions already exist"
        }
    }
    
    return $success
}

function Create-ImagesTxt {
    param(
        [object]$Video,
        [hashtable]$Paths
    )
    
    Write-Header "Creating images.txt"
    
    $imagesTxt = Join-Path $Paths.VideoPath "images.txt"
    
    # Check for images in subdirectory first, then root
    $imageFiles = Get-ChildItem -Path $Paths.ImagesPath -Filter "*.png" | Sort-Object Name
    if ($imageFiles.Count -eq 0) {
        $imageFiles = Get-ChildItem -Path $Paths.VideoPath -Filter "*.png" | Sort-Object Name
    }
    
    if ($imageFiles.Count -eq 0) {
        Write-Error "No images found in $($Paths.ImagesPath) or $($Paths.VideoPath)"
        return $false
    }
    
    $content = @()
    $scenes = $Video.storyboard_json.scenes
    
    for ($i = 0; $i -lt $imageFiles.Count; $i++) {
        $imageFile = $imageFiles[$i]
        $scene = if ($scenes -and $i -lt $scenes.Count) { $scenes[$i] } else { $null }
        $duration = if ($scene -and $scene.duration) { $scene.duration } else { 3 }
        
        # Convert to Unix-style path for FFmpeg
        $unixPath = $imageFile.FullName -replace '\\', '/'
        $content += "file '$unixPath'"
        $content += "duration $duration"
    }
    
    $content -join "`n" | Out-File -FilePath $imagesTxt -Encoding UTF8
    
    if (Test-Path $imagesTxt) {
        Write-Success "Created images.txt with $($imageFiles.Count) images"
        return $true
    } else {
        Write-Error "Failed to create images.txt"
        return $false
    }
}

# 🎬 Rendering Functions
function Test-FFmpeg {
    Write-Header "Checking FFmpeg Availability"
    
    try {
        $version = ffmpeg -version 2>&1 | Select-Object -First 1
        if ($version -match "ffmpeg version") {
            Write-Success "FFmpeg is available: $version"
            return $true
        } else {
            Write-Error "FFmpeg not found or not working"
            return $false
        }
    } catch {
        Write-Error "FFmpeg not available: $($_.Exception.Message)"
        return $false
    }
}

function Get-CaptionsFile {
    param([hashtable]$Paths)
    
    # Check for captions in subdirectory first
    $captionsSrt = Join-Path $Paths.CaptionsPath "captions.srt"
    $captionsVtt = Join-Path $Paths.CaptionsPath "captions.vtt"
    
    if (Test-Path $captionsSrt) {
        return $captionsSrt
    } elseif (Test-Path $captionsVtt) {
        return $captionsVtt
    }
    
    # Check for captions in root directory
    $captionsSrtRoot = Join-Path $Paths.VideoPath "captions.srt"
    $captionsVttRoot = Join-Path $Paths.VideoPath "captions.vtt"
    
    if (Test-Path $captionsSrtRoot) {
        return $captionsSrtRoot
    } elseif (Test-Path $captionsVttRoot) {
        return $captionsVttRoot
    }
    
    return $null
}

function Render-Video {
    param(
        [string]$VideoId,
        [hashtable]$Paths
    )
    
    Write-Header "Rendering Video: $VideoId"
    
    $imagesTxt = Join-Path $Paths.VideoPath "images.txt"
    $audioFile = Join-Path $Paths.AudioPath "audio.mp3"
    $outputFile = Join-Path $Paths.VideoPath "final_video.mp4"
    
    # Verify all required files exist
    $requiredFiles = @($imagesTxt, $audioFile)
    foreach ($file in $requiredFiles) {
        if (-not (Test-Path $file)) {
            Write-Error "Required file missing: $file"
            return $false
        }
    }
    
    # Get captions file if available
    $captionsFile = Get-CaptionsFile -Paths $Paths
    
    # Build FFmpeg command with enhanced subtitle styling
    $ffmpegArgs = @(
        "-y",  # Overwrite output file
        "-f", "concat",
        "-safe", "0",
        "-i", "`"$imagesTxt`"",
        "-i", "`"$audioFile`""
    )
    
    # Add subtitle filter with enhanced styling if captions exist
    if ($captionsFile) {
        $subtitleFilter = "subtitles=`"$captionsFile`":force_style='FontSize=24,PrimaryColour=&Hffffff,OutlineColour=&H000000,BackColour=&H80000000,Outline=2,Shadow=1'"
        $ffmpegArgs += @("-vf", $subtitleFilter)
    }
    
    # Add encoding options
    $ffmpegArgs += @(
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-shortest",
        "`"$outputFile`""
    )
    
    $ffmpegCmd = "ffmpeg " + ($ffmpegArgs -join " ")
    
    Write-Info "Running FFmpeg command:"
    Write-Host $ffmpegCmd -ForegroundColor Gray
    
    # Run FFmpeg with retry logic
    $maxRetries = 3
    $retryCount = 0
    
    while ($retryCount -lt $maxRetries) {
        try {
            $process = Start-Process -FilePath "ffmpeg" -ArgumentList $ffmpegArgs[1..($ffmpegArgs.Length-1)] -Wait -PassThru -NoNewWindow
            
            if ($process.ExitCode -eq 0) {
                if (Test-Path $outputFile) {
                    $size = (Get-Item $outputFile).Length
                    Write-Success "Video rendered successfully: $outputFile ($([math]::Round($size/1MB, 2)) MB)"
                    return $true
                } else {
                    Write-Error "FFmpeg completed but output file not found"
                    return $false
                }
            } else {
                throw "FFmpeg failed with exit code $($process.ExitCode)"
            }
        } catch {
            $retryCount++
            if ($retryCount -lt $maxRetries) {
                Write-Warning "FFmpeg failed (attempt $retryCount/$maxRetries): $($_.Exception.Message)"
                Start-Sleep -Seconds (2 * $retryCount) # Exponential backoff
            } else {
                Write-Error "FFmpeg failed after $maxRetries attempts: $($_.Exception.Message)"
                return $false
            }
        }
    }
    
    return $false
}

# 🔄 Queue Management Functions
function Add-ToQueue {
    param([string]$VideoId)
    
    $job = @{
        VideoId = $VideoId
        QueuedAt = Get-Date
        Status = "Queued"
    }
    
    $Global:RenderQueue.Enqueue($job)
    $Global:JobStats.TotalQueued++
    Write-JobStatus -VideoId $VideoId -Status "QUEUED"
}

function Process-Queue {
    Write-Header "Processing Queue"
    
    while ($Global:RenderQueue.Count -gt 0) {
        $job = $Global:RenderQueue.Dequeue()
        $videoId = $job.VideoId
        
        Write-JobStatus -VideoId $videoId -Status "PROCESSING"
        
        try {
            $success = Process-Video -VideoId $videoId
            if ($success) {
                $Global:JobStats.TotalCompleted++
                Write-JobStatus -VideoId $videoId -Status "COMPLETED"
            } else {
                $Global:JobStats.TotalFailed++
                Write-JobStatus -VideoId $videoId -Status "FAILED"
            }
        } catch {
            $Global:JobStats.TotalFailed++
            Write-JobStatus -VideoId $videoId -Status "FAILED" -Message $_.Exception.Message
        }
    }
}

# 📊 Monitoring Functions
function Show-QueueStatus {
    Write-Header "Queue Status"
    Write-Host "Queued Jobs: $($Global:RenderQueue.Count)" -ForegroundColor $Colors.Info
    Write-Host "Completed Jobs: $($Global:JobStats.TotalCompleted)" -ForegroundColor $Colors.Success
    Write-Host "Failed Jobs: $($Global:JobStats.TotalFailed)" -ForegroundColor $Colors.Error
    
    $elapsed = (Get-Date) - $Global:JobStats.StartTime
    Write-Host "Running Time: $($elapsed.ToString('hh\:mm\:ss'))" -ForegroundColor $Colors.Info
}

# 🚀 Main Functions
function Process-Video {
    param([string]$VideoId)
    
    Write-Header "Processing Video: $VideoId"
    
    # Check existing files
    $fileStatus = Test-VideoFiles -VideoId $VideoId
    Write-Info "Existing files: $($fileStatus.Existing -join ', ')"
    
    if ($fileStatus.Missing.Count -gt 0) {
        Write-Warning "Missing files: $($fileStatus.Missing -join ', ')"
        
        # Get video assets from Supabase
        $video = Get-VideoAssets -VideoId $VideoId
        if (-not $video) {
            Write-Error "Failed to get video assets from Supabase"
            return $false
        }
        
        # Create directories
        $paths = Create-VideoDirectories -VideoId $VideoId
        
        # Download missing assets
        if (-not (Download-VideoAssets -Video $video -Paths $paths)) {
            Write-Error "Failed to download video assets"
            return $false
        }
        
        # Create images.txt
        if (-not (Create-ImagesTxt -Video $video -Paths $paths)) {
            Write-Error "Failed to create images.txt"
            return $false
        }
    } else {
        Write-Success "All required files already exist"
        $paths = @{
            VideoPath = $fileStatus.VideoPath
            ImagesPath = $fileStatus.ImagesPath
            AudioPath = $fileStatus.AudioPath
            CaptionsPath = $fileStatus.CaptionsPath
        }
    }
    
    # Render video
    return Render-Video -VideoId $VideoId -Paths $paths
}

function Show-VideoList {
    Write-Header "Available Videos"
    
    $videos = Get-SupabaseVideos
    if ($videos.Count -eq 0) {
        Write-Warning "No videos found in Supabase"
        return
    }
    
    Write-Host "`nFound $($videos.Count) videos with complete assets:`n" -ForegroundColor $Colors.Info
    
    for ($i = 0; $i -lt $videos.Count; $i++) {
        $video = $videos[$i]
        $status = switch ($video.status) {
            "completed" { "SUCCESS" }
            "assets_generated" { "PROCESSING" }
            "failed" { "FAILED" }
            default { "PENDING" }
        }
        
        Write-Host "$($i + 1). $status $($video.id)" -ForegroundColor White
        Write-Host "   Status: $($video.status)" -ForegroundColor Gray
        Write-Host "   Images: $($video.image_urls.Count)" -ForegroundColor Gray
        Write-Host "   Audio: $(if ($video.audio_url) { 'Yes' } else { 'No' })" -ForegroundColor Gray
        Write-Host "   Captions: $(if ($video.captions_url) { 'Yes' } else { 'No' })" -ForegroundColor Gray
        Write-Host "   Created: $([DateTime]::Parse($video.created_at).ToString('yyyy-MM-dd HH:mm'))" -ForegroundColor Gray
        Write-Host ""
    }
    
    Write-Info "Use: .\auto-render-enhanced.ps1 -VideoId VIDEO_ID to render a specific video"
    Write-Info "Use: .\auto-render-enhanced.ps1 -RenderAll to render all videos"
}

function Queue-AllVideos {
    Write-Header "Queueing All Videos"
    
    $videos = Get-SupabaseVideos
    if ($videos.Count -eq 0) {
        Write-Warning "No videos found to render"
        return
    }
    
    foreach ($video in $videos) {
        Add-ToQueue -VideoId $video.id
    }
    
    Write-Success "Queued $($videos.Count) videos for processing"
    
    # Process queue
    Process-Queue
    
    Write-Header "All Jobs Completed"
    Show-QueueStatus
}

# 🎯 Main Execution
function Main {
    Write-Header "Auto Video Render Script - Enhanced Version"
    
    # Load environment
    Load-Environment
    
    # Check FFmpeg
    if (-not (Test-FFmpeg)) {
        Write-Error "FFmpeg is required but not available. Please install FFmpeg and add it to your PATH."
        exit 1
    }
    
    # Handle different modes
    if ($ListVideos) {
        Show-VideoList
    } elseif ($RenderAll) {
        Queue-AllVideos
    } elseif ($VideoId) {
        Process-Video -VideoId $VideoId
    } else {
        Write-Header "Usage"
        Write-Host "Available commands:" -ForegroundColor $Colors.Info
        Write-Host "  .\auto-render-enhanced.ps1 -ListVideos" -ForegroundColor White
        Write-Host "  .\auto-render-enhanced.ps1 -VideoId VIDEO_ID" -ForegroundColor White
        Write-Host "  .\auto-render-enhanced.ps1 -RenderAll [-MaxWorkers 3]" -ForegroundColor White
        Write-Host ""
        Write-Host "Examples:" -ForegroundColor $Colors.Info
        Write-Host "  .\auto-render-enhanced.ps1 -ListVideos" -ForegroundColor Gray
        Write-Host "  .\auto-render-enhanced.ps1 -VideoId f04df512-ee66-48f2-b8e6-e2fac9f3e6da" -ForegroundColor Gray
        Write-Host "  .\auto-render-enhanced.ps1 -RenderAll -MaxWorkers 5" -ForegroundColor Gray
    }
}

# Run the script
Main 