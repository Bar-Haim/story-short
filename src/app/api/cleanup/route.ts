import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function cleanupTempDirectory(videoId: string) {
  try {
    const tempDir = join(process.cwd(), 'renders', videoId, 'temp');
    
    // Check if directory exists
    try {
      await fs.access(tempDir);
    } catch {
      // Directory doesn't exist, nothing to clean
      return { cleaned: false, reason: 'directory_not_found' };
    }

    // Get list of files before cleanup
    const files = await fs.readdir(tempDir);
    const logFiles = files.filter(f => f.endsWith('.log'));
    
    // Remove all files except logs
    const filesToRemove = files.filter(f => !f.endsWith('.log'));
    
    for (const file of filesToRemove) {
      try {
        await fs.unlink(join(tempDir, file));
      } catch (err) {
        console.warn(`[cleanup] Failed to remove ${file}:`, err);
      }
    }

    console.log(`[cleanup] Cleaned ${filesToRemove.length} files from ${tempDir}, kept ${logFiles.length} log files`);
    
    return {
      cleaned: true,
      removedFiles: filesToRemove.length,
      keptLogs: logFiles.length
    };

  } catch (error) {
    console.error(`[cleanup] Error cleaning temp directory for ${videoId}:`, error);
    return { cleaned: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { videoId } = await req.json();
    
    if (!videoId) {
      return NextResponse.json({ ok: false, error: 'missing_video_id' }, { status: 400 });
    }

    const result = await cleanupTempDirectory(videoId);
    
    return NextResponse.json({ 
      ok: true, 
      cleanup: result
    });

  } catch (error) {
    console.error('[cleanup] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to cleanup temp files';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}