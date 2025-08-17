'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import WizardStepper, { defaultSteps } from '@/components/WizardStepper';

interface VideoData {
  id: string;
  status: string;
  image_urls?: string[];
  audio_url?: string;
  captions_url?: string;
  final_video_url?: string;
  error_message?: string;
  progress?: number;
  storyboard_json?: {
    scenes: any[];
  };
  ready?: {
    images: boolean;
    audio: boolean;
    captions: boolean;
  };
  assets?: {
    images: number;
    audio: boolean;
    captions: boolean;
    renderReady: boolean;
  };
  placeholders?: {
    count: number;
    scenesWithPlaceholder: number[];
    hasPlaceholders: boolean;
  };
}

// Safe JSON parsing helper
async function safeJson(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try { 
    return JSON.parse(text); 
  } catch { 
    return null; 
  }
}

export default function FinalizePage() {
  const router = useRouter();
  const params = useParams();
  const videoId = params.id as string;

  const [video, setVideo] = useState<VideoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [regeneratingScenes, setRegeneratingScenes] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (videoId) {
      fetchVideo();
      // Poll for updates every 2 seconds
      const interval = setInterval(fetchVideo, 2000);
      return () => clearInterval(interval);
    }
  }, [videoId]);

  // Automatically trigger asset generation on mount if needed
  useEffect(() => {
    if (video && !isGenerating) {
      // Check actual readiness from DB fields, not just status
      const needsAssets = !video.ready?.audio || !video.ready?.captions || !video.ready?.images;
      const canGenerate = ['script_approved', 'storyboard_generated', 'assets_failed', 'assets_generating'].includes(video.status);
      
      if (needsAssets && canGenerate) {
        console.log('[finalize] Auto-triggering asset generation - assets not ready:', { 
          audio: video.ready?.audio, 
          captions: video.ready?.captions, 
          images: video.ready?.images 
        });
        triggerAssetGeneration();
      }
    }
  }, [video, isGenerating]);



  const fetchVideo = async () => {
    try {
      const response = await fetch(`/api/video-status?id=${videoId}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to fetch video');
      }
      
      const result = await safeJson(response);
      if (!result) {
        throw new Error('Invalid response from server');
      }
      
      const videoData = result.data;
      
      if (!videoData) {
        throw new Error('Video not found');
      }

      setVideo(videoData);
      
    } catch (err: any) {
      console.error('Failed to fetch video:', err);
      setError(err.message || 'Failed to load video');
    } finally {
      setLoading(false);
    }
  };



  const triggerAssetGeneration = async () => {
    if (isGenerating) return; // Prevent duplicate calls
    
    setIsGenerating(true);
    try {
      console.log('[finalize] Triggering asset generation...');
      const response = await fetch('/api/generate-assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoId }),
      });

      const json = await safeJson(response);
      if (!response.ok) {
        const errorMsg = json?.error || `Asset generation failed (${response.status})`;
        if (errorMsg.includes('ELEVENLABS_API_KEY')) {
          setError('Missing ElevenLabs API key. Please check your environment configuration.');
        } else {
          setError(errorMsg);
        }
        return;
      }

      if (json?.status === 'ready') {
        console.log('[finalize] Assets already ready');
        await fetchVideo();
      } else if (json?.status === 'assets_generated') {
        console.log('[finalize] Asset generation completed successfully');
        await fetchVideo();
      } else {
        console.log('[finalize] Asset generation started');
        // Continue polling for updates
      }
      
    } catch (err: any) {
      console.error('Failed to trigger asset generation:', err);
      setError(err.message || 'Failed to trigger asset generation');
    } finally {
      setIsGenerating(false);
    }
  };





  

  const handleRetryAssets = async () => {
    if (isGenerating) return;
    
    setIsGenerating(true);
    setError('');
    
    try {
      const response = await fetch('/api/generate-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, force: true })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to retry asset generation');
      }
      
      const result = await response.json();
      
      if (result.status === 'assets_generated') {
        console.log('✅ Asset generation retry completed successfully');
        await fetchVideo();
      } else {
        console.log('🔄 Asset generation retry started');
        // Continue polling for updates
      }
      
    } catch (err: any) {
      console.error('Failed to retry asset generation:', err);
      setError(err.message || 'Failed to retry asset generation');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle scene regeneration
  const handleRegenerateScene = async (sceneIndex: number) => {
    if (regeneratingScenes.has(sceneIndex)) return;
    
    setRegeneratingScenes(prev => new Set(prev).add(sceneIndex));
    
    try {
      const response = await fetch('/api/regenerate-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, sceneIndex })
      });
      
      if (!response.ok) {
        throw new Error('Failed to regenerate scene');
      }
      
      const result = await response.json();
      
      if (result.ok) {
        // Refresh video data to show updated status
        await fetchVideo();
        
        if (result.is_placeholder) {
          setError(`Scene ${sceneIndex + 1} regeneration failed: ${result.reason}`);
        } else {
          setError(''); // Clear any previous errors
        }
      } else {
        throw new Error(result.error || 'Regeneration failed');
      }
    } catch (err: any) {
      console.error('Failed to regenerate scene:', err);
      setError(`Failed to regenerate scene ${sceneIndex + 1}: ${err.message}`);
    } finally {
      setRegeneratingScenes(prev => {
        const newSet = new Set(prev);
        newSet.delete(sceneIndex);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading video status...</p>
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600">Video not found</p>
          <button 
            onClick={() => router.push('/create')}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Go to Create
          </button>
        </div>
      </div>
    );
  }

  const imageCount = video.image_urls?.length || 0;
  const totalScenes = video.storyboard_json?.scenes?.length || 0;
  const hasAllImages = imageCount === totalScenes && imageCount > 0;
  const hasAudio = !!video.audio_url;
  const hasCaptions = !!video.captions_url;
  const isReady = hasAllImages && hasAudio && hasCaptions;
  
  // Use assets info if available, fall back to calculated values
  const assetsInfo = video.assets || {
    images: imageCount,
    audio: hasAudio,
    captions: hasCaptions,
    renderReady: isReady
  };

  // Enhanced progress calculation with detailed breakdown
  const total = totalScenes || 0;
  const imagesDone = imageCount || 0;
  const audioDone = hasAudio;
  const captionsDone = hasCaptions;

  let pct = 0;
  let statusLabel = '';
  
  if (total > 0) {
    // Images worth 60%, audio 20%, captions 20%
    pct = Math.round(
      (Math.min(imagesDone, total) / total) * 60 +
      (audioDone ? 20 : 0) +
      (captionsDone ? 20 : 0)
    );
  }

  // Generate live status text
  if (!audioDone || !captionsDone || imagesDone < total) {
    if (imagesDone < total) {
      statusLabel = `Images ${imagesDone}/${total}`;
    } else if (!audioDone) {
      statusLabel = 'Generating audio...';
    } else if (!captionsDone) {
      statusLabel = 'Generating captions...';
    }
  } else {
    statusLabel = 'Assets ready';
  }

  // Override for rendering status
  if (video.status === 'rendering') {
    pct = 80 + (video.progress || 0) * 0.2; // 80-100% range during rendering
    statusLabel = 'Rendering video...';
  } else if (video.status === 'completed') {
    pct = 100;
    statusLabel = 'Video complete!';
  }

  // Get status badge info
  const getStatusBadge = () => {
    switch (video.status) {
      case 'assets_generated':
        return { text: 'Ready to Render', color: 'bg-green-100 text-green-700' };
      case 'render_ready':
        return { text: 'Ready to Render', color: 'bg-green-100 text-green-700' };
      case 'assets_generating':
        return { text: 'Generating Assets', color: 'bg-blue-100 text-blue-700' };
      case 'assets_partial':
        return { text: 'Partial Assets Ready', color: 'bg-yellow-100 text-yellow-700' };
      case 'assets_failed':
        return { text: 'Asset Generation Failed', color: 'bg-red-100 text-red-700' };
      case 'rendering':
        return { text: 'Rendering Video', color: 'bg-purple-100 text-purple-700' };
      case 'render_failed':
        return { text: 'Render Failed', color: 'bg-red-100 text-red-700' };
      case 'completed':
        return { text: 'Video Complete', color: 'bg-green-100 text-green-700' };
      default:
        return { text: video.status, color: 'bg-gray-100 text-gray-700' };
    }
  };

  const statusBadge = getStatusBadge();

  // Check if View Video button should be enabled
  const canView = video.status === 'completed' && !!video.final_video_url;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Stepper */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <WizardStepper steps={defaultSteps} currentStep={3} />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Finalize Your Video</h1>
            <p className="text-gray-600">
              Review your assets and render the final video.
            </p>
          </div>

          {/* Status Badge */}
          <div className="mb-8">
            <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${statusBadge.color}`}>
              {statusBadge.text}
            </span>
          </div>



          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span>Progress</span>
              <span>{Math.round(pct)}%</span>
            </div>
            
            {/* Progress bar */}
            <div className="h-2 w-full rounded-full bg-gray-200 mb-4">
              <div
                className="h-2 rounded-full bg-violet-600 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Three step dots for Images, Audio, Captions */}
            <div className="flex items-center gap-6 text-sm mb-3">
              <div className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full ${imagesDone === total && total > 0 ? 'bg-green-500' : 'bg-violet-500 animate-pulse'}`} />
                <span className="text-gray-700">Images</span>
                {total > 0 && <span className="text-gray-500">({imagesDone}/{total})</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full ${audioDone ? 'bg-green-500' : 'bg-violet-500 animate-pulse'}`} />
                <span className="text-gray-700">Audio</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full ${captionsDone ? 'bg-green-500' : 'bg-violet-500 animate-pulse'}`} />
                <span className="text-gray-700">Captions</span>
              </div>
            </div>

            {/* Live status text */}
            <div className="text-gray-600 text-sm font-medium">
              {statusLabel}
            </div>
          </div>

          {/* Live progress strip with animated dots */}
          <div className="mb-6">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>{statusLabel}</span>
              <span className="animate-bounce">•</span>
              <span className="animate-bounce" style={{ animationDelay: '150ms' }}>•</span>
              <span className="animate-bounce" style={{ animationDelay: '300ms' }}>•</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full mt-1">
              <div 
                className="h-2 bg-violet-600 rounded-full transition-all" 
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Three step markers for overall pipeline */}
          <div className="grid grid-cols-3 gap-2 text-xs text-gray-600 mb-6">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${pct >= 30 ? 'bg-violet-600' : 'bg-gray-300'}`}></div>
              <span>Preparing</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${pct >= 70 ? 'bg-violet-600' : 'bg-gray-300'}`}></div>
              <span>Rendering</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${pct >= 100 ? 'bg-violet-600' : 'bg-gray-300'}`}></div>
              <span>Complete</span>
            </div>
          </div>

          {/* Assets Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Images */}
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900">Images</h3>
                {assetsInfo.images > 0 ? (
                  <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <p className="text-2xl font-bold text-gray-900">{video.ready?.images ? (Array.isArray(video.image_urls) ? video.image_urls.length : 0) : 0}/{totalScenes}</p>
              <p className="text-sm text-gray-600">Scene images</p>
            </div>

                      {/* Audio */}
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900">Audio</h3>
              {video.ready?.audio ? (
                <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-blue-500 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <p className="text-2xl font-bold text-gray-900">{video.ready?.audio ? 'Ready' : 'Generating...'}</p>
            <p className="text-sm text-gray-600">Voiceover audio</p>
          </div>

                      {/* Captions */}
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900">Captions</h3>
              {video.ready?.captions ? (
                <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-blue-500 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <p className="text-2xl font-bold text-gray-900">{video.ready?.captions ? 'Ready' : 'Generating...'}</p>
            <p className="text-sm text-gray-600">Subtitle file</p>
          </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Video Error Message */}
          {video.error_message && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700">{video.error_message}</p>
            </div>
          )}

          {/* Placeholder Warning Banner */}
          {video.placeholders?.hasPlaceholders && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-yellow-900 mb-2">
                    ⚠️ {video.placeholders.count} scene{video.placeholders.count > 1 ? 's' : ''} used placeholder{video.placeholders.count > 1 ? 's' : ''}
                  </h3>
                  <p className="text-yellow-700 text-sm mb-3">
                    Some scenes couldn't be generated due to content policy restrictions. 
                    You can try regenerating them individually to improve quality.
                  </p>
                  
                  {/* Scene-specific regeneration buttons */}
                  <div className="space-y-2">
                    {video.placeholders.scenesWithPlaceholder.map((sceneIndex) => {
                      const scene = video.storyboard_json?.scenes?.[sceneIndex];
                      const isRegenerating = regeneratingScenes.has(sceneIndex);
                      
                      return (
                        <div key={sceneIndex} className="flex items-center justify-between p-3 bg-yellow-100 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-yellow-900">
                              Scene {sceneIndex + 1}
                            </div>
                            {scene?.reason && (
                              <div className="text-xs text-yellow-700">
                                Reason: {scene.reason.replace(/_/g, ' ')}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleRegenerateScene(sceneIndex)}
                            disabled={isRegenerating}
                            className={`px-3 py-1 text-sm rounded-md transition-colors ${
                              isRegenerating
                                ? 'bg-yellow-300 text-yellow-800 cursor-not-allowed'
                                : 'bg-yellow-600 text-white hover:bg-yellow-700'
                            }`}
                          >
                            {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-4">
            {/* Main Action - Finalize Video */}
            {video.status === 'assets_generated' && video.ready?.audio && video.ready?.captions && video.ready?.images && (
              <div className="text-center">
                <Link
                  href={`/render/${videoId}`}
                  className="inline-block px-8 py-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Proceed to Rendering
                </Link>
                <p className="text-sm text-gray-600 mt-2">
                  All assets are ready! Click to start video rendering.
                </p>
              </div>
            )}

            {/* Asset Generation in Progress */}
            {(video.status === 'assets_generating' || (!video.ready?.audio || !video.ready?.captions || !video.ready?.images)) && (
              <div className="text-center">
                <div className="px-8 py-4 bg-blue-600 text-white rounded-lg opacity-75 cursor-not-allowed">
                  Generating Assets...
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Audio and captions are being generated automatically. Please wait...
                </p>
              </div>
            )}

            {/* Partial Assets Action */}
            {video.status === 'assets_partial' && (
              <div className="text-center">
                <button
                  onClick={triggerAssetGeneration}
                  disabled={isGenerating}
                  aria-busy={isGenerating}
                  className="px-8 py-4 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? 'Generating Missing Assets...' : 'Generate Missing Assets'}
                </button>
                <p className="mt-2 text-sm text-gray-600">
                  Some assets are ready, generating the rest...
                </p>
              </div>
            )}

            {/* Retry Actions */}
            {video.status === 'assets_failed' && (
              <div className="text-center">
                <button
                  onClick={handleRetryAssets}
                  disabled={isGenerating}
                  aria-busy={isGenerating}
                  className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? 'Retrying Assets...' : 'Retry Assets'}
                </button>
                <p className="text-sm text-gray-600 mt-2">
                  Click to retry asset generation
                </p>
              </div>
            )}



            {/* View Video Button - Only enabled when video is complete and URL exists */}
            {video.status === 'completed' && (
              <div className="text-center">
                <button
                  onClick={() => router.push(`/video/${videoId}`)}
                  disabled={!canView}
                  className={`px-8 py-4 rounded-lg transition-colors ${
                    canView 
                      ? 'bg-green-600 text-white hover:bg-green-700' 
                      : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  }`}
                  title={canView ? 'View your completed video' : 'Video not ready yet'}
                >
                  {canView ? 'View Video' : 'Video Processing...'}
                </button>
                
                {!canView && (
                  <p className="text-sm text-gray-600 mt-2">
                    Video is still being processed. Please wait...
                  </p>
                )}
              </div>
            )}

            {/* Secondary Actions */}
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => router.push(`/storyboard/${videoId}`)}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                ← Back to Scenes
              </button>
              
              {(video.status === 'assets_generated' || video.status === 'render_ready') && (
                <button
                  onClick={() => router.push(`/storyboard/${videoId}`)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Edit Scenes
                </button>
              )}
            </div>
          </div>

          {/* Status Help */}
          {!isReady && !['assets_generating', 'assets_partial'].includes(video.status) && (
            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Assets Not Ready</h3>
              <p className="text-blue-700 text-sm">
                Your video needs all assets to be ready before rendering. 
                {!hasAllImages && ' Missing scene images.'}
                {!hasAudio && ' Missing audio.'}
                {!hasCaptions && ' Missing captions.'}
              </p>
            </div>
          )}

          {/* Partial Assets Help */}
          {video.status === 'assets_partial' && (
            <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="font-semibold text-yellow-900 mb-2">Partial Assets Ready</h3>
              <p className="text-yellow-700 text-sm">
                Some assets are ready, but others are still being generated. 
                Click "Generate Missing Assets" to complete the remaining assets.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}