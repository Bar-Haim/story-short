import { NextRequest, NextResponse } from 'next/server';
import { VideoService } from '@/lib/supabase-server';

// Mark route dynamic and disable caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Timeout wrapper with retries
async function withTimeoutAndRetry<T>(
  operation: () => Promise<T>, 
  timeoutMs: number = 5000, 
  maxRetries: number = 2
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), timeoutMs);
      });
      
      const result = await Promise.race([operation(), timeoutPromise]);
      return result;
    } catch (error: any) {
      lastError = error;
      
      if (attempt < maxRetries) {
        // Exponential backoff: 100ms, 200ms, 400ms
        const delay = 100 * Math.pow(2, attempt);
        console.warn(`[video-status] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ 
        ok: false, 
        error: 'missing_video_id' 
      }, { status: 400 });
    }

    // Wrap Supabase calls with timeout + retries
    const video = await withTimeoutAndRetry(
      () => VideoService.getById(id),
      5000, // 5 second timeout
      2     // up to 2 retries
    );

    if (!video) {
      return NextResponse.json({ 
        ok: false, 
        error: 'video_not_found' 
      }, { status: 404 });
    }

    // Calculate progress and stage based on status
    let progress = 0;
    let stage = 'Unknown';
    
    // Check composite readiness for assets
    const hasImages = Array.isArray(video.image_urls) && video.image_urls.length > 0;
    const hasAudio = !!video.audio_url;
    const hasCaptions = !!video.captions_url;
    const isRenderReady = hasImages && hasAudio && hasCaptions;
    
    // Analyze placeholder usage from storyboard scenes
    let placeholdersCount = 0;
    let scenesWithPlaceholder: number[] = [];
    
    if (video.storyboard_json?.scenes && Array.isArray(video.storyboard_json.scenes)) {
      video.storyboard_json.scenes.forEach((scene: any, index: number) => {
        if (scene.placeholder_used) {
          placeholdersCount++;
          scenesWithPlaceholder.push(index);
        }
      });
    }
    
    switch (video.status) {
      case 'pending':
        progress = 10;
        stage = 'Initializing...';
        break;
      case 'script_generated':
        progress = 20;
        stage = 'Script ready';
        break;
      case 'storyboard_generated':
        progress = 30;
        stage = 'Storyboard ready';
        break;
      case 'script_approved':
        progress = 40;
        stage = 'Script approved';
        break;
      case 'assets_generating':
        progress = 50;
        stage = 'Generating assets...';
        break;
      case 'assets_partial':
        progress = 55;
        stage = 'Partial assets ready';
        break;
      case 'render_ready':
        progress = 60;
        stage = 'All assets ready';
        break;
      case 'assets_generated':
        progress = 60;
        stage = 'Assets ready';
        break;
      case 'rendering':
        progress = 80;
        stage = 'Rendering video...';
        break;
      case 'completed':
        progress = 100;
        stage = 'Video ready!';
        break;
      case 'failed':
        progress = 0;
        stage = 'Processing failed';
        break;
      case 'assets_failed':
        progress = 0;
        stage = 'Asset generation failed';
        break;
      default:
        progress = 0;
        stage = 'Unknown status';
    }

    // If assets are being generated, check image upload progress
    if (video.status === 'assets_generating' && video.image_upload_progress !== undefined) {
      progress = 30 + (video.image_upload_progress * 0.3); // 30-60% range
      stage = `Generating images... ${video.image_upload_progress}%`;
    }

    // If rendering, check if we have a final video URL
    if (video.status === 'rendering' && video.final_video_url) {
      progress = 90;
      stage = 'Finalizing video...';
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: video.id,
        status: video.status,
        progress,
        stage,
        input_text: video.input_text,
        script: video.script,
        storyboard_json: video.storyboard_json,
        audio_url: video.audio_url,
        captions_url: video.captions_url,
        image_urls: video.image_urls,
        total_duration: video.total_duration,
        final_video_url: video.final_video_url,
        error_message: video.error_message,
        image_upload_progress: video.image_upload_progress,
        created_at: video.created_at,
        updated_at: video.updated_at,
        // Add composite readiness information
        assets: {
          images: hasImages ? (Array.isArray(video.image_urls) ? video.image_urls.length : 0) : 0,
          audio: hasAudio,
          captions: hasCaptions,
          renderReady: isRenderReady
        },
        // Add placeholder information for UI regeneration options
        placeholders: {
          count: placeholdersCount,
          scenesWithPlaceholder: scenesWithPlaceholder,
          hasPlaceholders: placeholdersCount > 0
        }
      }
    });

  } catch (error: any) {
    console.error('[video-status] Error:', error);
    
    // On Supabase fetch error, return 200 with processing status instead of throwing 502
    if (error.message?.includes('timeout') || error.message?.includes('fetch')) {
      console.warn('[video-status] Supabase timeout/fetch error, returning processing status');
      return NextResponse.json({
        ok: true,
        data: {
          status: 'processing',
          progress: 50,
          stage: 'Processing... (status temporarily unavailable)',
          error_message: 'Status check temporarily unavailable, please try again in a moment.'
        }
      });
    }
    
    // For other errors, return 500
    return NextResponse.json({ 
      ok: false, 
      error: 'internal_server_error',
      message: 'An unexpected error occurred while checking video status.'
    }, { status: 500 });
  }
}
