'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function VideoPage() {
  const routeParams = useParams<{ id: string }>();
  const router = useRouter();
  const id = useMemo(() => (routeParams?.id ?? '').toString(), [routeParams]);
  
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  // Polling configuration
  const maxWaitTime = 180000; // 3 minutes max wait
  const maxRetries = 5;
  const baseDelay = 1000; // 1 second base delay

  // Calculate exponential backoff delay
  const getDelay = (attempt: number) => {
    const delay = baseDelay * Math.pow(2, attempt);
    return Math.min(delay, 10000); // Cap at 10 seconds
  };

  // Retry rendering with force flag
  const retryRendering = async () => {
    if (isRetrying) return;
    
    setIsRetrying(true);
    setErr(null);
    
    try {
      console.log('🔄 Retrying video rendering...');
      
      const response = await fetch('/api/render-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: id, force: true })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Rendering retry initiated:', result);
        
        // Reset retry count and start polling again
        setRetryCount(0);
        setLoading(true);
        
        // Wait a moment then start polling
        setTimeout(() => {
          pollVideoStatus();
        }, 2000);
        
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to retry rendering');
      }
    } catch (error) {
      console.error('❌ Rendering retry failed:', error);
      setErr(error instanceof Error ? error.message : 'Failed to retry rendering');
    } finally {
      setIsRetrying(false);
    }
  };

  // Poll video status with exponential backoff
  const pollVideoStatus = async () => {
    if (!id) return;
    
    const startTime = Date.now();
    let attempt = 0;
    
    const poll = async (): Promise<void> => {
      try {
        // Check if we've exceeded max wait time
        if (Date.now() - startTime > maxWaitTime) {
          throw new Error('Maximum wait time exceeded (3 minutes). Please try again later.');
        }

        console.log(`📡 Polling video status (attempt ${attempt + 1})...`);
        
        const response = await fetch(`/api/video-status?id=${id}`, {
          cache: 'no-store',
          next: { revalidate: 0 }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        if (result.error) {
          throw new Error(result.error);
        }
        
        const videoData = result.data;
        setData(videoData);
        
        // Check if video is ready
        if (videoData.status === 'completed' && videoData.final_video_url) {
          console.log('✅ Video is ready!');
          setLoading(false);
          setErr(null);
          return;
        }
        
        // Check if rendering failed
        if (videoData.status === 'render_failed') {
          throw new Error(videoData.error_message || 'Video rendering failed');
        }
        
        // Check if we should stop polling (failed status)
        if (['script_failed', 'storyboard_failed', 'assets_failed'].includes(videoData.status)) {
          throw new Error(`Video generation failed at ${videoData.status.replace('_', ' ')} stage`);
        }
        
        // Continue polling with exponential backoff
        attempt++;
        const delay = getDelay(attempt);
        
        console.log(`⏳ Video not ready yet (${videoData.status}), retrying in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return poll();
        
      } catch (error) {
        console.error(`❌ Polling attempt ${attempt + 1} failed:`, error);
        
        // If we've exceeded max retries, show error
        if (attempt >= maxRetries) {
          setErr(error instanceof Error ? error.message : 'Failed to load video after multiple attempts');
          setLoading(false);
          return;
        }
        
        // Retry with exponential backoff
        const delay = getDelay(attempt);
        console.log(`🔄 Retrying in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return poll();
      }
    };
    
    poll();
  };

  useEffect(() => {
    if (!id) return;
    
    console.log('🎬 Video page mounted, starting status polling...');
    pollVideoStatus();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Preparing video...</p>
          <p className="text-sm text-gray-500 mt-2">
            This may take a few minutes. Please wait...
          </p>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-red-600 text-xl mb-4">⚠️ Video Not Ready</div>
          <p className="text-gray-700 mb-6">{err}</p>
          
          <div className="flex flex-col gap-3">
            <button 
              onClick={retryRendering}
              disabled={isRetrying}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isRetrying ? 'Retrying...' : 'Retry Rendering'}
            </button>
            
            <button 
              onClick={() => router.push(`/render/${id}`)}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Back to Render Page
            </button>
            
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 underline"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data?.final_video_url) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">Video not ready yet</p>
          <p className="text-sm text-gray-500 mt-2">Please wait for rendering to complete</p>
          <button 
            onClick={() => router.push(`/render/${id}`)}
            className="mt-4 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Back to Render Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Your Video</h1>
          
          {/* Video Player */}
          <div className="relative">
            <video 
              controls 
              className="w-full rounded-xl shadow-lg"
              src={data.final_video_url}
              preload="metadata"
            />
            
            {/* Video Status Info */}
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-800">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">Video Ready!</span>
              </div>
              <p className="text-sm text-green-700 mt-1">
                Your video has been successfully rendered and is ready to view.
              </p>
            </div>
          </div>
          
          {/* Video Details */}
          <div className="mt-6 text-sm text-gray-600">
            <p>Duration: {data.total_duration || 'Unknown'} seconds</p>
            <p>Status: {data.status}</p>
            {data.render_done_at && (
              <p>Completed: {new Date(data.render_done_at).toLocaleString()}</p>
            )}
          </div>
          
          {/* Share and Download Buttons */}
          <ShareButtons url={data.final_video_url} videoId={id} />
        </div>
      </div>
    </div>
  );
}

function ShareButtons({ url, videoId }: { url: string; videoId: string }) {
  async function nativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My StoryShort video',
          url
        });
      } catch (e) {
        console.warn(e);
      }
    } else {
      await navigator.clipboard.writeText(url);
      alert('Link copied!');
    }
  }

  const wa = `https://wa.me/?text=${encodeURIComponent(url)}`;
  const tg = `https://t.me/share/url?url=${encodeURIComponent(url)}`;

  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <a 
        href={`/api/download-video/${videoId}`}
        className="px-4 py-2 rounded-xl bg-violet-600 text-white hover:bg-violet-700 transition-colors"
      >
        Download MP4
      </a>
      <button 
        onClick={nativeShare} 
        className="px-4 py-2 rounded-xl border border-gray-300 hover:bg-gray-50 transition-colors"
      >
        Share
      </button>
      <a 
        href={wa} 
        target="_blank" 
        rel="noopener noreferrer"
        className="px-4 py-2 rounded-xl border border-gray-300 hover:bg-gray-50 transition-colors"
      >
        WhatsApp
      </a>
      <a 
        href={tg} 
        target="_blank" 
        rel="noopener noreferrer"
        className="px-4 py-2 rounded-xl border border-gray-300 hover:bg-gray-50 transition-colors"
      >
        Telegram
      </a>
    </div>
  );
} 