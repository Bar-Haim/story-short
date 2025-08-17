import { NextResponse } from 'next/server';

interface ApiTestResult {
  name: string;
  status: 'success' | 'error' | 'not_configured';
  message: string;
  details?: Record<string, unknown>;
}

interface TestResponse {
  tests: ApiTestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

export async function GET() {
  const results: TestResponse = {
    tests: [],
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
    },
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
        results.tests.push({
          name: 'OpenRouter API',
          status: 'success',
          message: 'OpenRouter API is working',
          details: {
            models: data.data?.length || 0,
          },
        });
        results.summary.passed++;
      } else {
        results.tests.push({
          name: 'OpenRouter API',
          status: 'error',
          message: `OpenRouter API error: ${response.status} ${response.statusText}`,
        });
        results.summary.failed++;
      }
    } catch (error) {
      results.tests.push({
        name: 'OpenRouter API',
        status: 'error',
        message: `OpenRouter API test failed: ${error}`,
      });
      results.summary.failed++;
    }
  } else {
    results.tests.push({
      name: 'OpenRouter API',
      status: 'not_configured',
      message: 'OPENROUTER_API_KEY not found in environment variables',
    });
    results.summary.total++;
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
        results.tests.push({
          name: 'ElevenLabs API',
          status: 'success',
          message: 'ElevenLabs API is working',
          details: {
            voices: data.voices?.length || 0,
          },
        });
        results.summary.passed++;
      } else {
        results.tests.push({
          name: 'ElevenLabs API',
          status: 'error',
          message: `ElevenLabs API error: ${response.status} ${response.statusText}`,
        });
        results.summary.failed++;
      }
    } catch (error) {
      results.tests.push({
        name: 'ElevenLabs API',
        status: 'error',
        message: `ElevenLabs API test failed: ${error}`,
      });
      results.summary.failed++;
    }
  } else {
    results.tests.push({
      name: 'ElevenLabs API',
      status: 'not_configured',
      message: 'ELEVENLABS_API_KEY not found in environment variables',
    });
    results.summary.total++;
  }

  // Test Supabase
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      console.log('🧪 Testing Supabase connection...');
      const { sbServer } = await import('@/lib/supabase-server');
      const supabase = sbServer();
      
      const { data, error } = await supabase.from('videos').select('count').limit(1);
      
      if (error) {
        results.tests.push({
          name: 'Supabase',
          status: 'error',
          message: `Supabase connection error: ${error.message}`,
        });
        results.summary.failed++;
      } else {
        results.tests.push({
          name: 'Supabase',
          status: 'success',
          message: 'Supabase connection is working',
        });
        results.summary.passed++;
      }
    } catch (error) {
      results.tests.push({
        name: 'Supabase',
        status: 'error',
        message: `Supabase test failed: ${error}`,
      });
      results.summary.failed++;
    }
  } else {
    results.tests.push({
      name: 'Supabase',
      status: 'not_configured',
      message: 'Supabase environment variables not found',
    });
    results.summary.total++;
  }

  return NextResponse.json(results);
} 