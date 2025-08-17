#!/usr/bin/env node

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:4000';

async function testApiFix() {
  console.log('🧪 Testing API fix for generate-script...\n');
  
  try {
    // Test 1: Valid JSON request
    console.log('📝 Test 1: Valid JSON request with inputText');
    
    const response = await fetch(`${BASE_URL}/api/generate-script`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputText: 'Create a 40-second ultra-realistic cinematic video about golden retrievers...'
      }),
    });

    const data = await response.json();
    
    console.log('✅ Response received:');
    console.log(`   Status: ${response.status}`);
    console.log(`   OK: ${data.ok}`);
    console.log(`   Video ID: ${data.videoId || 'N/A'}`);
    console.log(`   Status: ${data.status || 'N/A'}`);
    console.log(`   Script preview: ${data.script?.substring(0, 100) || 'N/A'}...`);
    
    if (data.ok && data.videoId) {
      console.log('\n🎉 SUCCESS: API fix is working correctly!');
    } else {
      console.log('\n❌ FAILED: API returned error');
      console.log('Error details:', data.error || 'Unknown error');
    }

    // Test 2: Invalid request (missing inputText)
    console.log('\n📝 Test 2: Invalid request (missing inputText)');
    
    const invalidResponse = await fetch(`${BASE_URL}/api/generate-script`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Missing inputText
      }),
    });

    const invalidData = await invalidResponse.json();
    
    console.log('✅ Invalid request handled correctly:');
    console.log(`   Status: ${invalidResponse.status} (expected 400)`);
    console.log(`   OK: ${invalidData.ok}`);
    console.log(`   Error: ${invalidData.error}`);
    
    if (invalidResponse.status === 400 && !invalidData.ok) {
      console.log('🎉 SUCCESS: Invalid request properly rejected!');
    } else {
      console.log('❌ FAILED: Invalid request not properly handled');
    }

    // Test 3: Malformed JSON
    console.log('\n📝 Test 3: Malformed JSON request');
    
    const malformedResponse = await fetch(`${BASE_URL}/api/generate-script`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: '{"inputText": "test",}', // Malformed JSON
    });

    const malformedData = await malformedResponse.json();
    
    console.log('✅ Malformed JSON handled correctly:');
    console.log(`   Status: ${malformedResponse.status}`);
    console.log(`   OK: ${malformedData.ok}`);
    console.log(`   Error: ${malformedData.error}`);
    
    if (!malformedData.ok) {
      console.log('🎉 SUCCESS: Malformed JSON properly rejected!');
    } else {
      console.log('❌ FAILED: Malformed JSON not properly handled');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

testApiFix(); 