@echo off
echo 🎬 Rendering video for f04df512-ee66-48f2-b8e6-e2fac9f3e6da...
echo.

echo 📹 Basic rendering...
ffmpeg -y -f concat -safe 0 -i "images.txt" -i "audio/audio.mp3" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -shortest "final_video.mp4"

echo.
echo ✅ Rendering complete!
echo 📄 Output: final_video.mp4
pause
