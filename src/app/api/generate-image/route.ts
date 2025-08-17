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

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Generate image with OpenAI DALL-E 3
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: imagePrompt,
        n: 1,
        size: '1024x1792', // Closest to 1080x1920 that DALL-E 3 supports
        quality: 'hd',
        response_format: 'url'
      }),
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (_err) {
        errorData = { error: 'Failed to parse error response' };
      }
      console.error('OpenAI API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to generate image with OpenAI DALL-E 3', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    const imageUrl = data.data?.[0]?.url;
    
    if (!imageUrl) {
      return NextResponse.json(
        { error: 'No image URL received from OpenAI DALL-E 3' },
        { status: 500 }
      );
    }

    // Download the generated image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: `Failed to download image: ${imageResponse.statusText}` },
        { status: imageResponse.status }
      );
    }

    const imageBuffer = await imageResponse.arrayBuffer();

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': Buffer.byteLength(Buffer.from(imageBuffer as ArrayBuffer)).toString(),
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

  return `${basePrompt}. Style: ${selectedStyle}. Key elements: ${keyWords.join(', ')}. High quality, detailed, professional background image suitable for vertical video content (TikTok/Reels format). Optimized for 9:16 aspect ratio.`;
}
