// Test script to manually trigger asset generation
require('dotenv').config({ path: '.env.local' });

const videoId = '26ab34c4-5539-43f4-8b2e-f2ebe9f99203';

async function testAssetGeneration() {
  console.log(`🎬 Testing asset generation for video: ${videoId}`);
  
  try {
    const response = await fetch('http://localhost:4000/api/generate-assets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoId: videoId,
        script: 'HOOK: A world enveloped in tumult finds unexpected salvation—a wagging tail.\n\nBODY: Watch as Golden Retrievers rise, their joy radiating through bustling cities, serene shores, and verdant fields. Their journey, a testament to unconditional love and unending hope.\n\nCTA: Witness their tale unfold. Feel the joy they bring. Embrace the love they offer.',
        voiceId: 'Dslrhjl3ZpzrctukrQSN'
      }),
    });

    console.log('📡 Response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Asset generation failed:', errorData);
      return;
    }

    const data = await response.json();
    console.log('✅ Asset generation response:', data);
    
  } catch (error) {
    console.error('❌ Error testing asset generation:', error);
  }
}

testAssetGeneration(); 