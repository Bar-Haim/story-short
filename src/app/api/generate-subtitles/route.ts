import { NextRequest, NextResponse } from 'next/server';
import { VideoService, StorageService, sbServer } from '@/lib/supabase-server';
import * as fs from 'fs';
import * as path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { videoId, audioUrl } = await request.json();

    if (!videoId || !audioUrl) {
      return NextResponse.json({ 
        error: 'Missing required parameters: videoId and audioUrl' 
      }, { status: 400 });
    }

    console.log('🎤 Starting automated subtitle generation for video:', videoId);

    // Validate OpenAI API key
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ 
        error: 'OpenAI API key not configured for subtitle generation' 
      }, { status: 500 });
    }

    // Step 1: Download the TTS audio file
    console.log('📥 Downloading audio file from:', audioUrl);
    const audioResponse = await fetch(audioUrl);
    
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.statusText}`);
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    console.log('✅ Audio file downloaded successfully');

    // Step 2: Transcribe using OpenAI Whisper
    console.log('🎤 Transcribing audio with OpenAI Whisper...');
    
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
    formData.append("file", audioBlob, "voiceover.mp3");
    formData.append("model", "whisper-1");
    formData.append("response_format", "vtt");

    const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      let errorData;
      try {
        errorData = await whisperResponse.json();
      } catch (_err) {
        errorData = { error: 'Failed to parse error response' };
      }
      
      console.error('❌ Whisper API error:', errorData);
      
      let errorMessage = 'Failed to transcribe audio with Whisper';
      if (errorData.error?.message) {
        errorMessage = errorData.error.message;
      } else if (whisperResponse.status === 401) {
        errorMessage = 'Invalid OpenAI API key. Please check your configuration.';
      } else if (whisperResponse.status === 400) {
        errorMessage = 'Invalid audio file format. Please ensure the audio is in MP3 format.';
      } else if (errorData.error?.type === 'quota_exceeded') {
        errorMessage = 'OpenAI quota exceeded. Please add more credits to your account.';
      }
      
      throw new Error(errorMessage);
    }

    const vttText = await whisperResponse.text();
    console.log('✅ Audio transcribed successfully with Whisper');

    // Step 3: Upload VTT captions to Supabase Storage
    console.log('📤 Uploading captions to Supabase Storage...');
    
    const captionsPath = `renders/${videoId}/captions/subtitles.vtt`;
    const uploadResult = await StorageService.uploadFile(captionsPath, vttText, 'text/vtt');
    
    if (!uploadResult.success || !uploadResult.url) {
      throw new Error(uploadResult.error || 'Failed to upload captions to Supabase');
    }

    console.log('✅ Captions uploaded successfully to Supabase');

    // Step 3.5: Also save VTT file to local structured directory for organization
    console.log('📁 Saving captions to local structured directory...');
    try {
      const rendersDir = path.join(process.cwd(), 'renders');
      const captionsDir = path.join(rendersDir, videoId, 'captions');
      
      if (!fs.existsSync(captionsDir)) {
        fs.mkdirSync(captionsDir, { recursive: true });
      }
      
      const localVttPath = path.join(captionsDir, 'subtitles.vtt');
      await fs.promises.writeFile(localVttPath, vttText);
      console.log('✅ Captions saved to local structured directory:', localVttPath);
    } catch (dirError) {
      console.warn('⚠️ Failed to save captions to local directory:', dirError);
    }

    // Step 4: Update video record with captions URL
    console.log('📝 Updating video record with captions URL...');
    
    const updateResult = await VideoService.updateVideo(videoId, {
      captions_url: uploadResult.url
    });

    if (!updateResult.success) {
      throw new Error('Failed to update video record with captions URL');
    }

    console.log('✅ Video record updated with captions URL');

    return NextResponse.json({
      success: true,
      message: 'Subtitles generated and uploaded successfully',
      data: {
        videoId,
        captionsUrl: uploadResult.url,
        captionsFormat: 'vtt',
        transcriptionLength: vttText.length
      }
    });

  } catch (error) {
    console.error('❌ Subtitle generation failed:', error);
    
    return NextResponse.json({
      success: false,
      error: true,
      message: 'Failed to generate subtitles',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 