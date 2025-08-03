'use client';

import { useState, useRef } from 'react';

export default function Home() {
  const [storyText, setStoryText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [generatedScript, setGeneratedScript] = useState('');
  const [scriptError, setScriptError] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioError, setAudioError] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);

  const steps = ['Script', 'Storyboard', 'Assets', 'Render', 'Done'];

  const handleGenerate = async () => {
    if (!storyText.trim()) return;

    setIsGenerating(true);
    setProgress(0);
    setCurrentStep(0);
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
        throw new Error(`Server error (${response.status}): ${errorMsg}`);
      }

      if (!responseData.success || !responseData.script) {
        console.error('❌ Invalid response structure:', responseData);
        throw new Error('Invalid response from script generation API');
      }

      setGeneratedScript(responseData.script);
      setCurrentStep(1);
      setProgress(25);
      console.log('✅ Script generated and set successfully');

      // Start asset generation
      if (responseData.videoId) {
        console.log('🎬 Starting asset generation...');
        setCurrentStep(2);
        setProgress(50);
        
        try {
          const assetsResponse = await fetch('/api/generate-assets', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              videoId: responseData.videoId,
              script: responseData.script,
            }),
          });

          if (!assetsResponse.ok) {
            const errorData = await assetsResponse.json();
            console.error('❌ Asset generation failed:', errorData);
            throw new Error(errorData.error || 'Failed to generate assets');
          }

          const assetsData = await assetsResponse.json();
          console.log('✅ Assets generated successfully:', assetsData);
          setCurrentStep(3);
          setProgress(75);
          
        } catch (assetError) {
          console.error('🚨 Asset generation error:', assetError);
          setScriptError(assetError instanceof Error ? assetError.message : 'Failed to generate assets');
        }
      }

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
        body: JSON.stringify({ text: generatedScript }),
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (err) {
          errorData = { error: 'Failed to parse error response' };
        }
        throw new Error(errorData.error || 'Failed to generate audio');
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
      const response = await fetch('/api/test-env');
      const data = await response.json();
      console.log('🔍 API Test Results:', data);
      alert(`API Test Results:\n${JSON.stringify(data, null, 2)}`);
    } catch (error) {
      console.error('API Test Error:', error);
      alert('API Test Failed: ' + error);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 flex flex-col items-center py-20 px-4">
      {/* Header */}
      <h1 className="text-5xl font-bold text-purple-700 mb-3">StoryShort</h1>
      <p className="text-gray-600 text-center mb-6 max-w-xl">
        Transform your stories into engaging videos with AI-powered generation
      </p>

      {/* Enhanced Horizontal Progress Steps */}
      <div className="w-full max-w-4xl mb-12">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={index} className="flex flex-col items-center relative">
              {/* Step Circle */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                index < currentStep
                  ? 'bg-purple-600 border-purple-600 text-white'
                  : index === currentStep
                  ? 'bg-white border-purple-600 text-purple-600'
                  : 'bg-gray-100 border-gray-300 text-gray-400'
              }`}>
                {index < currentStep ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <span className="text-sm font-semibold">{index + 1}</span>
                )}
              </div>
              
              {/* Step Label */}
              <span className={`text-xs mt-2 font-medium transition-all duration-300 ${
                index < currentStep
                  ? 'text-purple-600'
                  : index === currentStep
                  ? 'text-purple-700 font-bold'
                  : 'text-gray-400'
              }`}>
                {step}
              </span>
              
              {/* Connecting Line */}
              {index < steps.length - 1 && (
                <div className={`absolute top-5 left-full w-full h-0.5 transition-all duration-300 ${
                  index < currentStep
                    ? 'bg-purple-600'
                    : 'bg-gray-300'
                }`} style={{ width: 'calc(100% - 2.5rem)' }}></div>
              )}
            </div>
          ))}
        </div>
        
        {/* Progress Bar */}
        <div className="mt-8 w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          ></div>
        </div>
        
        {/* Current Step Indicator */}
        <div className="mt-4 text-center">
          <span className="text-sm text-purple-600 font-medium">
            {currentStep < steps.length ? `Step ${currentStep + 1} of ${steps.length}: ${steps[currentStep]}` : 'Complete!'}
          </span>
        </div>
      </div>

      {/* Input Section */}
      <div className="bg-white shadow-xl rounded-xl p-8 w-full max-w-2xl mb-8">
        <h2 className="text-lg font-semibold mb-4">Tell Your Story</h2>

        <textarea
          placeholder="Enter your story here... For example: A young adventurer discovers a mysterious map that leads to a hidden treasure in an ancient forest..."
          value={storyText}
          onChange={(e) => setStoryText(e.target.value)}
          className="w-full h-32 p-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-400"
        />

        <div className="flex gap-4 mt-6">
          <button
            onClick={handleGenerate}
            disabled={!storyText.trim() || isGenerating}
            className={`flex-1 py-3 rounded-lg font-semibold text-white text-lg transition ${
              storyText.trim() && !isGenerating
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-md'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {isGenerating ? 'Generating Script...' : 'Generate Script'}
          </button>
          
          <button
            onClick={handleTestAPI}
            className="px-4 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold transition"
          >
            API Check
          </button>
        </div>

        {/* Progress Bar */}
        {isGenerating && (
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 mt-2">Generating your script...</p>
          </div>
        )}
      </div>

      {/* Generated Script Display */}
      {generatedScript && (
        <div className="bg-white shadow-xl rounded-xl p-8 w-full max-w-2xl mb-8">
          <h3 className="text-lg font-semibold mb-4 text-purple-700">Generated Script</h3>
          
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
              {generatedScript}
            </pre>
          </div>

          {/* Voice Playback Controls */}
          <div className="flex gap-4">
            <button
              onClick={isPlaying ? handleStopAudio : handlePlayAudio}
              disabled={isGeneratingAudio}
              className={`px-6 py-3 rounded-lg font-semibold text-white transition ${
                isGeneratingAudio
                  ? 'bg-gray-400 cursor-not-allowed'
                  : isPlaying
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-green-500 hover:bg-green-600'
              }`}
            >
              {isGeneratingAudio ? 'Generating...' : isPlaying ? 'Stop Audio' : 'Play Voice'}
            </button>
            
            {audioError && (
              <p className="text-red-500 text-sm self-center">{audioError}</p>
            )}
          </div>
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

      {/* Footer Features */}
      <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
        <div>
          <div className="text-blue-600 text-3xl mb-2">⚡</div>
          <h3 className="font-semibold text-lg">Fast Generation</h3>
          <p className="text-sm text-gray-600">Create videos in minutes, not hours</p>
        </div>
        <div>
          <div className="text-purple-600 text-3xl mb-2">✨</div>
          <h3 className="font-semibold text-lg">AI-Powered</h3>
          <p className="text-sm text-gray-600">Advanced AI creates stunning visuals</p>
        </div>
        <div>
          <div className="text-green-600 text-3xl mb-2">💚</div>
          <h3 className="font-semibold text-lg">Easy to Use</h3>
          <p className="text-sm text-gray-600">Just write your story and click generate</p>
        </div>
      </div>
    </main>
  );
}
