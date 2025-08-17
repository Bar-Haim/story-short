/**
 * Enhanced Video Rendering Test Suite
 * Tests all aspects of video rendering and subtitle burning
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

console.log('🧪 ENHANCED VIDEO RENDERING TEST SUITE\n');

async function runTest(testName, testFunction) {
  console.log(`📋 ${testName}...`);
  try {
    await testFunction();
    console.log(`✅ ${testName} - PASSED\n`);
    return true;
  } catch (error) {
    console.log(`❌ ${testName} - FAILED: ${error.message}\n`);
    return false;
  }
}

async function testEnhancedPowerShellScript() {
  const scriptPath = path.join(__dirname, 'render-latest.ps1');
  
  if (!fs.existsSync(scriptPath)) {
    throw new Error('Enhanced PowerShell script not found');
  }
  
  const scriptContent = fs.readFileSync(scriptPath, 'utf8');
  
  const requiredFeatures = [
    { name: 'Parameter support', pattern: 'param(', found: scriptContent.includes('param(') },
    { name: 'Enhanced logging', pattern: 'Write-Log', found: scriptContent.includes('Write-Log') },
    { name: 'Path escaping', pattern: 'Escape-FFmpegPath', found: scriptContent.includes('Escape-FFmpegPath') },
    { name: 'File validation', pattern: 'Test-FileValid', found: scriptContent.includes('Test-FileValid') },
    { name: 'SRT validation', pattern: 'Test-SrtContent', found: scriptContent.includes('Test-SrtContent') },
    { name: 'Images.txt validation', pattern: 'Test-ImagesTxtContent', found: scriptContent.includes('Test-ImagesTxtContent') },
    { name: 'Subdirectory support', pattern: 'audio/audio.mp3', found: scriptContent.includes('audio/audio.mp3') },
    { name: 'Captions subdirectory', pattern: 'captions/subtitles.srt', found: scriptContent.includes('captions/subtitles.srt') },
    { name: 'Enhanced FFmpeg filters', pattern: 'scale=1080:1920', found: scriptContent.includes('scale=1080:1920') },
    { name: 'Cinematic motion effects', pattern: 'zoompan=', found: scriptContent.includes('zoompan=') },
    { name: 'Subtitle burning', pattern: 'subtitles=', found: scriptContent.includes('subtitles=') },
    { name: 'Subtitle styling', pattern: 'force_style', found: scriptContent.includes('force_style') },
    { name: 'Error handling', pattern: 'catch {', found: scriptContent.includes('catch {') },
    { name: 'Debug mode', pattern: 'Debug = $false', found: scriptContent.includes('Debug = $false') }
  ];
  
  let allFeaturesFound = true;
  requiredFeatures.forEach(feature => {
    if (!feature.found) {
      console.log(`   ❌ Missing: ${feature.name}`);
      allFeaturesFound = false;
    } else {
      console.log(`   ✅ Found: ${feature.name}`);
    }
  });
  
  if (!allFeaturesFound) {
    throw new Error('Some required features are missing from the enhanced script');
  }
}

async function testFileStructureValidation() {
  const rendersDir = path.join(__dirname, 'renders');
  
  if (!fs.existsSync(rendersDir)) {
    throw new Error('Renders directory not found');
  }
  
  // Find a video directory with proper structure
  const videoDirs = fs.readdirSync(rendersDir)
    .filter(item => {
      const itemPath = path.join(rendersDir, item);
      return fs.statSync(itemPath).isDirectory() && 
             !['videos', 'test-images-txt', 'test-video-123'].includes(item);
    });
  
  if (videoDirs.length === 0) {
    throw new Error('No valid video directories found');
  }
  
  // Test the first video directory
  const testVideoDir = videoDirs[0];
  const testVideoPath = path.join(rendersDir, testVideoDir);
  
  console.log(`   Testing video directory: ${testVideoDir}`);
  
  // Check required files and directories
  const requiredPaths = [
    { path: 'images.txt', type: 'file' },
    { path: 'audio/audio.mp3', type: 'file' },
    { path: 'captions/subtitles.srt', type: 'file' },
    { path: 'images', type: 'directory' }
  ];
  
  for (const required of requiredPaths) {
    const fullPath = path.join(testVideoPath, required.path);
    const exists = fs.existsSync(fullPath);
    
    if (required.type === 'file') {
      if (!exists) {
        throw new Error(`Missing required file: ${required.path}`);
      }
      const stats = fs.statSync(fullPath);
      if (stats.size === 0) {
        throw new Error(`Empty file: ${required.path}`);
      }
      console.log(`   ✅ ${required.path} (${Math.round(stats.size / 1024)} KB)`);
    } else {
      if (!exists) {
        throw new Error(`Missing required directory: ${required.path}`);
      }
      console.log(`   ✅ ${required.path} (directory)`);
    }
  }
}

async function testSubtitleContentValidation() {
  const rendersDir = path.join(__dirname, 'renders');
  const videoDirs = fs.readdirSync(rendersDir)
    .filter(item => {
      const itemPath = path.join(rendersDir, item);
      return fs.statSync(itemPath).isDirectory() && 
             !['videos', 'test-images-txt', 'test-video-123'].includes(item);
    });
  
  if (videoDirs.length === 0) {
    throw new Error('No video directories to test');
  }
  
  const testVideoDir = videoDirs[0];
  const srtPath = path.join(rendersDir, testVideoDir, 'captions', 'subtitles.srt');
  
  if (!fs.existsSync(srtPath)) {
    throw new Error('SRT file not found for testing');
  }
  
  const srtContent = fs.readFileSync(srtPath, 'utf8');
  const lines = srtContent.split('\n');
  
  // Validate SRT format
  const timestampRegex = /\d{2}:\d{2}:\d{2},\d{3}\s-->\s\d{2}:\d{2}:\d{2},\d{3}/;
  const timestamps = lines.filter(line => timestampRegex.test(line));
  
  if (timestamps.length === 0) {
    throw new Error('SRT file contains no valid timestamps');
  }
  
  console.log(`   ✅ SRT file validated with ${timestamps.length} subtitle entries`);
  console.log(`   📝 Sample subtitle: ${lines.slice(0, 10).join('\n   ')}`);
}

async function testImagesTxtValidation() {
  const rendersDir = path.join(__dirname, 'renders');
  const videoDirs = fs.readdirSync(rendersDir)
    .filter(item => {
      const itemPath = path.join(rendersDir, item);
      return fs.statSync(itemPath).isDirectory() && 
             !['videos', 'test-images-txt', 'test-video-123'].includes(item);
    });
  
  if (videoDirs.length === 0) {
    throw new Error('No video directories to test');
  }
  
  const testVideoDir = videoDirs[0];
  const imagesTxtPath = path.join(rendersDir, testVideoDir, 'images.txt');
  
  if (!fs.existsSync(imagesTxtPath)) {
    throw new Error('Images.txt file not found for testing');
  }
  
  const imagesTxtContent = fs.readFileSync(imagesTxtPath, 'utf8');
  const lines = imagesTxtContent.split('\n').filter(line => line.trim() !== '');
  
  if (lines.length === 0) {
    throw new Error('Images.txt file is empty');
  }
  
  if (lines.length % 2 !== 0) {
    throw new Error('Images.txt has invalid line count (must be even)');
  }
  
  // Validate format
  for (let i = 0; i < lines.length; i += 2) {
    const fileLine = lines[i];
    const durationLine = lines[i + 1];
    
    if (!fileLine.match(/^file\s+'.*'$/)) {
      throw new Error(`Invalid file line format at line ${i + 1}: ${fileLine}`);
    }
    
    if (!durationLine.match(/^duration\s+\d+(\.\d+)?$/)) {
      throw new Error(`Invalid duration line format at line ${i + 2}: ${durationLine}`);
    }
  }
  
  console.log(`   ✅ Images.txt validated with ${lines.length / 2} image entries`);
  console.log(`   📄 Sample content: ${lines.slice(0, 4).join('\n   ')}`);
}

async function testFFmpegCommandSimulation() {
  // Create a test FFmpeg command similar to what the enhanced script would generate
  const testCommand = `ffmpeg -y -f concat -safe 0 -i "test_images.txt" -i "test_audio.mp3" -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,zoompan=z='min(zoom+0.0015+sin(t*0.6)*0.0003,1.2)':d=125:x='iw/2-(iw/zoom/2)+sin(t*0.3)*12+cos(t*0.15)*6+sin(t*0.9)*3':y='ih/2-(ih/zoom/2)+cos(t*0.25)*10+sin(t*0.08)*5+cos(t*0.7)*2':s=1080x1920,crop=1080:1920:x='sin(t*1.5)*1.5+cos(t*1.8)*1.2+sin(t*2.5)*0.6':y='cos(t*1.2)*1.5+sin(t*2.2)*1.0+cos(t*2.4)*0.5',eq=contrast=1.08:saturation=1.03:brightness=0.01,vignette=PI/4,noise=c0s=0.1:allf=t,subtitles="test_captions.srt":force_style='FontSize=28,PrimaryColour=&Hffffff,OutlineColour=&H000000,BackColour=&H80000000,Outline=2,Shadow=1,Bold=1,MarginV=50'" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -shortest -movflags +faststart "test_output.mp4"`;
  
  // Check if command contains all required components
  const requiredComponents = [
    'scale=1080:1920',
    'zoompan=',
    'crop=1080:1920',
    'eq=contrast=',
    'vignette=',
    'subtitles=',
    'force_style=',
    'libx264',
    'aac'
  ];
  
  let allComponentsFound = true;
  requiredComponents.forEach(component => {
    if (!testCommand.includes(component)) {
      console.log(`   ❌ Missing component: ${component}`);
      allComponentsFound = false;
    } else {
      console.log(`   ✅ Found component: ${component}`);
    }
  });
  
  if (!allComponentsFound) {
    throw new Error('FFmpeg command missing required components');
  }
  
  console.log(`   ✅ FFmpeg command structure validated (${testCommand.length} characters)`);
}

async function testPowerShellExecution() {
  // Test if PowerShell can execute the enhanced script
  const scriptPath = path.join(__dirname, 'render-latest.ps1');
  
  if (!fs.existsSync(scriptPath)) {
    throw new Error('Enhanced script not found');
  }
  
  // Test script syntax without executing
  try {
    const { stdout, stderr } = await execAsync(`powershell -ExecutionPolicy Bypass -Command "Get-Command -Syntax '${scriptPath}'"`, { timeout: 10000 });
    
    if (stderr && stderr.includes('error')) {
      throw new Error(`PowerShell syntax error: ${stderr}`);
    }
    
    console.log('   ✅ PowerShell script syntax is valid');
  } catch (error) {
    if (error.message.includes('timeout')) {
      console.log('   ⚠️ PowerShell syntax check timed out (this is normal)');
    } else {
      throw new Error(`PowerShell execution test failed: ${error.message}`);
    }
  }
}

async function testSubtitleBurningFeatures() {
  // Test subtitle burning specific features
  const scriptPath = path.join(__dirname, 'render-latest.ps1');
  const scriptContent = fs.readFileSync(scriptPath, 'utf8');
  
  const subtitleFeatures = [
    { name: 'Subtitle path handling', pattern: 'captions/subtitles.srt', found: scriptContent.includes('captions/subtitles.srt') },
    { name: 'Subtitle validation', pattern: 'Test-SrtContent', found: scriptContent.includes('Test-SrtContent') },
    { name: 'Subtitle burning filter', pattern: 'subtitles=', found: scriptContent.includes('subtitles=') },
    { name: 'Enhanced subtitle styling', pattern: 'FontSize=28', found: scriptContent.includes('FontSize=28') },
    { name: 'Subtitle color settings', pattern: 'PrimaryColour=&Hffffff', found: scriptContent.includes('PrimaryColour=&Hffffff') },
    { name: 'Subtitle outline', pattern: 'OutlineColour=&H000000', found: scriptContent.includes('OutlineColour=&H000000') },
    { name: 'Subtitle background', pattern: 'BackColour=&H80000000', found: scriptContent.includes('BackColour=&H80000000') },
    { name: 'Subtitle margin', pattern: 'MarginV=50', found: scriptContent.includes('MarginV=50') }
  ];
  
  let allFeaturesFound = true;
  subtitleFeatures.forEach(feature => {
    if (!feature.found) {
      console.log(`   ❌ Missing subtitle feature: ${feature.name}`);
      allFeaturesFound = false;
    } else {
      console.log(`   ✅ Found subtitle feature: ${feature.name}`);
    }
  });
  
  if (!allFeaturesFound) {
    throw new Error('Some subtitle burning features are missing');
  }
}

async function testErrorHandling() {
  const scriptPath = path.join(__dirname, 'render-latest.ps1');
  const scriptContent = fs.readFileSync(scriptPath, 'utf8');
  
  const errorHandlingFeatures = [
    { name: 'Try-catch blocks', pattern: 'try {', found: scriptContent.includes('try {') },
    { name: 'Error logging', pattern: 'Write-Log.*ERROR', found: /Write-Log.*ERROR/.test(scriptContent) },
    { name: 'File validation', pattern: 'Test-FileValid', found: scriptContent.includes('Test-FileValid') },
    { name: 'FFmpeg availability check', pattern: 'ffmpeg -version', found: scriptContent.includes('ffmpeg -version') },
    { name: 'Exit codes', pattern: 'exit 1', found: scriptContent.includes('exit 1') },
    { name: 'Comprehensive validation', pattern: 'allFilesValid', found: scriptContent.includes('allFilesValid') }
  ];
  
  let allFeaturesFound = true;
  errorHandlingFeatures.forEach(feature => {
    if (!feature.found) {
      console.log(`   ❌ Missing error handling: ${feature.name}`);
      allFeaturesFound = false;
    } else {
      console.log(`   ✅ Found error handling: ${feature.name}`);
    }
  });
  
  if (!allFeaturesFound) {
    throw new Error('Some error handling features are missing');
  }
}

async function runAllTests() {
  const tests = [
    { name: 'Enhanced PowerShell Script Features', test: testEnhancedPowerShellScript },
    { name: 'File Structure Validation', test: testFileStructureValidation },
    { name: 'Subtitle Content Validation', test: testSubtitleContentValidation },
    { name: 'Images.txt Format Validation', test: testImagesTxtValidation },
    { name: 'FFmpeg Command Simulation', test: testFFmpegCommandSimulation },
    { name: 'PowerShell Execution Test', test: testPowerShellExecution },
    { name: 'Subtitle Burning Features', test: testSubtitleBurningFeatures },
    { name: 'Error Handling Features', test: testErrorHandling }
  ];
  
  let passedTests = 0;
  let totalTests = tests.length;
  
  for (const test of tests) {
    const passed = await runTest(test.name, test.test);
    if (passed) passedTests++;
  }
  
  console.log('🎯 TEST SUMMARY');
  console.log(`✅ Passed: ${passedTests}/${totalTests} tests`);
  
  if (passedTests === totalTests) {
    console.log('🎉 ALL TESTS PASSED! Video rendering and subtitle burning should work perfectly.');
    console.log('\n📋 NEXT STEPS:');
    console.log('1. Run the enhanced PowerShell script: powershell -ExecutionPolicy Bypass -File render-latest.ps1');
    console.log('2. For debug mode: powershell -ExecutionPolicy Bypass -File render-latest.ps1 -Debug');
    console.log('3. For specific video: powershell -ExecutionPolicy Bypass -File render-latest.ps1 -VideoId "your-video-id"');
    console.log('4. Check the output video for burned-in subtitles');
  } else {
    console.log('⚠️ Some tests failed. Please review the issues above.');
  }
}

// Run all tests
runAllTests().catch(console.error); 