import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get('id');
    const fileName = searchParams.get('file');
    
    if (!videoId || !fileName) {
      return NextResponse.json({ error: 'missing_parameters' }, { status: 400 });
    }

    // Validate filename to prevent directory traversal
    if (fileName.includes('/') || fileName.includes('\\') || !fileName.endsWith('.log')) {
      return NextResponse.json({ error: 'invalid_filename' }, { status: 400 });
    }

    const logPath = join(process.cwd(), 'renders', videoId, 'temp', fileName);
    
    try {
      const logContent = await fs.readFile(logPath, 'utf8');
      
      return new NextResponse(logContent, {
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Cache-Control': 'no-cache'
        }
      });
    } catch (error) {
      if ((error as any)?.code === 'ENOENT') {
        return NextResponse.json({ error: 'log_file_not_found' }, { status: 404 });
      }
      throw error;
    }

  } catch (error) {
    console.error('[download-log] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to download log';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}