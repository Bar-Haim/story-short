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
      updatedAt: videoData.updated_at,
      steps: {
        images: {
          done: Array.isArray(videoData.image_urls) && videoData.image_urls.length > 0,
          total: videoData.storyboard_json?.scenes?.length || 0,
          count: Array.isArray(videoData.image_urls) ? videoData.image_urls.length : 0
        },
        audio: {
          done: !!videoData.audio_url,
          url: videoData.audio_url
        },
        captions: {
          done: !!videoData.captions_url,
          url: videoData.captions_url
        }
      }
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
      case 'script_approved':
        progress.progress = 25;
        progress.message = 'Script approved, generating storyboard...';
        break;
      case 'storyboard_generated':
        progress.progress = 30;
        progress.message = 'Storyboard created, preparing for asset generation...';
        break;
      case 'assets_generating':
        // Calculate progress based on actual asset completion
        const imagesProgress = progress.steps.images.done ? 40 : 30;
        const audioProgress = progress.steps.audio.done ? 20 : 0;
        const captionsProgress = progress.steps.captions.done ? 20 : 0;
        progress.progress = imagesProgress + audioProgress + captionsProgress;
        
        if (progress.steps.images.done && !progress.steps.audio.done && !progress.steps.captions.done) {
          progress.message = 'Images ready, generating audio and captions...';
        } else if (progress.steps.images.done && progress.steps.audio.done && !progress.steps.captions.done) {
          progress.message = 'Images and audio ready, generating captions...';
        } else if (progress.steps.images.done && !progress.steps.audio.done && progress.steps.captions.done) {
          progress.message = 'Images and captions ready, generating audio...';
        } else {
          progress.message = 'Generating assets...';
        }
        break;
      case 'assets_generated':
        progress.progress = 90;
        progress.message = 'All assets ready, ready for rendering...';
        break;
      case 'rendering':
        progress.progress = 95;
        progress.message = 'Rendering video...';
        break;
      case 'completed':
        progress.progress = 100;
        progress.message = 'Video completed!';
        break;
      case 'script_failed':
        progress.progress = 0;
        progress.message = 'Script generation failed';
        break;
      case 'storyboard_failed':
        progress.progress = 0;
        progress.message = 'Storyboard generation failed';
        break;
      case 'assets_failed':
        progress.progress = 0;
        progress.message = 'Asset generation failed';
        break;
      case 'render_failed':
        progress.progress = 0;
        progress.message = 'Video rendering failed';
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