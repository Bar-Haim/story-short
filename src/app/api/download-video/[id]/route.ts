import { NextRequest, NextResponse } from 'next/server';
import { sbServer } from '@/lib/supabase-server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({ error: 'Missing video ID' }, { status: 400 });
    }

    // Get video info from database
    const supabase = sbServer();
    const { data: video, error: fetchError } = await supabase
      .from('videos')
      .select('final_video_url, total_duration')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    if (!video.final_video_url) {
      return NextResponse.json({ error: 'Video not ready for download' }, { status: 404 });
    }

    // Extract the file path from the public URL
    // The URL format is: https://xxx.supabase.co/storage/v1/object/public/videos/finals/{id}.mp4
    const url = new URL(video.final_video_url);
    const pathParts = url.pathname.split('/');
    const bucket = pathParts[pathParts.indexOf('public') + 1];
    const filePath = pathParts.slice(pathParts.indexOf('public') + 2).join('/');

    if (!bucket || !filePath) {
      return NextResponse.json({ error: 'Invalid video URL format' }, { status: 500 });
    }

    // Download the file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(filePath);

    if (downloadError || !fileData) {
      console.error('Failed to download video file:', downloadError);
      return NextResponse.json({ error: 'Failed to download video file' }, { status: 500 });
    }

    // Convert Blob to Buffer for proper handling
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate filename
    const filename = `storyshort-video-${id}.mp4`;

    // Return the file with proper headers for download
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('Download video error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
} 