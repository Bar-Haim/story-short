import fetch from 'node-fetch';

async function testRenderVideo() {
  try {
    console.log('🎬 Testing render-video API...');
    
    // First, let's try to find a video ID from the database
    // For now, let's use a test video ID - you can replace this with an actual video ID
    const testVideoId = 'test-video-id'; // Replace with actual video ID from your database
    
    console.log(`📋 Using test video ID: ${testVideoId}`);
    
    const response = await fetch('http://localhost:4000/api/render-video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoId: testVideoId
      })
    });
    
    const result = await response.json();
    
    console.log('📊 Response status:', response.status);
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));
    console.log('📊 Response body:', JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log('✅ Render video API call successful');
    } else {
      console.log('❌ Render video API call failed');
    }
    
  } catch (error) {
    console.error('❌ Error calling render-video API:', error);
  }
}

// Wait a moment for the dev server to start, then test
setTimeout(() => {
  testRenderVideo();
}, 3000); 