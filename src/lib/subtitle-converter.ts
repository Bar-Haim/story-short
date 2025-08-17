/**
 * Subtitle format converter utilities
 * Converts VTT (WebVTT) format to SRT format for better FFmpeg compatibility
 */

export interface SubtitleEntry {
  startTime: number; // in seconds
  endTime: number;   // in seconds
  text: string;
}

/**
 * Parse VTT content and convert to SRT format
 * @param vttContent - The VTT file content
 * @returns SRT formatted string
 */
export function convertVttToSrt(vttContent: string): string {
  const lines = vttContent.trim().split('\n');
  let srtContent = '';
  let subtitleNumber = 1;
  let i = 0;

  while (i < lines.length) {
    // Skip WEBVTT header and metadata
    if (lines[i].startsWith('WEBVTT') || lines[i].startsWith('NOTE') || lines[i].trim() === '') {
      i++;
      continue;
    }

    // Find timestamp line
    const timestampMatch = lines[i].match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s-->\s(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
    if (timestampMatch) {
      const startTime = `${timestampMatch[1]}:${timestampMatch[2]}:${timestampMatch[3]},${timestampMatch[4]}`;
      const endTime = `${timestampMatch[5]}:${timestampMatch[6]}:${timestampMatch[7]},${timestampMatch[8]}`;
      
      srtContent += `${subtitleNumber}\n`;
      srtContent += `${startTime} --> ${endTime}\n`;
      
      i++;
      // Get subtitle text
      while (i < lines.length && lines[i].trim() !== '') {
        srtContent += lines[i].trim() + '\n';
        i++;
      }
      srtContent += '\n';
      subtitleNumber++;
    } else {
      i++;
    }
  }

  return srtContent;
}

/**
 * Parse VTT timestamp to seconds
 * @param timestamp - VTT timestamp (HH:MM:SS.mmm)
 * @returns time in seconds
 */
function parseTimestamp(timestamp: string): number {
  const parts = timestamp.split(':');
  const hours = parseInt(parts[0]);
  const minutes = parseInt(parts[1]);
  const seconds = parseFloat(parts[2]);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Create ASS (Advanced SubStation Alpha) subtitle format for better styling
 * @param vttContent - The VTT file content
 * @returns ASS formatted string
 */
export function convertVttToAss(vttContent: string): string {
  const entries = parseVttEntries(vttContent);
  
  const assHeader = `[Script Info]
Title: StoryShort Video Subtitles
ScriptType: v4.00+
WrapStyle: 1
ScaledBorderAndShadow: yes
YCbCr Matrix: None

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,32,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,2,2,2,10,10,50,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

  const assEvents = entries.map(entry => {
    const startTime = formatAssTimestamp(entry.startTime);
    const endTime = formatAssTimestamp(entry.endTime);
    return `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${entry.text}`;
  }).join('\n');

  return assHeader + '\n' + assEvents;
}

/**
 * Parse VTT entries into structured format
 * @param vttContent - The VTT file content
 * @returns Array of subtitle entries
 */
function parseVttEntries(vttContent: string): SubtitleEntry[] {
  const lines = vttContent.split('\n');
  const entries: SubtitleEntry[] = [];
  let currentEntry: Partial<SubtitleEntry> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line || line === 'WEBVTT' || line.startsWith('NOTE')) {
      continue;
    }

    const timestampMatch = line.match(/(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})/);
    
    if (timestampMatch) {
      if (currentEntry.startTime !== undefined && currentEntry.endTime !== undefined && currentEntry.text) {
        entries.push(currentEntry as SubtitleEntry);
      }
      
      currentEntry = {
        startTime: parseTimestamp(timestampMatch[1]),
        endTime: parseTimestamp(timestampMatch[2]),
        text: ''
      };
    } else if (currentEntry.startTime !== undefined && currentEntry.endTime !== undefined) {
      if (currentEntry.text) {
        currentEntry.text += ' ' + line;
      } else {
        currentEntry.text = line;
      }
    }
  }

  if (currentEntry.startTime !== undefined && currentEntry.endTime !== undefined && currentEntry.text) {
    entries.push(currentEntry as SubtitleEntry);
  }

  return entries;
}

/**
 * Format timestamp for ASS format
 * @param seconds - time in seconds
 * @returns ASS timestamp (H:MM:SS.cc)
 */
function formatAssTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const centiseconds = Math.floor((seconds % 1) * 100);
  
  return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
} 