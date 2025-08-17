import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const rendersPath = path.join(process.cwd(), 'renders');

// קבלת רשימת תיקיות ממויינת לפי תאריך יצירה (חדשות לגבוהות)
const folders = fs.readdirSync(rendersPath)
  .map(name => ({
    name,
    time: fs.statSync(path.join(rendersPath, name)).ctime.getTime()
  }))
  .sort((a, b) => b.time - a.time);

if (folders.length === 0) {
  console.error('No video render folders found!');
  process.exit(1);
}

const latestVideoId = folders[0].name;
const folderPath = path.join(rendersPath, latestVideoId);

const imagesTxt = path.join(folderPath, 'images.txt');
const audioPath = path.join(folderPath, 'audio.mp3');
const captionsPath = path.join(folderPath, 'captions.vtt');
const outputPath = path.join(folderPath, 'preview.mp4');

const ffmpegCmd = `ffmpeg -y -f concat -safe 0 -i "${imagesTxt}" -i "${audioPath}" -vf "subtitles=${captionsPath}" -c:v libx264 -pix_fmt yuv420p -c:a aac "${outputPath}"`;

console.log('Running ffmpeg command:\n', ffmpegCmd);

try {
  execSync(ffmpegCmd, { stdio: 'inherit' });
  console.log('✅ Video rendered successfully:', outputPath);
} catch (error) {
  console.error('❌ FFmpeg failed:', error);
  process.exit(1);
}
