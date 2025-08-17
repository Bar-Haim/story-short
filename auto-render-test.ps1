# 🎬 Auto Video Render Script - Test Version
# This script tests basic functionality without requiring environment setup

param(
    [Parameter(Mandatory=$false)]
    [string]$VideoId,
    
    [Parameter(Mandatory=$false)]
    [switch]$TestFFmpeg,
    
    [Parameter(Mandatory=$false)]
    [switch]$TestFiles
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

function Test-RendersDirectory {
    Write-Header "Testing Renders Directory"
    
    if (-not (Test-Path $RendersPath)) {
        Write-Warning "Renders directory does not exist: $RendersPath"
        Write-Info "Creating renders directory..."
        New-Item -ItemType Directory -Path $RendersPath -Force | Out-Null
        Write-Success "Created renders directory"
    } else {
        Write-Success "Renders directory exists: $RendersPath"
    }
    
    # List existing video directories
    $videoDirs = Get-ChildItem -Path $RendersPath -Directory | Sort-Object Name
    if ($videoDirs.Count -gt 0) {
        Write-Info "Found $($videoDirs.Count) video directories:"
        foreach ($dir in $videoDirs) {
            Write-Host "  - $($dir.Name)" -ForegroundColor Gray
        }
    } else {
        Write-Info "No video directories found"
    }
}

function Test-VideoFiles {
    param([string]$VideoId)
    
    Write-Header "Testing Video Files for: $VideoId"
    
    $videoPath = Join-Path $RendersPath $VideoId
    $imagesPath = Join-Path $videoPath "images"
    $audioPath = Join-Path $videoPath "audio"
    $captionsPath = Join-Path $videoPath "captions"
    
    $missing = @()
    $existing = @()
    
    # Check if video directory exists
    if (-not (Test-Path $videoPath)) {
        Write-Warning "Video directory does not exist: $videoPath"
        return @{
            Missing = @("video directory")
            Existing = @()
            VideoPath = $videoPath
            ImagesPath = $imagesPath
            AudioPath = $audioPath
            CaptionsPath = $captionsPath
        }
    }
    
    # Check images.txt
    $imagesTxt = Join-Path $videoPath "images.txt"
    if (Test-Path $imagesTxt) {
        $existing += "images.txt"
        Write-Success "Found images.txt"
    } else {
        $missing += "images.txt"
        Write-Warning "Missing images.txt"
    }
    
    # Check audio.mp3
    $audioFile = Join-Path $audioPath "audio.mp3"
    if (Test-Path $audioFile) {
        $existing += "audio.mp3"
        Write-Success "Found audio.mp3"
    } else {
        $missing += "audio.mp3"
        Write-Warning "Missing audio.mp3"
    }
    
    # Check captions with subdirectory support
    $captionsSrt = Join-Path $captionsPath "captions.srt"
    $captionsVtt = Join-Path $captionsPath "captions.vtt"
    $captionsSrtRoot = Join-Path $videoPath "captions.srt"
    $captionsVttRoot = Join-Path $videoPath "captions.vtt"
    
    if (Test-Path $captionsSrt) {
        $existing += "captions.srt (subdirectory)"
        Write-Success "Found captions.srt in subdirectory"
    } elseif (Test-Path $captionsVtt) {
        $existing += "captions.vtt (subdirectory)"
        Write-Success "Found captions.vtt in subdirectory"
    } elseif (Test-Path $captionsSrtRoot) {
        $existing += "captions.srt (root)"
        Write-Success "Found captions.srt in root"
    } elseif (Test-Path $captionsVttRoot) {
        $existing += "captions.vtt (root)"
        Write-Success "Found captions.vtt in root"
    } else {
        $missing += "captions"
        Write-Warning "Missing captions file"
    }
    
    # Check images directory with subdirectory support
    if (Test-Path $imagesPath) {
        $imageFiles = Get-ChildItem -Path $imagesPath -Filter "*.png" | Measure-Object
        if ($imageFiles.Count -gt 0) {
            $existing += "$($imageFiles.Count) images (subdirectory)"
            Write-Success "Found $($imageFiles.Count) images in subdirectory"
        } else {
            $missing += "images"
            Write-Warning "No images found in subdirectory"
        }
    } else {
        # Check for images in root directory
        $imageFilesRoot = Get-ChildItem -Path $videoPath -Filter "*.png" | Measure-Object
        if ($imageFilesRoot.Count -gt 0) {
            $existing += "$($imageFilesRoot.Count) images (root)"
            Write-Success "Found $($imageFilesRoot.Count) images in root"
        } else {
            $missing += "images"
            Write-Warning "No images found"
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

function Show-Usage {
    Write-Header "Auto Video Render Script - Test Version"
    Write-Host "Available commands:" -ForegroundColor $Colors.Info
    Write-Host "  .\auto-render-test.ps1 -TestFFmpeg" -ForegroundColor White
    Write-Host "  .\auto-render-test.ps1 -TestFiles" -ForegroundColor White
    Write-Host "  .\auto-render-test.ps1 -VideoId VIDEO_ID" -ForegroundColor White
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor $Colors.Info
    Write-Host "  .\auto-render-test.ps1 -TestFFmpeg" -ForegroundColor Gray
    Write-Host "  .\auto-render-test.ps1 -TestFiles" -ForegroundColor Gray
    Write-Host "  .\auto-render-test.ps1 -VideoId f04df512-ee66-48f2-b8e6-e2fac9f3e6da" -ForegroundColor Gray
}

# 🎯 Main Execution
function Main {
    if ($TestFFmpeg) {
        Test-FFmpeg
    } elseif ($TestFiles) {
        Test-RendersDirectory
    } elseif ($VideoId) {
        Test-VideoFiles -VideoId $VideoId
    } else {
        Show-Usage
    }
}

# Run the script
Main 