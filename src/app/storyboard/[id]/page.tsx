'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import React from 'react';
import WizardStepper, { defaultSteps } from '@/components/WizardStepper';

interface Scene {
  description: string;
  image_prompt?: string;
  scene_number?: number;
  duration?: number;
}

interface VideoData {
  id: string;
  status: string;
  storyboard_json?: {
    scenes: Scene[];
  };
  image_urls?: string[];
  dirty_scenes?: number[];
  error_message?: string;
}

interface EditingScene {
  index: number;
  text: string;
  image_prompt: string;
}

interface FailedScene {
  index: number;
  originalPrompt: string;
  softenedPrompt?: string;
  error: string;
  suggestion: string;
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

// Image readiness helper
function isReady(url?: string | null) {
  // treat any non-empty http(s) URL as ready
  return !!url && /^https?:\/\//i.test(url);
}

export default function StoryboardPage() {
  const router = useRouter();
  const params = useParams();
  const videoId = params.id as string;

  const [video, setVideo] = useState<VideoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Scene management state
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [editingScene, setEditingScene] = useState<EditingScene | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [regeneratingScenes, setRegeneratingScenes] = useState<Set<number>>(new Set());

  // Image state
  const [images, setImages] = useState<(string | null)[]>([]);
  const [imageProgress, setImageProgress] = useState<{ [key: number]: 'loading' | 'ready' | 'failed' }>({});
  const [dirtyScenes, setDirtyScenes] = useState<number[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  
  // Guard against double-starting preview generation in dev/StrictMode
  const startedRef = useRef(false);
  
  // Content policy violation handling
  const [failedScenes, setFailedScenes] = useState<FailedScene[]>([]);
  const [editingFailedPrompt, setEditingFailedPrompt] = useState<{ index: number; prompt: string } | null>(null);

  // Image readiness progress calculation
  const totalScenes = scenes?.length ?? 0;
  
  // Prefer local `images` state if you have it; otherwise derive from video.image_urls
  const imageList: (string | null | undefined)[] =
    (images && images.length ? images : video?.image_urls) ?? [];
  
  const readyCount = imageList.filter(isReady).length;
  const allImagesReady = totalScenes > 0 && readyCount === totalScenes;
  const percent = totalScenes > 0 ? Math.round((readyCount / totalScenes) * 100) : 0;

  // Enhanced image readiness check with additional validation
  const canProceedToAssets = allImagesReady && 
    video?.status !== 'assets_failed' && 
    !generating &&
    totalScenes > 0;

  // Update image progress state
  useEffect(() => {
    if (scenes.length > 0) {
      const progress: { [key: number]: 'loading' | 'ready' | 'failed' } = {};
      scenes.forEach((_, index) => {
        if (images[index] && isReady(images[index])) {
          progress[index] = 'ready';
        } else if (video?.status === 'assets_failed' && !images[index]) {
          progress[index] = 'failed';
        } else {
          progress[index] = 'loading';
        }
      });
      setImageProgress(progress);
    }
  }, [images, scenes, video?.status]);
  
  // Update dirty scenes state
  useEffect(() => {
    if (video?.dirty_scenes) {
      setDirtyScenes(video.dirty_scenes);
    }
  }, [video?.dirty_scenes]);
  
  // Update overall progress
  useEffect(() => {
    if (scenes.length > 0) {
      const readyCount = images.filter(Boolean).length;
      const total = scenes.length;
      setOverallProgress(total > 0 ? Math.round((readyCount / total) * 100) : 0);
    }
  }, [images, scenes]);

  useEffect(() => {
    if (videoId) {
      let cancelled = false;
      
      async function ensureImages() {
        // Quick probe for current state
        try {
          const response = await fetch(`/api/video-status?id=${videoId}`, { cache: 'no-store' });
          if (cancelled) return;
          
          const result = await safeJson(response);
          if (!result?.data) return;
          
          const data = result.data;
          const status = data?.status;
          const scenes = data?.storyboard_json?.scenes ?? [];
          const urls = data?.image_urls ?? [];
          
          setImages(urls);
          
          // Only call preview in these states:
          const canPreview = status === 'storyboard_generated' || status === 'script_approved';
          if (!canPreview) return; // if it's assets_generating, just poll; server will 409 otherwise
          
          // Only call preview if there are missing images and we haven't started yet
          const missing = scenes.filter((_: any, i: number) => !urls?.[i]).length;
          
          if (missing > 0 && !startedRef.current) {
            startedRef.current = true;
            const r = await fetch('/api/generate-preview-images', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ id: videoId }),
            });

            // Ignore 409 (someone else generating). Just continue polling.
            if (!r.ok && r.status !== 409) {
              console.warn('generate-preview-images failed', r.status);
            }
          }
        } catch (err) {
          console.error('Failed to start image generation:', err);
        }
      }
      
      ensureImages();
      
      // Poll for updates every 1.5 seconds
      const interval = setInterval(async () => {
        if (cancelled) return;
        
        try {
          const response = await fetch(`/api/video-status?id=${videoId}`, { cache: 'no-store' });
          if (cancelled) return;
          
          const result = await safeJson(response);
          if (!result?.data) return;
          
          setImages(result.data?.image_urls ?? []);
        } catch (err) {
          console.error('Failed to poll for updates:', err);
        }
      }, 1500);
      
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }
  }, [videoId]);

  // Separate effect for initial video fetch
  useEffect(() => {
    if (videoId) {
      fetchVideo();
    }
  }, [videoId]);

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
      
      if (videoData.storyboard_json?.scenes) {
        setScenes(videoData.storyboard_json.scenes);
      }
      
      // Sync images state with video data
      if (videoData.image_urls) {
        setImages(videoData.image_urls);
      }
      
    } catch (err: any) {
      console.error('Failed to fetch video:', err);
      setError(err.message || 'Failed to load video');
    } finally {
      setLoading(false);
    }
  };

  const handleReorderScenes = async (newOrder: number[]) => {
    try {
      const response = await fetch('/api/storyboard/reorder', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: videoId,
          order: newOrder
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reorder scenes');
      }

      await fetchVideo(); // Refresh data
      setSuccess('Scenes reordered successfully!');
      
    } catch (err: any) {
      console.error('Failed to reorder scenes:', err);
      setError(err.message || 'Failed to reorder scenes');
    }
  };

  const handleEditScene = async (index: number, text?: string, imagePrompt?: string) => {
    if (!text && !imagePrompt) return;

    try {
      const updateData: any = { id: videoId, index };
      if (text !== undefined) updateData.text = text;
      if (imagePrompt !== undefined) updateData.image_prompt = imagePrompt;

      const response = await fetch('/api/storyboard/scene', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update scene');
      }

      await fetchVideo(); // Refresh data
      setSuccess('Scene updated successfully!');
      setEditingScene(null);
      
    } catch (err: any) {
      console.error('Failed to update scene:', err);
      setError(err.message || 'Failed to update scene');
    }
  };

  const handleDeleteScene = async (index: number) => {
    if (!confirm('Are you sure you want to delete this scene?')) return;

    try {
      const response = await fetch('/api/storyboard/delete', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: videoId,
          index
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete scene');
      }

      await fetchVideo(); // Refresh data
      setSuccess('Scene deleted successfully!');
      
    } catch (err: any) {
      console.error('Failed to delete scene:', err);
      setError(err.message || 'Failed to delete scene');
    }
  };

  const handleRegenerateImage = async (index: number, newPrompt?: string) => {
    setRegeneratingScenes(prev => new Set(prev).add(index));
    setError('');
    setSuccess('');
    
    // Remove from failed scenes if it was there
    setFailedScenes(prev => prev.filter(fs => fs.index !== index));
    
    try {
      const response = await fetch('/api/scene-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: videoId,
          index,
          newPrompt
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle content policy violations specifically
        if (data.code === 'content_policy_violation') {
          const failedScene: FailedScene = {
            index,
            originalPrompt: data.details.originalPrompt,
            softenedPrompt: data.details.softenedPrompt,
            error: data.message,
            suggestion: data.details.suggestion
          };
          
          setFailedScenes(prev => [...prev.filter(fs => fs.index !== index), failedScene]);
          setError(`Scene ${index + 1}: ${data.message}`);
          return;
        }
        
        throw new Error(data.error || 'Failed to regenerate image');
      }

      if (data.success) {
        // Update local images state immediately
        setImages(prev => {
          const newImages: (string | null)[] = [...prev];
          while (newImages.length <= index) {
            newImages.push(null);
          }
          newImages[index] = data.url || null;
          return newImages;
        });

        // Show success message with orientation info if applicable
        let successMsg = `Scene ${index + 1} image regenerated successfully!`;
        if (data.orientationFixed) {
          successMsg += ' (orientation was corrected)';
        }
        if (data.wasSoftened) {
          successMsg += ' (used softened prompt)';
        }
        
        setSuccess(successMsg);
        
        // Refresh video data to get updated state
        await fetchVideo();
      }
      
    } catch (err: any) {
      console.error('Failed to regenerate image:', err);
      setError(err.message || 'Failed to regenerate image');
    } finally {
      setRegeneratingScenes(prev => {
        const newSet = new Set(prev);
        newSet.delete(index);
        return newSet;
      });
    }
  };

  const handleEditFailedPrompt = (index: number) => {
    const failedScene = failedScenes.find(fs => fs.index === index);
    if (failedScene) {
      setEditingFailedPrompt({
        index,
        prompt: failedScene.softenedPrompt || failedScene.originalPrompt
      });
    }
  };

  const handleSaveFailedPrompt = async () => {
    if (!editingFailedPrompt) return;
    
    const { index, prompt } = editingFailedPrompt;
    
    // Update the scene's image prompt in the storyboard
    const updatedScenes = [...scenes];
    if (updatedScenes[index]) {
      updatedScenes[index] = {
        ...updatedScenes[index],
        image_prompt: prompt || undefined
      };
      setScenes(updatedScenes);
    }
    
    // Clear editing state
    setEditingFailedPrompt(null);
    
    // Try to regenerate with the new prompt
    if (prompt) {
      await handleRegenerateImage(index, prompt);
    }
  };

  const handleCancelFailedPrompt = () => {
    setEditingFailedPrompt(null);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const newOrder = [...Array(scenes.length).keys()];
    const draggedItem = newOrder.splice(draggedIndex, 1)[0];
    newOrder.splice(dropIndex, 0, draggedItem);

    handleReorderScenes(newOrder);
    setDraggedIndex(null);
  };

  const handleContinue = async () => {
    setGenerating(true);
    setError('');
    
    try {
      const response = await fetch('/api/generate-assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoId }),
      });

      const data = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        // Idempotent success: already generated
        if (data?.status === 'assets_generated' || data?.status === 'render_ready' || 
            /already generated|assets_generated/i.test(data?.error || '') || 
            /already generated|assets_generated/i.test(data?.note || '')) {
          console.log('[storyboard] Assets already generated, proceeding to finalize');
          router.push(`/finalize/${videoId}`);
          return;
        } else {
          throw new Error(data?.error || 'Failed to generate assets');
        }
      }

      // Check if assets are already ready from the response
      if (data?.nextStatus === 'render_ready' || data?.nextStatus === 'assets_generated') {
        console.log('[storyboard] Assets ready from response, proceeding to finalize');
        router.push(`/finalize/${videoId}`);
        return;
      }

      // Poll for completion until ready
      await pollUntilReady(videoId, ['assets_generated', 'render_ready'], 120000);
      router.push(`/finalize/${videoId}`);
      
    } catch (err: any) {
      console.error('Failed to generate assets:', err);
      setError(err.message || 'Failed to generate assets');
    } finally {
      setGenerating(false);
    }
  };

  // Poll until video reaches target status
  const pollUntilReady = async (videoId: string, targetStatuses: string[], timeoutMs: number = 120000): Promise<void> => {
    const startTime = Date.now();
    const pollInterval = 3000; // 3 seconds
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const statusResponse = await fetch(`/api/video-status?id=${videoId}`);
        if (statusResponse.ok) {
          const statusResult = await statusResponse.json();
          const status = statusResult.data?.status;
          
          if (targetStatuses.includes(status)) {
            console.log(`[storyboard] Target status reached: ${status}`);
            return;
          } else if (status === 'assets_failed') {
            throw new Error(statusResult.data?.error_message || 'Asset generation failed');
          }
        }
      } catch (error) {
        console.warn('[storyboard] Status check failed, retrying...', error);
      }
      
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    throw new Error('Asset generation timed out');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading storyboard...</p>
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

  // Use the state variable instead of redeclaring

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Stepper */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <WizardStepper steps={defaultSteps} currentStep={2} videoStatus={video.status} />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Manage Your Scenes</h1>
            <p className="text-gray-600">
              Reorder, edit, or regenerate scene images. Drag to reorder scenes.
            </p>
            <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
              <span>Total scenes: <strong>{scenes.length}</strong></span>
              {dirtyScenes.length > 0 && (
                <span className="text-orange-600">
                  Scenes needing regeneration: <strong>{dirtyScenes.length}</strong>
                </span>
              )}
            </div>
            
            {/* Image Progress Status */}
            <div className="mt-2 text-sm text-gray-600">
              {readyCount}/{totalScenes} images ready • {percent}%
            </div>
          </div>

          {/* Regeneration Notice */}
          {dirtyScenes.length > 0 && video?.status === 'script_approved' && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    Script Updated - Assets Need Regeneration
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>
                      You've made changes to your script. All {dirtyScenes.length} scenes need to be regenerated to match the new content. 
                      Click "Continue to Assets" to regenerate images, audio, and captions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Content Policy Violation Alert */}
          {video?.status === 'assets_failed' && video?.error_message?.includes('content_policy') && (
            <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-orange-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-orange-800">
                    Some images were blocked by the provider's policy
                  </h3>
                  <div className="mt-2 text-sm text-orange-700">
                    <p>Please rewrite the prompts to be family-friendly (no nudity/violence/minors/etc.) and click Regenerate.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Success Display */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700">{success}</p>
            </div>
          )}

          {/* Image Progress Banner */}
          {!allImagesReady && (
            <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-800">
              <div className="flex items-center justify-between text-sm font-medium mb-3">
                <span>Generating preview images…</span>
                <span>{readyCount}/{totalScenes} ready • {percent}%</span>
              </div>
              
              {/* Overall Progress Bar */}
              <div className="mb-3 h-3 w-full overflow-hidden rounded bg-amber-200">
                <div
                  className="h-3 bg-violet-600 transition-[width] duration-500 ease-out"
                  style={{ width: `${percent}%` }}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                  role="progressbar"
                />
              </div>
              
              {/* Enhanced Progress Display */}
              <div className="text-center mb-3">
                <div className="text-xl font-bold text-amber-800 mb-1">
                  {percent}%
                </div>
                <div className="text-xs text-amber-700">
                  {readyCount} of {totalScenes} images ready
                </div>
              </div>
              
              {/* Individual Image Status */}
              <div className="grid grid-cols-5 gap-2 mb-3">
                {scenes.map((_, index) => {
                  const status = imageProgress[index] || 'loading';
                  const isGenerating = status === 'loading' && regeneratingScenes.has(index);
                  return (
                    <div key={index} className="text-center">
                      <div className={`
                        w-8 h-8 mx-auto rounded-full flex items-center justify-center text-xs font-medium
                        ${status === 'ready' ? 'bg-green-500 text-white' : ''}
                        ${status === 'loading' ? 'bg-amber-400 text-white animate-pulse' : ''}
                        ${status === 'failed' ? 'bg-red-500 text-white' : ''}
                        ${isGenerating ? 'ring-2 ring-purple-400 ring-opacity-75' : ''}
                      `}>
                        {status === 'ready' ? '✓' : status === 'failed' ? '✗' : index + 1}
                      </div>
                      <div className="text-xs mt-1">Scene {index + 1}</div>
                      {isGenerating && (
                        <div className="text-xs text-purple-600 mt-1">Regenerating</div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              <div className="text-xs opacity-80">
                {readyCount === 0 ? 'Starting image generation...' : 
                 readyCount < totalScenes ? 'Images are being generated in parallel. Please wait...' :
                 'All images ready!'}
              </div>
              
              {/* Show error message if provider switched to fallback */}
              {video?.error_message && (
                <div className="mt-2 text-xs text-amber-600">
                  {video.error_message}
                </div>
              )}
            </div>
          )}

          {/* Scenes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {scenes.map((scene, index) => {
              const isDirty = dirtyScenes.includes(index);
              const hasImage = images[index] && images[index] !== null;
              const isRegenerating = regeneratingScenes.has(index);
              const isFailed = video?.status === 'assets_failed' && !hasImage && !isDirty;
              
              return (
                <div
                  key={index}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`
                    bg-white border-2 rounded-lg p-4 cursor-move transition-all
                    ${isDirty ? 'border-orange-300 bg-orange-50' : ''}
                    ${isFailed ? 'border-red-300 bg-red-50' : ''}
                    ${!isDirty && !isFailed ? 'border-gray-200' : ''}
                    hover:border-purple-300 hover:shadow-lg
                    ${draggedIndex === index ? 'opacity-50' : ''}
                  `}
                >
                  {/* Scene Number */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-700">Scene {index + 1}</span>
                    <div className="flex gap-1">
                      {isDirty && (
                        <span className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded">
                          Needs Regen
                        </span>
                      )}
                      {isFailed && (
                        <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded">
                          Blocked
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Image Preview */}
                  <div className="mb-3">
                    {hasImage ? (
                      <img
                        src={images[index] || ''}
                        alt={`Scene ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                        loading="lazy"
                      />
                    ) : isFailed ? (
                      <div className="w-full h-32 bg-red-100 rounded-lg flex items-center justify-center">
                        <div className="text-center">
                          <svg className="mx-auto h-8 w-8 text-red-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          <span className="text-red-600 text-xs">Content Blocked</span>
                          <p className="text-red-500 text-xs mt-1">Edit prompt & retry</p>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center relative overflow-hidden">
                        {/* Loading Animation */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                        
                        {/* Placeholder Content */}
                        <div className="text-center relative z-10">
                          <div className="w-12 h-12 mx-auto mb-2 bg-gray-300 rounded-full animate-pulse"></div>
                          <span className="text-gray-400 text-xs">Generating...</span>
                          
                          {/* Individual Progress Indicator */}
                          {imageProgress[index] === 'loading' && (
                            <div className="mt-2">
                              <div className="w-16 h-1 bg-gray-300 rounded-full mx-auto">
                                <div className="w-1/2 h-1 bg-purple-400 rounded-full animate-pulse"></div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Scene Text */}
                  <p className="text-sm text-gray-700 mb-3 line-clamp-3">
                    {scene.description}
                  </p>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setEditingScene({
                        index,
                        text: scene.description,
                        image_prompt: scene.image_prompt || scene.description
                      })}
                      className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      Edit
                    </button>
                    
                    <button
                      onClick={() => handleRegenerateImage(index)}
                      disabled={isRegenerating}
                      className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 disabled:opacity-50"
                    >
                      {isRegenerating ? 'Generating...' : 'Regen Image'}
                    </button>
                    
                    {scenes.length > 1 && (
                      <button
                        onClick={() => handleDeleteScene(index)}
                        className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Failed Scenes Section */}
          {failedScenes.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-red-700 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                Content Policy Violations ({failedScenes.length})
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {failedScenes.map((failedScene) => (
                  <div key={failedScene.index} className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-red-700">Scene {failedScene.index + 1}</span>
                      <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded">Blocked</span>
                    </div>
                    
                    <div className="mb-3">
                      <div className="w-full h-32 bg-red-100 rounded-lg flex items-center justify-center">
                        <div className="text-center">
                          <svg className="mx-auto h-8 w-8 text-red-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          <span className="text-red-600 text-xs">Content Blocked</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <p className="text-xs text-gray-600 mb-2">Original Prompt:</p>
                      <p className="text-sm text-gray-700 bg-gray-100 p-2 rounded text-xs">{failedScene.originalPrompt}</p>
                    </div>
                    
                    {failedScene.softenedPrompt && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-600 mb-2">Softened Prompt:</p>
                        <p className="text-sm text-gray-700 bg-gray-100 p-2 rounded text-xs">{failedScene.softenedPrompt}</p>
                      </div>
                    )}
                    
                    <div className="mb-3">
                      <p className="text-xs text-red-600 mb-2">Error:</p>
                      <p className="text-sm text-red-700 bg-red-100 p-2 rounded text-xs">{failedScene.error}</p>
                    </div>
                    
                    {failedScene.suggestion && (
                      <div className="mb-3">
                        <p className="text-xs text-blue-600 mb-2">Suggestion:</p>
                        <p className="text-sm text-blue-700 bg-blue-100 p-2 rounded text-xs">{failedScene.suggestion}</p>
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditFailedPrompt(failedScene.index)}
                        className="flex-1 px-3 py-2 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        Edit Prompt
                      </button>
                      
                      <button
                        onClick={() => handleRegenerateImage(failedScene.index, failedScene.softenedPrompt)}
                        className="flex-1 px-3 py-2 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                      >
                        Try Softened
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scene Rendering Section - REMOVED DUPLICATE */}
          {/* This section was removed to eliminate duplication with the main scenes grid above */}

          {/* Action Button */}
          <div className="text-center">
            <button
              onClick={handleContinue}
              disabled={!allImagesReady}
              aria-busy={generating}
              className={`px-8 py-4 rounded-lg font-medium transition-colors ${
                allImagesReady
                  ? 'bg-violet-600 text-white hover:bg-violet-700'
                  : 'bg-gray-300 text-gray-600 cursor-not-allowed'
              }`}
              title={
                allImagesReady
                  ? 'Continue to Assets'
                  : `Please wait until all ${totalScenes} images are ready before continuing`
              }
            >
              {generating ? 'Generating Assets...' : 'Continue to Assets'}
            </button>
            
            {generating && (
              <p className="text-sm text-gray-600 mt-2">
                This may take a few minutes. Please wait...
              </p>
            )}
            
            {!allImagesReady && !generating && (
              <p className="text-sm text-amber-600 mt-2">
                Please wait until all {totalScenes} images are ready before continuing.
              </p>
            )}
          </div>

          {/* Back Link */}
          <div className="mt-8 text-center">
            <button
              onClick={() => {
                if (video.status === 'storyboard_generated') {
                  if (confirm('Going back to script editing will allow you to make changes. Any script changes will require regenerating the storyboard and all assets (images, audio, captions). This process will take a few minutes. Continue?')) {
                    router.push(`/script/${videoId}`);
                  }
                } else {
                  router.push(`/script/${videoId}`);
                }
              }}
              className="text-gray-600 hover:text-gray-900 text-sm hover:underline"
            >
              ← Back to Script
            </button>
          </div>
        </div>
      </main>

      {/* Edit Scene Modal */}
      {editingScene && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Edit Scene {editingScene.index + 1}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Scene Description
                </label>
                <textarea
                  value={editingScene.text}
                  onChange={(e) => setEditingScene(prev => prev ? { ...prev, text: e.target.value } : null)}
                  className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Image Prompt
                </label>
                <textarea
                  value={editingScene.image_prompt}
                  onChange={(e) => setEditingScene(prev => prev ? { ...prev, image_prompt: e.target.value } : null)}
                  className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingScene(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => editingScene && handleEditScene(
                  editingScene.index,
                  editingScene.text,
                  editingScene.image_prompt
                )}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Failed Prompt Modal */}
      {editingFailedPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4 text-red-700">
              Edit Scene {editingFailedPrompt.index + 1} Prompt
            </h3>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                This scene was blocked due to content policy violations. Edit the prompt to make it more appropriate and try again.
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Image Prompt
                </label>
                <textarea
                  value={editingFailedPrompt.prompt}
                  onChange={(e) => setEditingFailedPrompt(prev => prev ? { ...prev, prompt: e.target.value } : null)}
                  className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Describe the scene in a way that follows content policies..."
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCancelFailedPrompt}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFailedPrompt}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Save & Retry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}