export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { sbServer } from '@/lib/supabase-server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(req: Request) {
  const t0 = Date.now();
  
  try {
    const body = await req.json();
    const { id } = body;
    
    if (!id) {
      return NextResponse.json(
        { error: 'missing id' }, 
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const supabase = sbServer();

    // Get video data to verify it's ready for finalization
    const { data: videoData, error: fetchError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('[finalize] Database error:', fetchError);
      return NextResponse.json(
        { error: 'db_error', code: fetchError.code }, 
        { status: 502, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (!videoData) {
      return NextResponse.json(
        { error: 'video_not_found' }, 
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Check if video is ready for rendering
    const progress = videoData.progress ? 
      (typeof videoData.progress === 'string' ? JSON.parse(videoData.progress) : videoData.progress) 
      : null;

    if (!progress || progress.imagesDone !== progress.imagesTotal || progress.imagesTotal === 0) {
      return NextResponse.json(
        { error: 'assets_not_ready', message: 'All assets must be generated before finalizing' }, 
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Check required assets
    if (!videoData.audio_url || !videoData.captions_url || !videoData.image_urls || videoData.image_urls.length === 0) {
      return NextResponse.json(
        { error: 'missing_assets', message: 'Audio, captions, and images must be available' }, 
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Update status to rendering with pipeline timestamp
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('videos')
      .update({ 
        status: 'rendering',
        render_started_at: now,
        updated_at: now
      })
      .eq('id', id);

    if (updateError) {
      console.error('[finalize] Failed to update status:', updateError);
      return NextResponse.json(
        { error: 'update_failed' }, 
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Start video rendering in background process
    try {
      console.log('[finalize] Starting video rendering process for video:', id);
      
      // Use the existing render-video route for actual rendering
      // We'll spawn a background process to call the render-video API
      const renderScriptPath = path.join(process.cwd(), 'scripts', 'background-render.js');
      
      // Create a simple background script to call render-video API
      const backgroundScript = `
const fetch = require('node-fetch');

async function renderVideo() {
  try {
    console.log('[background-render] Starting render for video: ${id}');
    
    const response = await fetch('${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:4000'}/api/render-video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ videoId: '${id}' })
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('[background-render] Video rendered successfully');
    } else {
      console.error('[background-render] Render failed:', result.error);
    }
  } catch (error) {
    console.error('[background-render] Error during rendering:', error);
  }
}

renderVideo();
`;

      // For now, we'll trigger the render directly instead of spawning a process
      // This is simpler and more reliable for development
      console.log('[finalize] Triggering render-video API directly');
      
      // Call render-video API in the background (fire and forget)
      setTimeout(async () => {
        try {
          const renderResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:4000'}/api/render-video`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ videoId: id })
          });
          
          const renderResult = await renderResponse.json();
          
          if (renderResponse.ok && renderResult.success) {
            console.log('[finalize] Background render completed successfully');
          } else {
            console.error('[finalize] Background render failed:', renderResult.error);
            
            // Update status to failed if render failed
            await supabase
              .from('videos')
              .update({ 
                status: 'failed',
                error_message: renderResult.error || 'Rendering failed',
                updated_at: new Date().toISOString()
              })
              .eq('id', id);
          }
        } catch (error) {
          console.error('[finalize] Background render error:', error);
          
          // Update status to failed if render errored
          await supabase
            .from('videos')
            .update({ 
              status: 'failed',
              error_message: error.message || 'Rendering error',
              updated_at: new Date().toISOString()
            })
            .eq('id', id);
        }
      }, 1000); // Start after 1 second
      
    } catch (error) {
      console.error('[finalize] Failed to start rendering process:', error);
      
      // Revert status back to assets_generated
      await supabase
        .from('videos')
        .update({ 
          status: 'assets_generated',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      
      return NextResponse.json(
        { error: 'render_start_failed', message: 'Failed to start rendering process' }, 
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    console.log('[finalize] Successfully started rendering process', { id, ms: Date.now() - t0 });
    
    return NextResponse.json(
      { 
        success: true, 
        message: 'Video rendering started',
        status: 'rendering'
      }, 
      { headers: { 'Cache-Control': 'no-store' } }
    );

  } catch (e: any) {
    console.error('[finalize] Fatal error:', { id: req.url, err: e?.message, stack: e?.stack });
    return NextResponse.json(
      { error: 'internal_error' }, 
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}