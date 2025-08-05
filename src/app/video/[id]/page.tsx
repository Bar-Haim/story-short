'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { VideoService } from '@/lib/supabase';

interface VideoData {
  id: string;
  status: string;
  input_text: string;
  script: string | null;
  storyboard_json: any;
  audio_url: string | null;
  captions_url: string | null;
  image_urls: string[] | null;
  total_duration: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface Scene {
  scene_number: number;
  description: string;
  image_prompt: string;
  text: string;
  duration: number;
}

export default function VideoPage() {
  const params = useParams();
  const videoId = params.id as string;
  
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentScene, setCurrentScene] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioTime, setAudioTime] = useState(0);
  const [showCaptions, setShowCaptions] = useState(true);
  const [editingScene, setEditingScene] = useState<number | null>(null);
  const [editingCaption, setEditingCaption] = useState('');
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
  const [isRenderingVideo, setIsRenderingVideo] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);

  // Load video data
  useEffect(() => {
    const loadVideo = async () => {
      try {
        const result = await VideoService.getVideo(videoId);
        if (result.success && result.video) {
          setVideoData(result.video);
        } else {
          setError(result.error || 'Failed to load video');
        }
      } catch (err) {
        setError('Failed to load video data');
      } finally {
        setLoading(false);
      }
    };

    if (videoId) {
      loadVideo();
    }
  }, [videoId]);

  // Audio synchronization
  useEffect(() => {
    if (audioRef.current && videoData?.audio_url) {
      audioRef.current.src = videoData.audio_url;
    }
  }, [videoData?.audio_url]);

  useEffect(() => {
    if (!isPlaying || !audioRef.current || !videoData?.storyboard_json?.scenes) return;

    const updateScene = () => {
      if (!audioRef.current) return;
      
      const currentTime = audioRef.current.currentTime;
      setAudioTime(currentTime);
      
      const scenes = videoData.storyboard_json.scenes;
      let sceneIndex = 0;
      let accumulatedTime = 0;
      
      for (let i = 0; i < scenes.length; i++) {
        const sceneDuration = scenes[i].duration || 0;
        if (currentTime >= accumulatedTime && currentTime < accumulatedTime + sceneDuration) {
          sceneIndex = i;
          break;
        }
        accumulatedTime += sceneDuration;
      }
      
      setCurrentScene(sceneIndex);
    };

    const interval = setInterval(updateScene, 100);
    return () => clearInterval(interval);
  }, [isPlaying, videoData?.storyboard_json?.scenes]);

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      const time = parseFloat(e.target.value);
      audioRef.current.currentTime = time;
      setAudioTime(time);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEditScene = (sceneIndex: number) => {
    const scenes = videoData?.storyboard_json?.scenes;
    if (scenes && scenes[sceneIndex]) {
      setEditingScene(sceneIndex);
      setEditingCaption(scenes[sceneIndex].text);
    }
  };

  const handleSaveCaption = async () => {
    if (editingScene === null || !videoData) return;

    try {
      const updatedStoryboard = { ...videoData.storyboard_json };
      updatedStoryboard.scenes[editingScene].text = editingCaption;

      const result = await VideoService.updateVideo(videoId, {
        storyboard_json: updatedStoryboard
      });

      if (result.success) {
        setVideoData(prev => prev ? {
          ...prev,
          storyboard_json: updatedStoryboard
        } : null);
        setEditingScene(null);
      }
    } catch (err) {
      console.error('Failed to save caption:', err);
    }
  };

  const handleRegenerateImage = async (sceneIndex: number) => {
    if (!videoData) return;

    setIsRegeneratingImage(true);
    try {
      const scene = videoData.storyboard_json.scenes[sceneIndex];
      
      const response = await fetch('/api/generate-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: videoId,
          script: videoData.script,
          regenerateImage: true,
          sceneIndex: sceneIndex,
          imagePrompt: scene.image_prompt
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Reload video data to get updated image
          const videoResult = await VideoService.getVideo(videoId);
          if (videoResult.success && videoResult.video) {
            setVideoData(videoResult.video);
          }
        }
      }
    } catch (err) {
      console.error('Failed to regenerate image:', err);
    } finally {
      setIsRegeneratingImage(false);
    }
  };

  const handleRenderFinalVideo = async () => {
    if (!videoData) return;

    setIsRenderingVideo(true);
    try {
      const response = await fetch('/api/render-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: videoId }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Reload video data to get final video URL
          const videoResult = await VideoService.getVideo(videoId);
          if (videoResult.success && videoResult.video) {
            setVideoData(videoResult.video);
            alert('🎉 Final video rendered successfully! Check the download button below.');
          }
        } else {
          throw new Error(result.message || 'Failed to render video');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to render video');
      }
    } catch (err) {
      console.error('Failed to render video:', err);
      alert(`Failed to render video: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsRenderingVideo(false);
    }
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const handleRetryGeneration = async () => {
    if (!videoData) return;

    try {
      // Reset video status to pending
      await VideoService.updateVideo(videoId, {
        status: 'pending',
        error_message: null
      });

      // Reload the page to restart the generation process
      window.location.reload();
    } catch (err) {
      console.error('Failed to retry generation:', err);
      alert('Failed to retry generation. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading video...</p>
        </div>
      </div>
    );
  }

  // Handle failed videos
  if (videoData && videoData.status === 'failed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="bg-white/90 backdrop-blur-sm shadow-2xl rounded-2xl p-8 border border-white/20">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⚠️</span>
            </div>
            <h1 className="text-2xl font-bold text-orange-600 mb-2">Video Generation Failed</h1>
            <p className="text-gray-600 mb-4">
              {videoData.error_message || 'The video could not be generated due to an error.'}
            </p>
            
            {/* Show specific error details */}
            {videoData.error_message && (
              <div className="bg-gray-50 p-4 rounded-lg mb-6 text-left">
                <h3 className="font-semibold text-gray-800 mb-2">Error Details:</h3>
                <p className="text-sm text-gray-600">{videoData.error_message}</p>
              </div>
            )}
            
            <div className="space-y-3">
              <a
                href="/"
                className="block w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-300 font-semibold"
              >
                ← Back to Generator
              </a>
              <button
                onClick={handleRetryGeneration}
                className="block w-full px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all duration-300 font-semibold"
              >
                🔄 Retry Generation
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !videoData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="bg-white/90 backdrop-blur-sm shadow-2xl rounded-2xl p-8 border border-white/20">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">❌</span>
            </div>
            <h1 className="text-2xl font-bold text-red-600 mb-2">Video Not Found</h1>
            <p className="text-gray-600 mb-6">
              {error === 'Video not found' 
                ? `The video with ID "${videoId}" could not be found. It may have been deleted or the URL is incorrect.`
                : error || 'An error occurred while loading the video.'
              }
            </p>
            <div className="space-y-3">
              <a
                href="/"
                className="block w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-300 font-semibold"
              >
                ← Back to Generator
              </a>
              <button
                onClick={() => window.location.reload()}
                className="block w-full px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all duration-300 font-semibold"
              >
                🔄 Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const scenes = videoData.storyboard_json?.scenes || [];
  const currentSceneData = scenes[currentScene];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Video Player</h1>
              <p className="text-sm text-gray-600">ID: {videoId}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSidebar}
                className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                title={sidebarCollapsed ? "Show Scene Editor" : "Hide Scene Editor"}
              >
                {sidebarCollapsed ? '📋' : '✖️'}
              </button>
              <a
                href="/"
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                ← Back to Generator
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Video Player */}
          <div className={`${sidebarCollapsed ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
            <div className="bg-white/90 backdrop-blur-sm shadow-2xl rounded-2xl p-8 border border-white/20">
              <h2 className="text-xl font-bold text-gray-800 mb-6">Final Video</h2>
              
              {/* Video Display */}
              <div className="relative bg-black rounded-xl overflow-hidden mb-6 aspect-[9/16] max-h-96">
                {currentSceneData && videoData.image_urls?.[currentScene] && (
                  <img
                    src={videoData.image_urls[currentScene]}
                    alt={`Scene ${currentScene + 1}`}
                    className="w-full h-full object-cover"
                  />
                )}
                
                {/* Captions Overlay */}
                {showCaptions && currentSceneData?.text && (
                  <div className="absolute bottom-4 left-4 right-4 bg-black/70 text-white p-3 rounded-lg text-center">
                    <p className="text-sm font-medium">{currentSceneData.text}</p>
                  </div>
                )}
                
                {/* Play/Pause Overlay */}
                <button
                  onClick={handlePlayPause}
                  className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors"
                >
                  {isPlaying ? (
                    <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center">
                      <span className="text-2xl">⏸️</span>
                    </div>
                  ) : (
                    <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center">
                      <span className="text-2xl">▶️</span>
                    </div>
                  )}
                </button>
              </div>

              {/* Audio Controls */}
              <div className="space-y-4">
                {/* Progress Bar */}
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600 w-12">
                    {formatTime(audioTime)}
                  </span>
                  <input
                    type="range"
                    min="0"
                    max={audioRef.current?.duration || 0}
                    value={audioTime}
                    onChange={handleSeek}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-sm text-gray-600 w-12">
                    {formatTime(audioRef.current?.duration || 0)}
                  </span>
                </div>

                {/* Control Buttons */}
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={handlePlayPause}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {isPlaying ? '⏸️ Pause' : '▶️ Play'}
                  </button>
                  
                  <button
                    onClick={() => setShowCaptions(!showCaptions)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    {showCaptions ? '📝 Hide Captions' : '📝 Show Captions'}
                  </button>

                  {videoData.audio_url && (
                    <button
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = videoData.audio_url!;
                        link.download = 'voiceover.mp3';
                        link.click();
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      💾 Download Audio
                    </button>
                  )}

                  {videoData.final_video_url && (
                    <button
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = videoData.final_video_url!;
                        link.download = 'final_video.mp4';
                        link.click();
                      }}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      🎬 Download Final Video
                    </button>
                  )}

                  {!videoData.final_video_url && (
                    <button
                      onClick={handleRenderFinalVideo}
                      disabled={isRenderingVideo}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:bg-gray-400"
                    >
                      {isRenderingVideo ? '🎬 Rendering...' : '🎬 Render Final Video'}
                    </button>
                  )}
                </div>

                {/* Scene Information */}
                <div className="text-center text-sm text-gray-600">
                  Scene {currentScene + 1} of {scenes.length}
                </div>
              </div>

              {/* Hidden Audio Element */}
              <audio
                ref={audioRef}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
              />
            </div>
          </div>

          {/* Scene Editor Sidebar */}
          {!sidebarCollapsed && (
            <div className="lg:col-span-1">
              <div className="bg-white/90 backdrop-blur-sm shadow-2xl rounded-2xl p-6 border border-white/20">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-800">Scene Editor</h2>
                  <button
                    onClick={toggleSidebar}
                    className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                    title="Hide Scene Editor"
                  >
                    ✖️
                  </button>
                </div>
              
              <div className="space-y-4">
                {scenes.map((scene: Scene, index: number) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      index === currentScene
                        ? 'border-purple-400 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-800">Scene {index + 1}</h3>
                      <span className="text-xs text-gray-500">{scene.duration}s</span>
                    </div>
                    
                    {/* Scene Image */}
                    {videoData.image_urls?.[index] && (
                      <div className="mb-3">
                        <img
                          src={videoData.image_urls[index]}
                          alt={`Scene ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                      </div>
                    )}
                    
                    {/* Caption Editor */}
                    <div className="mb-3">
                      {editingScene === index ? (
                        <div className="space-y-2">
                          <textarea
                            value={editingCaption}
                            onChange={(e) => setEditingCaption(e.target.value)}
                            className="w-full p-2 text-sm border border-gray-300 rounded resize-none"
                            rows={3}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleSaveCaption}
                              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingScene(null)}
                              className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm text-gray-700 mb-2">{scene.text}</p>
                          <button
                            onClick={() => handleEditScene(index)}
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                          >
                            Edit Caption
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* Regenerate Image Button */}
                    <button
                      onClick={() => handleRegenerateImage(index)}
                      disabled={isRegeneratingImage}
                      className="w-full px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700 disabled:bg-gray-400"
                    >
                      {isRegeneratingImage ? '🔄 Regenerating...' : '🔄 Regenerate Image'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
} 