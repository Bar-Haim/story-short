'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import WizardStepper, { defaultSteps } from '@/components/WizardStepper';
import { parseScriptSections, stripMeta } from '@/lib/script';

interface VideoData {
  id: string;
  status: string;
  script?: string;
  script_text?: string;
  error_message?: string;
}

type VideoStatus = {
  status: string;
  error_message?: string | null;
  script_text?: string | null;
  script?: string | null;
};





function useScriptStatus(videoId: string) {
  const [status, setStatus] = useState<VideoStatus>({ status: 'loading' });
  const [elapsed, setElapsed] = useState(0);
  const t0Ref = useRef<number | null>(null);
  const timerRef = useRef<any>(null);

  // poll status every 1500ms until script_generated/script_approved
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const res = await fetch(`/api/video-status?id=${videoId}`, { cache: 'no-store' });
      const json = await res.json();
      if (!cancelled) setStatus(json?.data ?? { status: 'unknown' });
    }

    // start elapsed timer
    t0Ref.current = Date.now();
    timerRef.current = setInterval(() => {
      if (t0Ref.current) setElapsed(Math.floor((Date.now() - t0Ref.current) / 1000));
    }, 1000);

    const int = setInterval(poll, 1500);
    poll();

    return () => {
      cancelled = true;
      clearInterval(int);
      clearInterval(timerRef.current);
    };
  }, [videoId]);

  // Enhanced progress calculation with more granular stages
  const progress = useMemo(() => {
    const s = status.status;
    
    // More detailed progress mapping
    if (s === 'script_generated' || s === 'script_approved') return { 
      pct: 100, 
      label: 'Script Ready', 
      stage: 'complete',
      details: 'Your script is ready for review and editing'
    };
    
    if (s === 'created') return { 
      pct: 25, 
      label: 'Preparing Script Generation', 
      stage: 'preparing',
      details: 'Setting up AI script generation...'
    };
    
    if (s === 'loading' || s === 'unknown') return { 
      pct: 15, 
      label: 'Contacting AI Services', 
      stage: 'connecting',
      details: 'Connecting to AI generation services...'
    };
    
    if (s?.includes('failed')) return { 
      pct: 100, 
      label: 'Generation Failed', 
      stage: 'failed',
      details: status.error_message || 'Script generation encountered an error'
    };
    
    if (s === 'script_generating') return { 
      pct: 60, 
      label: 'Generating Script Content', 
      stage: 'generating',
      details: 'AI is creating your script based on your story...'
    };
    
    // Default working state
    return { 
      pct: 40, 
      label: 'Processing', 
      stage: 'working',
      details: 'Working on your script...'
    };
  }, [status.status, status.error_message]);

  return { status, progress, elapsed };
}

