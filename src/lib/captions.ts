import { sbServer } from './supabase-server';
import { ensureBucket } from './tts';

// Split text into sentences for caption timing
function splitIntoSentences(text: string): string[] {
  return text.replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

// Format timestamp for SRT (hh:mm:ss,ms)
function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds - Math.floor(seconds)) * 1000);
  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${String(ms).padStart(3, '0')}`;
}

// Wrap text for SRT (max ~42 chars per line, max 2 lines)
function wrapForSrt(text: string, max = 42): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line: string[] = [];
  
  for (const w of words) {
    const test = [...line, w].join(' ');
    if (test.length > max && line.length) {
      lines.push(line.join(' '));
      line = [w];
    } else {
      line.push(w);
    }
  }
  
  if (line.length) lines.push(line.join(' '));
  
  // If more than 2 lines, try to balance them
  if (lines.length > 2) {
    const joined = lines.join(' ');
    const mid = Math.floor(joined.length / 2);
    const left = joined.slice(0, mid).trim();
    const right = joined.slice(mid).trim();
    return `${left}\n${right}`;
  }
  
  return lines.join('\n');
}

// Build SRT captions with naive timing
function buildSrt(text: string, estimatedDuration: number = 0): string {
  const sentences = splitIntoSentences(text);
  
  if (sentences.length === 0) {
    // Fallback for empty text
    const duration = Math.max(estimatedDuration, 5.0); // minimum 5 seconds
    return `1\n00:00:00,000 --> ${formatTimestamp(duration)}\n${text || ' '}\n\n`;
  }

  const totalChars = sentences.reduce((a, s) => a + s.length, 0) || 1;
  const minSeg = 1.2; // minimum segment duration
  let currentTime = 0;
  const out: string[] = [];

  sentences.forEach((sentence, i) => {
    const share = sentence.length / totalChars;
    let duration = Math.max(minSeg, estimatedDuration * share);
    
    // Ensure last segment fills remaining time
    if (i === sentences.length - 1) {
      duration = Math.max(minSeg, estimatedDuration - currentTime);
    }
    
    const start = currentTime;
    const end = Math.min(estimatedDuration, currentTime + duration);
    currentTime = end;

    const cueText = wrapForSrt(sentence);
    out.push(
      String(i + 1),
      `${formatTimestamp(start)} --> ${formatTimestamp(end)}`,
      cueText,
      ''
    );
  });

  return out.join('\n');
}

// Generate captions and upload to Supabase
export async function generateCaptions(video: any): Promise<string> {
  // Get script text from video
  const scriptText = video.script_text || video.script || '';
  if (!scriptText) {
    throw new Error('No script text found for caption generation');
  }

  console.log(`[captions] Generating captions for video ${video.id}, text length: ${scriptText.length}`);

  // Estimate duration based on text length (rough estimate: 150 words per minute)
  const wordCount = scriptText.split(/\s+/).length;
  const estimatedDuration = Math.max(5.0, (wordCount / 150) * 60); // minimum 5 seconds
  
  console.log(`[captions] Estimated duration: ${estimatedDuration.toFixed(2)}s (${wordCount} words)`);

  // Build SRT captions
  const srt = buildSrt(scriptText, estimatedDuration);
  
  console.log(`[captions] Generated SRT captions with ${splitIntoSentences(scriptText).length} segments`);

  // Ensure bucket exists
  await ensureBucket('renders-captions');
  
  // Upload to Supabase
  const supabase = sbServer();
  const captionsPath = `videos/${video.id}/captions.srt`;
  
  const { error: uploadError } = await supabase.storage
    .from('renders-captions')
    .upload(captionsPath, srt, { 
      contentType: 'application/x-subrip', 
      upsert: true 
    });

  if (uploadError) {
    throw new Error(`Captions upload failed: ${uploadError.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('renders-captions')
    .getPublicUrl(captionsPath);

  if (!urlData?.publicUrl) {
    throw new Error('Failed to get public URL for uploaded captions');
  }

  console.log(`[captions] Captions generated and uploaded successfully: ${urlData.publicUrl}`);
  return urlData.publicUrl;
} 