import { NextRequest, NextResponse } from 'next/server';
import { sbServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'missing id' }, { status: 400 });
  
  try {
    const supabase = sbServer();
    const { data, error } = await supabase.from('videos').select('*').eq('id', id).maybeSingle();
    
    if (error) {
      console.error('[video-debug] Database error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        videoId: id
      });
      return NextResponse.json({ ok: false, error: error.message }, { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'pragma': 'no-cache',
          'expires': '0'
        }
      });
    }
    
    if (!data) {
      console.log('[video-debug] Video not found:', { videoId: id });
      return NextResponse.json({ ok: false, error: 'Video not found' }, { 
        status: 404,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'pragma': 'no-cache',
          'expires': '0'
        }
      });
    }
    
    return NextResponse.json({ ok: true, data }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'pragma': 'no-cache',
        'expires': '0'
      }
    });
  } catch (e) {
    console.error('[video-debug] Error:', e);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'pragma': 'no-cache',
        'expires': '0'
      }
    });
  }
} 