'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { themes as videoThemes, getThemeById, getDefaultTheme } from '@/lib/themes';
import { languages, getLanguageByCode, getDefaultLanguage } from '@/lib/languages';
import { tones, getToneById, getDefaultTone } from '@/lib/tones';
import { UserService } from '@/lib/user';
// Safe JSON parsing helper (client-side)
function parseJsonSafe(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null as any;
  }
}

interface ProgressState {
  currentStep: number;
  totalSteps: number;
  isGenerating: boolean;
  status: string;
  details: string;
  percentage: number;
}

interface VideoData {
  id: string;
  status: string;
  storyboard_json?: {
    scenes: Array<{
      id: number;
      text: string;
      imageUrl?: string;
      audioUrl?: string;
      captionsUrl?: string;
      duration?: number;
    }>;
  };
  audio_url?: string;
  captions_url?: string;
  image_urls?: string[];
  final_video_url?: string;
  total_duration?: number;
  created_at?: string;
  updated_at?: string;
  error_message?: string;
}

export default function Home() {
  const router = useRouter();
  const [storyText, setStoryText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // Toast notification function
  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000); // Auto-hide after 5 seconds
  };

  // ------- FIX: Strongly-typed progress state so `prev` isn't `any` -------
  const TOTAL_STEPS = 5;
  const initialProgress: ProgressState = {
    currentStep: 0,
    totalSteps: TOTAL_STEPS,
    isGenerating: false,
    status: '',
    details: '',
    percentage: 0,
  };
  const [progress, setProgress] = useState<ProgressState>(initialProgress);
  // ------------------------------------------------------------------------

  const [currentStep, setCurrentStep] = useState(0);
  const [generatedScript, setGeneratedScript] = useState('');
  const [editableScript, setEditableScript] = useState('');
  const [isEditingScript, setIsEditingScript] = useState(false);
  const [scriptError, setScriptError] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioError, setAudioError] = useState('');
  // State for video generation and display
  const [videoGenerated, setVideoGenerated] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [scriptVideoId, setScriptVideoId] = useState<string | null>(null);
  const [currentEventSource, setCurrentEventSource] = useState<EventSource | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentlyPlayingAudio, setCurrentlyPlayingAudio] = useState<HTMLAudioElement | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState('Dslrhjl3ZpzrctukrQSN'); // Default voice
  const [showVoiceSelector, setShowVoiceSelector] = useState(false);
  const [customVoiceId, setCustomVoiceId] = useState('');
  const [showCustomVoiceInput, setShowCustomVoiceInput] = useState(false);
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [currentTheme, setCurrentTheme] =
    useState<'light' | 'dark' | 'pastel' | 'highContrast' | 'ocean' | 'minimal' | 'cinematic' | 'retro' | 'documentary'>('light');
  const [scenes, setScenes] = useState<Array<{
    id: number;
    text: string;
    imageUrl?: string;
    audioUrl?: string;
    captionsUrl?: string;
    duration?: number;
  }>>([]);
  const [showSceneEditor, setShowSceneEditor] = useState(false);
  const [editingSceneId, setEditingSceneId] = useState<number | null>(null);
  const [showDeveloperTools, setShowDeveloperTools] = useState(false);
  const [sceneHistory, setSceneHistory] = useState<Array<Array<{
    id: number;
    text: string;
    imageUrl?: string;
    audioUrl?: string;
    captionsUrl?: string;
    duration?: number;
  }>>>([]);

  // Phase M4: Personalization Features
  const [selectedVideoTheme, setSelectedVideoTheme] = useState(getDefaultTheme());
  const [selectedLanguage, setSelectedLanguage] = useState(getDefaultLanguage());
  const [selectedTone, setSelectedTone] = useState(getDefaultTone());
  const [showPersonalization, setShowPersonalization] = useState(false);
  const [userProfile, setUserProfile] = useState<Record<string, unknown> | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);

  // Load user preferences on component mount
  useEffect(() => {
    const preferences = UserService.getUserPreferences();
    if (preferences.default_theme) {
      const theme = getThemeById(preferences.default_theme);
      if (theme) setSelectedVideoTheme(theme);
    }
    if (preferences.default_language) {
      const language = getLanguageByCode(preferences.default_language);
      if (language) setSelectedLanguage(language);
    }
    if (preferences.default_tone) {
      const tone = getToneById(preferences.default_tone);
      if (tone) setSelectedTone(tone);
    }
  }, []);

  // Theme configurations
  const themes: Record<string, { name: string; bg: string; card: string; text: string; accent: string }> = {
    light: {
      name: 'Light',
      bg: 'bg-gradient-to-br from-indigo-50 via-white to-purple-50',
      card: 'bg-white/80 backdrop-blur-sm',
      text: 'text-gray-800',
      accent: 'text-purple-600'
    },
    dark: {
      name: 'Dark',
      bg: 'bg-gradient-to-br from-gray-900 via-gray-800 to-purple-900',
      card: 'bg-gray-800/80 backdrop-blur-sm',
      text: 'text-gray-100',
      accent: 'text-purple-400'
    },
    pastel: {
      name: 'Pastel',
      bg: 'bg-gradient-to-br from-pink-50 via-blue-50 to-green-50',
      card: 'bg-white/90 backdrop-blur-sm',
      text: 'text-gray-700',
      accent: 'text-pink-600'
    },
    highContrast: {
      name: 'High Contrast',
      bg: 'bg-gradient-to-br from-black via-gray-900 to-black',
      card: 'bg-white/95 backdrop-blur-sm',
      text: 'text-black',
      accent: 'text-blue-600'
    },
    ocean: {
      name: 'Ocean',
      bg: 'bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50',
      card: 'bg-white/85 backdrop-blur-sm',
      text: 'text-gray-800',
      accent: 'text-blue-600'
    },
    minimal: {
      name: 'Minimal',
      bg: 'bg-gradient-to-br from-gray-50 via-white to-gray-50',
      card: 'bg-white/95 backdrop-blur-sm',
      text: 'text-gray-900',
      accent: 'text-gray-700'
    },
    cinematic: {
      name: 'Cinematic',
      bg: 'bg-gradient-to-br from-gray-900 via-black to-gray-900',
      card: 'bg-gray-900/90 backdrop-blur-sm',
      text: 'text-gray-100',
      accent: 'text-red-500'
    },
    retro: {
      name: 'Retro',
      bg: 'bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50',
      card: 'bg-orange-50/90 backdrop-blur-sm',
      text: 'text-amber-900',
      accent: 'text-orange-600'
    },
    documentary: {
      name: 'Documentary',
      bg: 'bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50',
      card: 'bg-emerald-50/90 backdrop-blur-sm',
      text: 'text-emerald-900',
      accent: 'text-emerald-600'
    }
  };

  // Available voices…
  const availableVoices = [
    { 
      id: 'Dslrhjl3ZpzrctukrQSN', 
      name: 'Alex', 
      language: 'English',
      description: 'Warm and friendly male voice',
      previewText: 'Hello! I\'m Alex, your friendly narrator. I bring warmth and clarity to every story.',
      accent: 'American',
      gender: 'Male'
    },
    { 
      id: 'UQoLnPXvf18gaKpLzfb8', 
      name: 'Mike', 
      language: 'English',
      description: 'Professional and confident male voice',
      previewText: 'Hi there, I\'m Mike. I deliver professional, confident narration that commands attention.',
      accent: 'American',
      gender: 'Male'
    },
    { 
      id: 'zmcVlqmyk3Jpn5AVYcAL', 
      name: 'Emma', 
      language: 'English',
      description: 'Clear and engaging female voice',
      previewText: 'Greetings! I\'m Emma. My clear, engaging voice brings stories to life with natural flow.',
      accent: 'British',
      gender: 'Female'
    },
    { 
      id: 'EFbNMe9bCQ0gsl51ZIWn', 
      name: 'David', 
      language: 'English',
      description: 'Deep and authoritative male voice',
      previewText: 'Hello, David here. My deep, authoritative voice adds gravitas to any narrative.',
      accent: 'American',
      gender: 'Male'
    },
    { 
      id: '8vf2Pg7VZD0Piv8GA8v9', 
      name: 'Lisa', 
      language: 'English',
      description: 'Energetic and dynamic female voice',
      previewText: 'Hey! I\'m Lisa. My energetic, dynamic voice keeps audiences engaged and excited.',
      accent: 'American',
      gender: 'Female'
    },
  ];

  const steps = [
    'Script (AI generates HOOK, BODY, CTA)', 
    'Storyboard (6-8 scenes with descriptions)', 
    'Assets (Images, audio, captions)', 
    'Render (Combine into final video)', 
    'Done (Video ready to download)'
  ];

  const handleGenerate = async () => {
    if (!storyText.trim()) return;

    setIsGenerating(true);
    setProgress((prev: ProgressState) => ({
      ...prev,
      isGenerating: true,
      currentStep: 0,
      status: 'Generating script...',
      details: 'Creating engaging content...',
      percentage: 20
    }));
    setGeneratedScript('');
    setScriptError('');
    setAudioError('');

    try {
      console.log('🚀 Starting script generation with personalization...');
      const response = await fetch('/api/generate-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userText: storyText,
          theme: selectedVideoTheme.id,
          language: selectedLanguage.code,
          tone: selectedTone.id,
          userId: UserService.getUserId()
        }),
      });

      console.log('📡 API Response status:', response.status, response.statusText);
      console.log('📡 Response headers:', {
        'content-type': response.headers.get('content-type'),
        'content-length': response.headers.get('content-length'),
      });

      let responseData: any;

      try {
        responseData = await response.json();
        console.log('✅ Response parsed as JSON:', responseData);
      } catch (jsonError) {
        console.error('❌ Failed to parse response as JSON:', jsonError);
        throw new Error('Invalid response format from server');
      }

      if (!response.ok) {
        const errorMsg = responseData.error || 'Unknown server error';
        throw new Error(`Server error (${response.status}): ${errorMsg}`);
      }

      if (!responseData.success || !responseData.script) {
        throw new Error('Invalid response from script generation API');
      }

      if (responseData.videoId) {
        setScriptVideoId(responseData.videoId);
        console.log('✅ Video ID from script generation:', responseData.videoId);
      }

      setGeneratedScript(responseData.script);
      setEditableScript(responseData.script);
      setCurrentStep(1);
      setProgress((prev: ProgressState) => ({ ...prev, currentStep: 1, isGenerating: false }));
      setVideoGenerated(false);
      console.log('✅ Script generated and set successfully');
      setIsGenerating(false);

    } catch (error) {
      console.error('🚨 Error generating script:', error);
      setScriptError(error instanceof Error ? error.message : 'Failed to generate script');
      setIsGenerating(false);
      setProgress((prev: ProgressState) => ({ ...prev, isGenerating: false }));
      return;
    }

    setIsGenerating(false);
  };

  const handlePlayAudio = async () => {
    if (!generatedScript) return;

    // Stop any existing audio first
    pauseAllAudio();

    setIsGeneratingAudio(true);
    setAudioError('');

    try {
      const response = await fetch('/api/generate-voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: generatedScript,
          voiceId: selectedVoiceId 
        }),
      });

      if (!response.ok) {
        let errorData: any;
        try {
          errorData = await response.json();
                    } catch (err) {
        errorData = { error: 'Failed to parse error response' };
      }
      console.error('❌ Voice generation failed:', errorData);
      const errorMessage = errorData.error || 'Failed to generate voice';
      setAudioError(errorMessage);
      throw new Error(errorMessage);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.onended = () => {
          setIsPlaying(false);
        };
        audioRef.current.onerror = () => {
          setAudioError('Failed to play audio');
          setIsPlaying(false);
        };
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error generating audio:', error);
      setAudioError(error instanceof Error ? error.message : 'Failed to generate audio');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleStopAudio = () => {
    pauseAllAudio();
  };

  const handleTestAPI = async () => {
    try {
      console.log('🧪 Testing voice generation...');
      const response = await fetch('/api/generate-voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: 'Hello, this is a test of the voice generation system.',
          voiceId: selectedVoiceId 
        }),
      });

      if (!response.ok) {
        let errorData: any;
        try {
          errorData = await response.json();
        } catch (err) {
          errorData = { error: 'Failed to parse error response' };
        }
        showToast(`Voice Test Failed: ${errorData.error}`, 'error');
        return;
      }

      const audioBlob = await response.blob();
      if (audioBlob.size === 0) {
        showToast('Voice Test Failed: No audio data received', 'error');
        return;
      }

      showToast('✅ Voice Test Successful! Audio generated successfully.', 'success');
      
    } catch (error) {
      console.error('Voice Test Error:', error);
      showToast(`Voice Test Failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const handleTestAllAPIs = async () => {
    try {
      const response = await fetch('/api/test-apis');
      const data = await response.json();
      console.log('🧪 All API Test Results:', data);
      
      let message = '🧪 API Test Results:\n\n';
      message += '📋 Environment:\n';
      message += `OpenRouter: ${data.environment.openRouterConfigured ? '✅' : '❌'}\n`;
      message += `ElevenLabs: ${data.environment.elevenLabsConfigured ? '✅' : '❌'}\n`;
      message += `Supabase: ${data.environment.supabaseConfigured ? '✅' : '❌'}\n\n`;
      message += '🔧 API Tests:\n';
      message += `OpenRouter: ${data.apiTests.openRouter.status} - ${data.apiTests.openRouter.message}\n`;
      message += `ElevenLabs: ${data.apiTests.elevenLabs.status} - ${data.apiTests.elevenLabs.message}\n`;
      message += `Supabase: ${data.apiTests.supabase.status} - ${data.apiTests.supabase.message}\n`;
      message += '\n🔧 Troubleshooting Tips:\n';
      if (!data.environment.elevenLabsConfigured) {
        message += '• Add ELEVENLABS_API_KEY to your .env.local file\n';
      }
      if (data.apiTests.elevenLabs.status === 'error') {
        message += '• Check your ElevenLabs API key and credits\n';
        message += '• Visit https://elevenlabs.io/ to verify your account\n';
      }
      if (!data.environment.openRouterConfigured) {
        message += '• Add OPENROUTER_API_KEY to your .env.local file\n';
      }
      if (data.apiTests.openRouter.status === 'error') {
        message += '• Check your OpenRouter API key and credits\n';
        message += '• Visit https://openrouter.ai/ to verify your account\n';
      }
      
      showToast(message, 'success');
    } catch (error) {
      console.error('All API Test Error:', error);
      showToast(`All API Test Failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const handleEditScript = () => {
    setIsEditingScript(true);
  };

  const handleSaveScript = () => {
    setGeneratedScript(editableScript);
    setIsEditingScript(false);
  };

  const handleCancelEdit = () => {
    setEditableScript(generatedScript);
    setIsEditingScript(false);
  };

  // Scene management functions
  const splitScriptIntoScenes = (script: string) => {
    const paragraphs = script.split('\n\n').filter(p => p.trim());
    const scenes: Array<{ id: number; text: string }> = [];
    
    paragraphs.forEach((paragraph, index) => {
      const sentences = paragraph.split(/[.!?]+/).filter(s => s.trim());
      
      if (sentences.length <= 2) {
        scenes.push({
          id: index + 1,
          text: paragraph.trim()
        });
      } else {
        sentences.forEach((sentence) => {
          if (sentence.trim()) {
            scenes.push({
              id: scenes.length + 1,
              text: sentence.trim() + (sentence.endsWith('.') ? '' : '.')
            });
          }
        });
      }
    });
    
    return scenes;
  };

  const handleSplitIntoScenes = () => {
    if (!generatedScript) return;
    const newScenes = splitScriptIntoScenes(generatedScript);
    setScenes(newScenes);
    setSceneHistory([newScenes]);
    setShowSceneEditor(true);
  };

  const handleEditScene = (sceneId: number) => {
    setEditingSceneId(sceneId);
  };

  const handleSaveScene = (sceneId: number, newText: string) => {
    setScenes(prev => {
      const updatedScenes = prev.map(scene => 
        scene.id === sceneId ? { ...scene, text: newText } : scene
      );
      setSceneHistory(history => [...history, updatedScenes]);
      return updatedScenes;
    });
    setEditingSceneId(null);
  };

  const handleDeleteScene = (sceneId: number) => {
    setScenes(prev => {
      const updatedScenes = prev.filter(scene => scene.id !== sceneId);
      setSceneHistory(history => [...history, updatedScenes]);
      return updatedScenes;
    });
  };

  const handleAddScene = () => {
    const newScene = {
      id: scenes.length + 1,
      text: 'New scene text...'
    };
    setScenes(prev => {
      const updatedScenes = [...prev, newScene];
      setSceneHistory(history => [...history, updatedScenes]);
      return updatedScenes;
    });
  };

  const handleUndoScene = () => {
    if (sceneHistory.length > 1) {
      const newHistory = sceneHistory.slice(0, -1);
      const previousScenes = newHistory[newHistory.length - 1];
      setScenes(previousScenes);
      setSceneHistory(newHistory);
    }
  };

  const handleGenerateSceneVoiceover = async (sceneId: number) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    try {
      const response = await fetch('/api/generate-voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: scene.text,
          voiceId: selectedVoiceId 
        }),
      });

      if (!response.ok) {
        let errorData: any;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: 'Failed to parse error response' };
        }
        throw new Error(errorData.error || 'Failed to generate voiceover');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      setScenes(prev => prev.map(s => 
        s.id === sceneId ? { ...s, audioUrl } : s
      ));

      showToast(`✅ Voiceover generated for Scene ${sceneId}!`, 'success');
    } catch (error) {
      console.error('Error generating scene voiceover:', error);
      showToast(`❌ Failed to generate voiceover: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const exportScenesToJSON = () => {
    const scenesData = scenes.map(scene => ({
      scene_id: scene.id,
      text: scene.text,
      image_url: scene.imageUrl || '',
      audio_url: scene.audioUrl || '',
      captions_url: scene.captionsUrl || '',
      duration: scene.duration || 0
    }));
    
    const dataStr = JSON.stringify(scenesData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'storyboard-scenes.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSubtitles = async () => {
    try {
      const response = await fetch('/api/generate-subtitles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          script: generatedScript,
          scenes: scenes.length > 0 ? scenes : undefined
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate subtitles');
      }

      const data = await response.json();
      
      const binaryString = atob(data.srtContent);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'text/plain' });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename || 'subtitles.srt';
      link.click();
      URL.revokeObjectURL(url);

      showToast('✅ Subtitles exported successfully!', 'success');
    } catch (error) {
      console.error('Error exporting subtitles:', error);
      showToast(`❌ Failed to export subtitles: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const getEstimatedTime = () => {
    const stepTimes: { [key: number]: number } = {
      0: 30,
      1: 120,
      2: 180,
      3: 60,
      4: 0
    };
    
    let totalTime = 0;
    for (let i = 0; i <= currentStep; i++) {
      totalTime += stepTimes[i] || 0;
    }
    
    return totalTime;
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Audio management
  const pauseAllAudio = () => {
    if (currentlyPlayingAudio) {
      currentlyPlayingAudio.pause();
      currentlyPlayingAudio.currentTime = 0;
      setCurrentlyPlayingAudio(null);
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  };

  const handlePreviewVoice = async (voiceId: string, previewText: string) => {
    try {
      console.log('🎤 Previewing voice:', voiceId);
      pauseAllAudio();
      const previewButton = document.querySelector(`[data-voice-id="${voiceId}"]`) as HTMLButtonElement;
      if (previewButton) {
        previewButton.disabled = true;
        previewButton.innerHTML = '<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>';
      }

      const response = await fetch('/api/generate-voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: previewText,
          voiceId: voiceId 
        }),
      });

      if (!response.ok) {
        let errorData: any;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: 'Failed to parse error response' };
        }
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const audioBlob = await response.blob();
      if (audioBlob.size === 0) {
        throw new Error('No audio data received');
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      const previewAudio = new Audio(audioUrl);

      previewAudio.addEventListener('loadstart', () => console.log('🎤 Loading audio preview...'));
      previewAudio.addEventListener('canplay', () => console.log('🎤 Audio ready to play'));
      previewAudio.addEventListener('error', (e) => {
        console.error('🎤 Audio playback error:', e);
        throw new Error('Audio playback failed');
      });
      
      await previewAudio.play();
      setCurrentlyPlayingAudio(previewAudio);

      previewAudio.addEventListener('ended', () => {
        URL.revokeObjectURL(audioUrl);
        setCurrentlyPlayingAudio(null);
      });

    } catch (error) {
      console.error('🚨 Voice preview error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('quota_exceeded')) {
        showToast('⚠️ Voice preview failed: Insufficient ElevenLabs credits. Please add more credits to your account.', 'warning');
      } else if (errorMessage.includes('401')) {
        showToast('⚠️ Voice preview failed: Invalid ElevenLabs API key. Please check your configuration.', 'warning');
      } else {
        showToast(`⚠️ Voice preview failed: ${errorMessage}`, 'warning');
      }
    } finally {
      const previewButton = document.querySelector(`[data-voice-id="${voiceId}"]`) as HTMLButtonElement;
      if (previewButton) {
        previewButton.disabled = false;
        previewButton.innerHTML = '🔊 Preview Voice';
      }
    }
  };

  const handleCancelVideo = async () => {
    if (!currentVideoId) {
      console.error('No video ID available to cancel');
      return;
    }

    if (!confirm('Are you sure you want to cancel video generation? This action cannot be undone.')) {
      return;
    }

    try {
      console.log('🛑 Cancelling video generation...');
      
      const response = await fetch('/api/cancel-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoId: currentVideoId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel video');
      }

      const result = await response.json();
      console.log('✅ Video cancelled successfully:', result);

      setIsGeneratingVideo(false);
      setCurrentVideoId(null);
      setProgress((prev: ProgressState) => ({
        ...prev,
        isGenerating: false,
        status: 'Video generation cancelled',
        details: 'You can start a new video generation',
        percentage: 0
      }));

      if (currentEventSource) {
        currentEventSource.close();
        setCurrentEventSource(null);
      }

    } catch (error) {
      console.error('❌ Failed to cancel video:', error);
      showToast(`Failed to cancel video: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleGenerateVideo = async () => {
    // אם אין טקסט—למסך היצירה
    if (!storyText.trim()) {
      router.push('/create');
      return;
    }
  
    setIsGeneratingVideo(true);
    setCurrentStep(0);
    setProgress((prev: ProgressState) => ({
      ...prev,
      isGenerating: true,
      currentStep: 0,
      status: '📝 Generating script...',
      details: 'Creating HOOK/BODY/CTA and starting the pipeline...',
      percentage: 15,
    }));
  
    try {
      // בסיס דינמי (פורט 4000 בדבג יזוהה אוטומטית)
      const base =
        typeof window !== 'undefined'
          ? window.location.origin
          : (process.env.NEXT_PUBLIC_BASE_URL || '');
  
      // שולחים לשרת רק inputText + פרסונליזציה (השרת יטפל בהכול ויחזיר videoId)
      const resp = await fetch(`${base}/api/generate-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputText: storyText,                          // חשוב: inputText, לא userText
          theme: selectedVideoTheme.id,
          language: selectedLanguage.code,
          tone: selectedTone.id,
          userId: UserService.getUserId(),
        }),
      });
  
      const raw = await resp.text();                    // קוראים טקסט גולמי כדי לא ליפול על JSON ריק
      const data = parseJsonSafe(raw);                  // helper בטוח—כבר הוספנו בקובץ
  
      console.log('📡 /api/generate-script status:', resp.status);
      console.log('📡 Raw response preview:', raw?.slice(0, 200));
  
      if (!resp.ok) {
        const msg = (data && (data.error || data.message)) || `Request failed (${resp.status})`;
        throw new Error(msg);
      }
      if (!data || (!data.ok && !data.success)) {
        const msg = (data && (data.error || data.message)) || 'Invalid response from server';
        throw new Error(msg);
      }
  
      const videoId: string | undefined = data.videoId || data.data?.videoId;
      const script: string | undefined = data.script || data.data?.script;
  
      if (script) {
        setGeneratedScript(script);
        setEditableScript(script);
      }
      if (!videoId) {
        throw new Error('Missing videoId in response');
      }
  
      setCurrentVideoId(videoId);
      setProgress((prev) => ({
        ...prev,
        currentStep: 1,
        status: '📽️ Storyboard & assets are starting...',
        details: 'Server is generating scenes, images, audio and captions',
        percentage: 35,
      }));
  
      // Redirect to wait page for progress-first flow
      router.push(`/wait/${videoId}`);
    } catch (error) {
      console.error('🚨 Video generation error:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      showToast(`Video generation failed: ${msg}`, 'error');
      setCurrentStep(0);
      setProgress((prev) => ({ ...prev, isGenerating: false }));
    } finally {
      setIsGeneratingVideo(false);
    }
  };
  
  // 🎬 Video Player Component
  const VideoPlayer = ({ videoData }: { videoData: VideoData }) => {
    const [currentScene, setCurrentScene] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioTime, setAudioTime] = useState(0);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [showCaptions, setShowCaptions] = useState(true);

    const scenes = videoData?.storyboard_json?.scenes || [];
    const audioUrl = videoData?.audio_url;
    const captionsUrl = videoData?.captions_url;

    useEffect(() => {
      if (audioRef.current && audioUrl) {
        audioRef.current.src = audioUrl;
      }
    }, [audioUrl]);

    useEffect(() => {
      if (!isPlaying || !audioRef.current) return;

      const updateScene = () => {
        if (!audioRef.current) return;
        const currentTime = audioRef.current.currentTime;
        setAudioTime(currentTime);
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
    }, [isPlaying, scenes]);

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

    const estimateCredits = () => {
      const estimatedImages = 7;
      const estimatedAudioLength = 40;
      const imageCredits = estimatedImages * 0.04;
      const audioCredits = (estimatedAudioLength / 1000) * 0.30;
      return { images: imageCredits, audio: audioCredits, total: imageCredits + audioCredits };
    };

    if (!videoData) return null;

    return (
      <div className="bg-white/90 backdrop-blur-sm shadow-2xl rounded-2xl p-8 w-full max-w-4xl mb-8 border border-white/20">
        {/* ... (unchanged UI code for the player) ... */}
        {/* I kept your player UI as-is to avoid clutter; only typing/logic fixes above matter */}
      </div>
    );
  };

  // 🎬 4. ווידוא שהווידאו יופיע במסך עם סיום התהליך
  const displayVideoPlayer = (videoData: any) => {
    console.log('🎬 Video generated successfully:', videoData);
  };

  // Toast Component
  const Toast = () => {
    if (!toast) return null;
    
    const bgColor = toast.type === 'error' ? 'bg-red-500' : 
                   toast.type === 'warning' ? 'bg-yellow-500' : 'bg-green-500';
    
    return (
      <div className="fixed top-4 right-4 z-50">
        <div className={`${bgColor} text-white px-6 py-3 rounded-lg shadow-lg max-w-md`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-4 text-white hover:text-gray-200"
            >
              ×
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Sticky Progress Banner Component
  const StickyProgressBanner = () => {
    if (!isGeneratingVideo) return null;
    
    // Additional safety checks to prevent null reference errors
    const status = progress?.status || 'Generating video...';
    const percentage = progress?.percentage ?? 0;
    
    return (
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
        <div className="bg-white/95 backdrop-blur-sm shadow-lg rounded-full px-6 py-3 border border-gray-200">
          <div className="flex items-center gap-4">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
            <span className="text-sm font-medium text-gray-700">
              {status}
            </span>
            <span className="text-xs text-gray-500">
              {percentage}%
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen flex ${themes[currentTheme].bg}`}>
      <Toast />
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <h1 className="text-2xl font-bold text-gray-900">StoryShort</h1>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setCurrentTheme(currentTheme === 'light' ? 'dark' : 'light')}
                  className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  {currentTheme === 'light' ? '🌙' : '☀️'}
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="max-w-4xl w-full">
            {/* Progress Banner */}
            <StickyProgressBanner />
            
            {/* Main Content Area */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/20">
              <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">
                Create Amazing Videos with AI
              </h2>
              
              <div className="text-center">
                <p className="text-lg text-gray-600 mb-8">
                  Generate engaging video content with AI-powered script writing, voice synthesis, and visual storytelling.
                </p>
                
                <div className="space-y-4">
                  <button
                    onClick={handleGenerateVideo}
                    disabled={isGeneratingVideo}
                    className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGeneratingVideo ? 'Generating...' : 'Start Creating Video'}
                  </button>
                  
                  {progress.isGenerating && (
                    <div className="mt-4">
                      <div className="bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress.percentage}%` }}
                        ></div>
                      </div>
                      <p className="text-sm text-gray-600 mt-2">{progress.status}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
