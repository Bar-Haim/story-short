import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      return NextResponse.json({ 
        error: 'OpenAI API key not configured',
        configured: false 
      });
    }

    console.log('🔍 Testing OpenAI API key...');
    console.log('🔍 Key length:', openaiApiKey.length);
    console.log('🔍 Key starts with:', openaiApiKey.substring(0, 10) + '...');

    // Test with a simple request
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('📡 Test response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ OpenAI test failed:', errorData);
      
      return NextResponse.json({
        error: 'OpenAI API test failed',
        status: response.status,
        details: errorData,
        configured: true,
        working: false
      });
    }

    const data = await response.json();
    console.log('✅ OpenAI test successful');

    return NextResponse.json({
      message: 'OpenAI API is working',
      configured: true,
      working: true,
      models: data.data?.length || 0
    });

  } catch (error) {
    console.error('🚨 Test error:', error);
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      configured: !!process.env.OPENAI_API_KEY,
      working: false
    });
  }
} 