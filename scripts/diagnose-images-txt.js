#!/usr/bin/env node

/**
 * 🛠️ Images.txt Diagnostic and Fix Script
 * 
 * This script helps diagnose and fix issues with missing images.txt files
 * during video rendering with FFmpeg.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Images.txt Diagnostic Tool');
console.log('============================\n');

// Configuration
const RENDERS_DIR = path.join(__dirname, '../renders');
const TEMP_DIR = path.join(process.cwd(), 'temp');

// Utility functions
function checkDirectory(dirPath, description) {
  console.log(`📁 Checking ${description}: ${dirPath}`);
  
  if (!fs.existsSync(dirPath)) {
    console.log(`   ❌ Directory does not exist`);
    return false;
  }
  
  const stats = fs.statSync(dirPath);
  if (!stats.isDirectory()) {
    console.log(`   ❌ Path exists but is not a directory`);
    return false;
  }
  
  console.log(`   ✅ Directory exists`);
  return true;
}

function listFiles(dirPath, description) {
  console.log(`\n📋 Listing files in ${description}:`);
  
  if (!fs.existsSync(dirPath)) {
    console.log(`   ❌ Directory does not exist`);
    return [];
  }
  
  try {
    const files = fs.readdirSync(dirPath);
    if (files.length === 0) {
      console.log(`   📭 Directory is empty`);
      return [];
    }
    
    files.forEach(file => {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      const size = stats.isFile() ? `(${stats.size} bytes)` : '(directory)';
      console.log(`   📄 ${file} ${size}`);
    });
    
    return files;
  } catch (error) {
    console.log(`   ❌ Error reading directory: ${error.message}`);
    return [];
  }
}

function findImagesTxtFiles(startDir) {
  console.log(`\n🔍 Searching for images.txt files in: ${startDir}`);
  
  const foundFiles = [];
  
  function searchRecursively(dir) {
    if (!fs.existsSync(dir)) return;
    
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stats = fs.statSync(itemPath);
        
        if (stats.isDirectory()) {
          searchRecursively(itemPath);
        } else if (item === 'images.txt') {
          foundFiles.push(itemPath);
          console.log(`   ✅ Found: ${itemPath} (${stats.size} bytes)`);
        }
      }
    } catch (error) {
      console.log(`   ⚠️ Error searching ${dir}: ${error.message}`);
    }
  }
  
  searchRecursively(startDir);
  
  if (foundFiles.length === 0) {
    console.log(`   ❌ No images.txt files found`);
  }
  
  return foundFiles;
}

function createSampleImagesTxt() {
  console.log(`\n🛠️ Creating sample images.txt file for testing...`);
  
  const sampleDir = path.join(RENDERS_DIR, 'test-images-txt');
  const sampleImagesTxt = path.join(sampleDir, 'images.txt');
  
  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(sampleDir)) {
      fs.mkdirSync(sampleDir, { recursive: true });
      console.log(`   📁 Created directory: ${sampleDir}`);
    }
    
    // Create sample images.txt content
    const sampleContent = `file 'scene_1.png'
duration 3
file 'scene_2.png'
duration 3
file 'scene_3.png'
duration 3`;
    
    fs.writeFileSync(sampleImagesTxt, sampleContent);
    console.log(`   ✅ Created sample images.txt: ${sampleImagesTxt}`);
    console.log(`   📄 Content:`);
    console.log(`   ${sampleContent.split('\n').map(line => `   ${line}`).join('\n')}`);
    
    return sampleImagesTxt;
  } catch (error) {
    console.log(`   ❌ Error creating sample file: ${error.message}`);
    return null;
  }
}

function validateImagesTxtFormat(filePath) {
  console.log(`\n🔍 Validating images.txt format: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`   ❌ File does not exist`);
    return false;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    console.log(`   📄 File size: ${content.length} characters`);
    console.log(`   📄 Number of lines: ${lines.length}`);
    
    // Validate FFmpeg concat format
    let isValid = true;
    let errors = [];
    
    for (let i = 0; i < lines.length; i += 2) {
      const fileLine = lines[i];
      const durationLine = lines[i + 1];
      
      if (!fileLine.startsWith('file ')) {
        errors.push(`Line ${i + 1}: Expected 'file ' but got '${fileLine}'`);
        isValid = false;
      }
      
      if (durationLine && !durationLine.startsWith('duration ')) {
        errors.push(`Line ${i + 2}: Expected 'duration ' but got '${durationLine}'`);
        isValid = false;
      }
      
      // Check if file path is quoted
      const fileMatch = fileLine.match(/file '(.+)'/);
      if (!fileMatch) {
        errors.push(`Line ${i + 1}: File path should be quoted`);
        isValid = false;
      }
    }
    
    if (isValid) {
      console.log(`   ✅ File format is valid`);
      console.log(`   📄 Content preview:`);
      console.log(`   ${content.split('\n').slice(0, 6).map(line => `   ${line}`).join('\n')}`);
      if (content.split('\n').length > 6) {
        console.log(`   ...`);
      }
    } else {
      console.log(`   ❌ File format is invalid:`);
      errors.forEach(error => console.log(`   ${error}`));
    }
    
    return isValid;
  } catch (error) {
    console.log(`   ❌ Error reading file: ${error.message}`);
    return false;
  }
}

function checkFFmpegAvailability() {
  console.log(`\n🎬 Checking FFmpeg availability...`);
  
  try {
    const version = execSync('ffmpeg -version', { encoding: 'utf8', timeout: 5000 });
    console.log(`   ✅ FFmpeg is available`);
    console.log(`   📄 Version: ${version.split('\n')[0]}`);
    return true;
  } catch (error) {
    console.log(`   ❌ FFmpeg is not available: ${error.message}`);
    console.log(`   💡 Please install FFmpeg and ensure it's in your PATH`);
    return false;
  }
}

function suggestFixes() {
  console.log(`\n💡 Suggested Fixes:`);
  console.log(`==================`);
  
  console.log(`1. 📁 Ensure renders directory structure:`);
  console.log(`   - Create: ${RENDERS_DIR}`);
  console.log(`   - Each video should have: renders/{videoId}/images/`);
  console.log(`   - images.txt should be in the same directory as images`);
  
  console.log(`\n2. 🔧 Update render-video route to save images.txt permanently:`);
  console.log(`   - Currently images.txt is created in temp directory`);
  console.log(`   - Add code to save it to renders/{videoId}/images.txt`);
  
  console.log(`\n3. 📋 Ensure proper images.txt format:`);
  console.log(`   file 'scene_1.png'`);
  console.log(`   duration 3`);
  console.log(`   file 'scene_2.png'`);
  console.log(`   duration 3`);
  
  console.log(`\n4. 🎬 Test FFmpeg command manually:`);
  console.log(`   ffmpeg -f concat -safe 0 -i "images.txt" -i "audio.mp3" output.mp4`);
}

// Main diagnostic process
async function runDiagnostics() {
  console.log('🚀 Starting diagnostics...\n');
  
  // 1. Check renders directory
  const rendersExists = checkDirectory(RENDERS_DIR, 'renders directory');
  
  if (rendersExists) {
    // 2. List video directories
    const videoDirs = listFiles(RENDERS_DIR, 'renders directory');
    
    // 3. Search for images.txt files
    const foundImagesTxt = findImagesTxtFiles(RENDERS_DIR);
    
    // 4. Validate any found images.txt files
    foundImagesTxt.forEach(filePath => {
      validateImagesTxtFormat(filePath);
    });
    
    // 5. Check a specific video directory if it exists
    if (videoDirs.length > 0) {
      const firstVideoDir = path.join(RENDERS_DIR, videoDirs[0]);
      console.log(`\n📁 Examining first video directory: ${firstVideoDir}`);
      listFiles(firstVideoDir, 'video directory');
    }
  }
  
  // 6. Check FFmpeg availability
  checkFFmpegAvailability();
  
  // 7. Create sample images.txt for testing
  const sampleFile = createSampleImagesTxt();
  
  if (sampleFile) {
    validateImagesTxtFormat(sampleFile);
  }
  
  // 8. Provide suggestions
  suggestFixes();
  
  console.log(`\n✅ Diagnostics complete!`);
}

// Run the diagnostics
runDiagnostics().catch(error => {
  console.error('❌ Diagnostic error:', error);
  process.exit(1);
}); 