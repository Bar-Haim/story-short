import { NextRequest, NextResponse } from 'next/server';
import { VideoService, sbServer } from '@/lib/supabase-server';

// Safe JSON parsing helper
function parseJsonSafe(text: string) {
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error('Failed to parse JSON:', e);
    return null;
  }
}

// Function to get OpenRouter API configuration
function getOpenRouterConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OpenRouter API key not configured');
  }
  return { apiKey };
}

// Function to generate storyboard using OpenRouter API
async function generateStoryboard(script: string) {
  const { apiKey } = getOpenRouterConfig();
  
  const prompt = `Create a detailed video storyboard from this script. Return a JSON object with a "scenes" array. Each scene should have: scene_number, description, duration (in seconds), and image_prompt (detailed visual description for DALL-E). Aim for 5-8 scenes total.

Script:
${script}

Return only valid JSON, no additional text.`;

  console.log('🤖 Calling OpenRouter API...');
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:4000',
      'X-Title': 'StoryShort Video Generator'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error('No content received from OpenRouter API');
  }

  console.log('✅ OpenRouter API response received');
  return content;
}

export async function POST(request: NextRequest) {
  let videoId: string | undefined;
  const supabase = sbServer();
  
  try {
    const body = await request.json();
    videoId = body?.videoId;
    
    if (!videoId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Missing videoId' 
      }, { status: 400 });
    }

    console.log('[storyboard] START', { videoId });

    // Immediately mark storyboard as started (keep current status)
    try {
      await supabase
        .from('videos')
        .update({ 
          storyboard_started_at: new Date().toISOString()
          // Do NOT change status here - keep it as script_generated
        })
        .eq('id', videoId);
    } catch (dbErr) {
      console.warn('[storyboard] Failed to set started timestamp:', dbErr);
    }

    // Get video data
    const video = await VideoService.getById(videoId);
    if (!video) {
      throw new Error('Video not found');
    }

    // Check preconditions for wizard workflow
    const allowedStatuses = ['script_generated', 'script_approved'];
    if (!allowedStatuses.includes(video.status)) {
      throw new Error(`Cannot generate storyboard in status: ${video.status}`);
    }

    // Use script_text if available, fall back to script for backwards compatibility
    const scriptToUse = video.script_text || video.script;
    if (!scriptToUse) {
      throw new Error('No script found for video');
    }

    console.log('[storyboard] Generating storyboard for script length:', scriptToUse.length);

    // Generate storyboard using LLM
    const storyboardContent = await generateStoryboard(scriptToUse);
    console.log('[storyboard] LLM OK');

    // Parse and validate the storyboard
    const storyboard = parseJsonSafe(storyboardContent);
    if (!storyboard || !Array.isArray(storyboard.scenes)) {
      throw new Error('Invalid storyboard format received from LLM');
    }

    // Validate scenes
    if (storyboard.scenes.length === 0) {
      throw new Error('No scenes generated');
    }

    for (let i = 0; i < storyboard.scenes.length; i++) {
      const scene = storyboard.scenes[i];
      if (!scene.description || !scene.image_prompt) {
        throw new Error(`Scene ${i + 1} missing required fields`);
      }
    }

    console.log('[storyboard] saving to DB…');

    // Save storyboard as JSONB object (not string) and initialize wizard-specific fields
    await supabase
      .from('videos')
      .update({
        storyboard_json: storyboard, // Save as object, not JSON.stringify
        status: 'storyboard_generated',
        storyboard_version: 1, // Initialize version counter
        dirty_scenes: [], // Initialize dirty scenes array
        error_message: null // Clear any previous errors
      })
      .eq('id', videoId);

    // DO NOT auto-trigger assets in wizard workflow - wait for user approval

    return NextResponse.json({
      ok: true,
      videoId,
      status: 'storyboard_generated',
      scenes: storyboard.scenes.length
    });

  } catch (err: any) {
    const errorMessage = `[storyboard] ${err instanceof Error ? err.message : String(err)}`;
    console.error('[storyboard] ERROR', err);

    if (videoId) {
      try {
        await supabase
          .from('videos')
          .update({
            status: 'assets_failed', // Use assets_failed as specified
            error_message: errorMessage
          })
          .eq('id', videoId);
      } catch (dbErr) {
        console.error('[storyboard] Failed to update error status:', dbErr);
      }
    }

    return NextResponse.json({
      ok: false,
      error: errorMessage
    }, { status: 500 });

  } finally {
    console.log('[storyboard] DONE/EXIT', { videoId });
  }
}