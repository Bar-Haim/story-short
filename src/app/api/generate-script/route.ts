import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function summarizeText(text: string, maxLength: number = 500): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export async function POST(request: NextRequest) {
  try {
    console.log('📥 Received script generation request');

    const { userText } = await request.json();
    if (!userText || typeof userText !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid userText' }, { status: 400 });
    }

    const openRouterApiKey = process.env.OPENAI_API_KEY; // Using the same env var but for OpenRouter
    if (!openRouterApiKey) {
      return NextResponse.json({ error: 'OpenRouter API key not configured' }, { status: 500 });
    }

    console.log('🔑 OpenRouter API key configured, proceeding with generation');
    console.log('🔍 API Key length:', openRouterApiKey.length);
    console.log('🔍 API Key starts with:', openRouterApiKey.substring(0, 10) + '...');

    // Create record in Supabase (optional)
    let videoData = null;
    try {
      const { data, error: insertError } = await supabase
        .from('videos')
        .insert({
          status: 'pending',
          input_text: userText,
          script: null
        })
        .select()
        .single();

      if (!insertError) {
        videoData = data;
        console.log('✅ Video record created with ID:', videoData.id);
      }
    } catch (err) {
      console.warn('⚠️ Supabase not available:', err);
    }

    const prompt = `Create a short video script based on this story: "${summarizeText(userText)}"

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
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.7,
    };

    console.log('🤖 Calling OpenRouter API...');
    console.log('📤 Request payload:', JSON.stringify(payload, null, 2));

    const openaiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('📡 OpenRouter Response status:', openaiResponse.status);

    if (!openaiResponse.ok) {
      let errorData;
      try {
        errorData = await openaiResponse.json();
      } catch (err) {
        errorData = { error: 'Failed to parse error response' };
      }
      
      console.error('❌ OpenRouter API error:', {
        status: openaiResponse.status,
        statusText: openaiResponse.statusText,
        error: errorData,
        headers: Object.fromEntries(openaiResponse.headers.entries())
      });

      if (videoData) {
        try {
          await supabase.from('videos').update({ status: 'failed' }).eq('id', videoData.id);
        } catch (updateError) {
          console.error('❌ Failed to update video status to failed:', updateError);
        }
      }

      return NextResponse.json({
        error: 'Failed to generate script from OpenRouter',
        details: errorData,
        status: openaiResponse.status
      }, { status: 500 });
    }

    const openaiData = await openaiResponse.json();
    console.log('✅ OpenRouter response received');

    if (!openaiData.choices || !openaiData.choices[0] || !openaiData.choices[0].message) {
      console.error('❌ Invalid OpenRouter response structure:', openaiData);
      return NextResponse.json({ error: 'Invalid response from OpenRouter' }, { status: 500 });
    }

    const generatedScript = openaiData.choices[0].message.content.trim();
    console.log('📝 Generated script:', generatedScript);

    // Update video record with generated script (if DB is available)
    if (videoData) {
      try {
        const { error: updateError } = await supabase
          .from('videos')
          .update({
            status: 'script_generated',
            script: generatedScript
          })
          .eq('id', videoData.id);

        if (updateError) {
          console.error('❌ Failed to update video with script:', updateError);
        } else {
          console.log('✅ Script saved to database successfully');
        }
      } catch (updateError) {
        console.error('❌ Failed to update video with script:', updateError);
      }
    }

    const response = {
      success: true,
      script: generatedScript,
      videoId: videoData?.id || null
    };

    console.log('📤 Success response data:', JSON.stringify(response, null, 2));
    return NextResponse.json(response);

  } catch (error) {
    console.error('🚨 Unexpected error in script generation:', error);
    return NextResponse.json({
      error: 'Server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
