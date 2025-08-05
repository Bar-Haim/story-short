'use client';

import { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface ProgressState {
  currentStep: number;
  totalSteps: number;
  isGenerating: boolean;
  status: string;
  details: string;
  percentage: number;
}

export default function Home() {
  const [storyText, setStoryText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<ProgressState>({
    currentStep: 0,
    totalSteps: 5,
    isGenerating: false,
    status: '',
    details: '',
    percentage: 0
  });
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
  const [videoData, setVideoData] = useState<any>(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [currentEventSource, setCurrentEventSource] = useState<EventSource | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentlyPlayingAudio, setCurrentlyPlayingAudio] = useState<HTMLAudioElement | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState('Dslrhjl3ZpzrctukrQSN'); // Default voice
  const [showVoiceSelector, setShowVoiceSelector] = useState(false);
  const [customVoiceId, setCustomVoiceId] = useState('');
  const [showCustomVoiceInput, setShowCustomVoiceInput] = useState(false);
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark' | 'pastel' | 'highContrast' | 'ocean'>('light');
  const audioRef = useRef<HTMLAudioElement>(null);

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
    }
  };

  // Available voices with preview samples - corrected names and improved descriptions
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
          setProgress(prev => ({
        ...prev,
        isGenerating: true,
        currentStep: 0
      }));
    setGeneratedScript('');
    setScriptError('');
    setAudioError('');

    try {
      console.log('🚀 Starting script generation...');
      const response = await fetch('/api/generate-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userText: storyText }),
      });

      console.log('📡 API Response status:', response.status, response.statusText);
      console.log('📡 Response headers:', {
        'content-type': response.headers.get('content-type'),
        'content-length': response.headers.get('content-length'),
      });

      let responseData;
      let errorMessage = '';

      try {
        responseData = await response.json();
        console.log('✅ Response parsed as JSON:', responseData);
      } catch (jsonError) {
        console.error('❌ Failed to parse response as JSON:', jsonError);
        console.error('❌ Response status:', response.status);
        console.error('❌ Response statusText:', response.statusText);
        console.error('❌ Response headers:', Object.fromEntries(response.headers.entries()));
        errorMessage = 'Invalid response format from server';
        throw new Error(errorMessage);
      }

      if (!response.ok) {
        const errorMsg = responseData.error || 'Unknown server error';
        console.error('❌ API Error:', responseData);
        console.error('❌ Full response data:', JSON.stringify(responseData, null, 2));
        console.error('❌ Response status:', response.status);
        console.error('❌ Response headers:', Object.fromEntries(response.headers.entries()));
        throw new Error(`Server error (${response.status}): ${errorMsg}`);
      }

      if (!responseData.success || !responseData.script) {
        console.error('❌ Invalid response structure:', responseData);
        throw new Error('Invalid response from script generation API');
      }

            setGeneratedScript(responseData.script);
      setEditableScript(responseData.script);
      setCurrentStep(1);
      setProgress(prev => ({ ...prev, currentStep: 1 }));
      setVideoGenerated(false);
      console.log('✅ Script generated and set successfully');
      setIsGenerating(false); // Reset generating state

    } catch (error) {
      console.error('🚨 Error generating script:', error);
      setScriptError(error instanceof Error ? error.message : 'Failed to generate script');
      setIsGenerating(false);
      return;
    }

    setIsGenerating(false);
  };

  const handlePlayAudio = async () => {
    if (!generatedScript) return;

    setIsGeneratingAudio(true);
    setAudioError('');
    setIsPlaying(false);

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
        let errorData;
        try {
          errorData = await response.json();
        } catch (err) {
          errorData = { error: 'Failed to parse error response' };
        }
        console.error('❌ Voice generation failed:', errorData);
        
        // Show specific error message from the API
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
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  };

  const handleTestAPI = async () => {
    try {
      // Test voice generation with a simple text
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
        let errorData;
        try {
          errorData = await response.json();
        } catch (err) {
          errorData = { error: 'Failed to parse error response' };
        }
        alert(`Voice Test Failed:\n${errorData.error}\n\nDetails: ${JSON.stringify(errorData.details, null, 2)}`);
        return;
      }

      const audioBlob = await response.blob();
      if (audioBlob.size === 0) {
        alert('Voice Test Failed: No audio data received');
        return;
      }

      alert('✅ Voice Test Successful! Audio generated successfully.');
      
    } catch (error) {
      console.error('Voice Test Error:', error);
      alert('Voice Test Failed: ' + error);
    }
  };

  const handleTestAllAPIs = async () => {
    try {
      const response = await fetch('/api/test-apis');
      const data = await response.json();
      console.log('🧪 All API Test Results:', data);
      
      // Create a formatted message
      let message = '🧪 API Test Results:\n\n';
      
      // Environment status
      message += '📋 Environment:\n';
      message += `OpenRouter: ${data.environment.openRouterConfigured ? '✅' : '❌'}\n`;
      message += `ElevenLabs: ${data.environment.elevenLabsConfigured ? '✅' : '❌'}\n`;
      message += `Supabase: ${data.environment.supabaseConfigured ? '✅' : '❌'}\n\n`;
      
      // API test results
      message += '🔧 API Tests:\n';
      message += `OpenRouter: ${data.apiTests.openRouter.status} - ${data.apiTests.openRouter.message}\n`;
      message += `ElevenLabs: ${data.apiTests.elevenLabs.status} - ${data.apiTests.elevenLabs.message}\n`;
      message += `Supabase: ${data.apiTests.supabase.status} - ${data.apiTests.supabase.message}\n`;
      
      // Add troubleshooting tips
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
      
      alert(message);
    } catch (error) {
      console.error('All API Test Error:', error);
      alert('All API Test Failed: ' + error);
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

  const getEstimatedTime = () => {
    const stepTimes: { [key: number]: number } = {
      0: 30, // Script generation: 30 seconds
      1: 120, // Storyboard generation: 2 minutes
      2: 180, // Asset generation: 3 minutes
      3: 60, // Render: 1 minute
      4: 0 // Done
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

  const handlePreviewVoice = async (voiceId: string, previewText: string) => {
    try {
      console.log('🎤 Previewing voice:', voiceId);
      
      // Stop any currently playing audio to prevent overlap
      if (currentlyPlayingAudio) {
        currentlyPlayingAudio.pause();
        currentlyPlayingAudio.currentTime = 0;
        setCurrentlyPlayingAudio(null);
      }
      
      // Show loading state
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
        let errorData;
        try {
          errorData = await response.json();
        } catch (err) {
          errorData = { error: 'Failed to parse error response' };
        }
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const audioBlob = await response.blob();
      
      if (audioBlob.size === 0) {
        throw new Error('No audio data received');
      }

      const audioUrl = URL.createObjectURL(audioBlob);

      // Create temporary audio element for preview
      const previewAudio = new Audio(audioUrl);
      
      // Add event listeners for better UX
      previewAudio.addEventListener('loadstart', () => console.log('🎤 Loading audio preview...'));
      previewAudio.addEventListener('canplay', () => console.log('🎤 Audio ready to play'));
      previewAudio.addEventListener('error', (e) => {
        console.error('🎤 Audio playback error:', e);
        throw new Error('Audio playback failed');
      });
      
      await previewAudio.play();
      
      // Store the currently playing audio
      setCurrentlyPlayingAudio(previewAudio);
      
      console.log('✅ Voice preview played successfully');

      // Clean up after playback
      previewAudio.addEventListener('ended', () => {
        URL.revokeObjectURL(audioUrl);
        setCurrentlyPlayingAudio(null);
      });

    } catch (error) {
      console.error('🚨 Voice preview error:', error);
      
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('quota_exceeded')) {
        alert('⚠️ Voice preview failed: Insufficient ElevenLabs credits. Please add more credits to your account.');
      } else if (errorMessage.includes('401')) {
        alert('⚠️ Voice preview failed: Invalid ElevenLabs API key. Please check your configuration.');
      } else {
        alert(`⚠️ Voice preview failed: ${errorMessage}`);
      }
    } finally {
      // Reset button state
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

      // Reset states
      setIsGeneratingVideo(false);
      setCurrentVideoId(null);
      setProgress(prev => ({
        ...prev,
        status: 'Video generation cancelled',
        details: 'You can start a new video generation',
        percentage: 0
      }));

      // Close any active SSE connection
      if (currentEventSource) {
        currentEventSource.close();
        setCurrentEventSource(null);
      }

    } catch (error) {
      console.error('❌ Failed to cancel video:', error);
      alert(`Failed to cancel video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleGenerateVideo = async () => {
    if (!generatedScript.trim()) {
      alert('Please generate a script first');
      return;
    }

    setIsGeneratingVideo(true);
    setCurrentStep(2); // Start at "Assets" step
    setProgress(prev => ({ 
      ...prev, 
      currentStep: 2,
      status: '🎬 Generating Video Assets...',
      details: 'Creating storyboard and preparing assets...',
      percentage: 20
    }));

    try {
      console.log('🎬 Starting video generation...');
      
      // Update progress for storyboard generation
      setProgress(prev => ({ 
        ...prev, 
        status: '📝 Creating Storyboard...',
        details: 'Generating scene descriptions and image prompts...',
        percentage: 30
      }));

      const videoId = uuidv4();
      setCurrentVideoId(videoId);
      
      // Start SSE connection for real-time progress
      const eventSource = new EventSource(`/api/progress/${videoId}`);
      setCurrentEventSource(eventSource);
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'progress') {
            setProgress(prev => ({
              ...prev,
              status: data.details,
              details: `Status: ${data.status}`,
              percentage: data.percentage
            }));
          } else if (data.type === 'error') {
            console.error('Progress error:', data.message);
          }
        } catch (error) {
          console.error('Failed to parse SSE data:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        eventSource.close();
        setCurrentEventSource(null);
      };

      const response = await fetch('/api/generate-assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: videoId,
          script: generatedScript,
          voiceId: selectedVoiceId,
        }),
      });

      console.log('🎬 Video generation response status:', response.status);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (err) {
          errorData = { error: 'Failed to parse error response' };
        }
        console.error('❌ Video generation failed:', JSON.stringify(errorData, null, 2));
        
        // Show detailed error information
        const errorMessage = String(errorData.details?.error || errorData.error || 'Failed to generate video');


        const errorDetails = errorData.details || errorData.stack || 'No additional details';
        
        // Handle specific billing limit errors
        if (errorMessage.includes('Billing limit reached') || 
            errorMessage.includes('billing hard limit') ||
            errorMessage.includes('quota exceeded') ||
            errorMessage.includes('insufficient credits')) {
          
          const billingError = `⚠️ Billing Limit Reached\n\nYour Stability AI account has reached its billing limit. To continue generating images:\n\n1. Visit your Stability AI dashboard\n2. Upgrade your plan or add more credits\n3. Try generating your video again\n\nError: ${errorMessage}`;
          
          console.error('❌ Billing limit error:', billingError);
          throw new Error(billingError);
        }
        
        // Handle other specific errors
        if (errorMessage.includes('API Key Error')) {
          const apiError = `🔑 API Key Issue\n\nThere's a problem with your Stability AI API key:\n\n1. Check your API key in the .env.local file\n2. Verify the key is valid and active\n3. Ensure you have sufficient credits\n\nError: ${errorMessage}`;
          throw new Error(apiError);
        }
        
        if (errorMessage.includes('Content Policy Violation')) {
          const contentError = `🚫 Content Policy Violation\n\nYour image prompt violates content policies:\n\n1. Modify your story to avoid prohibited content\n2. Try a different approach or theme\n3. Ensure your content is appropriate\n\nError: ${errorMessage}`;
          throw new Error(contentError);
        }
        
        console.error('❌ Error details:', JSON.stringify(errorDetails, null, 2));
        throw new Error(`${errorMessage}\n\nDetails: ${errorDetails}`);
      }

      const data = await response.json();
      console.log('✅ Video generated successfully:', data);
      
      // Update progress for completion
      setProgress(prev => ({ 
        ...prev, 
        status: '✅ Video Assets Generated!',
        details: 'All images, audio, and captions created successfully',
        percentage: 100
      }));
      
      // Close SSE connection
      eventSource.close();
      setCurrentEventSource(null);
      
      // Redirect to dedicated video page
      const responseVideoId = data.data.videoId;
      if (responseVideoId) {
        window.location.href = `/video/${responseVideoId}`;
      } else {
        // Fallback: show video player on current page
        setVideoData(data.data);
        setShowVideoPlayer(true);
        setCurrentStep(4); // Move to "Done" step
        setProgress(prev => ({ ...prev, currentStep: 4 }));
        setVideoGenerated(true);
      }
      
      // Show success summary
      if (data.summary) {
        let message = '🎬 Video Generation Complete!\n\n';
        
        // Add summary items
        Object.entries(data.summary).forEach(([key, value]) => {
          if (key !== 'errors') {
            message += `${key}: ${value}\n`;
          }
        });
        
        // Add errors if any
        if (data.summary.errors && data.summary.errors.length > 0) {
          message += '\n⚠️ Errors encountered:\n';
          data.summary.errors.forEach((error: string) => {
            message += `• ${error}\n`;
          });
        }
        
        alert(message);
      }

    } catch (error) {
      console.error('🚨 Video generation error:', error);
      alert('Video generation failed: ' + error);
      setCurrentStep(1);
      setProgress(prev => ({ ...prev, currentStep: 1 }));
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  // 🎬 Video Player Component
  const VideoPlayer = ({ videoData }: { videoData: any }) => {
    const [currentScene, setCurrentScene] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioTime, setAudioTime] = useState(0);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [showCaptions, setShowCaptions] = useState(true);

    const scenes = videoData?.storyboard?.scenes || [];
    const audioUrl = videoData?.audioUrl;
    const captionsUrl = videoData?.captionsUrl;

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
        
        // Find which scene should be showing based on audio time
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
    // Rough estimation based on typical usage
    const estimatedImages = 7; // Average number of scenes
    const estimatedAudioLength = 40; // seconds
    
    const imageCredits = estimatedImages * 0.04; // ~$0.04 per DALL-E 3 image
    const audioCredits = (estimatedAudioLength / 1000) * 0.30; // ~$0.30 per 1000 characters
    
    return {
      images: imageCredits,
      audio: audioCredits,
      total: imageCredits + audioCredits
    };
  };

    if (!videoData) return null;

    return (
      <div className="bg-white/90 backdrop-blur-sm shadow-2xl rounded-2xl p-8 w-full max-w-4xl mb-8 border border-white/20">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-800">🎬 Generated Video</h3>
          <button
            onClick={() => setShowVideoPlayer(false)}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Video Display Area */}
        <div className="relative bg-black rounded-xl overflow-hidden mb-6 aspect-[9/16] max-h-96">
          {scenes[currentScene] && (
            <img
              src={videoData.imageUrls?.[currentScene]}
              alt={`Scene ${currentScene + 1}`}
              className="w-full h-full object-cover"
            />
          )}
          
          {/* Captions Overlay */}
          {showCaptions && scenes[currentScene]?.text && (
            <div className="absolute bottom-4 left-4 right-4 bg-black/70 text-white p-3 rounded-lg text-center">
              <p className="text-sm font-medium">{scenes[currentScene].text}</p>
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

            <button
              onClick={() => {
                if (audioUrl) {
                  const link = document.createElement('a');
                  link.href = audioUrl;
                  link.download = 'voiceover.mp3';
                  link.click();
                }
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              💾 Download Audio
            </button>

            <button
              onClick={() => {
                if (captionsUrl) {
                  const link = document.createElement('a');
                  link.href = captionsUrl;
                  link.download = 'captions.vtt';
                  link.click();
                }
              }}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              📝 Download Captions
            </button>
          </div>

                  {/* Scene Information */}
        <div className="text-center text-sm text-gray-600">
          Scene {currentScene + 1} of {scenes.length}
        </div>

        {/* Debug Information */}
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Debug Info:</h4>
          <div className="text-xs text-gray-600 space-y-1">
            <div>Audio URL: {audioUrl ? '✅ Available' : '❌ Missing'}</div>
            <div>Images: {videoData.imageUrls?.length || 0} generated</div>
            <div>Scenes: {scenes.length} total</div>
            <div>Current Time: {formatTime(audioTime)}</div>
            <div>Audio Duration: {formatTime(audioRef.current?.duration || 0)}</div>
          </div>
        </div>
        </div>

        {/* Hidden Audio Element */}
        <audio
          ref={audioRef}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      </div>
    );
  };

  // 🎬 4. ווידוא שהווידאו יופיע במסך עם סיום התהליך
  const displayVideoPlayer = (videoData: any) => {
    // This will be implemented to show the generated video
    console.log('🎬 Video generated successfully:', videoData);
    // TODO: Implement video player display
  };

  // Sticky Progress Banner Component
  const StickyProgressBanner = () => {
    if (!isGeneratingVideo) return null;
    
    return (
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
        <div className="bg-white/95 backdrop-blur-sm shadow-lg rounded-full px-6 py-3 border border-gray-200">
          <div className="flex items-center gap-4">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
            <span className="text-sm font-medium text-gray-700">
              {progress.status || 'Generating video...'}
            </span>
            <span className="text-xs text-gray-500">
              {progress.percentage}%
            </span>
          </div>
        </div>
      </div>
    );
  };



  return (
    <div className={`min-h-screen flex ${themes[currentTheme].bg}`}>
      {/* Side Menu Backdrop - Only on mobile */}
      {showSideMenu && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setShowSideMenu(false)}
        />
      )}
      
      {/* Side Menu - Always visible on desktop, collapsible on mobile */}
      <div className={`fixed inset-y-0 left-0 z-50 w-80 ${themes[currentTheme].card} shadow-2xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
        showSideMenu ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="flex flex-col h-full">
          {/* Side Menu Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-full flex items-center justify-center mr-3 shadow-lg">
                  <span className="text-white text-lg">🎬</span>
                </div>
                <h2 className="text-xl font-bold text-gray-800">StoryShort</h2>
              </div>
              <button
                onClick={() => setShowSideMenu(false)}
                className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Side Menu Content */}
          <div className="flex-1 p-6 space-y-6 overflow-y-auto">
            {/* Quick Stats */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-xl border border-purple-200">
              <h3 className="font-semibold text-gray-800 mb-3">Project Status</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Current Step:</span>
                  <span className="text-sm font-semibold text-purple-600">{currentStep + 1}/{steps.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Progress:</span>
                  <span className="text-sm font-semibold text-purple-600">{Math.round(((currentStep + 1) / steps.length) * 100)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Est. Time:</span>
                  <span className="text-sm font-semibold text-purple-600">{formatTime(getEstimatedTime())}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Script Generated:</span>
                  <span className="text-sm font-semibold text-green-600">{generatedScript ? '✅' : '❌'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Video Generated:</span>
                  <span className="text-sm font-semibold text-green-600">{videoGenerated ? '✅' : '❌'}</span>
                </div>
              </div>
            </div>

            {/* Voice Selection */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-3">Selected Voice</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Current:</span>
                  <span className="text-sm font-semibold text-purple-600">
                    {availableVoices.find(v => v.id === selectedVoiceId)?.name || 'Custom Voice'}
                  </span>
                </div>
                <button
                  onClick={() => setShowVoiceSelector(!showVoiceSelector)}
                  className="w-full py-2 px-3 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Change Voice
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={handleTestAPI}
                  className="w-full py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                >
                  🎤 Test Voice
                </button>
                <button
                  onClick={handleTestAllAPIs}
                  className="w-full py-2 px-3 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg text-sm font-medium transition-colors"
                >
                  🧪 Test All APIs
                </button>
                {generatedScript && (
                  <button
                    onClick={handlePlayAudio}
                    disabled={isGeneratingAudio}
                    className="w-full py-2 px-3 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    🎤 Play Voice
                  </button>
                )}
                {generatedScript && !isEditingScript && (
                  <button
                    onClick={handleEditScript}
                    className="w-full py-2 px-3 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    ✏️ Edit Script
                  </button>
                )}
              </div>
            </div>

            {/* Theme Customization */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-3">🎨 Theme</h3>
              <div className="space-y-2">
                {Object.entries(themes).map(([key, theme]) => (
                  <button
                    key={key}
                    onClick={() => setCurrentTheme(key as any)}
                    className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      currentTheme === key
                        ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {theme.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Help & Resources */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-3">Help & Resources</h3>
              <div className="space-y-2">
                <a
                  href="https://elevenlabs.io/app/voice-library?language=en&filters=true"
            target="_blank"
            rel="noopener noreferrer"
                  className="block w-full py-2 px-3 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg text-sm font-medium transition-colors"
                >
                  🌐 Browse Voices
                </a>
                <button
                  onClick={() => setShowCustomVoiceInput(!showCustomVoiceInput)}
                  className="w-full py-2 px-3 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-sm font-medium transition-colors"
                >
                  + Add Custom Voice
                </button>
                <button
                  onClick={() => {
                    const helpText = `🔧 Troubleshooting Guide:

1. API Keys Required:
   • OPENAI_API_KEY (for image generation)
   • ELEVENLABS_API_KEY (for voice generation)

2. Common Issues:
   • Image generation fails: Check OpenAI API key
   • Audio generation fails: Check ElevenLabs API key or credits
   • Database errors: Check Supabase configuration

3. Setup Steps:
   • Create .env.local file in project root
   • Add your API keys
   • Restart the development server

4. Test APIs:
   • Use "Test All APIs" button to verify configuration
   • Check console for detailed error messages

5. ElevenLabs Credits:
   • Ensure you have sufficient credits in your ElevenLabs account
   • Check your usage at https://elevenlabs.io/`;
                    alert(helpText);
                  }}
                  className="w-full py-2 px-3 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-lg text-sm font-medium transition-colors"
                >
                  ❓ Troubleshooting
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Account for side menu on desktop */}
      <div className="flex-1 flex flex-col items-center py-12 px-4 lg:ml-80">
        {/* Top Bar with Menu Button - Only on mobile */}
        <div className="w-full max-w-6xl flex justify-between items-center mb-8">
          <button
            onClick={() => setShowSideMenu(true)}
            className="lg:hidden p-3 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-white/20"
          >
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <div className="text-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
              StoryShort
            </h1>
            <p className="text-gray-600 text-sm">AI-Powered Video Generation</p>
          </div>
          
          <div className="w-12"></div> {/* Spacer for centering */}
        </div>

      {/* Modern Progress Steps */}
      <div className="w-full max-w-5xl mb-12">
        <div className="flex items-center justify-between relative">
          {/* Background Line */}
          <div className="absolute top-6 left-0 right-0 h-1 bg-gray-200 rounded-full -z-10"></div>
          
          {steps.map((step, index) => (
            <div key={index} className="flex flex-col items-center relative z-10">
              {/* Step Circle */}
              <div className={`w-12 h-12 rounded-full flex items-center justify-center border-3 transition-all duration-500 shadow-lg ${
                index < currentStep
                  ? 'bg-gradient-to-br from-purple-600 to-indigo-600 border-purple-600 text-white shadow-purple-200'
                  : index === currentStep
                  ? 'bg-white border-3 border-purple-600 text-purple-600 shadow-lg'
                  : 'bg-white border-2 border-gray-300 text-gray-400 shadow-sm'
              }`}>
                {index < currentStep ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <span className="text-sm font-bold">{index + 1}</span>
                )}
              </div>
              
              {/* Step Label */}
              <div className="mt-3 text-center max-w-32">
                <span className={`text-xs font-semibold transition-all duration-300 block ${
                  index < currentStep
                    ? 'text-purple-600'
                    : index === currentStep
                    ? 'text-purple-700'
                    : 'text-gray-400'
                }`}>
                  {step.split(' (')[0]}
                </span>
                <span className={`text-xs transition-all duration-300 block mt-1 ${
                  index < currentStep
                    ? 'text-purple-500'
                    : index === currentStep
                    ? 'text-purple-600'
                    : 'text-gray-400'
                }`}>
                  {step.includes('(') ? step.split('(')[1].replace(')', '') : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
        
        {/* Progress Bar */}
        <div className="mt-8 w-full bg-gray-100 rounded-full h-3 shadow-inner relative">
          <div
            className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 h-3 rounded-full transition-all duration-700 ease-out shadow-sm"
            style={{ width: `${progress.percentage}%` }}
          ></div>
          {/* Percentage Indicator */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold text-gray-700 bg-white px-2 py-1 rounded-full shadow-sm">
              {Math.round(progress.percentage)}%
            </span>
          </div>
        </div>
        
        {/* Progress Info */}
        <div className="mt-6 text-center space-y-2">
          <div className="flex items-center justify-center gap-4">
            <span className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-700 rounded-full text-sm font-semibold shadow-sm">
              <span className="w-2 h-2 bg-purple-600 rounded-full mr-2 animate-pulse"></span>
              {progress.status || (currentStep < steps.length ? `Step ${currentStep + 1} of ${steps.length}: ${steps[currentStep].split(' (')[0]}` : 'Complete!')}
            </span>
            
            {/* Cancel Button - Show during video generation */}
            {isGeneratingVideo && progress.percentage > 0 && progress.percentage < 100 && (
              <button
                onClick={handleCancelVideo}
                className="inline-flex items-center px-4 py-2 bg-red-100 text-red-700 rounded-full text-sm font-semibold shadow-sm hover:bg-red-200 transition-colors"
                title="Cancel video generation"
              >
                <span className="mr-2">❌</span>
                Cancel
              </button>
            )}
          </div>
          
          {/* Progress Details */}
          {progress.details && (
            <div className="text-sm text-gray-600 bg-gray-50 px-4 py-2 rounded-lg">
              <div className="flex items-center justify-center">
                {progress.percentage < 100 && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600 mr-2"></div>
                )}
                {progress.details}
              </div>
              
              {/* Enhanced Image Upload Progress Display */}
              {progress.details.includes('📸 Uploading Images') && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-center space-x-2">
                    <span className="text-blue-600 font-semibold">📸</span>
                    <span className="text-blue-700 font-medium">
                      {progress.details.replace('📸 Uploading Images – ', '')}
                    </span>
                  </div>
                  <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${progress.percentage}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Estimated Time */}
          {currentStep < steps.length && !progress.status && (
            <div className="flex items-center justify-center space-x-4 text-sm text-gray-600">
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Est. Time: {formatTime(getEstimatedTime())}
              </span>
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Progress: {Math.round(progress.percentage)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Input Section */}
      <div className="bg-white/80 backdrop-blur-sm shadow-2xl rounded-2xl p-8 w-full max-w-3xl mb-8 border border-white/20">
        <div className="flex items-center mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-full flex items-center justify-center mr-4 shadow-lg">
            <span className="text-white text-lg">✍️</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Tell Your Story</h2>
            <p className="text-gray-600 text-sm">Share your idea and let AI create the magic</p>
          </div>
        </div>

        {/* Billing Warning with Credit Estimation */}
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <span className="text-blue-600 text-lg">💡</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Important Note</h3>
                <p className="text-sm text-blue-700 mt-1">
                  Video generation uses AI services that require credits. Image generation uses Stability AI (DALL-E 3), 
                  and audio uses ElevenLabs. If you encounter billing errors, please check your account balances and upgrade plans as needed.
                </p>
                {/* Credit Estimation Tooltip */}
                <div className="mt-3 p-3 bg-blue-100 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-blue-800">Estimated Cost:</span>
                    <span className="text-xs font-bold text-blue-900">
                      ~$0.28
                    </span>
                  </div>
                  <div className="text-xs text-blue-700 mt-1">
                    Images: ~$0.28 | Audio: ~$0.01
                  </div>
                </div>
              </div>
            </div>
            {/* Sidebar Toggle Button */}
            <button
              onClick={toggleSidebar}
              className="ml-4 p-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors"
              title={sidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
            >
              {sidebarOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <textarea
          placeholder="Enter your story here... For example: A young adventurer discovers a mysterious map that leads to a hidden treasure in an ancient forest..."
          value={storyText}
          onChange={(e) => setStoryText(e.target.value)}
          className="w-full h-40 p-6 border-2 border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-4 focus:ring-purple-200 focus:border-purple-400 transition-all duration-300 text-gray-700 placeholder-gray-400 shadow-sm"
        />

        {/* Step 1: Initial State - Only Generate Script and API Check */}
        {!generatedScript && (
          <div className="flex gap-6 mt-8">
            <div className="flex-1">
              <button
                onClick={handleGenerate}
                disabled={!storyText.trim() || isGenerating}
                className={`w-full py-4 rounded-xl font-bold text-white text-lg transition-all duration-300 transform hover:scale-105 ${
                  storyText.trim() && !isGenerating
                    ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:via-indigo-700 hover:to-blue-700 shadow-lg hover:shadow-xl'
                    : 'bg-gray-300 cursor-not-allowed'
                }`}
                title="Generate a video script from your story using AI"
              >
                <div className="flex items-center justify-center">
                  {isGenerating ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                      Generating Script...
                    </>
                  ) : (
                    <>
                      <span className="mr-2">🚀</span>
                      Generate Script
                    </>
                  )}
                </div>
              </button>
              <p className="text-xs text-gray-500 mt-2 text-center">Step 1: Creates HOOK, BODY, CTA script</p>
            </div>
            
            <div className="flex flex-col">
              <button
                onClick={handleTestAPI}
                className="px-6 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all duration-300 border-2 border-gray-200 hover:border-gray-300"
                title="Check if all API keys are configured correctly"
              >
                🔧 API Check
              </button>
              <p className="text-xs text-gray-500 mt-2 text-center">Debug: Tests environment setup</p>
            </div>
          </div>
        )}

        {/* Step 2: After Script Generation - Show Debug Tools */}
        {generatedScript && !scriptError && (
          <div className="flex gap-4 mt-6">
            <div className="flex-1">
              <button
                onClick={handleGenerate}
                disabled={!storyText.trim() || isGenerating}
                className={`w-full py-3 rounded-lg font-semibold text-white text-lg transition ${
                  storyText.trim() && !isGenerating
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-md'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
                title="Generate a new script"
              >
                Generate New Script
              </button>
              <p className="text-xs text-gray-500 mt-1">Create a new script</p>
            </div>
            
            <div className="flex flex-col">
              <button
                onClick={handleTestAPI}
                className="px-4 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold transition"
                title="Check if all API keys are configured correctly"
              >
                API Check
              </button>
              <p className="text-xs text-gray-500 mt-1">Debug: Tests environment setup</p>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {progress.isGenerating && (
          <div className="mt-4">
                          <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Step {progress.currentStep} of {progress.totalSteps}
                </span>
                <span className="text-sm font-medium text-blue-600">
                  {Math.round((progress.currentStep / progress.totalSteps) * 100)}%
                </span>
              </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(progress.currentStep / progress.totalSteps) * 100}%` }}
              ></div>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {progress.currentStep === 1 && 'Generating storyboard...'}
              {progress.currentStep === 2 && 'Creating images...'}
              {progress.currentStep === 3 && 'Generating audio...'}
              {progress.currentStep === 4 && 'Creating captions...'}
              {progress.currentStep === 5 && 'Finalizing video...'}
            </div>
          </div>
        )}
        </div>

      {/* Generated Script Display */}
      {generatedScript && (
        <div className="bg-white/80 backdrop-blur-sm shadow-2xl rounded-2xl p-8 w-full max-w-4xl mb-8 border border-white/20">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mr-4 shadow-lg">
                <span className="text-white text-lg">📝</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Generated Script</h3>
                <p className="text-gray-600 text-sm">Your AI-generated video script</p>
              </div>
            </div>
            {!isEditingScript && (
              <button
                onClick={handleEditScript}
                className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                ✏️ Edit Script
              </button>
            )}
          </div>
          
          {isEditingScript ? (
            <div className="mb-6">
              <textarea
                value={editableScript}
                onChange={(e) => setEditableScript(e.target.value)}
                className="w-full h-48 p-6 border-2 border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-400 font-mono text-sm transition-all duration-300"
                placeholder="Edit your script here..."
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleSaveScript}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                  ✅ Save Changes
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                  ❌ Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-6 rounded-xl mb-6 border border-gray-200 shadow-sm">
              <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono leading-relaxed">
                {generatedScript}
              </pre>
            </div>
          )}

          {/* Voice Selection */}
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mr-3 shadow-lg">
                  <span className="text-white text-sm">🎤</span>
                </div>
                <label className="text-sm font-semibold text-gray-700">Voice Selection:</label>
              </div>
              <button
                onClick={() => setShowVoiceSelector(!showVoiceSelector)}
                className="px-6 py-3 bg-gradient-to-r from-purple-100 to-indigo-100 hover:from-purple-200 hover:to-indigo-200 text-purple-700 rounded-xl text-sm font-semibold transition-all duration-300 border border-purple-200 hover:border-purple-300 shadow-sm"
              >
                {availableVoices.find(v => v.id === selectedVoiceId)?.name || 
                 (selectedVoiceId !== 'Dslrhjl3ZpzrctukrQSN' ? `Custom Voice (${selectedVoiceId})` : 'Select Voice')} ▼
              </button>
            </div>
            
            {showVoiceSelector && (
              <div className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl border border-gray-200 shadow-xl">
                <h4 className="text-lg font-bold mb-4 text-gray-800">Choose Your Voice:</h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {availableVoices.map((voice) => (
                    <div
                      key={voice.id}
                      className={`p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer ${
                        selectedVoiceId === voice.id
                          ? 'border-purple-400 bg-gradient-to-r from-purple-50 to-indigo-50 shadow-lg'
                          : 'border-gray-200 hover:border-purple-300 hover:shadow-md'
                      }`}
                      onClick={() => {
                        setSelectedVoiceId(voice.id);
                        setShowVoiceSelector(false);
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-bold text-gray-800">{voice.name}</div>
                          <div className="text-sm text-gray-600">{voice.description}</div>
                          <div className="text-xs text-gray-500 mt-1">{voice.accent} • {voice.language} • {voice.gender}</div>
                        </div>
                        {selectedVoiceId === voice.id && (
                          <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                      
                      <div className="bg-gray-50 p-3 rounded-lg mb-3">
                        <p className="text-sm text-gray-700 italic">"{voice.previewText}"</p>
                      </div>
                      
                      <button
                        data-voice-id={voice.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePreviewVoice(voice.id, voice.previewText);
                        }}
                        className="w-full py-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-lg text-sm font-semibold transition-all duration-300 transform hover:scale-105 shadow-sm"
                      >
                        🔊 Preview Voice
                      </button>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <a
                      href="https://elevenlabs.io/app/voice-library?language=en&filters=true"
          target="_blank"
          rel="noopener noreferrer"
                      className="text-purple-600 hover:text-purple-800 text-sm font-semibold flex items-center"
                    >
                      🌐 Browse more voices on ElevenLabs →
                    </a>
                    <button
                      onClick={() => setShowCustomVoiceInput(!showCustomVoiceInput)}
                      className="text-purple-600 hover:text-purple-800 text-sm font-semibold flex items-center"
                    >
                      + Add Custom Voice ID
                    </button>
                  </div>
                  
                  {showCustomVoiceInput && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        Custom Voice ID:
                      </label>
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={customVoiceId}
                          onChange={(e) => setCustomVoiceId(e.target.value)}
                          placeholder="Enter ElevenLabs Voice ID"
                          className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all duration-300"
                        />
                        <button
                          onClick={() => {
                            if (customVoiceId.trim()) {
                              setSelectedVoiceId(customVoiceId.trim());
                              setShowCustomVoiceInput(false);
                              setCustomVoiceId('');
                            }
                          }}
                          className="px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-semibold transition-all duration-300 shadow-sm"
                        >
                          Use Voice
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Find voice IDs on ElevenLabs voice library page
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4">
            {/* Voice Playback */}
            <button
              onClick={isPlaying ? handleStopAudio : handlePlayAudio}
              disabled={isGeneratingAudio}
              className={`px-8 py-4 rounded-xl font-bold text-white transition-all duration-300 transform hover:scale-105 shadow-lg ${
                isGeneratingAudio
                  ? 'bg-gray-400 cursor-not-allowed'
                  : isPlaying
                  ? 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600'
                  : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
              }`}
            >
              <div className="flex items-center">
                {isGeneratingAudio ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Generating...
                  </>
                ) : isPlaying ? (
                  <>
                    <span className="mr-2">⏹️</span>
                    Stop Audio
                  </>
                ) : (
                  <>
                    <span className="mr-2">🎤</span>
                    Play Voice
                  </>
                )}
              </div>
            </button>
            
            {/* Make Video Button - Only show after script is saved */}
            {!isEditingScript && (
              <button
                onClick={handleGenerateVideo}
                disabled={isGeneratingVideo}
                className={`px-8 py-4 rounded-xl font-bold text-white transition-all duration-300 transform hover:scale-105 shadow-lg ${
                  isGeneratingVideo
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:via-indigo-700 hover:to-blue-700'
                }`}
              >
                <div className="flex items-center">
                  {isGeneratingVideo ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                      Generating Video...
                    </>
                  ) : (
                    <>
                      <span className="mr-2">🎬</span>
                      Make Video
                    </>
                  )}
                </div>
              </button>
            )}
            
            {audioError && (
              <div className="flex items-center px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                <span className="text-red-500 mr-2">⚠️</span>
                <p className="text-red-700 text-sm font-medium">{audioError}</p>
              </div>
            )}
          </div>

          {/* Video Player */}
          {showVideoPlayer && videoData && (
            <VideoPlayer videoData={videoData} />
          )}

          {/* Video Generation Status */}
          {videoGenerated && !showVideoPlayer && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="text-green-800 font-semibold mb-2">✅ Video Generated Successfully!</h4>
              <p className="text-green-700 text-sm">
                Your video assets have been created. Check the console for detailed results.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {scriptError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 w-full max-w-2xl mb-8">
          <h3 className="text-red-800 font-semibold mb-2">Error</h3>
          <p className="text-red-700">{scriptError}</p>
        </div>
      )}

      {/* Hidden Audio Element */}
      <audio ref={audioRef} style={{ display: 'none' }} />

      {/* Sticky Progress Banner */}
      <StickyProgressBanner />

            {/* Footer Features */}
      <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
        <div className="bg-white/60 backdrop-blur-sm p-8 rounded-2xl border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-2xl">⚡</span>
          </div>
          <h3 className="font-bold text-xl text-gray-800 mb-2">Fast Generation</h3>
          <p className="text-gray-600 leading-relaxed">Create professional videos in minutes, not hours</p>
        </div>
        <div className="bg-white/60 backdrop-blur-sm p-8 rounded-2xl border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-2xl">✨</span>
          </div>
          <h3 className="font-bold text-xl text-gray-800 mb-2">AI-Powered</h3>
          <p className="text-gray-600 leading-relaxed">Advanced AI creates stunning visuals and voices</p>
        </div>
        <div className="bg-white/60 backdrop-blur-sm p-8 rounded-2xl border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-2xl">💚</span>
          </div>
          <h3 className="font-bold text-xl text-gray-800 mb-2">Easy to Use</h3>
          <p className="text-gray-600 leading-relaxed">Just write your story and let AI do the magic</p>
        </div>
              </div>
      </div>
    </div>
  );
}
