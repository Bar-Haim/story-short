import { NextRequest, NextResponse } from 'next/server';
import { VideoService } from '@/lib/supabase-server';
import { generateCaptions } from '@/lib/captions';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { videoId } = await request.json();
    
    if (!videoId) {
      return NextResponse.json({ 
        error: 'Missing videoId parameter' 
      }, { status: 400 });
    }

    console.log('📝 Starting captions generation for video:', videoId);

    // Get current video data
    const video = await VideoService.getById(videoId);
    if (!video) {
      return NextResponse.json({ 
        error: 'Video not found' 
      }, { status: 404 });
    }

    // Check if captions already exist
    if (video.captions_url) {
      console.log('📝 Captions already exist, returning existing URL');
      return NextResponse.json({
        success: true,
        captions_url: video.captions_url,
        message: 'Captions already generated',
        status: 'exists'
      });
    }

    // Check if we have script text
    const scriptText = video.script_text || video.script;
    if (!scriptText) {
      return NextResponse.json({ 
        error: 'No script text found for caption generation' 
      }, { status: 400 });
    }

    // Update status to indicate captions generation
    await VideoService.updateVideo(videoId, { 
      status: 'assets_generating',
      error_message: 'Generating captions...'
    });

    try {
      // Generate captions
      const captionsUrl = await generateCaptions(video);
      
      // Update database with captions URL and status
      await VideoService.updateVideo(videoId, { 
        captions_url: captionsUrl,
        error_message: null
      });

      console.log('✅ Captions generated and saved successfully');
      
      return NextResponse.json({
        success: true,
        captions_url: captionsUrl,
        message: 'Captions generated successfully',
        status: 'generated'
      });

    } catch (error: any) {
      console.error('❌ Captions generation failed:', error.message);
      
      // Update database with error status
      await VideoService.updateVideo(videoId, { 
        status: 'assets_failed',
        error_message: `Captions generation failed: ${error.message}`
      });

      return NextResponse.json({
        success: false,
        error: 'Captions generation failed',
        details: error.message,
        status: 'failed'
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('❌ Error in generate-captions:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
