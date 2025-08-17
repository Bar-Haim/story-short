'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

export default function VideoPage() {
  const routeParams = useParams<{ id: string }>();
  const id = useMemo(() => (routeParams?.id ?? '').toString(), [routeParams]);
  
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    
    const ac = new AbortController();
    
    async function poll() {
      setLoading(true);
      setErr(null);
      
      try {
        for (let i = 0; i < 30; i++) { // up to ~90s
          const res = await fetch(`/api/video-status?id=${id}`, {
            signal: ac.signal,
            cache: 'no-store'
          });
          
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          
          let j;
          try {
            j = await res.json();
          } catch (jsonError) {
            console.warn('JSON parsing failed, retrying...', jsonError);
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }
          
          setData(j?.data);
          
          // wait until ready
          if (j?.data?.status === 'completed' && j?.data?.final_video_url) {
            setLoading(false);
            return;
          }
          
          await new Promise(r => setTimeout(r, 3000));
        }
        
        throw new Error('Timeout waiting for final video');
        
      } catch (e: any) {
        if (ac.signal.aborted) return;
        setErr(e?.message || 'Failed to fetch video');
        setLoading(false);
      }
    }
    
    poll();
    
    return () => ac.abort();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading video...</p>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">Failed to load video: {err}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Retry
          </button>
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Your Video</h1>
          <video 
            controls 
            className="w-full rounded-xl shadow-lg"
            src={data.final_video_url}
          />
          <div className="mt-6 text-sm text-gray-600">
            <p>Duration: {data.total_duration || 'Unknown'} seconds</p>
            <p>Status: {data.status}</p>
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