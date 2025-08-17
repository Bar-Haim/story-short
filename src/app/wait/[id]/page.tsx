'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { VideoStatusResponse, VideoProgress } from '@/types/video';

export default function WaitPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const [videoStatus, setVideoStatus] = useState<VideoStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPolling, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [previousStatus, setPreviousStatus] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState(2000);
  const [pollingStartTime, setPollingStartTime] = useState(Date.now());

  // Enhanced polling with visibility detection and exponential backoff
  useEffect(() => {
    if (!id) return;

    const pollStatus = async () => {
      // Skip polling if page is hidden
      if (document.visibilityState === 'hidden') return;

      try {
        const response = await fetch(`/api/video-status?id=${id}`, {
          cache: 'no-store',
          next: { revalidate: 0 }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }
        
        // Check for status change to trigger toast
        if (previousStatus && previousStatus === 'rendering' && data.data.status === 'completed') {
          showToast('✅ Video is ready!');
        }
        
        setPreviousStatus(data.data.status);
        setVideoStatus(data.data);
        setLoading(false);
        setError(null);
        
        // Trigger cleanup for completed or failed renders
        if (data.data.status === 'completed' || data.data.status === 'render_failed') {
          // Fire-and-forget cleanup request
          fetch('/api/cleanup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoId: id }),
          }).catch(err => console.warn('Cleanup failed:', err));
        }
        
        // Don't auto-redirect - let user choose what to do
        
      } catch (err) {
        console.error('Error polling video status:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch status');
        setLoading(false);
      }
    };

    // Initial poll
    pollStatus();
    
    // Calculate polling interval with exponential backoff after 1 minute
    const updateInterval = () => {
      const elapsed = Date.now() - pollingStartTime;
      if (elapsed > 60000) { // After 1 minute
        if (elapsed > 180000) return 8000; // 8s after 3 minutes
        if (elapsed > 120000) return 5000; // 5s after 2 minutes
        return 3000; // 3s after 1 minute
      }
      return 2000; // 2s for first minute
    };
    
    // Set up polling interval with dynamic timing
    const interval = setInterval(() => {
      const newInterval = updateInterval();
      if (newInterval !== pollingInterval) {
        setPollingInterval(newInterval);
        clearInterval(interval);
        setTimeout(() => pollStatus(), newInterval);
      } else {
        pollStatus();
      }
    }, pollingInterval);

    // Resume polling when page becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        pollStatus();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [id, router, pollingInterval, pollingStartTime, previousStatus]);

  const calculateProgressPercentage = (progress: VideoProgress): number => {
    if (progress.imagesTotal === 0) return 0;
    
    const imageProgress = (progress.imagesDone / progress.imagesTotal) * 100;
    
    // Add small bonus for audio and captions completion
    let bonus = 0;
    if (progress.audioDone) bonus += 5;
    if (progress.captionsDone) bonus += 5;
    
    return Math.min(100, imageProgress + bonus);
  };

  // Helper functions
  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('✅ Link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
      showToast('❌ Failed to copy link');
    }
  };

  const downloadVideo = (url: string) => {
    // Use the download API endpoint for proper headers and file serving
    const downloadUrl = `/api/download-video/${id}`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `storyshort-video-${id}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('✅ Download started!');
  };

  const cancelRendering = async () => {
    try {
      const res = await fetch(`/api/render/cancel?id=${id}`, { method: 'POST' });
      if (res.ok) {
        showToast('🛑 Rendering cancelled');
      } else {
        throw new Error('Failed to cancel');
      }
    } catch (err) {
      console.error('Cancel failed:', err);
      showToast('❌ Failed to cancel rendering');
    }
  };

  // Computed state for button enabling
  const canFinalize = videoStatus?.status === 'assets_generated';
  const canView = videoStatus?.status === 'completed' && !!videoStatus?.final_video_url;

  // Poll until video completion with timeout
  async function pollUntilCompleted(videoId: string, timeoutMs = 180000, intervalMs = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await fetch(`/api/video-status?id=${videoId}`, { cache: 'no-store' });
        if (!res.ok) {
          console.warn(`[poll] HTTP ${res.status}, retrying in ${intervalMs}ms`);
          await new Promise(r => setTimeout(r, intervalMs));
          continue;
        }
        
        const json = await res.json();
        const st = json?.data?.status;
        if (st === 'completed' && json?.data?.final_video_url) return json.data.final_video_url as string;
        if (st?.includes('failed')) throw new Error(json?.data?.error_message || 'render_failed');
      } catch (e) {
        console.warn(`[poll] JSON parse error, retrying in ${intervalMs}ms:`, e);
        // Continue polling on JSON errors
      }
      await new Promise(r => setTimeout(r, intervalMs));
    }
    throw new Error('timeout_waiting_for_completed');
  }

  async function handleFinalize(videoId: string) {
    try {
      setIsFinalizing(true);
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      });
      if (!res.ok) {
        let err: any = {};
        try {
          err = await res.json();
        } catch (parseError) {
          console.warn('[finalize] Failed to parse error response:', parseError);
        }
        throw new Error(err?.error || `render_start_failed:${res.status}`);
      }
      // Poll to completion, then navigate to the video page
      const finalUrl = await pollUntilCompleted(videoId);
      router.push(`/video/${videoId}`); // "View Video" page
    } catch (e: any) {
      console.error('[finalize] error', e);
      setError(e?.message || 'Failed to finalize video');
    } finally {
      setIsFinalizing(false);
    }
  }

  function handleEdit(videoId: string) {
    setIsEditing(true);
    router.push(`/video/${videoId}`); // Navigate to video page for editing
  }

  const handleViewVideo = () => {
    router.push(`/video/${id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Loading video status...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ Error</div>
          <p className="text-gray-700">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!videoStatus) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Video not found</h2>
        </div>
      </div>
    );
  }

  // Handle render failed status
  if (videoStatus.status === 'render_failed') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="mx-auto max-w-md rounded-2xl border p-6 shadow-sm bg-white">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Rendering failed</h2>
          <p className="text-sm text-gray-600 mb-4">
            {videoStatus.error_message === 'cancelled_by_user' 
              ? 'Rendering was cancelled by user.'
              : (videoStatus.error_message ?? 'Video rendering failed. You can try again.')
            }
          </p>
          <div className="flex gap-2 mb-4">
            {videoStatus.error_message !== 'cancelled_by_user' && (
              <button
                onClick={async () => {
                  try {
                    await fetch('/api/render', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ videoId: id }),
                    });
                    window.location.reload();
                  } catch (err) {
                    console.error('Retry failed:', err);
                  }
                }}
                className="rounded-xl px-4 py-2 bg-violet-600 text-white hover:bg-violet-700"
              >
                Try Again
              </button>
            )}
            <a 
              href="/create" 
              className="rounded-xl px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700"
            >
              Back to Generator
            </a>
          </div>
          {(videoStatus as any).log_url && (
            <div className="mb-4">
              <a
                href={(videoStatus as any).log_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                📄 Download FFmpeg Log
              </a>
            </div>
          )}
          <div className="text-xs text-gray-500">
            <div>Video ID: {id}</div>
            <div>Status: {videoStatus.status}</div>
          </div>
        </div>
      </div>
    );
  }

  // Handle failed statuses
  if (videoStatus.status === 'assets_failed') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="mx-auto max-w-md rounded-2xl border p-6 shadow-sm bg-white">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Generation failed</h2>
          <p className="text-sm text-gray-600 mb-4">
            {videoStatus.error_message ?? 'Assets generation failed. You can try again.'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                try {
                  await fetch('/api/generate-assets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ videoId: id }),
                  });
                  window.location.reload(); // Refresh to start polling again
                } catch (err) {
                  console.error('Retry failed:', err);
                }
              }}
              className="rounded-xl px-4 py-2 bg-violet-600 text-white hover:bg-violet-700"
            >
              Try Again
            </button>
            <a 
              href="/create" 
              className="rounded-xl px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700"
            >
              Back to Generator
            </a>
          </div>
          <div className="mt-4 text-xs text-gray-500">
            <div>Video ID: {id}</div>
            <div>Status: {videoStatus.status}</div>
          </div>
        </div>
      </div>
    );
  }

  // Video completion result card
  if (videoStatus.status === 'completed' && videoStatus.final_video_url) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-sm p-8">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🎉</div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Your Video is Ready!
              </h1>
              <p className="text-gray-600">
                Your story has been transformed into a beautiful video.
              </p>
            </div>

            {/* Video Player */}
            <div className="mb-8">
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  controls
                  className="w-full h-full"
                  preload="metadata"
                  poster={videoStatus.image_urls?.[0] || undefined}
                >
                  <source src={videoStatus.final_video_url} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <button
                type="button"
                className="rounded-xl px-6 py-3 bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                onClick={() => copyToClipboard(videoStatus.final_video_url!)}
              >
                📋 Copy Link
              </button>

              <button
                type="button"
                className="rounded-xl px-6 py-3 bg-green-600 text-white hover:bg-green-700 transition-colors"
                onClick={() => downloadVideo(videoStatus.final_video_url!)}
              >
                ⬇️ Download MP4
              </button>

              <button
                type="button"
                className="rounded-xl px-6 py-3 bg-gray-600 text-white hover:bg-gray-700 transition-colors"
                onClick={() => handleEdit(id)}
              >
                ✏️ Edit Scenes
              </button>

              <button
                type="button"
                className="rounded-xl px-6 py-3 bg-violet-600 text-white hover:bg-violet-700 transition-colors"
                onClick={() => router.push('/create')}
              >
                ➕ Create Another
              </button>
            </div>

            {/* Video Details */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Video Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Video ID:</span>
                  <div className="font-mono text-xs">{id}</div>
                </div>
                <div>
                  <span className="text-gray-500">Scenes:</span>
                  <div>{videoStatus.progress.imagesTotal}</div>
                </div>
                <div>
                  <span className="text-gray-500">Status:</span>
                  <div className="text-green-600 font-medium">Completed</div>
                </div>
                <div>
                  <span className="text-gray-500">File Size:</span>
                  <div>Video file</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const progressPercentage = calculateProgressPercentage(videoStatus.progress);

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Generating Your Video
            </h1>
            <p className="text-gray-600">
              Please wait while we create your video assets...
            </p>
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Progress</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>

          {/* Progress Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                {videoStatus.progress.imagesDone}/{videoStatus.progress.imagesTotal}
              </div>
              <div className="text-sm text-gray-600">Images Generated</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                {videoStatus.progress.audioDone ? '✅' : '⏳'}
              </div>
              <div className="text-sm text-gray-600">Audio Ready</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                {videoStatus.progress.captionsDone ? '✅' : '⏳'}
              </div>
              <div className="text-sm text-gray-600">Captions Ready</div>
            </div>
          </div>

          {/* Status Message */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              Status: {videoStatus.status.replace('_', ' ').toUpperCase()}
            </div>
          </div>

          {/* Action Buttons - No click-blocking overlays */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pointer-events-auto">
            <button
              type="button"
              className="rounded-xl px-4 py-2 bg-gray-800 text-white disabled:opacity-50"
              onClick={() => handleEdit(id)}
              disabled={isEditing}
            >
              Edit Scenes
            </button>

            {videoStatus.status === 'rendering' ? (
              <button
                type="button"
                className="rounded-xl px-4 py-2 bg-red-600 text-white hover:bg-red-700 transition-colors"
                onClick={cancelRendering}
              >
                🛑 Cancel Rendering
              </button>
            ) : (
              <button
                type="button"
                className="rounded-xl px-4 py-2 bg-violet-600 text-white disabled:opacity-50"
                onClick={() => handleFinalize(id)}
                disabled={!canFinalize || isFinalizing}
              >
                {isFinalizing ? 'Finalizing…' : 'Finalize Video'}
              </button>
            )}

            <button
              type="button"
              className="rounded-xl px-4 py-2 bg-gray-200 text-gray-900 disabled:opacity-50"
              onClick={() => router.push(`/video/${id}`)}
              disabled={!canView}
              title={!canView ? 'Video not ready yet' : undefined}
            >
              View Video
            </button>
          </div>

          {/* Help Text */}
          <div className="mt-8 text-center text-sm text-gray-500">
            <p>
              {!canFinalize && !canView && 'Assets are still being generated. Please wait...'}
              {canFinalize && !canView && 'All assets ready! You can finalize the video now.'}
              {canView && 'Your video is ready to view!'}
              {isFinalizing && 'Finalizing video and rendering... This may take a few minutes.'}
            </p>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="bg-gray-900 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-2 fade-in-0">
            <span>{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
}