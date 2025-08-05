// ✅ /src/app/api/generate-voice/route.ts
import { NextRequest, NextResponse } from 'next/server';

function parseScript(scriptText: string): { hook: string; body: string; cta: string } | null {
  try {
    // Try to parse the script text into sections
    const lines = scriptText.split('\n').filter(line => line.trim());
    
    let hook = '';
    let body = '';
    let cta = '';
    
    for (const line of lines) {
      if (line.startsWith('HOOK:')) {
        hook = line.replace('HOOK:', '').trim();
      } else if (line.startsWith('BODY:')) {
        body = line.replace('BODY:', '').trim();
      } else if (line.startsWith('CTA:')) {
        cta = line.replace('CTA:', '').trim();
      }
    }
    
    if (hook && body && cta) {
      return { hook, body, cta };
    }
    
    // If parsing failed, treat the entire text as body
    return { hook: '', body: scriptText.trim(), cta: '' };
  } catch (error) {
    console.error('Failed to parse script:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { text, voiceId } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid text' }, { status: 400 });
    }

    const selectedVoiceId = voiceId || 'Dslrhjl3ZpzrctukrQSN'; // Default voice

    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsApiKey) {
      return NextResponse.json({ error: 'Missing ElevenLabs API key' }, { status: 500 });
    }

    console.log('🎤 Parsing script for voice generation...');
    const parsedScript = parseScript(text);
    
    if (!parsedScript) {
      return NextResponse.json({ error: 'Failed to parse script' }, { status: 400 });
    }

    const textToRead = `${parsedScript.hook} ${parsedScript.body} ${parsedScript.cta}`.trim();
    console.log('🎤 Text to read:', textToRead);

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsApiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: textToRead,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        }
      })
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (err) {
        errorData = { error: 'Failed to parse error response' };
      }
      console.error('❌ ElevenLabs API error:', errorData);
      
      // Provide specific error messages based on the response
      let errorMessage = 'Failed to generate voice from ElevenLabs';
      if (errorData.status === 'quota_exceeded') {
        errorMessage = 'Insufficient ElevenLabs credits. Please add more credits to your account.';
      } else if (response.status === 401) {
        errorMessage = 'Invalid ElevenLabs API key. Please check your ELEVENLABS_API_KEY.';
      } else if (response.status === 400) {
        errorMessage = `Invalid request: ${errorData.message || 'Check your voice ID and text'}`;
      } else if (errorData.error) {
        errorMessage = errorData.error;
      }
      
      return NextResponse.json(
        { error: errorMessage, details: errorData },
        { status: response.status }
      );
    }

    const audioBuffer = await response.arrayBuffer();
    console.log('✅ Audio generated successfully');

    return new NextResponse(Buffer.from(audioBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg'
      }
    });
  } catch (err) {
    console.error('🚨 Voice generation error:', err);
    return NextResponse.json({ error: 'Server error', details: err }, { status: 500 });
  }
}
