import { NextRequest, NextResponse } from 'next/server';
import { VideoService } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoId } = body;

    if (!videoId) {
      return NextResponse.json(
        { success: false, error: 'Video ID is required' },
        { status: 400 }
      );
    }

    console.log(`🛑 Cancelling video generation for video ID: ${videoId}`);

    // Update video status to cancelled
    const updateResult = await VideoService.updateVideo(videoId, {
      status: 'cancelled',
      error_message: 'Video generation was cancelled by user'
    });

    if (!updateResult.success) {
      console.error('Failed to cancel video:', updateResult.error);
      return NextResponse.json(
        { success: false, error: 'Failed to cancel video generation' },
        { status: 500 }
      );
    }

    console.log(`✅ Video ${videoId} cancelled successfully`);

    return NextResponse.json({
      success: true,
      message: 'Video generation cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling video:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 