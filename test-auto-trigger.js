#!/usr/bin/env node

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:4000';

async function testAutoTrigger() {
  console.log('🧪 Testing auto-trigger functionality...\n');
  
  try {
    // Step 1: Generate script
    console.log('📝 Step 1: Generating script...');
    
    const scriptResponse = await fetch(`${BASE_URL}/api/generate-script`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputText: 'Create a 40-second ultra-realistic cinematic video about golden retrievers...'
      }),
    });

    const scriptData = await scriptResponse.json();
    
    if (!scriptResponse.ok || !scriptData.ok) {
      console.error('❌ Script generation failed:', scriptData);
      return;
    }

    console.log('✅ Script generated successfully');
    console.log(`   Video ID: ${scriptData.videoId}`);
    console.log(`   Status: ${scriptData.status}`);
    
    const videoId = scriptData.videoId;
    
    // Step 2: Wait for storyboard generation
    console.log('\n⏳ Step 2: Waiting for storyboard generation...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 3: Check storyboard status
    console.log('\n📋 Step 3: Checking storyboard status...');
    
    const storyboardResponse = await fetch(`${BASE_URL}/api/generate-storyboard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ videoId }),
    });

    const storyboardData = await storyboardResponse.json();
    
    if (storyboardResponse.ok && storyboardData.ok) {
      console.log('✅ Storyboard generation successful');
      console.log(`   Scenes Count: ${storyboardData.scenesCount}`);
      console.log(`   Status: ${storyboardData.status}`);
    } else {
      console.error('❌ Storyboard generation failed:', storyboardData);
    }
    
    // Step 4: Wait for assets generation (auto-triggered)
    console.log('\n⏳ Step 4: Waiting for assets generation (auto-triggered)...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Step 5: Check assets status
    console.log('\n🖼️ Step 5: Checking assets status...');
    
    const assetsResponse = await fetch(`${BASE_URL}/api/generate-assets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ videoId }),
    });

    const assetsData = await assetsResponse.json();
    
    if (assetsResponse.ok && assetsData.ok) {
      console.log('✅ Assets generation successful');
      console.log(`   Status: ${assetsData.status}`);
    } else {
      console.error('❌ Assets generation failed:', assetsData);
    }
    
    // Step 6: Check final video status
    console.log('\n📊 Step 6: Checking final video status...');
    
    const statusResponse = await fetch(`${BASE_URL}/api/video-status?id=${videoId}`);
    const statusData = await statusResponse.json();
    
    if (statusResponse.ok && statusData.ok) {
      console.log('✅ Video status check successful');
      console.log(`   Final Status: ${statusData.status}`);
      console.log(`   Has Audio: ${!!statusData.audio_url}`);
      console.log(`   Has Captions: ${!!statusData.captions_url}`);
      console.log(`   Has Images: ${!!statusData.image_urls && statusData.image_urls.length > 0}`);
      console.log(`   Has Final Video: ${!!statusData.final_video_url}`);
    } else {
      console.error('❌ Video status check failed:', statusData);
    }
    
    console.log('\n🎉 Auto-trigger test completed!');
    console.log(`🔗 Video URL: ${BASE_URL}/video/${videoId}`);
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

testAutoTrigger(); 