export default function ScriptPage() {
  const router = useRouter();
  const params = useParams();
  const videoId = params.id as string;

  // Use the enhanced status hook
  const { status, progress, elapsed } = useScriptStatus(videoId);

  // Enhanced state management
  const [isSaving, setIsSaving] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState('');
  const [requiresRegeneration, setRequiresRegeneration] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Script editing state with new approach
  const [hook, setHook] = useState('');
  const [body, setBody] = useState('');
  const [cta, setCta] = useState('');
  const [dirty, setDirty] = useState(false);

  // Refs for accessibility
  const statusMessageRef = useRef<HTMLDivElement>(null);

  // Auto-generation logic and prefill
  const [checkedForGeneration, setCheckedForGeneration] = useState(false);
  
  useEffect(() => {
    const currentStatus = status?.status;
    const hasScript = !!((status as any)?.script_text ?? (status as any)?.script);
    
    // If status is 'created' and no script exists, redirect back to create page
    if (currentStatus === 'created' && !hasScript && !checkedForGeneration) {
      setCheckedForGeneration(true);
      console.log('⚠️ Script page accessed with status "created" but no script found. Redirecting to create page.');
      router.push('/create');
      return;
    }
    
    // Prefill once we have script_text from status
    if (hasScript) {
      const raw = (status as any)?.script_text ?? (status as any)?.script;
      const { hook: h, body: b, cta: c } = parseScriptSections(raw);
      // Prefill only if user hasn't started typing
      setHook(prev => prev || h);
      setBody(prev => prev || b);
      setCta(prev => prev || c);
      // Do NOT mark dirty here; user will decide to edit or continue.
    }
  }, [status?.status, (status as any)?.script_text, (status as any)?.script, checkedForGeneration, router]);

  // Mark dirty only on change:
  const onHook = (v: string) => { setHook(v); setDirty(true); };
  const onBody = (v: string) => { setBody(v); setDirty(true); };
  const onCta = (v: string) => { setCta(v); setDirty(true); };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMsg(null);
    setSuccess('');
    setRequiresRegeneration(false);
    
    const scriptText = `HOOK: ${hook}\n\nBODY: ${body}\n\nCTA: ${cta}`.trim();
    
    if (!hook.trim() && !body.trim() && !cta.trim()) {
      setIsSaving(false);
      throw new Error('Script cannot be empty');
    }

    const payload = { 
      id: videoId, 
      script_text: scriptText 
    };

    const response = await fetch('/api/script', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let err = 'Failed to save script';
      try {
        const errorData = await response.json();
        err = errorData?.error || err;
      } catch {}
      setIsSaving(false);
      throw new Error(err);
    }

    const result = await response.json();
    
    // Check if regeneration is required
    if (result.requiresRegeneration) {
      setRequiresRegeneration(true);
      setSuccess(result.message || 'Script saved successfully! Assets will need to be regenerated.');
    } else {
      setSuccess('Script saved successfully!');
    }

    setDirty(false);
    setIsSaving(false);
  };

  const handleSaveAndContinue = async () => {
    try {
      // Instant feedback: disable button and show loading message
      setContinuing(true);
      setStatusMessage('Please wait… moving to the next step.');
      setErrorMsg(null);
      setSuccess('');
      
      // Focus the status message for screen readers
      setTimeout(() => {
        statusMessageRef.current?.focus();
      }, 100);
      
      // Always saves first
      await handleSave();
      
      // Update status message for storyboard generation
      setStatusMessage('Generating storyboard...');
      
      // If regeneration is required, go directly to storyboard to regenerate assets
      if (requiresRegeneration) {
        console.log('🔄 Script changed, navigating to storyboard for asset regeneration');
        setStatusMessage('Navigating to storyboard for asset regeneration...');
        router.push(`/storyboard/${videoId}`);
        return;
      }
      
      // Generate storyboard (normal flow)
      const response = await fetch('/api/generate-storyboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate storyboard');
      }

      // Update status message before navigation
      setStatusMessage('Storyboard generated successfully! Navigating...');
      
      // Navigate to storyboard page
      router.push(`/storyboard/${videoId}`);
      
    } catch (err: any) {
      console.error('Failed to continue:', err);
      setErrorMsg(err.message || 'Failed to save script');
      setStatusMessage(null);
    } finally {
      setContinuing(false);
    }
  };

  // Handle navigation back from storyboard with confirmation
  const handleBackToStoryboard = () => {
    if (status.status === 'storyboard_generated' && dirty) {
      if (confirm('You have unsaved script changes. If you continue to the storyboard, your changes will be lost. Do you want to save first?')) {
        handleSave();
      }
    }
    router.push(`/storyboard/${videoId}`);
  };

  if (status.status === 'loading' || status.status === 'unknown') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading script...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Stepper */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <WizardStepper steps={defaultSteps} currentStep={1} videoStatus={status.status} />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Enhanced Progress Display */}
        <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                progress.stage === 'complete' ? 'bg-green-500' :
                progress.stage === 'failed' ? 'bg-red-500' :
                'bg-purple-500 animate-pulse'
              }`} />
              <span className="font-semibold text-gray-900">{progress.label}</span>
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">{progress.pct}%</span>
              {elapsed > 0 && <span className="ml-2">• {elapsed}s elapsed</span>}
            </div>
          </div>
          
          {/* Progress Bar with Stage Colors */}
          <div className="h-3 w-full bg-gray-200 rounded-full mb-3 overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all duration-500 ease-out ${
                progress.stage === 'complete' ? 'bg-green-500' :
                progress.stage === 'failed' ? 'bg-red-500' :
                progress.stage === 'generating' ? 'bg-blue-500' :
                progress.stage === 'preparing' ? 'bg-amber-500' :
                'bg-purple-500'
              }`}
              style={{ width: `${progress.pct}%` }}
            />
          </div>
          
          {/* Stage Details */}
          <div className="text-sm text-gray-700">
            {progress.details}
            {progress.stage === 'generating' && (
              <div className="mt-2 flex items-center gap-2 text-purple-600">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600"></div>
                <span>AI is working on your script...</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Review Your Script</h1>
            <p className="text-gray-600">
              Edit your AI-generated script. This will be used for voiceover and captions.
            </p>
          </div>

          {/* Enhanced Status Display */}
          {status.status === 'script_generated' && (
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-sm font-bold">✓</span>
                </div>
                <div className="flex-1">
                  <p className="text-blue-800 font-semibold mb-2">Script Generated Successfully!</p>
                  <p className="text-blue-700 text-sm mb-3">
                    Your AI-generated script is ready for review and editing. You can modify any section to better match your vision.
                  </p>
                  <div className="bg-blue-100 p-3 rounded border border-blue-200">
                    <p className="text-blue-800 text-xs font-medium">💡 Tips:</p>
                    <ul className="text-blue-700 text-xs mt-1 space-y-1">
                      <li>• Keep the hook engaging and attention-grabbing</li>
                      <li>• Ensure the body flows naturally and tells your story</li>
                      <li>• Make the CTA clear and actionable</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {status.status === 'script_approved' && (
            <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-sm font-bold">✓</span>
                </div>
                <div className="flex-1">
                  <p className="text-green-800 font-semibold mb-2">Script Approved & Ready!</p>
                  <p className="text-green-700 text-sm mb-3">
                    Your script has been approved and is ready for the next step. You can still make edits if needed before proceeding.
                  </p>
                  <div className="bg-green-100 p-3 rounded border border-green-200">
                    <p className="text-green-800 text-xs font-medium">🎯 Next Steps:</p>
                    <p className="text-green-700 text-xs mt-1">
                      Click "Save & Continue" to proceed to storyboard generation, or make additional edits to your script.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {status.status === 'storyboard_generated' && (
            <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-amber-800 text-sm font-bold">⚠</span>
                </div>
                <div className="flex-1">
                  <p className="text-amber-800 font-semibold mb-2">Storyboard Already Generated</p>
                  <p className="text-amber-700 text-sm mb-3">
                    A storyboard has already been created for this script. You can still edit your script here, but changes will require regenerating the storyboard and all assets.
                  </p>
                  <div className="bg-amber-100 p-3 rounded border border-amber-200">
                    <p className="text-amber-800 text-xs font-medium">ℹ️ Note:</p>
                    <p className="text-amber-700 text-xs mt-1">
                      If you make changes, you'll need to regenerate images, audio, and captions to match the new script content.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {status.status?.includes('failed') && (
            <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-sm font-bold">✗</span>
                </div>
                <div className="flex-1">
                  <p className="text-red-800 font-semibold mb-2">Script Generation Failed</p>
                  <p className="text-red-700 text-sm mb-3">
                    {status.error_message || 'Script generation encountered an unexpected error. Please try again.'}
                  </p>
                  <div className="bg-red-100 p-3 rounded border border-red-200">
                    <p className="text-red-800 text-xs font-medium">🔄 Recovery Options:</p>
                    <ul className="text-red-700 text-xs mt-1 space-y-1">
                      <li>• Refresh the page to retry generation</li>
                      <li>• Return to the create page and try again</li>
                      <li>• Check your internet connection</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Regeneration Warning */}
          {requiresRegeneration && (
            <div className="mb-6 p-6 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-lg font-bold">⚠️</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-orange-900 text-lg mb-2">Asset Regeneration Required</h3>
                  <p className="text-orange-700 text-sm mb-4">
                    Since you've made changes to the script after the storyboard was generated, the following assets will need to be regenerated to match your new content:
                  </p>
                </div>
              </div>
              
              {/* Asset Impact Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-orange-100 p-3 rounded border border-orange-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-orange-600 text-lg">🖼️</span>
                    <span className="text-orange-800 font-medium text-sm">Scene Images</span>
                  </div>
                  <p className="text-orange-700 text-xs">
                    All scene visuals will be regenerated to match your new script content
                  </p>
                </div>
                
                <div className="bg-orange-100 p-3 rounded border border-orange-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-orange-600 text-lg">🎵</span>
                    <span className="text-orange-800 font-medium text-sm">Audio Narration</span>
                  </div>
                  <p className="text-orange-700 text-xs">
                    Voiceover will be regenerated to match your updated script text
                  </p>
                </div>
                
                <div className="bg-orange-100 p-3 rounded border border-orange-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-orange-600 text-lg">📝</span>
                    <span className="text-orange-800 font-medium text-sm">Video Captions</span>
                  </div>
                  <p className="text-orange-700 text-xs">
                    Subtitles will be updated to reflect your script changes
                  </p>
                </div>
              </div>
              
              {/* Process Information */}
              <div className="bg-orange-100 p-4 rounded border border-orange-200 mb-4">
                <p className="text-orange-800 text-sm font-medium mb-3">📋 Regeneration Process:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-orange-700">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                    <span>Process takes 3-5 minutes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                    <span>Existing storyboard structure preserved</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                    <span>All assets regenerated in parallel</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                    <span>You can continue editing while processing</span>
                  </div>
                </div>
              </div>
              
              <p className="text-orange-700 text-sm font-medium">
                Click "Save & Regenerate Assets" below to proceed with the regeneration process.
              </p>
            </div>
          )}

          {/* Error Display */}
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-red-700 font-medium mb-3">{errorMsg}</p>
                  <button
                    onClick={() => {
                      setErrorMsg(null);
                      setStatusMessage(null);
                    }}
                    className="text-red-600 hover:text-red-800 text-sm font-medium underline"
                  >
                    Try again
                  </button>
                </div>
                <button
                  onClick={() => setErrorMsg(null)}
                  className="text-red-400 hover:text-red-600 ml-4"
                  aria-label="Dismiss error"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Success Display */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700">{success}</p>
            </div>
          )}

          {/* Enhanced Script Editor */}
          <div className="space-y-6">
            {/* Hook Section */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <label htmlFor="hook" className="text-sm font-semibold text-blue-900 flex items-center gap-2">
                  <span className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">1</span>
                  </span>
                  Hook (Attention-grabbing opening)
                </label>
                <div className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                  {hook.length}/200 characters
                </div>
              </div>
              <textarea
                id="hook"
                value={hook}
                onChange={(e) => onHook(e.target.value)}
                placeholder="Enter your hook to grab viewers' attention..."
                className="w-full h-24 px-4 py-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white/80 backdrop-blur-sm"
                maxLength={200}
              />
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-blue-600">
                  💡 Make it compelling and relevant to your audience
                </p>
                <div className={`text-xs font-medium ${
                  hook.length > 180 ? 'text-orange-600' : 
                  hook.length > 150 ? 'text-blue-600' : 'text-blue-500'
                }`}>
                  {200 - hook.length} characters remaining
                </div>
              </div>
            </div>

            {/* Body Section */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl border border-purple-200">
              <div className="flex items-center justify-between mb-3">
                <label htmlFor="body" className="text-sm font-semibold text-purple-900 flex items-center gap-2">
                  <span className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">2</span>
                  </span>
                  Body (Main story or explanation)
                </label>
                <div className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded-full">
                  {body.length}/200 characters
                </div>
              </div>
              <textarea
                id="body"
                value={body}
                onChange={(e) => onBody(e.target.value)}
                placeholder="Enter your main story content..."
                className="w-full h-32 px-4 py-3 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none bg-white/80 backdrop-blur-sm"
                maxLength={200}
              />
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-purple-600">
                  📖 Tell your story clearly and engagingly
                </p>
                <div className={`text-xs font-medium ${
                  body.length > 180 ? 'text-orange-600' : 
                  body.length > 150 ? 'text-purple-600' : 'text-purple-500'
                }`}>
                  {200 - body.length} characters remaining
                </div>
              </div>
            </div>

            {/* CTA Section */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
              <div className="flex items-center justify-between mb-3">
                <label htmlFor="cta" className="text-sm font-semibold text-green-900 flex items-center gap-2">
                  <span className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">3</span>
                  </span>
                  Call to Action (What should viewers do?)
                </label>
                <div className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                  {cta.length}/200 characters
                </div>
              </div>
              <textarea
                id="cta"
                value={cta}
                onChange={(e) => onCta(e.target.value)}
                placeholder="Enter your call to action..."
                className="w-full h-20 px-4 py-3 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none bg-white/80 backdrop-blur-sm"
                maxLength={200}
              />
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-green-600">
                  🎯 Be specific about what you want viewers to do
                </p>
                <div className={`text-xs font-medium ${
                  cta.length > 180 ? 'text-orange-600' : 
                  cta.length > 150 ? 'text-green-600' : 'text-green-500'
                }`}>
                  {200 - cta.length} characters remaining
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Word Count & Progress Indicator */}
          <div className="mt-8 p-6 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Script Progress</h3>
              <div className="text-sm text-gray-600">
                Total: <span className="font-bold text-gray-900">{hook.length + body.length + cta.length}</span> characters
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                <span>Script Length</span>
                <span className="font-medium">
                  {hook.length + body.length + cta.length}/600 characters
                </span>
              </div>
              <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ease-out ${
                    (hook.length + body.length + cta.length) > 500 ? 'bg-red-500' :
                    (hook.length + body.length + cta.length) > 400 ? 'bg-orange-500' :
                    (hook.length + body.length + cta.length) > 200 ? 'bg-green-500' :
                    'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(100, ((hook.length + body.length + cta.length) / 600) * 100)}%` }}
                />
              </div>
            </div>
            
            {/* Length Guidelines */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-green-600 text-lg">✅</span>
                  <span className="font-medium text-gray-900">Optimal Length</span>
                </div>
                <p className="text-sm text-gray-600">
                  {hook.length + body.length + cta.length >= 200 && hook.length + body.length + cta.length <= 400 ? 
                    'Perfect! Your script length is ideal for a 40-second video.' :
                    hook.length + body.length + cta.length < 200 ?
                    'Consider adding more detail to make your story engaging.' :
                    'Your script is quite detailed. Consider condensing for better pacing.'
                  }
                </p>
              </div>
              
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-blue-600 text-lg">📱</span>
                  <span className="font-medium text-gray-900">Video Duration</span>
                </div>
                <p className="text-sm text-gray-600">
                  {hook.length + body.length + cta.length <= 300 ? 'Estimated: 20-30 seconds' :
                   hook.length + body.length + cta.length <= 450 ? 'Estimated: 30-40 seconds' :
                   hook.length + body.length + cta.length <= 600 ? 'Estimated: 40-50 seconds' :
                   'Estimated: 50+ seconds (consider shortening)'}
                </p>
              </div>
            </div>
            
            {/* Warning for long scripts */}
            {(hook.length + body.length + cta.length) > 600 && (
              <div className="mt-4 p-3 bg-orange-100 border border-orange-200 rounded-lg">
                <div className="flex items-center gap-2 text-orange-800">
                  <span className="text-lg">⚠️</span>
                  <span className="text-sm font-medium">
                    Script is quite long. Consider shortening for better viewer engagement and pacing.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Status Message - Aria Live Region */}
          {statusMessage && (
            <div 
              ref={statusMessageRef}
              className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg"
              aria-live="polite"
              aria-atomic="true"
              tabIndex={-1}
            >
              <div className="flex items-center justify-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span className="text-blue-800 font-medium">{statusMessage}</span>
              </div>
            </div>
          )}

          {/* Enhanced Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mt-8">
            <button
              type="button"
              onClick={handleSave}
              disabled={(() => {
                const isEmpty = !hook.trim() && !body.trim() && !cta.trim();
                return isSaving || !dirty || isEmpty;
              })()}
              aria-busy={isSaving}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-center gap-2">
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Saving…</span>
                  </>
                ) : (
                  <>
                    <span className="text-lg">💾</span>
                    <span>Save Script</span>
                  </>
                )}
              </div>
            </button>
            
            <button
              type="button"
              onClick={async () => {
                if (requiresRegeneration) {
                  const confirmed = confirm(
                    '⚠️ Asset Regeneration Confirmation\n\n' +
                    'This will regenerate all assets (images, audio, captions) to match your script changes.\n\n' +
                    '• Process takes 3-5 minutes\n' +
                    '• Existing assets will be replaced\n' +
                    '• You can continue editing while assets regenerate\n\n' +
                    'Do you want to proceed?'
                  );
                  if (confirmed) {
                    await handleSaveAndContinue();
                  }
                } else {
                  await handleSaveAndContinue();
                }
              }}
              disabled={(() => {
                const isEmpty = !hook.trim() && !body.trim() && !cta.trim();
                return isSaving || continuing || isEmpty;
              })()}
              aria-busy={continuing}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-center gap-2">
                {continuing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Please wait...</span>
                  </>
                ) : (
                  <>
                    <span className="text-lg">
                      {requiresRegeneration ? '🔄' : '➡️'}
                    </span>
                    <span>
                      {requiresRegeneration ? 'Save & Regenerate Assets' : 'Save & Continue'}
                    </span>
                  </>
                )}
              </div>
            </button>
          </div>

          {/* Enhanced Status Messages */}
          <div className="mt-6 p-4 bg-gradient-to-r from-slate-50 to-gray-50 rounded-lg border border-gray-200">
            <div className="text-center">
              {(() => {
                const isEmpty = !hook.trim() && !body.trim() && !cta.trim();
                
                if (isEmpty) {
                  return (
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                      <span>Waiting for AI to generate your script…</span>
                    </div>
                  );
                } else if (dirty) {
                  if (requiresRegeneration) {
                    return (
                      <div className="flex items-center justify-center gap-2 text-orange-600">
                        <span className="text-lg">⚠️</span>
                        <span className="font-medium">
                          You have unsaved changes. Clicking "Save & Regenerate Assets" will save them and mark assets for regeneration.
                        </span>
                      </div>
                    );
                  } else {
                    return (
                      <div className="flex items-center justify-center gap-2 text-orange-600">
                        <span className="text-lg">💾</span>
                        <span className="font-medium">
                          You have unsaved changes. Clicking "Save & Continue" will save them first.
                        </span>
                      </div>
                    );
                  }
                } else {
                  if (requiresRegeneration) {
                    return (
                      <div className="flex items-center justify-center gap-2 text-orange-600">
                        <span className="text-lg">🔄</span>
                        <span className="font-medium">
                          Script is saved. Assets need regeneration due to changes.
                        </span>
                      </div>
                    );
                  } else {
                    return (
                      <div className="flex items-center justify-center gap-2 text-green-600">
                        <span className="text-lg">✅</span>
                        <span className="font-medium">
                          Script is saved and ready to continue!
                        </span>
                      </div>
                    );
                  }
                }
              })()}
            </div>
          </div>

          {/* Back Link */}
          <div className="mt-8 text-center">
            <button
              onClick={() => router.push('/create')}
              className="text-gray-600 hover:text-gray-900 text-sm mr-4"
            >
              ← Back to Create
            </button>
            
            {/* Show back to storyboard button if we're coming from storyboard */}
            {status.status === 'storyboard_generated' && (
              <button
                onClick={handleBackToStoryboard}
                className="text-purple-600 hover:text-purple-700 text-sm"
              >
                ← Back to Storyboard
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}