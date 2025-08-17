export async function ttsGenerateBuffer({
  text,
  voiceId = process.env.VOICE_ID ?? 'EFbNMe9bCQ0gsl51ZIWn',
}: { text: string; voiceId?: string }) {
  const apiKey = process.env.ELEVENLABS_API_KEY!;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.4, similarity_boost: 0.75 },
    }),
  });
  if (!res.ok) throw new Error(`TTS failed: ${res.status} ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
} 