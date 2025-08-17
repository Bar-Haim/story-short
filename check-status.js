#!/usr/bin/env node

import fetch from 'node-fetch';

const videoId = '4857aca6-c504-4360-b46b-574a77a4effc';

async function checkStatus() {
  try {
    const response = await fetch(`http://localhost:4000/api/video-status?id=${videoId}`);
    const data = await response.json();
    console.log('Video Status:', data);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkStatus(); 