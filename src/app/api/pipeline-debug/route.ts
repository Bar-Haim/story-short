import { NextRequest, NextResponse } from 'next/server';
import { sbServer } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  
  if (!id) {
    return NextResponse.json({ 
      ok: false, 
      error: 'missing id parameter' 
    }, { status: 400 });
  }
  
  try {
    const { data, error } = await sbServer()
      .from('videos')
      .select('*, error_message, storyboard_started_at, storyboard_done_at, storyboard_json')
      .eq('id', id)
      .maybeSingle();
      
    if (error || !data) {
      return NextResponse.json({ 
        ok: false, 
        error: error?.message || 'not found' 
      }, { status: 404 });
    }
    
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    console.error('[pipeline-debug] Error:', e);
    return NextResponse.json({ 
      ok: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 