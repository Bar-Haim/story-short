'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import React from 'react';
import { themes, getDefaultTheme } from '@/lib/themes';
import { languages, getDefaultLanguage } from '@/lib/languages';
import { tones, getDefaultTone } from '@/lib/tones';
import WizardStepper, { defaultSteps } from '@/components/WizardStepper';

// Type definitions
type GenerateScriptRequest = { 
  inputText: string; 
  theme?: string; 
  language?: string; 
  tone?: string; 
};

type GenerateScriptResponse = { 
  ok: boolean; 
  videoId?: string; 
  status?: string; 
  error?: string; 
  script?: string;
};

export default function CreateScript() {
  const router = useRouter();
  const [storyText, setStoryText] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedScript, setGeneratedScript] = useState('');
  const [error, setError] = useState('');
  const [selectedTheme, setSelectedTheme] = useState(getDefaultTheme());
  const [selectedLanguage, setSelectedLanguage] = useState(getDefaultLanguage());
  const [selectedTone, setSelectedTone] = useState(getDefaultTone());

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    const payload = { 
      inputText: storyText,
      theme: selectedTheme.id,
      language: selectedLanguage.code,
      tone: selectedTone.id,
    };

    try {
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(payload),
        keepalive: true,
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Bad JSON (${res.status}): ${text.slice(0,180)}`);
      }

      if (!res.ok || !data?.ok || !data?.videoId) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      const vid = String(data.videoId);
      console.log('[create] navigating to video', vid);

      // Wizard flow - redirect to script page for review and approval
      try {
        router.push(`/script/${vid}`);
      } catch (navErr) {
        console.warn('[create] router.push failed, using hard redirect', navErr);
        window.location.href = `/script/${vid}`;
      }
    } catch (err: any) {
      console.error('[create] generate-script failed', err);
      alert(`Failed to generate script: ${err?.message ?? err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      <div className="flex-1 flex flex-col">
        {/* Header with Stepper */}
        <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <WizardStepper steps={defaultSteps} currentStep={0} />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="max-w-4xl w-full">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/20">
              <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">
                Create Your Story
              </h2>
              
              <form onSubmit={handleSubmit} noValidate className="space-y-6">
                {/* Story Input */}
                <div>
                  <label htmlFor="storyText" className="block text-sm font-medium text-gray-700 mb-2">
                    Tell us your story
                  </label>
                  <textarea
                    id="storyText"
                    value={storyText}
                    onChange={(e) => setStoryText(e.target.value)}
                    placeholder="Describe what you want to create a video about..."
                    className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                    disabled={loading}
                  />
                </div>

                {/* Personalization Options */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Theme */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Theme
                    </label>
                    <select
                      value={selectedTheme.id}
                      onChange={(e) => {
                        const theme = Object.values(themes).find(t => t.id === e.target.value);
                        if (theme) setSelectedTheme(theme);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      disabled={loading}
                    >
                      {Object.values(themes).map((theme) => (
                        <option key={theme.id} value={theme.id}>
                          {theme.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Language */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Language
                    </label>
                    <select
                      value={selectedLanguage.code}
                      onChange={(e) => {
                        const language = Object.values(languages).find(l => l.code === e.target.value);
                        if (language) setSelectedLanguage(language);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      disabled={loading}
                    >
                      {Object.values(languages).map((language) => (
                        <option key={language.code} value={language.code}>
                          {language.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tone
                    </label>
                    <select
                      value={selectedTone.id}
                      onChange={(e) => {
                        const tone = Object.values(tones).find(t => t.id === e.target.value);
                        if (tone) setSelectedTone(tone);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      disabled={loading}
                    >
                      {Object.values(tones).map((tone) => (
                        <option key={tone.id} value={tone.id}>
                          {tone.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Error Display */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-700">{error}</p>
                  </div>
                )}

                {/* Generate Button */}
                <div className="text-center">
                  <button
                    type="submit"
                    disabled={loading || !storyText.trim()}
                    className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Generating Script...' : 'Generate Script'}
                  </button>
                </div>
              </form>

              {/* Back Link */}
              <div className="mt-8 text-center">
                <button
                  onClick={() => router.push('/')}
                  className="text-gray-600 hover:text-gray-900 text-sm"
                >
                  ← Back to Home
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
} 