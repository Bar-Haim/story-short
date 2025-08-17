import { NextRequest, NextResponse } from 'next/server';
import { VideoService } from '@/lib/supabase-server';
import { generateTTS } from '@/lib/tts';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { videoId } = await request.json();
    
    if (!videoId) {
      return NextResponse.json({ 
        error: 'Missing videoId parameter' 
      }, { status: 400 });
    }

    console.log('🎤 Starting audio generation for video:', videoId);

    // Get current video data
    const video = await VideoService.getById(videoId);
    if (!video) {
      return NextResponse.json({ 
        error: 'Video not found' 
      }, { status: 404 });
    }

    // Check if audio already exists
    if (video.audio_url) {
      console.log('🎤 Audio already exists, returning existing URL');
      return NextResponse.json({
        success: true,
        audio_url: video.audio_url,
        message: 'Audio already generated',
        status: 'exists'
      });
    }

    // Check if we have script text
    const scriptText = video.script_text || video.script;
    if (!scriptText) {
      return NextResponse.json({ 
        error: 'No script text found for audio generation' 
      }, { status: 400 });
    }

    // Update status to indicate audio generation
    await VideoService.updateVideo(videoId, { 
      status: 'assets_generating',
      error_message: 'Generating audio...'
    });

    try {
      // Generate TTS audio
      const audioUrl = await generateTTS(video);
      
      // Update database with audio URL and status
      await VideoService.updateVideo(videoId, { 
        audio_url: audioUrl,
        error_message: null
      });

      console.log('✅ Audio generated and saved successfully');
      
      return NextResponse.json({
        success: true,
        audio_url: audioUrl,
        message: 'Audio generated successfully',
        status: 'generated'
      });

    } catch (error: any) {
      console.error('❌ Audio generation failed:', error.message);
      
      // Update database with error status
      await VideoService.updateVideo(videoId, { 
        status: 'assets_failed',
        error_message: `Audio generation failed: ${error.message}`
      });

      return NextResponse.json({
        success: false,
        error: 'Audio generation failed',
        details: error.message,
        status: 'failed'
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('❌ Error in generate-audio:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
