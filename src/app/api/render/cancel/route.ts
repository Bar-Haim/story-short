import { NextRequest, NextResponse } from 'next/server';
import { VideoService } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get('id');
    
    if (!videoId) {
      return NextResponse.json({ ok: false, error: 'missing_video_id' }, { status: 400 });
    }

    // Get current video status
    const video = await VideoService.getById(videoId);
    if (!video) {
      return NextResponse.json({ ok: false, error: 'video_not_found' }, { status: 404 });
    }

    // Only allow cancellation if currently rendering
    if (video.status !== 'rendering') {
      return NextResponse.json({ 
        ok: false, 
        error: 'cannot_cancel',
        message: `Cannot cancel video in status: ${video.status}` 
      }, { status: 409 });
    }

    // Update status to cancelled
    await VideoService.updateVideo(videoId, {
      status: 'render_failed',
      error_message: 'cancelled_by_user'
    });

    console.log(`[render/cancel] Video ${videoId} cancelled by user`);

    return NextResponse.json({ 
      ok: true, 
      message: 'Render cancelled successfully',
      status: 'render_failed'
    });

  } catch (error) {
    console.error('[render/cancel] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to cancel render';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}