# FFmpeg Installation Script for Windows
# This script downloads and installs FFmpeg for Windows

Write-Host "Installing FFmpeg for StoryShort..." -ForegroundColor Green

# Create FFmpeg directory in user profile
$ffmpegDir = "$env:USERPROFILE\ffmpeg"
$ffmpegBinDir = "$ffmpegDir\bin"

if (!(Test-Path $ffmpegDir)) {
    New-Item -ItemType Directory -Path $ffmpegDir -Force | Out-Null
    Write-Host "Created FFmpeg directory: $ffmpegDir" -ForegroundColor Green
}

# Download FFmpeg (using a direct download link)
$ffmpegUrl = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
$zipPath = "$env:TEMP\ffmpeg.zip"

Write-Host "Downloading FFmpeg..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri $ffmpegUrl -OutFile $zipPath -UseBasicParsing
    Write-Host "Download completed" -ForegroundColor Green
} catch {
    Write-Host "Failed to download FFmpeg: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Extract FFmpeg
Write-Host "Extracting FFmpeg..." -ForegroundColor Yellow
try {
    Expand-Archive -Path $zipPath -DestinationPath $ffmpegDir -Force
    Write-Host "Extraction completed" -ForegroundColor Green
} catch {
    Write-Host "Failed to extract FFmpeg: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Find the extracted folder (it might have a version number)
$extractedFolders = Get-ChildItem -Path $ffmpegDir -Directory | Where-Object { $_.Name -like "ffmpeg*" }
if ($extractedFolders.Count -eq 0) {
    Write-Host "Could not find extracted FFmpeg folder" -ForegroundColor Red
    exit 1
}

$ffmpegExtractedDir = $extractedFolders[0].FullName
$ffmpegBinSource = "$ffmpegExtractedDir\bin"

# Copy files to the bin directory
if (!(Test-Path $ffmpegBinDir)) {
    New-Item -ItemType Directory -Path $ffmpegBinDir -Force | Out-Null
}

Write-Host "Copying FFmpeg files..." -ForegroundColor Yellow
Copy-Item -Path "$ffmpegBinSource\*" -Destination $ffmpegBinDir -Recurse -Force

# Add to PATH
$currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($currentPath -notlike "*$ffmpegBinDir*") {
    $newPath = "$currentPath;$ffmpegBinDir"
    [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
    Write-Host "Added FFmpeg to PATH" -ForegroundColor Green
} else {
    Write-Host "FFmpeg already in PATH" -ForegroundColor Blue
}

# Clean up
Remove-Item -Path $zipPath -Force -ErrorAction SilentlyContinue
Remove-Item -Path $ffmpegExtractedDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "FFmpeg installation completed!" -ForegroundColor Green
Write-Host "FFmpeg location: $ffmpegBinDir" -ForegroundColor Cyan
Write-Host "Please restart your terminal/PowerShell to use FFmpeg" -ForegroundColor Yellow

# Test FFmpeg
Write-Host "Testing FFmpeg installation..." -ForegroundColor Yellow
try {
    $env:PATH = "$ffmpegBinDir;$env:PATH"
    $ffmpegVersion = & "$ffmpegBinDir\ffmpeg.exe" -version 2>&1 | Select-Object -First 1
    Write-Host "FFmpeg test successful: $ffmpegVersion" -ForegroundColor Green
} catch {
    Write-Host "FFmpeg test failed. Please restart your terminal and try again." -ForegroundColor Red
} 