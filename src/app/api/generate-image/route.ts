import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { text, style = 'cinematic', sceneType = 'background' } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required and must be a string' },
        { status: 400 }
      );
    }

    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured' },
        { status: 500 }
      );
    }

    const imagePrompt = createImagePrompt(text, style, sceneType);

    const response = await fetch('https://openrouter.ai/api/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://storyshort.app',
        'X-Title': 'StoryShort - AI Video Generation',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: imagePrompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        response_format: 'b64_json',
      }),
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (err) {
        errorData = { error: 'Failed to parse error response' };
      }
      console.error('OpenRouter API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to generate image from OpenRouter', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    if (!data.data?.[0]?.b64_json) {
      return NextResponse.json(
        { error: 'Invalid response from image generation API' },
        { status: 500 }
      );
    }

    const imageBuffer = Buffer.from(data.data[0].b64_json, 'base64');

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': imageBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error generating image:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function createImagePrompt(scriptText: string, style: string, sceneType: string): string {
  const words = scriptText.toLowerCase().split(' ');
  const keyWords = words.filter(word =>
    word.length > 3 &&
    !['the', 'and', 'but', 'for', 'with', 'this', 'that', 'they', 'have', 'will', 'from', 'your', 'into', 'time', 'more', 'some', 'could', 'them', 'other', 'than', 'then', 'their', 'first', 'been', 'call', 'who', 'its', 'now', 'find', 'down', 'day', 'did', 'get', 'come', 'made', 'may', 'part'].includes(word)
  ).slice(0, 10);

  const basePrompt = `Create a cinematic ${sceneType} image that represents: "${scriptText.substring(0, 200)}..."`;

  const stylePrompts = {
    cinematic: 'cinematic lighting, dramatic atmosphere, professional photography',
    modern: 'clean, modern design, minimalist, contemporary',
    fantasy: 'magical, ethereal, dreamlike, fantasy elements',
    dramatic: 'high contrast, dramatic shadows, intense mood',
    peaceful: 'soft lighting, calm atmosphere, serene environment',
    adventurous: 'dynamic composition, action-oriented, exciting',
    mysterious: 'mysterious atmosphere, subtle lighting, intriguing',
    vibrant: 'bright colors, energetic, lively atmosphere'
  };

  const selectedStyle = stylePrompts[style as keyof typeof stylePrompts] || stylePrompts.cinematic;

  return `${basePrompt}. Style: ${selectedStyle}. Key elements: ${keyWords.join(', ')}. High quality, detailed, professional background image suitable for video content.`;
}
