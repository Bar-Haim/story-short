import { NextRequest, NextResponse } from 'next/server';
import { VideoService } from '@/lib/supabase-server';

// Force Node.js runtime (not Edge) to avoid fetch/env issues
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, script_text } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid video ID' }, { status: 400 });
    }

    if (!script_text || typeof script_text !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid script_text' }, { status: 400 });
    }

    console.log('📝 Updating script for video:', id);
    console.log('📝 Script text length:', script_text.length);

    // Get current video to verify it exists and is in correct state
    const video = await VideoService.getById(id);
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Verify video is in a state where script can be updated
    // Allow editing in storyboard_generated status to enable navigation back
    const allowedStatuses = ['created', 'script_generated', 'script_approved', 'storyboard_generated'];
    if (!allowedStatuses.includes(video.status)) {
      return NextResponse.json({ 
        error: `Cannot update script in status: ${video.status}` 
      }, { status: 409 });
    }

    // Check if this is a script change that requires asset regeneration
    const isScriptChange = video.script_text !== script_text || video.script !== script_text;
    const requiresRegeneration = isScriptChange && (video.status === 'storyboard_generated' || video.status === 'assets_generated');

    // Prepare update payload
    const updatePayload: any = {
      script_text,
      error_message: null,
    };

    // If this is a script change after storyboard generation, we need to:
    // 1. Mark all scenes as dirty (need image regeneration)
    // 2. Clear existing assets that depend on the old script
    // 3. Set status back to script_approved to allow re-generation
    if (requiresRegeneration) {
      console.log('📝 Script changed after storyboard generation - marking assets for regeneration');
      
      // Get total scenes to mark all as dirty
      const storyboard = video.storyboard_json || video.storyboard;
      const totalScenes = Array.isArray(storyboard?.scenes) ? storyboard.scenes.length : 0;
      
      updatePayload.status = 'script_approved';
      updatePayload.dirty_scenes = Array.from({ length: totalScenes }, (_, i) => i);
      
      // Clear dependent assets that need regeneration
      updatePayload.audio_url = null;
      updatePayload.captions_url = null;
      
      console.log(`📝 Marked ${totalScenes} scenes as dirty for regeneration`);
    } else if (video.status === 'created' || video.status === 'script_generated') {
      // Normal flow - just approve the script
      updatePayload.status = 'script_approved';
    }
    // If status is already script_approved, just update script_text

    // Try to write script_text, fall back to legacy "script" if the column is missing
    let updateResult;
    try {
      updateResult = await VideoService.updateVideo(id, updatePayload);
    } catch (e: any) {
      const msg = String(e?.message || e);
      console.log('⚠️ Primary update failed, attempting fallback. Error:', msg);
      if (msg.includes(`script_text`) || msg.includes('schema cache') || msg.includes('column') || msg.includes('does not exist')) {
        console.log('⚠️ script_text column not found, falling back to legacy script column');
        // Fallback path: write into legacy `script`
        try {
          const fallbackPayload = { ...updatePayload, script: script_text }; // legacy column
          updateResult = await VideoService.updateVideo(id, fallbackPayload);
          console.log('✅ Script saved to legacy column successfully');
        } catch (fallbackError: any) {
          console.error('❌ Fallback also failed:', fallbackError);
          return NextResponse.json({ error: `Primary save failed: ${msg}. Fallback failed: ${fallbackError.message}` }, { status: 500 });
        }
      } else {
        console.error('❌ Failed to update script:', msg);
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    if (!updateResult.success) {
      console.error('❌ Failed to update script:', updateResult.error);
      return NextResponse.json({ error: 'Failed to update script' }, { status: 500 });
    }

    console.log('✅ Script updated successfully');
    
    // Return response with regeneration info if applicable
    const response: any = {
      ok: true,
      status: updatePayload.status || 'script_approved'
    };
    
    if (requiresRegeneration) {
      response.requiresRegeneration = true;
      response.message = 'Script updated. Dependent assets (images, audio, captions) will need to be regenerated.';
    }
    
    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ Error in PATCH /api/script:', error);
    return NextResponse.json({ 
      error: error?.message || 'Internal server error' 
    }, { status: 500 });
  }
}