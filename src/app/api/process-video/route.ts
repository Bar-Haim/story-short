import { NextRequest, NextResponse } from 'next/server';
import { VideoService, sbServer } from '@/lib/supabase-server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    // Try to get videoId from query params first, then from body
    const { searchParams } = new URL(request.url);
    let videoId = searchParams.get('id');
    
    if (!videoId) {
      // Try to get from request body
      try {
        const body = await request.json();
        videoId = body.id;
      } catch (e) {
        // Ignore body parsing errors
      }
    }

    if (!videoId) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }

    console.log('🎬 Processing video request for ID:', videoId);

    // Check if video exists and get current status
    const result = await VideoService.getVideo(videoId);
    if (!result.success || !result.video) {
      return NextResponse.json({ success: false, error: 'Video not found' }, { status: 404 });
    }
    const video = result.video;

    // Only process if status indicates it needs processing
    const needsProcessing = ['script_generated', 'assets_missing', 'failed'].includes(video.status);
    
    if (!needsProcessing) {
      console.log('ℹ️ Video does not need processing, current status:', video.status);
      return NextResponse.json({ 
        success: true, 
        message: 'Video does not need processing',
        status: video.status 
      });
    }

    // Spawn background processing job
    try {
      const processScriptPath = path.join(process.cwd(), 'scripts', 'process-video.cjs');
      const child = spawn('node', [processScriptPath, videoId], { 
        detached: true, 
        stdio: 'ignore' 
      });
      child.unref();
      
      console.log('🚀 Background processing started for video:', videoId);
      
      return NextResponse.json({ 
        success: true, 
        message: 'Background processing started',
        videoId: videoId 
      });
      
    } catch (spawnError) {
      console.error('❌ Failed to start background processing:', spawnError);
      return NextResponse.json({ 
        error: 'Failed to start background processing',
        details: spawnError instanceof Error ? spawnError.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Error in process-video API:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 