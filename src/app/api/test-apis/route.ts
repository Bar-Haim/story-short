import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const results = {
    timestamp: new Date().toISOString(),
    environment: {
      openRouterConfigured: !!process.env.OPENROUTER_API_KEY,
      elevenLabsConfigured: !!process.env.ELEVENLABS_API_KEY,
      supabaseConfigured: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    },
    apiTests: {
      openRouter: null as any,
      elevenLabs: null as any,
      supabase: null as any,
    }
  };

  // Test OpenRouter API (for script and image generation)
  if (process.env.OPENROUTER_API_KEY) {
    try {
      console.log('🧪 Testing OpenRouter API...');
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        results.apiTests.openRouter = {
          status: 'success',
          message: 'OpenRouter API is working',
          models: data.data?.length || 0,
        };
      } else {
        results.apiTests.openRouter = {
          status: 'error',
          message: `OpenRouter API error: ${response.status} ${response.statusText}`,
        };
      }
    } catch (error) {
      results.apiTests.openRouter = {
        status: 'error',
        message: `OpenRouter API test failed: ${error}`,
      };
    }
  } else {
    results.apiTests.openRouter = {
      status: 'not_configured',
      message: 'OPENROUTER_API_KEY not found in environment variables',
    };
  }

  // Test ElevenLabs API
  if (process.env.ELEVENLABS_API_KEY) {
    try {
      console.log('🧪 Testing ElevenLabs API...');
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        results.apiTests.elevenLabs = {
          status: 'success',
          message: 'ElevenLabs API is working',
          voices: data.voices?.length || 0,
        };
      } else {
        results.apiTests.elevenLabs = {
          status: 'error',
          message: `ElevenLabs API error: ${response.status} ${response.statusText}`,
        };
      }
    } catch (error) {
      results.apiTests.elevenLabs = {
        status: 'error',
        message: `ElevenLabs API test failed: ${error}`,
      };
    }
  } else {
    results.apiTests.elevenLabs = {
      status: 'not_configured',
      message: 'ELEVENLABS_API_KEY not found in environment variables',
    };
  }

  // Test Supabase
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      console.log('🧪 Testing Supabase connection...');
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      const { data, error } = await supabase.from('videos').select('count').limit(1);
      
      if (error) {
        results.apiTests.supabase = {
          status: 'error',
          message: `Supabase connection error: ${error.message}`,
        };
      } else {
        results.apiTests.supabase = {
          status: 'success',
          message: 'Supabase connection is working',
        };
      }
    } catch (error) {
      results.apiTests.supabase = {
        status: 'error',
        message: `Supabase test failed: ${error}`,
      };
    }
  } else {
    results.apiTests.supabase = {
      status: 'not_configured',
      message: 'Supabase environment variables not found',
    };
  }

  return NextResponse.json(results);
} 