import { NextRequest, NextResponse } from 'next/server';
import { VideoService } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

function summarizeText(text: string, maxLength: number = 500): string {
  if (text.length <= maxLength) return text;
  
  // Try to find a good breaking point
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}

export async function POST(request: NextRequest) {
  try {
    const { userText } = await request.json();
    
    if (!userText || typeof userText !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid userText' }, { status: 400 });
    }

    console.log('📥 Received script generation request');
    
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      return NextResponse.json({ error: 'OpenRouter API key not configured' }, { status: 500 });
    }
    
    if (!openRouterApiKey.startsWith('sk-or-') && !openRouterApiKey.startsWith('sk-proj-')) {
      return NextResponse.json({ error: 'Missing or invalid API key' }, { status: 500 });
    }

    console.log('🔑 OpenRouter API key configured, proceeding with generation');
    console.log('🔍 API Key length:', openRouterApiKey.length);
    console.log('🔍 API Key starts with:', openRouterApiKey.substring(0, 10) + '...');
    console.log('🔍 API Key type check:', openRouterApiKey.startsWith('sk-or-') ? 'OpenRouter format' : 'Project format');

    // Create video record in database
    const createResult = await VideoService.createVideo(userText);
    if (!createResult.success) {
      console.error('❌ Failed to create video record:', createResult.error);
      return NextResponse.json({ error: 'Failed to create video record' }, { status: 500 });
    }

    const videoId = createResult.videoId;
    console.log('✅ Video record created with ID:', videoId);

    // Summarize text if too long
    const summarizedText = summarizeText(userText);
    
    const prompt = `Create a short video script based on this story: "${summarizedText}"

Generate a script with exactly 3 parts, each under 200 characters:
1. HOOK: An attention-grabbing opening
2. BODY: Brief explanation or story
3. CTA: Call-to-action

Format the response exactly like this:
HOOK: [hook text]
BODY: [body text] 
CTA: [cta text]

Keep the total script under 600 characters for a 40-second voiceover.`;

    const payload = {
      model: 'openai/gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.7,
    };

    console.log('🤖 Calling OpenRouter API...');
    console.log('📤 Request payload:', JSON.stringify(payload, null, 2));
    console.log('🔍 Request headers being sent:', {
      'Authorization': `Bearer ${openRouterApiKey.substring(0, 20)}...`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://storyshort.app',
      'X-Title': 'StoryShort - AI Video Generation'
    });
    console.log('🔍 Authorization header value:', `Bearer ${openRouterApiKey.substring(0, 20)}...`);

    const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://storyshort.app',
        'X-Title': 'StoryShort - AI Video Generation',
      },
      body: JSON.stringify(payload),
    });

    console.log('📡 OpenRouter Response status:', openRouterResponse.status);

    if (!openRouterResponse.ok) {
      let errorText = await openRouterResponse.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (err) {
        errorData = { error: 'Failed to parse error response', raw: errorText };
      }
      
      // Update video status to failed
      await VideoService.updateVideo(videoId!, { 
        status: 'failed', 
        error_message: `OpenRouter API error: ${errorData.error || errorText}` 
      });
      
      return NextResponse.json({ 
        error: 'Failed to generate script from OpenRouter', 
        details: errorData, 
        status: openRouterResponse.status 
      }, { status: 500 });
    }

    const openRouterData = await openRouterResponse.json();
    console.log('✅ OpenRouter response received');
    
    const generatedScript = openRouterData.choices[0]?.message?.content?.trim();
    console.log('📝 Generated script:', generatedScript);

    if (!generatedScript) {
      // Update video status to failed
      await VideoService.updateVideo(videoId!, { 
        status: 'failed', 
        error_message: 'No script content received from OpenRouter' 
      });
      
      return NextResponse.json({ error: 'No script content received from OpenRouter' }, { status: 500 });
    }

    // Update video record with generated script
    const updateResult = await VideoService.updateVideo(videoId!, {
      status: 'script_generated',
      script: generatedScript
    });

    if (!updateResult.success) {
      console.error('❌ Failed to update video with script:', updateResult.error);
      return NextResponse.json({ error: 'Failed to save script to database' }, { status: 500 });
    }

    console.log('✅ Script saved to database successfully');

    const responseData = {
      success: true,
      script: generatedScript,
      videoId: videoId
    };

    console.log('📤 Success response data:', responseData);
    return NextResponse.json(responseData);

  } catch (error) {
    console.error('❌ Error in generate-script:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
