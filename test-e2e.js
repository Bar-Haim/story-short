#!/usr/bin/env node

const fetch = require('node-fetch');

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:4000';

async function testE2E() {
  console.log('🧪 Starting StoryShort MVP E2E Test...\n');
  
  let videoId = null;
  let testResults = {
    script_generation: false,
    storyboard_generation: false,
    assets_generation: false,
    rendering: false,
    final_video: false
  };

  try {
    // Test 1: Generate Script
    console.log('📝 Test 1: Generate Script');
    console.log('Input: "A heartwarming story about a golden retriever who helps a lonely child find friendship and joy in their neighborhood."');
    
    const scriptResponse = await fetch(`${BASE_URL}/api/generate-script`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputText: 'A heartwarming story about a golden retriever who helps a lonely child find friendship and joy in their neighborhood.'
      }),
    });

    if (!scriptResponse.ok) {
      const errorText = await scriptResponse.text();
      console.error(`❌ Script generation failed: ${scriptResponse.status} - ${errorText}`);
      return;
    }

    const scriptResult = await scriptResponse.json();
    console.log('✅ Script generation successful');
    console.log(`   Video ID: ${scriptResult.videoId}`);
    console.log(`   Status: ${scriptResult.status}`);
    console.log(`   Script: ${scriptResult.script?.substring(0, 100)}...`);
    
    videoId = scriptResult.videoId;
    testResults.script_generation = true;

    // Wait a moment for storyboard generation to complete
    console.log('\n⏳ Waiting for storyboard generation...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Test 2: Check Storyboard Generation
    console.log('\n📋 Test 2: Check Storyboard Generation');
    
    const storyboardResponse = await fetch(`${BASE_URL}/api/generate-storyboard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoId: videoId
      }),
    });

    if (storyboardResponse.ok) {
      const storyboardResult = await storyboardResponse.json();
      console.log('✅ Storyboard generation successful');
      console.log(`   Scenes Count: ${storyboardResult.scenesCount}`);
      console.log(`   Status: ${storyboardResult.status}`);
      testResults.storyboard_generation = true;
    } else {
      const errorText = await storyboardResponse.text();
      console.error(`❌ Storyboard generation failed: ${storyboardResponse.status} - ${errorText}`);
    }

    // Wait for assets generation
    console.log('\n⏳ Waiting for assets generation...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Test 3: Generate Assets
    console.log('\n🖼️ Test 3: Generate Assets');
    
    const assetsResponse = await fetch(`${BASE_URL}/api/generate-assets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoId: videoId
      }),
    });

    if (assetsResponse.ok) {
      const assetsResult = await assetsResponse.json();
      console.log('✅ Assets generation successful');
      console.log(`   Status: ${assetsResult.status}`);
      testResults.assets_generation = true;
    } else {
      const errorText = await assetsResponse.text();
      console.error(`❌ Assets generation failed: ${assetsResponse.status} - ${errorText}`);
    }

    // Wait for rendering
    console.log('\n⏳ Waiting for video rendering...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Test 4: Render Video
    console.log('\n🎬 Test 4: Render Video');
    
    const renderResponse = await fetch(`${BASE_URL}/api/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoId: videoId
      }),
    });

    if (renderResponse.ok) {
      const renderResult = await renderResponse.json();
      console.log('✅ Video rendering successful');
      console.log(`   Final URL: ${renderResult.finalUrl}`);
      console.log(`   Duration: ${renderResult.duration}s`);
      console.log(`   Status: ${renderResult.status}`);
      testResults.rendering = true;
      testResults.final_video = true;
    } else {
      const errorText = await renderResponse.text();
      console.error(`❌ Video rendering failed: ${renderResponse.status} - ${errorText}`);
    }

    // Test 5: Guard Test - Try to generate assets without storyboard
    console.log('\n🛡️ Test 5: Guard Test - Try generate-assets without storyboard');
    
    const guardResponse = await fetch(`${BASE_URL}/api/generate-assets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoId: 'test-video-id-without-storyboard'
      }),
    });

    if (guardResponse.status === 400) {
      const guardResult = await guardResponse.json();
      console.log('✅ Guard test successful');
      console.log(`   Reason: ${guardResult.reason}`);
      console.log(`   Status: ${guardResult.status}`);
    } else {
      console.error(`❌ Guard test failed: Expected 400, got ${guardResponse.status}`);
    }

    // Test 6: Check Final Video Status
    console.log('\n📊 Test 6: Check Final Video Status');
    
    const statusResponse = await fetch(`${BASE_URL}/api/video-status/${videoId}`);
    if (statusResponse.ok) {
      const statusResult = await statusResponse.json();
      console.log('✅ Video status check successful');
      console.log(`   Final Status: ${statusResult.status}`);
      console.log(`   Final Video URL: ${statusResult.final_video_url || 'Not available'}`);
      console.log(`   Total Duration: ${statusResult.total_duration || 'Not available'}s`);
    } else {
      console.error(`❌ Video status check failed: ${statusResponse.status}`);
    }

    // Summary
    console.log('\n📋 E2E Test Summary:');
    console.log('====================');
    console.log(`✅ Script Generation: ${testResults.script_generation ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Storyboard Generation: ${testResults.storyboard_generation ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Assets Generation: ${testResults.assets_generation ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Video Rendering: ${testResults.rendering ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Final Video: ${testResults.final_video ? 'PASS' : 'FAIL'}`);
    
    const allPassed = Object.values(testResults).every(result => result);
    console.log(`\n🎯 Overall Result: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
    
    if (videoId) {
      console.log(`\n🔗 Video URL: ${BASE_URL}/video/${videoId}`);
    }

  } catch (error) {
    console.error('❌ E2E Test failed with error:', error);
  }
}

// Run the test
testE2E().catch(console.error); 