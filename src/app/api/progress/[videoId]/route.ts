import { NextRequest, NextResponse } from 'next/server';
import { VideoService } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params;

  if (!videoId) {
    return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
  }

  // Set up SSE headers
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const sendProgress = (data: any) => {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // Send initial connection message
      sendProgress({ type: 'connected', videoId });

      // Poll for video status updates
      const pollInterval = setInterval(async () => {
        try {
          const result = await VideoService.getVideo(videoId);
          
          if (result.success && result.video) {
            const video = result.video;
            
            // Send progress update based on status
            let progress = {
              type: 'progress',
              status: video.status,
              percentage: 0,
              details: ''
            };

            switch (video.status) {
              case 'pending':
                progress.percentage = 10;
                progress.details = 'Initializing video generation...';
                break;
              case 'script_generated':
                progress.percentage = 20;
                progress.details = 'Script generated, preparing assets...';
                break;
              case 'generating_assets':
                // Calculate dynamic percentage based on image upload progress
                const basePercentage = 30; // Starting percentage for asset generation
                const maxAssetPercentage = 70; // Maximum percentage for asset generation
                const assetRange = maxAssetPercentage - basePercentage;
                
                if (video.image_upload_progress !== null && video.image_upload_progress !== undefined) {
                  // Show real-time image upload progress
                  const imageProgressPercentage = (video.image_upload_progress / 100) * assetRange;
                  progress.percentage = Math.round(basePercentage + imageProgressPercentage);
                  progress.details = `📸 Uploading Images – ${video.image_upload_progress}% completed`;
                } else {
                  // Fallback for when image progress is not available
                  progress.percentage = 30;
                  progress.details = 'Creating storyboard and generating images...';
                }
                break;
              case 'assets_generated':
                progress.percentage = 80;
                progress.details = 'All assets generated successfully!';
                break;
              case 'completed':
                progress.percentage = 100;
                progress.details = 'Video generation complete!';
                break;
              case 'failed':
                progress.percentage = 0;
                progress.details = `Generation failed: ${video.error_message || 'Unknown error'}`;
                break;
              case 'cancelled':
                progress.percentage = 0;
                progress.details = 'Video generation was cancelled';
                break;
            }

            sendProgress(progress);

            // Close connection if video is completed, failed, or cancelled
            if (video.status === 'completed' || video.status === 'failed' || video.status === 'cancelled') {
              clearInterval(pollInterval);
              controller.close();
            }
          } else {
            // Video not found or not ready yet - send a waiting message instead of error
            sendProgress({ 
              type: 'progress', 
              status: 'initializing',
              percentage: 5,
              details: 'Initializing video generation... This may take a few seconds.'
            });
          }
        } catch (error) {
          sendProgress({ 
            type: 'error', 
            message: 'Error polling video status' 
          });
        }
      }, 1000); // Poll every second

      // Clean up on client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(pollInterval);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  });
} 