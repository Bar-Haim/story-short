import { NextRequest, NextResponse } from 'next/server';
import { VideoService, sbServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, order } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid video ID' }, { status: 400 });
    }

    if (!Array.isArray(order) || order.some(idx => typeof idx !== 'number' || idx < 0)) {
      return NextResponse.json({ error: 'Invalid order array' }, { status: 400 });
    }

    console.log('🔄 Reordering scenes for video:', id);
    console.log('🔄 New order:', order);

    // Get current video
    const video = await VideoService.getById(id);
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Verify video has a storyboard
    if (!video.storyboard_json || !video.storyboard_json.scenes) {
      return NextResponse.json({ error: 'No storyboard found' }, { status: 400 });
    }

    const currentScenes = video.storyboard_json.scenes;
    
    // Validate order array matches scene count
    if (order.length !== currentScenes.length) {
      return NextResponse.json({ 
        error: `Order array length (${order.length}) doesn't match scene count (${currentScenes.length})` 
      }, { status: 400 });
    }

    // Validate all indices are valid
    const maxIndex = currentScenes.length - 1;
    if (order.some(idx => idx > maxIndex)) {
      return NextResponse.json({ error: 'Invalid scene indices in order' }, { status: 400 });
    }

    // Validate no duplicate indices
    const uniqueOrder = [...new Set(order)];
    if (uniqueOrder.length !== order.length) {
      return NextResponse.json({ error: 'Duplicate indices in order' }, { status: 400 });
    }

    // Reorder scenes
    const reorderedScenes = order.map(index => currentScenes[index]);

    // Update storyboard with new order and increment version
    const updatedStoryboard = {
      ...video.storyboard_json,
      scenes: reorderedScenes
    };

    const updateResult = await VideoService.updateVideo(id, {
      storyboard_json: updatedStoryboard,
      storyboard_version: (video.storyboard_version || 1) + 1
    });

    if (!updateResult.success) {
      console.error('❌ Failed to reorder scenes:', updateResult.error);
      return NextResponse.json({ error: 'Failed to reorder scenes' }, { status: 500 });
    }

    console.log('✅ Scenes reordered successfully');
    
    return NextResponse.json({
      success: true,
      storyboard_version: (video.storyboard_version || 1) + 1
    });

  } catch (error: any) {
    console.error('❌ Error in PATCH /api/storyboard/reorder:', error);
    return NextResponse.json({ 
      error: error?.message || 'Internal server error' 
    }, { status: 500 });
  }
}