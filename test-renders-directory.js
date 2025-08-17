// Test script to verify renders directory creation
const fs = require('fs');
const path = require('path');

async function testRendersDirectory() {
  console.log('🧪 Testing renders directory creation...');
  
  const testVideoId = 'test-video-123';
  const rendersDir = path.join(process.cwd(), 'renders');
  const videoDir = path.join(rendersDir, testVideoId);
  const imagesDir = path.join(videoDir, 'images');
  const audioDir = path.join(videoDir, 'audio');
  const captionsDir = path.join(videoDir, 'captions');
  const videosDir = path.join(rendersDir, 'videos');
  
  try {
    // Test 1: Create renders directory
    console.log('📁 Testing renders directory creation...');
    if (!fs.existsSync(rendersDir)) {
      await fs.promises.mkdir(rendersDir, { recursive: true });
      console.log('✅ Created renders directory');
    } else {
      console.log('✅ Renders directory already exists');
    }
    
    // Test 2: Create video-specific directories
    console.log('📁 Testing video-specific directory creation...');
    if (!fs.existsSync(videoDir)) {
      await fs.promises.mkdir(videoDir, { recursive: true });
      console.log('✅ Created video directory');
    }
    
    if (!fs.existsSync(imagesDir)) {
      await fs.promises.mkdir(imagesDir, { recursive: true });
      console.log('✅ Created images directory');
    }
    
    if (!fs.existsSync(audioDir)) {
      await fs.promises.mkdir(audioDir, { recursive: true });
      console.log('✅ Created audio directory');
    }
    
    if (!fs.existsSync(captionsDir)) {
      await fs.promises.mkdir(captionsDir, { recursive: true });
      console.log('✅ Created captions directory');
    }
    
    // Test 3: Create videos directory for final videos
    console.log('📁 Testing videos directory creation...');
    if (!fs.existsSync(videosDir)) {
      await fs.promises.mkdir(videosDir, { recursive: true });
      console.log('✅ Created videos directory');
    }
    
    // Test 4: Verify directory structure
    console.log('🔍 Verifying directory structure...');
    const directories = [
      { path: rendersDir, name: 'renders' },
      { path: videoDir, name: 'renders/video' },
      { path: imagesDir, name: 'renders/video/images' },
      { path: audioDir, name: 'renders/video/audio' },
      { path: captionsDir, name: 'renders/video/captions' },
      { path: videosDir, name: 'renders/videos' }
    ];
    
    for (const dir of directories) {
      if (fs.existsSync(dir.path)) {
        const stats = fs.statSync(dir.path);
        console.log(`✅ ${dir.name}: exists (${stats.isDirectory() ? 'directory' : 'file'})`);
      } else {
        console.log(`❌ ${dir.name}: missing`);
      }
    }
    
    // Test 5: Create a test file to verify write permissions
    console.log('📝 Testing file creation...');
    const testFilePath = path.join(videoDir, 'test.txt');
    await fs.promises.writeFile(testFilePath, 'Test file content');
    console.log('✅ Test file created successfully');
    
    // Clean up test file
    await fs.promises.unlink(testFilePath);
    console.log('✅ Test file cleaned up');
    
    console.log('\n🎉 All renders directory tests passed!');
    console.log('📋 Directory structure verified:');
    console.log('   renders/');
    console.log('   ├── test-video-123/');
    console.log('   │   ├── images/');
    console.log('   │   ├── audio/');
    console.log('   │   └── captions/');
    console.log('   └── videos/');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testRendersDirectory(); 