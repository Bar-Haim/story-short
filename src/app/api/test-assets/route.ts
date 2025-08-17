import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Test environment variables
    const openRouterApiKey = process.env.OPENAI_API_KEY;
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    
    return NextResponse.json({
      message: 'Asset generation test',
      environment: {
        openRouterConfigured: !!openRouterApiKey,
        elevenLabsConfigured: !!elevenLabsApiKey,
        openRouterKeyLength: openRouterApiKey?.length || 0,
        elevenLabsKeyLength: elevenLabsApiKey?.length || 0,
      },
      status: 'ready'
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 