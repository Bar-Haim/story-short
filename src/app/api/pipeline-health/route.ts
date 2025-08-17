import { NextResponse } from 'next/server';
import { sbServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ ok:false, error:'missing id' }, { status:400 });
  
  const { data, error } = await sbServer().from('videos').select('*').eq('id', id).maybeSingle();
  
  if (error) {
    console.error('[pipeline-health] Database error:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      videoId: id
    });
    return NextResponse.json({ ok:false, error: error.message }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'pragma': 'no-cache',
        'expires': '0'
      }
    });
  }
  
  if (!data) {
    console.log('[pipeline-health] Video not found:', { videoId: id });
    return NextResponse.json({ ok:false, error: 'Video not found' }, { 
      status: 404,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'pragma': 'no-cache',
        'expires': '0'
      }
    });
  }

  // Calculate accurate progress based on scenes count
  const scenesCount = Array.isArray(data.storyboard_json?.scenes) ? data.storyboard_json.scenes.length : 0;
  const imageCount = Array.isArray(data.image_urls) ? data.image_urls.length : 0;
  const cappedImageCount = Math.min(imageCount, scenesCount);
  const accurateProgress = scenesCount ? Math.round((cappedImageCount / scenesCount) * 100) : 0;

  // summarize key signals
  const summary = {
    id: data.id,
    status: data.status,
    hasStoryboard: !!data.storyboard_json,
    scenes: scenesCount,
    started: {
      script: data.script_started_at || null,
      storyboard: data.storyboard_started_at || null,
      assets: data.assets_started_at || null,
      render: data.render_started_at || null,
    },
    done: {
      script: data.script_done_at || null,
      storyboard: data.storyboard_done_at || null,
      assets: data.assets_done_at || null,
      render: data.render_done_at || null,
    },
    error_message: data.error_message || null,
    image_progress: accurateProgress,
    images_count: cappedImageCount,
    final_video_url: data.final_video_url || null,
  };

  return NextResponse.json({ ok:true, summary, raw:data }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'pragma': 'no-cache',
      'expires': '0'
    }
  });
}