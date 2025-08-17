import { NextRequest, NextResponse } from 'next/server';
import { VideoService, sbServer } from '@/lib/supabase-server';
import type { VideoStatus } from '@/types/video';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params;

  if (!videoId) {
    return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
  }

  try {
    const video = await VideoService.getVideo(videoId);
    
    if (!video.success) {
      console.error('[progress] Database error:', {
        error: video.error,
        videoId
      });
      return NextResponse.json({ error: 'Failed to fetch video' }, { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'pragma': 'no-cache',
          'expires': '0'
        }
      });
    }
    
    if (!video.video) {
      console.log('[progress] Video not found:', { videoId });
      return NextResponse.json({ error: 'Video not found' }, { 
        status: 404,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'pragma': 'no-cache',
          'expires': '0'
        }
      });
    }

    const videoData = video.video;
    
    // Calculate progress based on status
    const progress = {
      videoId,
      status: videoData.status as VideoStatus,
      progress: 0,
      message: '',
      error: videoData.error_message || null,
      storyboard: videoData.storyboard_json,
      audioUrl: videoData.audio_url,
      captionsUrl: videoData.captions_url,
      imageUrls: videoData.image_urls || [],
      finalVideoUrl: videoData.final_video_url,
      totalDuration: videoData.total_duration,
      createdAt: videoData.created_at,
      updatedAt: videoData.updated_at
    };

    // Set progress percentage and message based on status
    switch (videoData.status as VideoStatus) {
      case 'pending':
        progress.progress = 0;
        progress.message = 'Initializing...';
        break;
      case 'script_generated':
        progress.progress = 20;
        progress.message = 'Script generated, creating storyboard...';
        break;
      case 'assets_generating':
        progress.progress = 40;
        progress.message = 'Generating assets...';
        break;
      case 'assets_generated':
        progress.progress = 90;
        progress.message = 'Assets ready, ready for rendering...';
        break;
      case 'rendering':
        progress.progress = 95;
        progress.message = 'Rendering video...';
        break;
      case 'completed':
        progress.progress = 100;
        progress.message = 'Video completed!';
        break;
      case 'failed':
        progress.progress = 0;
        progress.message = 'Generation failed';
        break;
      default:
        progress.progress = 0;
        progress.message = 'Unknown status';
    }

    return NextResponse.json(progress, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'pragma': 'no-cache',
        'expires': '0'
      }
    });
    
  } catch (_err) {
    console.error('[progress] Error fetching video progress:', {
      error: _err,
      videoId,
      message: _err instanceof Error ? _err.message : 'Unknown error'
    });
    return NextResponse.json({ error: 'Failed to fetch video progress' }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'pragma': 'no-cache',
        'expires': '0'
      }
    });
  }
} 