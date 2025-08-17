import { NextRequest, NextResponse } from 'next/server';
import { VideoService, sbServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, index, text, image_prompt } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid video ID' }, { status: 400 });
    }

    if (typeof index !== 'number' || index < 0) {
      return NextResponse.json({ error: 'Missing or invalid scene index' }, { status: 400 });
    }

    console.log('✏️ Editing scene for video:', id, 'index:', index);

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

    const currentScene = scenes[index];
    let needsImageRegen = false;

    // Update scene properties if provided
    if (text !== undefined) {
      scenes[index] = { ...currentScene, description: text };
    }
    
    if (image_prompt !== undefined) {
      scenes[index] = { ...scenes[index], image_prompt };
      // If image prompt changed, mark this scene as dirty for re-generation
      needsImageRegen = image_prompt !== currentScene.image_prompt;
    }

    // Update dirty scenes array if image needs regeneration
    const currentDirtyScenes = Array.isArray(video.dirty_scenes) ? video.dirty_scenes : [];
    let updatedDirtyScenes = [...currentDirtyScenes];
    
    if (needsImageRegen && !updatedDirtyScenes.includes(index)) {
      updatedDirtyScenes.push(index);
    }

    // Update storyboard and dirty scenes
    const updatedStoryboard = {
      ...video.storyboard_json,
      scenes
    };

    const updateData: any = {
      storyboard_json: updatedStoryboard,
      storyboard_version: (video.storyboard_version || 1) + 1,
      dirty_scenes: updatedDirtyScenes
    };

    const updateResult = await VideoService.updateVideo(id, updateData);

    if (!updateResult.success) {
      console.error('❌ Failed to update scene:', updateResult.error);
      return NextResponse.json({ error: 'Failed to update scene' }, { status: 500 });
    }

    console.log('✅ Scene updated successfully');
    
    return NextResponse.json({
      success: true,
      storyboard_version: (video.storyboard_version || 1) + 1,
      dirty_scenes: updatedDirtyScenes,
      needs_image_regen: needsImageRegen
    });

  } catch (error: any) {
    console.error('❌ Error in PATCH /api/storyboard/scene:', error);
    return NextResponse.json({ 
      error: error?.message || 'Internal server error' 
    }, { status: 500 });
  }
}