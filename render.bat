@echo off
echo 🎬 StoryShort Auto Video Render
echo ================================
echo.

REM Check if PowerShell is available
powershell.exe -Command "Write-Host 'PowerShell is available'" >nul 2>&1
if errorlevel 1 (
    echo ❌ PowerShell is not available or not working
    pause
    exit /b 1
)

REM Check if the PowerShell script exists
if not exist "%~dp0auto-render-video.ps1" (
    echo ❌ auto-render-video.ps1 not found in current directory
    echo Please ensure the script is in the same directory as this batch file
    pause
    exit /b 1
)

REM Run the PowerShell script with all arguments
echo 🚀 Starting auto-render script...
echo.
powershell.exe -ExecutionPolicy Bypass -File "%~dp0auto-render-video.ps1" %*

REM Check if the script ran successfully
if errorlevel 1 (
    echo.
    echo ❌ Script execution failed
    echo Check the error messages above for details
) else (
    echo.
    echo ✅ Script execution completed
)

echo.
echo Press any key to exit...
pause >nul 