export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { sbServer } from '@/lib/supabase-server';

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'Rendering error';
  }
}

export async function POST(req: Request) {
  const t0 = Date.now();

  try {
    const body = await req.json();
    const { id } = body as { id?: string };

    if (!id) {
      return NextResponse.json(
        { error: 'missing id' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
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
        { error: 'db_error', code: (fetchError as { code?: string })?.code },
        { status: 502, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (!videoData) {
      return NextResponse.json(
        { error: 'video_not_found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // Check if video is ready for rendering
    let progress: unknown = videoData.progress ?? null;
    if (typeof progress === 'string') {
      try {
        progress = JSON.parse(progress);
      } catch {
        progress = null;
      }
    }

    const imagesDone =
      progress && typeof progress === 'object' && 'imagesDone' in progress
        ? (progress as { imagesDone?: number }).imagesDone ?? 0
        : 0;
    const imagesTotal =
      progress && typeof progress === 'object' && 'imagesTotal' in progress
        ? (progress as { imagesTotal?: number }).imagesTotal ?? 0
        : 0;

    if (!progress || imagesDone !== imagesTotal || imagesTotal === 0) {
      return NextResponse.json(
        {
          error: 'assets_not_ready',
          message: 'All assets must be generated before finalizing',
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // Check required assets
    if (
      !videoData.audio_url ||
      !videoData.captions_url ||
      !videoData.image_urls ||
      videoData.image_urls.length === 0
    ) {
      return NextResponse.json(
        {
          error: 'missing_assets',
          message: 'Audio, captions, and images must be available',
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // Update status to rendering with pipeline timestamp
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('videos')
      .update({
        status: 'rendering',
        render_started_at: now,
        updated_at: now,
      })
      .eq('id', id);

    if (updateError) {
      console.error('[finalize] Failed to update status:', updateError);
      return NextResponse.json(
        { error: 'update_failed' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // Start video rendering (fire-and-forget)
    try {
      console.log('[finalize] Triggering render-video API directly');

      setTimeout(async () => {
        try {
          const baseUrl =
            process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:4000';
          const renderResponse = await fetch(`${baseUrl}/api/render-video`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoId: id }),
          });

          const renderResult = (await renderResponse.json()) as {
            success?: boolean;
            error?: unknown;
          };

          if (renderResponse.ok && renderResult?.success) {
            console.log('[finalize] Background render completed successfully');
          } else {
            const msg = getErrorMessage(renderResult?.error);
            console.error('[finalize] Background render failed:', msg);

            await supabase
              .from('videos')
              .update({
                status: 'failed',
                error_message: msg || 'Rendering failed',
                updated_at: new Date().toISOString(),
              })
              .eq('id', id);
          }
        } catch (err: unknown) {
          const msg = getErrorMessage(err);
          console.error('[finalize] Background render error:', msg);

          await supabase
            .from('videos')
            .update({
              status: 'failed',
              error_message: msg || 'Rendering error',
              updated_at: new Date().toISOString(),
            })
            .eq('id', id);
        }
      }, 1000);
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      console.error('[finalize] Failed to start rendering process:', msg);

      // Revert status back to assets_generated
      await supabase
        .from('videos')
        .update({
          status: 'assets_generated',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      return NextResponse.json(
        {
          error: 'render_start_failed',
          message: 'Failed to start rendering process',
        },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    console.log('[finalize] Successfully started rendering process', {
      id,
      ms: Date.now() - t0,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Video rendering started',
        status: 'rendering',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e: unknown) {
    const msg = getErrorMessage(e);
    console.error('[finalize] Fatal error:', { url: req.url, err: msg });
    return NextResponse.json(
      { error: 'internal_error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
