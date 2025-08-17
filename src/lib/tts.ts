import { sbServer } from './supabase-server';

// Ensure bucket exists (idempotent)
export async function ensureBucket(name: string): Promise<void> {
  const supabase = sbServer();
  
  // Check if bucket exists
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(b => b.name === name);
  
  if (!bucketExists) {
    // Create bucket if it doesn't exist
    const { error } = await supabase.storage.createBucket(name, {
      public: true,
      allowedMimeTypes: name === 'renders-audio' ? ['audio/mpeg', 'audio/wav'] : ['application/x-subrip', 'text/plain']
    });
    
    if (error) {
      console.warn(`[tts] Bucket creation warning (may already exist): ${error.message}`);
    }
  }
}

// Generate TTS and upload to Supabase
export async function generateTTS(video: any): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ELEVENLABS_API_KEY environment variable');
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'EFbNMe9bCQ0gsl51ZIWn';
  
  // Get script text from video
  const scriptText = video.script_text || video.script || '';
  if (!scriptText) {
    throw new Error('No script text found for TTS generation');
  }

  console.log(`[tts] Generating TTS for video ${video.id}, text length: ${scriptText.length}`);

  // Generate TTS using ElevenLabs
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text: scriptText,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.4, similarity_boost: 0.75 },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TTS API error: ${response.status} ${errorText}`);
  }

  const audioBuffer = await response.arrayBuffer();
  
  // Ensure bucket exists
  await ensureBucket('renders-audio');
  
  // Upload to Supabase
  const supabase = sbServer();
  const audioPath = `videos/${video.id}/audio.mp3`;
  
  const { error: uploadError } = await supabase.storage
    .from('renders-audio')
    .upload(audioPath, audioBuffer, { 
      contentType: 'audio/mpeg', 
      upsert: true 
    });

  if (uploadError) {
    throw new Error(`Audio upload failed: ${uploadError.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('renders-audio')
    .getPublicUrl(audioPath);

  if (!urlData?.publicUrl) {
    throw new Error('Failed to get public URL for uploaded audio');
  }

  console.log(`[tts] TTS generated and uploaded successfully: ${urlData.publicUrl}`);
  return urlData.publicUrl;
} 