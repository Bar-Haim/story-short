'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { VideoStatusResponse } from '@/types/video';

export default function RenderPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const [videoStatus, setVideoStatus] = useState<VideoStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Track elapsed time for rendering
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Poll video status every 3 seconds (less frequent than wait page)
  useEffect(() => {
    if (!id) return;

    const pollStatus = async () => {
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
        
        setVideoStatus(data.data);
        setLoading(false);
        setError(null);
        
        // If video is completed and has final_video_url, enable view button
        
      } catch (err) {
        console.error('Error polling video status:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch status');
        setLoading(false);
      }
    };

    // Initial poll
    pollStatus();
    
    // Set up polling interval
    const interval = setInterval(pollStatus, 3000);
    
    return () => clearInterval(interval);
  }, [id]);

  const handleViewVideo = () => {
    router.push(`/video/${id}`);
  };

  const handleBackToWait = () => {
    router.push(`/wait/${id}`);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
          <div className="flex gap-4 mt-4 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retry
            </button>
            <button
              onClick={handleBackToWait}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Back to Assets
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!videoStatus) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Video not found</h2>
          <button
            onClick={handleBackToWait}
            className="mt-4 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Back to Assets
          </button>
        </div>
      </div>
    );
  }

  const isRendering = videoStatus.status === 'rendering';
  const isCompleted = videoStatus.status === 'completed';
  const hasFailed = videoStatus.status === 'script_failed' || 
                   videoStatus.status === 'storyboard_failed' || 
                   videoStatus.status === 'assets_failed' || 
                   videoStatus.status === 'render_failed';

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {isCompleted ? 'Video Ready!' : 'Rendering Your Video'}
            </h1>
            <p className="text-gray-600">
              {isCompleted 
                ? 'Your video has been successfully rendered and is ready to view.'
                : isRendering 
                  ? 'Please wait while we compile your final video with subtitles...'
                  : 'Preparing video for rendering...'}
            </p>
          </div>

          {/* Rendering Animation */}
          <div className="text-center mb-8">
            {isCompleted ? (
              <div className="w-24 h-24 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : hasFailed ? (
              <div className="w-24 h-24 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-12 h-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            ) : (
              <div className="w-24 h-24 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>

          {/* Status and Time */}
          <div className="text-center mb-8">
            <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium mb-4 ${
              isCompleted 
                ? 'bg-green-100 text-green-800'
                : hasFailed 
                  ? 'bg-red-100 text-red-800'
                  : 'bg-blue-100 text-blue-800'
            }`}>
              {!isCompleted && !hasFailed && (
                <div className="animate-pulse rounded-full h-2 w-2 bg-current mr-2"></div>
              )}
              Status: {videoStatus.status.replace('_', ' ').toUpperCase()}
            </div>
            
            {(isRendering || isCompleted) && (
              <div className="text-sm text-gray-500">
                {isCompleted ? 'Completed' : `Elapsed time: ${formatTime(elapsedTime)}`}
              </div>
            )}
          </div>

          {/* Rendering Progress Indicator */}
          {isRendering && (
            <div className="mb-8">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Rendering Progress</span>
                <span>In Progress...</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '75%' }}></div>
              </div>
              <div className="text-xs text-gray-500 mt-2 text-center">
                Adding subtitles and finalizing video...
              </div>
            </div>
          )}

          {/* Video Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                {videoStatus.progress.imagesTotal}
              </div>
              <div className="text-sm text-gray-600">Total Scenes</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                {videoStatus.progress.audioDone ? '✅' : '❌'}
              </div>
              <div className="text-sm text-gray-600">Audio Track</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                {videoStatus.progress.captionsDone ? '✅' : '❌'}
              </div>
              <div className="text-sm text-gray-600">Subtitles</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleBackToWait}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
            >
              Back to Assets
            </button>
            
            <button
              onClick={handleViewVideo}
              disabled={!videoStatus.canView}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                videoStatus.canView
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isCompleted ? 'View Video' : 'View Video (Not Ready)'}
            </button>
          </div>

          {/* Expected Time Notice */}
          {isRendering && (
            <div className="mt-8 text-center text-sm text-gray-500">
              <p>
                Video rendering typically takes 2-5 minutes depending on length and complexity.
                <br />
                Please keep this page open and avoid refreshing.
              </p>
            </div>
          )}

          {/* Failure Notice */}
          {hasFailed && (
            <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-center">
                <h3 className="text-lg font-medium text-red-800 mb-2">Rendering Failed</h3>
                <p className="text-red-700 text-sm">
                  There was an issue rendering your video. Please try again or contact support if the problem persists.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}