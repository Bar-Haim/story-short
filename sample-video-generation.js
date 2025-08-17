/**
 * StoryShort Sample Video Generation Pipeline
 * 
 * This script demonstrates the complete video generation process
 * from input text to final MP4 video with all intermediate steps.
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:4000/api';
const SAMPLE_INPUT = `Once upon a time, there was a young entrepreneur named Sarah who dreamed of building the next big tech company. She spent countless nights coding, networking, and learning from failures. Despite facing numerous rejections and setbacks, Sarah never gave up on her vision. Her persistence paid off when she finally launched her app and it became a huge success. Today, Sarah's company helps thousands of people achieve their dreams, proving that with determination and hard work, anything is possible.`;

async function generateSampleVideo() {
  console.log('🎬 Starting StoryShort Video Generation Pipeline\n');
  
  try {
    // Step 1: Generate Script
    console.log('📝 Step 1: Generating AI Script...');
    const scriptResponse = await axios.post(`${API_BASE_URL}/generate-script`, {
      userText: SAMPLE_INPUT
    });
    
    const { videoId, script } = scriptResponse.data;
    console.log('✅ Script Generated Successfully!');
    console.log('📄 Generated Script:');
    console.log(script);
    console.log(`🆔 Video ID: ${videoId}\n`);

    // Step 2: Generate Assets (Images, Audio, Captions)
    console.log('🎨 Step 2: Generating Video Assets...');
    const assetsResponse = await axios.post(`${API_BASE_URL}/generate-assets`, {
      videoId: videoId,
      script: script,
      voiceId: 'Dslrhjl3ZpzrctukrQSN' // Default voice
    });
    
    console.log('✅ Assets Generated Successfully!');
    console.log('📊 Asset Summary:');
    console.log(`   - Images: ${assetsResponse.data.data.imageUrls?.length || 0}`);
    console.log(`   - Audio: ${assetsResponse.data.data.audioUrl ? '✅' : '❌'}`);
    console.log(`   - Captions: ${assetsResponse.data.data.captionsUrl ? '✅' : '❌'}`);
    console.log(`   - Duration: ${assetsResponse.data.data.totalDuration || 0}s\n`);

    // Step 3: Render Final Video
    console.log('🎬 Step 3: Rendering Final Video...');
    const renderResponse = await axios.post(`${API_BASE_URL}/render-video`, {
      videoId: videoId
    });
    
    console.log('✅ Video Rendered Successfully!');
    console.log('📹 Final Video Details:');
    console.log(`   - URL: ${renderResponse.data.data.finalVideoUrl}`);
    console.log(`   - Duration: ${renderResponse.data.data.duration}s`);
    console.log(`   - Scenes: ${renderResponse.data.data.scenes}`);
    console.log(`   - File Size: ${renderResponse.data.data.fileSize}MB\n`);

    // Step 4: Display Results
    console.log('🎉 Video Generation Complete!');
    console.log('📋 Final Results:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🎬 Video ID: ${videoId}`);
    console.log(`📹 Final Video: ${renderResponse.data.data.finalVideoUrl}`);
    console.log(`⏱️ Duration: ${renderResponse.data.data.duration} seconds`);
    console.log(`🖼️ Scenes: ${renderResponse.data.data.scenes}`);
    console.log(`📦 File Size: ${renderResponse.data.data.fileSize}MB`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Step 5: Download Links
    console.log('📥 Download Links:');
    console.log(`🎬 Final MP4: ${renderResponse.data.data.finalVideoUrl}`);
    console.log(`🎵 Audio Only: ${assetsResponse.data.data.audioUrl}`);
    console.log(`📝 Captions: ${assetsResponse.data.data.captionsUrl}\n`);

    // Step 6: Share Information
    console.log('🔗 Share Information:');
    console.log(`🌐 Video Page: http://localhost:4000/video/${videoId}`);
    console.log(`📱 Direct Link: ${renderResponse.data.data.finalVideoUrl}\n`);

    return {
      success: true,
      videoId: videoId,
      finalVideoUrl: renderResponse.data.data.finalVideoUrl,
      duration: renderResponse.data.data.duration,
      scenes: renderResponse.data.data.scenes,
      fileSize: renderResponse.data.data.fileSize
    };

  } catch (error) {
    console.error('❌ Video Generation Failed:', error.message);
    
    if (error.response) {
      console.error('📋 Error Details:', error.response.data);
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Sample JSON Output Structure
const sampleJSONOutput = {
  "videoId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "input_text": "Once upon a time, there was a young entrepreneur...",
  "script": {
    "hook": "Imagine being told your dreams are impossible...",
    "body": "Sarah faced countless rejections, but she never gave up...",
    "cta": "Your dreams are waiting. Start building them today."
  },
  "storyboard_json": {
    "scenes": [
      {
        "scene_number": 1,
        "description": "Young entrepreneur Sarah working late at night",
        "image_prompt": "A determined young woman coding at her desk late at night, soft lighting, cinematic",
        "text": "Imagine being told your dreams are impossible...",
        "duration": 5
      },
      {
        "scene_number": 2,
        "description": "Sarah facing rejections and setbacks",
        "image_prompt": "A woman looking disappointed but determined, holding rejection letters, emotional",
        "text": "Sarah faced countless rejections, but she never gave up...",
        "duration": 25
      },
      {
        "scene_number": 3,
        "description": "Sarah's successful app launch celebration",
        "image_prompt": "A successful woman celebrating with her team, confetti, achievement, victory",
        "text": "Your dreams are waiting. Start building them today.",
        "duration": 10
      }
    ]
  },
  "audio_url": "https://supabase.co/storage/v1/object/public/assets/audio/550e8400-e29b-41d4-a716-446655440000.mp3",
  "captions_url": "https://supabase.co/storage/v1/object/public/assets/captions/550e8400-e29b-41d4-a716-446655440000.vtt",
  "image_urls": [
    "https://supabase.co/storage/v1/object/public/assets/images/550e8400-e29b-41d4-a716-446655440000/scene_1.png",
    "https://supabase.co/storage/v1/object/public/assets/images/550e8400-e29b-41d4-a716-446655440000/scene_2.png",
    "https://supabase.co/storage/v1/object/public/assets/images/550e8400-e29b-41d4-a716-446655440000/scene_3.png"
  ],
  "final_video_url": "https://supabase.co/storage/v1/object/public/assets/renders/videos/550e8400-e29b-41d4-a716-446655440000.mp4",
  "total_duration": 40,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:35:00Z"
};

// Sample VTT Captions File
const sampleVTTFile = `WEBVTT

00:00:00.000 --> 00:00:05.000
Imagine being told your dreams are impossible...

00:00:05.000 --> 00:00:10.000
Sarah faced countless rejections

00:00:10.000 --> 00:00:15.000
but she never gave up on her vision

00:00:15.000 --> 00:00:20.000
She spent countless nights coding

00:00:20.000 --> 00:00:25.000
networking, and learning from failures

00:00:25.000 --> 00:00:30.000
Her persistence finally paid off

00:00:30.000 --> 00:00:35.000
when she launched her app

00:00:35.000 --> 00:00:40.000
Your dreams are waiting. Start building them today.`;

// Export for use in other scripts
module.exports = {
  generateSampleVideo,
  sampleJSONOutput,
  sampleVTTFile,
  SAMPLE_INPUT
};

// Run the sample if this file is executed directly
if (require.main === module) {
  generateSampleVideo()
    .then(result => {
      if (result.success) {
        console.log('🎉 Sample video generation completed successfully!');
        console.log('📁 Check the generated files and video player for results.');
      } else {
        console.log('❌ Sample video generation failed.');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Unexpected error:', error);
      process.exit(1);
    });
} 