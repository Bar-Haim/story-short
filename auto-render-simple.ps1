# 🎬 Simple Auto Video Render Script
param(
    [Parameter(Mandatory=$false)]
    [string]$VideoId,
    
    [Parameter(Mandatory=$false)]
    [switch]$ListVideos,
    
    [Parameter(Mandatory=$false)]
    [switch]$RenderAll
)

# Configuration
$BasePath = Split-Path -Parent $PSScriptRoot
$RendersPath = Join-Path $BasePath "renders"

# Colors
$Success = "Green"
$Error = "Red"
$Warning = "Yellow"
$Info = "Cyan"

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor $Success
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor $Error
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️ $Message" -ForegroundColor $Warning
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️ $Message" -ForegroundColor $Info
}

function Test-FFmpeg {
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

function Show-Usage {
    Write-Host "`n🎬 Auto Video Render Script" -ForegroundColor Magenta
    Write-Host "================================" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "Available commands:" -ForegroundColor $Info
    Write-Host "  .\auto-render-simple.ps1 -ListVideos" -ForegroundColor White
    Write-Host "  .\auto-render-simple.ps1 -VideoId VIDEO_ID" -ForegroundColor White
    Write-Host "  .\auto-render-simple.ps1 -RenderAll" -ForegroundColor White
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor $Info
    Write-Host "  .\auto-render-simple.ps1 -ListVideos" -ForegroundColor Gray
    Write-Host "  .\auto-render-simple.ps1 -VideoId f04df512-ee66-48f2-b8e6-e2fac9f3e6da" -ForegroundColor Gray
    Write-Host "  .\auto-render-simple.ps1 -RenderAll" -ForegroundColor Gray
}

# Main execution
Write-Host "🎬 Auto Video Render Script" -ForegroundColor Magenta
Write-Host "================================" -ForegroundColor Magenta

# Check FFmpeg
if (-not (Test-FFmpeg)) {
    Write-Error "FFmpeg is required but not available. Please install FFmpeg and add it to your PATH."
    exit 1
}

# Handle different modes
if ($ListVideos) {
    Write-Info "List videos mode - This would show available videos from Supabase"
    Write-Warning "Full Supabase integration not implemented in this simple version"
} elseif ($RenderAll) {
    Write-Info "Render all videos mode - This would process all available videos"
    Write-Warning "Full Supabase integration not implemented in this simple version"
} elseif ($VideoId) {
    Write-Info "Processing video: $VideoId"
    Write-Warning "Full Supabase integration not implemented in this simple version"
} else {
    Show-Usage
}

Write-Success "Script completed successfully!" 