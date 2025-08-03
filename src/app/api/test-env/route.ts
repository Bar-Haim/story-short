import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const envInfo = {
    message: 'StoryShort API Environment Test',
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV,
      openaiConfigured: !!process.env.OPENAI_API_KEY,
      elevenLabsConfigured: !!process.env.ELEVENLABS_API_KEY,
      openRouterConfigured: !!process.env.OPENROUTER_API_KEY,
      supabaseUrlConfigured: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseKeyConfigured: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
    apiKeys: {
      openaiLength: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0,
      elevenLabsLength: process.env.ELEVENLABS_API_KEY ? process.env.ELEVENLABS_API_KEY.length : 0,
      openRouterLength: process.env.OPENROUTER_API_KEY ? process.env.OPENROUTER_API_KEY.length : 0,
      supabaseUrlLength: process.env.NEXT_PUBLIC_SUPABASE_URL ? process.env.NEXT_PUBLIC_SUPABASE_URL.length : 0,
      supabaseKeyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length : 0,
    }
  };

  console.log('🔍 Environment test requested:', envInfo);
  
  return NextResponse.json(envInfo);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('📤 Test POST received:', body);
    
    return NextResponse.json({
      message: 'Test POST successful',
      receivedData: body,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Test POST error:', error);
    return NextResponse.json({
      error: 'Failed to parse request body',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 400 });
  }
}
