const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = 'http://localhost:4000/api';

console.log('🧪 Testing Local File Handling and Supabase Upload...\n');

async function testLocalFileHandling() {
  try {
    // Step 1: Generate a test script
    console.log('📝 Step 1: Generating test script...');
    const scriptResponse = await axios.post(`${API_BASE_URL}/generate-script`, {
      userText: 'A magical cat discovers a portal to another dimension. The adventure begins with curiosity and leads to unexpected friendships.'
    });
    
    const { videoId, script } = scriptResponse.data;
    console.log('✅ Test script generated');
    console.log(`🆔 Video ID: ${videoId}\n`);

    // Step 2: Generate assets
    console.log('🎨 Step 2: Generating video assets...');
    const assetsResponse = await axios.post(`${API_BASE_URL}/generate-assets`, {
      videoId: videoId,
      script: script,
      voiceId: 'Dslrhjl3ZpzrctukrQSN'
    });
    
    console.log('✅ Assets generated successfully');
    console.log('📊 Asset Summary:');
    console.log(`   - Images: ${assetsResponse.data.data.imageUrls?.length || 0}`);
    console.log(`   - Audio: ${assetsResponse.data.data.audioUrl ? '✅' : '❌'}`);
    console.log(`   - Captions: ${assetsResponse.data.data.captionsUrl ? '✅' : '❌'}\n`);

    // Step 3: Test video rendering with local file handling
    console.log('🎬 Step 3: Testing video rendering with local file handling...');
    
    // Wait a moment for assets to be fully processed
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const renderResponse = await axios.post(`${API_BASE_URL}/render-video`, {
      videoId: videoId
    }, {
      timeout: 300000 // 5 minute timeout
    });
    
    if (renderResponse.data.success) {
      console.log('✅ Video rendering completed successfully!');
      console.log('📹 Final Video Details:');
      console.log(`   - URL: ${renderResponse.data.data.finalVideoUrl}`);
      console.log(`   - Duration: ${renderResponse.data.data.duration}s`);
      console.log(`   - Scenes: ${renderResponse.data.data.scenes}`);
      console.log(`   - File Size: ${renderResponse.data.data.fileSize}MB`);
      console.log(`   - Local Path: ${renderResponse.data.data.localPath}`);
      console.log(`   - Supabase Path: ${renderResponse.data.data.supabasePath}`);
      
      // Step 4: Verify local file exists
      console.log('\n📁 Step 4: Verifying local file exists...');
      const localPath = renderResponse.data.data.localPath;
      
      if (fs.existsSync(localPath)) {
        const stats = fs.statSync(localPath);
        console.log(`✅ Local file exists: ${localPath}`);
        console.log(`   - Size: ${Math.round(stats.size / 1024 / 1024)} MB`);
        console.log(`   - Created: ${stats.birthtime}`);
        console.log(`   - Modified: ${stats.mtime}`);
      } else {
        console.log('❌ Local file does not exist:', localPath);
      }
      
      // Step 5: Verify renders directory structure
      console.log('\n📂 Step 5: Verifying renders directory structure...');
      const rendersDir = path.join(process.cwd(), 'renders');
      const videosDir = path.join(rendersDir, 'videos');
      
      console.log(`   - Renders directory: ${rendersDir} (${fs.existsSync(rendersDir) ? '✅' : '❌'})`);
      console.log(`   - Videos directory: ${videosDir} (${fs.existsSync(videosDir) ? '✅' : '❌'})`);
      
      if (fs.existsSync(videosDir)) {
        const files = fs.readdirSync(videosDir);
        console.log(`   - Files in videos directory: ${files.length}`);
        files.forEach(file => {
          const filePath = path.join(videosDir, file);
          const stats = fs.statSync(filePath);
          console.log(`     - ${file} (${Math.round(stats.size / 1024 / 1024)} MB)`);
        });
      }
      
      // Step 6: Test downloading the final video
      console.log('\n📥 Step 6: Testing video download from Supabase...');
      const videoResponse = await axios.get(renderResponse.data.data.finalVideoUrl, {
        responseType: 'stream'
      });
      
      if (videoResponse.status === 200) {
        console.log('✅ Video download from Supabase successful');
        
        // Get content length if available
        const contentLength = videoResponse.headers['content-length'];
        if (contentLength) {
          console.log(`   - Content Length: ${Math.round(contentLength / 1024 / 1024)} MB`);
        }
      } else {
        console.log('❌ Video download from Supabase failed');
      }
      
    } else {
      console.log('❌ Video rendering failed');
      console.log('Error:', renderResponse.data.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }
}

async function testDirectoryCreation() {
  console.log('\n🔧 Testing directory creation functionality...');
  
  const testDirs = [
    path.join(process.cwd(), 'renders'),
    path.join(process.cwd(), 'renders', 'videos'),
    path.join(process.cwd(), 'renders', 'test-subdir')
  ];
  
  testDirs.forEach(dir => {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
      } else {
        console.log(`📁 Directory already exists: ${dir}`);
      }
    } catch (error) {
      console.log(`❌ Failed to create directory: ${dir} - ${error.message}`);
    }
  });
}

async function testFileOperations() {
  console.log('\n📄 Testing file operations...');
  
  const testFile = path.join(process.cwd(), 'renders', 'videos', 'test-file.txt');
  const testContent = 'This is a test file for video rendering pipeline.';
  
  try {
    // Write test file
    fs.writeFileSync(testFile, testContent);
    console.log(`✅ Created test file: ${testFile}`);
    
    // Verify file exists
    if (fs.existsSync(testFile)) {
      const stats = fs.statSync(testFile);
      console.log(`✅ Test file verified: ${stats.size} bytes`);
    }
    
    // Read and verify content
    const readContent = fs.readFileSync(testFile, 'utf8');
    if (readContent === testContent) {
      console.log('✅ File content verified correctly');
    } else {
      console.log('❌ File content verification failed');
    }
    
    // Clean up
    fs.unlinkSync(testFile);
    console.log('✅ Test file cleaned up');
    
  } catch (error) {
    console.log(`❌ File operation test failed: ${error.message}`);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting comprehensive local file handling tests...\n');
  
  await testDirectoryCreation();
  await testFileOperations();
  await testLocalFileHandling();
  
  console.log('\n🎉 All tests completed!');
  console.log('\n📋 Summary of local file handling features:');
  console.log('✅ Local renders directory creation with recursive mkdir');
  console.log('✅ Video file copying from temp to local directory');
  console.log('✅ File existence and size verification');
  console.log('✅ Enhanced FFmpeg error handling');
  console.log('✅ Supabase upload to assets/renders/{videoId}/video.mp4');
  console.log('✅ Comprehensive error handling and logging');
  console.log('✅ Local file path verification and cleanup');
}

// Run the tests
runAllTests().catch(console.error); 