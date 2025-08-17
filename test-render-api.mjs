import fetch from 'node-fetch';

async function testRenderVideo() {
  try {
    console.log('🎬 Testing render-video API...');
    
    // Use a real video ID from the database
    const testVideoId = '5a6d3c34-7d7a-47c5-a4b6-86336d58f33d'; // Real video ID from database
    
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

// Test the API
testRenderVideo(); 