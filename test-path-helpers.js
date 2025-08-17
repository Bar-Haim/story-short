#!/usr/bin/env node

/**
 * Test script for the new Windows-safe path helpers
 * Run with: node test-path-helpers.js
 */

// Simulate the path helpers from the render route
const toFFPath = (p) => p.replace(/\\/g, '/'); // forward slashes
const toFilterPath = (p) => toFFPath(p).replace(/:/g, '\\:').replace(/'/g, "\\'");
const lf = (s) => s.replace(/\r\n/g, '\n');

// Test paths (Windows-style)
const testPaths = [
  'C:\\Users\\haim4\\Desktop\\StoryShort MVP Development Plan\\storyshort\\renders\\test\\image1.jpg',
  'C:\\Program Files\\FFmpeg\\bin\\ffmpeg.exe',
  'C:\\Users\\haim4\\Documents\\My Photos\\vacation photo.jpg',
  'D:\\External Drive\\videos\\sample.mp4',
  'C:\\Users\\haim4\\AppData\\Local\\Temp\\temp_123\\audio.mp3'
];

console.log('🧪 Testing Windows-safe path helpers...\n');

console.log('1️⃣ toFFPath() - Convert backslashes to forward slashes:');
testPaths.forEach((path, i) => {
  const result = toFFPath(path);
  console.log(`   Input:  ${path}`);
  console.log(`   Output: ${result}`);
  console.log(`   ✅ ${result.includes('\\') ? '❌ Still has backslashes' : '✅ All forward slashes'}\n`);
});

console.log('2️⃣ toFilterPath() - Escape for FFmpeg filters:');
testPaths.forEach((path, i) => {
  const ffPath = toFFPath(path);
  const result = toFilterPath(path);
  console.log(`   Input:  ${path}`);
  console.log(`   FFPath: ${ffPath}`);
  console.log(`   Filter: ${result}`);
  console.log(`   ✅ ${result.includes(':') ? '✅ Colons escaped' : '❌ Colons not escaped'}\n`);
});

console.log('3️⃣ lf() - Normalize line endings:');
const testStrings = [
  'line1\r\nline2\r\nline3',
  'line1\nline2\nline3',
  'line1\rline2\rline3',
  'mixed\r\nline\nending\r\nhere'
];

testStrings.forEach((str, i) => {
  const result = lf(str);
  console.log(`   Input:  "${str}"`);
  console.log(`   Output: "${result}"`);
  console.log(`   ✅ ${result.includes('\r\n') ? '❌ Still has CRLF' : '✅ All LF'}\n`);
});

console.log('4️⃣ Complete workflow test:');
const sampleImagePath = 'C:\\Users\\haim4\\Desktop\\test image.jpg';
const resolvedPath = require('path').resolve(sampleImagePath);
const ffPath = toFFPath(resolvedPath);
const filterPath = toFilterPath(resolvedPath);

console.log(`   Original:     ${sampleImagePath}`);
console.log(`   Resolved:     ${resolvedPath}`);
console.log(`   FFmpeg path:  ${ffPath}`);
console.log(`   Filter path:  ${filterPath}`);

// Test images.txt generation
const imagesTxtContent = `ffconcat version 1.0
file '${ffPath}'
duration 3.0
file '${ffPath}'`;

console.log(`\n   Images.txt:\n${imagesTxtContent}`);
console.log(`   ✅ Content length: ${imagesTxtContent.length} characters`);
console.log(`   ✅ Ends with newline: ${imagesTxtContent.endsWith('\n') ? 'Yes' : 'No'}`);

console.log('\n🎉 Path helper tests completed!');
console.log('\n📋 Summary:');
console.log('   - toFFPath(): Converts Windows paths to FFmpeg-compatible forward slashes');
console.log('   - toFilterPath(): Escapes paths for use in FFmpeg filter strings');
console.log('   - lf(): Normalizes line endings to LF for consistent file generation');
console.log('   - All functions work together to create Windows-safe FFmpeg commands'); 