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
    const { text } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid text' }, { status: 400 });
    }

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

    const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/Dslrhjl3ZpzrctukrQSN', {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsApiKey,
        'Content-Type': 'application/json'
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
      return NextResponse.json(
        { error: 'Failed to generate voice from ElevenLabs', details: errorData },
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
