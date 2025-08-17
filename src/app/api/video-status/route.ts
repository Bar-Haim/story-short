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
    
    // Check composite readiness for assets - SINGLE SOURCE OF TRUTH
    const hasImages = Array.isArray(video.image_urls) && video.image_urls.length > 0;
    const hasAudio = !!video.audio_url;
    const hasCaptions = !!video.captions_url;
    const isRenderReady = hasImages && hasAudio && hasCaptions;
    
    // Derive actual status from DB fields, not just the status field
    let actualStatus = video.status;
    let actualProgress = progress;
    let actualStage = stage;
    
    // Override status if it's inconsistent with actual DB state
    if (video.status === 'assets_generated' && !isRenderReady) {
      console.log(`[video-status] Inconsistent status detected: status=assets_generated but assets not ready. Correcting to assets_generating`);
      actualStatus = 'assets_generating';
    }
    
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
    
    switch (actualStatus) {
      case 'pending':
        actualProgress = 10;
        actualStage = 'Initializing...';
        break;
      case 'script_generated':
        actualProgress = 20;
        actualStage = 'Script ready';
        break;
      case 'storyboard_generated':
        actualProgress = 30;
        actualStage = 'Storyboard ready';
        break;
      case 'script_approved':
        actualProgress = 40;
        actualStage = 'Script approved';
        break;
      case 'assets_generating':
        actualProgress = 50;
        actualStage = 'Generating assets...';
        break;
      case 'assets_partial':
        actualProgress = 55;
        actualStage = 'Partial assets ready';
        break;
      case 'render_ready':
        actualProgress = 60;
        actualStage = 'All assets ready';
        break;
      case 'assets_generated':
        actualProgress = 60;
        actualStage = 'Assets ready';
        break;
      case 'rendering':
        actualProgress = 80;
        actualStage = 'Rendering video...';
        break;
      case 'completed':
        actualProgress = 100;
        actualStage = 'Video ready!';
        break;
      case 'failed':
        actualProgress = 0;
        actualStage = 'Processing failed';
        break;
      case 'assets_failed':
        actualProgress = 0;
        actualStage = 'Asset generation failed';
        break;
      default:
        actualProgress = 0;
        actualStage = 'Unknown status';
    }

    // If assets are being generated, check image upload progress
    if (actualStatus === 'assets_generating' && video.image_upload_progress !== undefined) {
      actualProgress = 30 + (video.image_upload_progress * 0.3); // 30-60% range
      actualStage = `Generating images... ${video.image_upload_progress}%`;
    }

    // If rendering, check if we have a final video URL
    if (actualStatus === 'rendering' && video.final_video_url) {
      actualProgress = 90;
      actualStage = 'Finalizing video...';
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: video.id,
        status: actualStatus, // Use corrected status
        progress: actualProgress, // Use corrected progress
        stage: actualStage, // Use corrected stage
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
        // SINGLE SOURCE OF TRUTH: readiness derived from DB fields
        ready: {
          images: hasImages,
          audio: hasAudio,
          captions: hasCaptions
        },
        // Composite readiness for backward compatibility
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
