import { NextRequest, NextResponse } from 'next/server';
import { VideoService, sbServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, index } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid video ID' }, { status: 400 });
    }

    if (typeof index !== 'number' || index < 0) {
      return NextResponse.json({ error: 'Missing or invalid scene index' }, { status: 400 });
    }

    console.log('🗑️ Deleting scene for video:', id, 'index:', index);

    // Get current video
    const video = await VideoService.getById(id);
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Verify video has a storyboard
    if (!video.storyboard_json || !video.storyboard_json.scenes) {
      return NextResponse.json({ error: 'No storyboard found' }, { status: 400 });
    }

    const scenes = [...video.storyboard_json.scenes];
    
    // Validate scene index
    if (index >= scenes.length) {
      return NextResponse.json({ error: 'Invalid scene index' }, { status: 400 });
    }

    // Don't allow deleting if only one scene remains
    if (scenes.length <= 1) {
      return NextResponse.json({ error: 'Cannot delete the last remaining scene' }, { status: 400 });
    }

    // Remove the scene
    scenes.splice(index, 1);

    // Update dirty scenes array - remove references to deleted scene and adjust indices
    const currentDirtyScenes = Array.isArray(video.dirty_scenes) ? video.dirty_scenes : [];
    const updatedDirtyScenes = currentDirtyScenes
      .filter((dirtyIndex: number) => dirtyIndex !== index) // Remove the deleted scene index
      .map((dirtyIndex: number) => dirtyIndex > index ? dirtyIndex - 1 : dirtyIndex); // Shift indices down

    // Also need to handle image_urls array if it exists
    let updatedImageUrls = video.image_urls;
    if (Array.isArray(video.image_urls) && video.image_urls.length > index) {
      updatedImageUrls = [...video.image_urls];
      updatedImageUrls.splice(index, 1);
    }

    // Update storyboard
    const updatedStoryboard = {
      ...video.storyboard_json,
      scenes
    };

    const updateData: any = {
      storyboard_json: updatedStoryboard,
      storyboard_version: (video.storyboard_version || 1) + 1,
      dirty_scenes: updatedDirtyScenes
    };

    // Update image_urls if it was modified
    if (updatedImageUrls !== video.image_urls) {
      updateData.image_urls = updatedImageUrls;
    }

    const updateResult = await VideoService.updateVideo(id, updateData);

    if (!updateResult.success) {
      console.error('❌ Failed to delete scene:', updateResult.error);
      return NextResponse.json({ error: 'Failed to delete scene' }, { status: 500 });
    }

    console.log('✅ Scene deleted successfully');
    
    return NextResponse.json({
      success: true,
      storyboard_version: (video.storyboard_version || 1) + 1,
      dirty_scenes: updatedDirtyScenes,
      scenes_count: scenes.length
    });

  } catch (error: any) {
    console.error('❌ Error in PATCH /api/storyboard/delete:', error);
    return NextResponse.json({ 
      error: error?.message || 'Internal server error' 
    }, { status: 500 });
  }
}