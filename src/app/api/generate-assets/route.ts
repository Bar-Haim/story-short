import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface StoryboardScene {
  id: number;
  description: string;
  image_prompt: string;
  duration: number;
}

interface Storyboard {
  scenes: StoryboardScene[];
  total_duration: number;
}

function parseScript(scriptText: string): { hook: string; body: string; cta: string } | null {
  try {
    const lines = scriptText.split('\n').filter(line => line.trim());
    
    let hook = '';
    let body = '';
    let cta = '';
    
    for (const line of lines) {
      if (line.startsWith('HOOK:')) {
        hook = line.replace('HOOK:', '').trim();
      } else if (line.startsWith('BODY:')) {
        body = line.replace('BODY:', '').trim();
      } else if (line.startsWith('CTA:')) {
        cta = line.replace('CTA:', '').trim();
      }
    }
    
    if (hook && body && cta) {
      return { hook, body, cta };
    }
    
    return { hook: '', body: scriptText.trim(), cta: '' };
  } catch (error) {
    console.error('Failed to parse script:', error);
    return null;
  }
}

async function generateStoryboard(script: string): Promise<Storyboard> {
  const openRouterApiKey = process.env.OPENAI_API_KEY;
  
  const prompt = `Create a storyboard for this video script: "${script}"

Generate 6-8 scenes as JSON array. Each scene should have:
- id: scene number (1-8)
- description: brief scene description
- image_prompt: detailed prompt for AI image generation (1080x1920 vertical)
- duration: estimated seconds (2-4 seconds each)

Format as JSON:
{
  "scenes": [
    {
      "id": 1,
      "description": "Scene description",
      "image_prompt": "Detailed image prompt for AI generation",
      "duration": 3
    }
  ],
  "total_duration": 24
}

Keep total duration under 40 seconds. Make scenes visually engaging and match the script tone.`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openRouterApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate storyboard');
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  try {
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to parse storyboard JSON:', error);
    throw new Error('Invalid storyboard format');
  }
}

async function generateImage(prompt: string): Promise<ArrayBuffer> {
  const openRouterApiKey = process.env.OPENAI_API_KEY;
  
  const response = await fetch('https://openrouter.ai/api/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openRouterApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1024x1792', // Vertical format
      quality: 'standard',
      style: 'natural',
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate image');
  }

  const data = await response.json();
  const imageUrl = data.data[0].url;
  
  // Download the image
  const imageResponse = await fetch(imageUrl);
  return await imageResponse.arrayBuffer();
}

async function generateAudio(script: string): Promise<ArrayBuffer> {
  const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
  
  const parsedScript = parseScript(script);
  if (!parsedScript) {
    throw new Error('Failed to parse script for audio generation');
  }

  const textToRead = `${parsedScript.hook} ${parsedScript.body} ${parsedScript.cta}`.trim();

  const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/Dslrhjl3ZpzrctukrQSN', {
    method: 'POST',
    headers: {
      'xi-api-key': elevenLabsApiKey!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: textToRead,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5,
      },
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate audio');
  }

  return await response.arrayBuffer();
}

function generateCaptions(script: string, totalDuration: number): string {
  const parsedScript = parseScript(script);
  if (!parsedScript) {
    return '';
  }

  const hookDuration = Math.floor(totalDuration * 0.3);
  const bodyDuration = Math.floor(totalDuration * 0.5);
  const ctaDuration = totalDuration - hookDuration - bodyDuration;

  let vtt = 'WEBVTT\n\n';
  
  let startTime = 0;
  
  // Hook
  vtt += `${formatTime(startTime)} --> ${formatTime(startTime + hookDuration)}\n`;
  vtt += `${parsedScript.hook}\n\n`;
  startTime += hookDuration;
  
  // Body
  vtt += `${formatTime(startTime)} --> ${formatTime(startTime + bodyDuration)}\n`;
  vtt += `${parsedScript.body}\n\n`;
  startTime += bodyDuration;
  
  // CTA
  vtt += `${formatTime(startTime)} --> ${formatTime(startTime + ctaDuration)}\n`;
  vtt += `${parsedScript.cta}\n\n`;

  return vtt;
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.000`;
}

async function uploadToSupabase(
  bucket: string,
  path: string,
  data: ArrayBuffer | string,
  contentType: string
): Promise<string> {
  const { data: uploadData, error } = await supabase.storage
    .from(bucket)
    .upload(path, data, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error('Upload error:', error);
    throw new Error(`Failed to upload ${path}`);
  }

  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return urlData.publicUrl;
}

export async function POST(request: NextRequest) {
  try {
    console.log('🎬 Starting asset generation...');
    
    const { videoId, script } = await request.json();
    
    if (!videoId || !script) {
      return NextResponse.json({ error: 'Missing videoId or script' }, { status: 400 });
    }

    // Update status to generating assets
    await supabase
      .from('videos')
      .update({ status: 'generating_assets' })
      .eq('id', videoId);

    console.log('📝 Generating storyboard...');
    const storyboard = await generateStoryboard(script);
    console.log('✅ Storyboard generated:', storyboard.scenes.length, 'scenes');

    // Generate images for each scene
    console.log('🖼️ Generating images...');
    const imageUrls: string[] = [];
    for (let i = 0; i < storyboard.scenes.length; i++) {
      const scene = storyboard.scenes[i];
      console.log(`🖼️ Generating image ${i + 1}/${storyboard.scenes.length}...`);
      
      const imageBuffer = await generateImage(scene.image_prompt);
      const imagePath = `renders/${videoId}/scene_${i + 1}.png`;
      const imageUrl = await uploadToSupabase('assets', imagePath, imageBuffer, 'image/png');
      imageUrls.push(imageUrl);
      
      console.log(`✅ Image ${i + 1} uploaded:`, imageUrl);
    }

    // Generate audio
    console.log('🎤 Generating audio...');
    const audioBuffer = await generateAudio(script);
    const audioPath = `renders/${videoId}/audio.mp3`;
    const audioUrl = await uploadToSupabase('assets', audioPath, audioBuffer, 'audio/mpeg');
    console.log('✅ Audio uploaded:', audioUrl);

    // Generate captions
    console.log('📄 Generating captions...');
    const captions = generateCaptions(script, storyboard.total_duration);
    const captionsPath = `renders/${videoId}/captions.vtt`;
    const captionsUrl = await uploadToSupabase('assets', captionsPath, captions, 'text/vtt');
    console.log('✅ Captions uploaded:', captionsUrl);

    // Update database with all assets
    const { error: updateError } = await supabase
      .from('videos')
      .update({
        status: 'assets_generated',
        storyboard_json: storyboard,
        audio_url: audioUrl,
        captions_url: captionsUrl,
        image_urls: imageUrls,
        total_duration: storyboard.total_duration,
      })
      .eq('id', videoId);

    if (updateError) {
      console.error('❌ Failed to update video record:', updateError);
      throw new Error('Failed to update database');
    }

    console.log('✅ All assets generated and uploaded successfully');

    return NextResponse.json({
      success: true,
      storyboard,
      audioUrl,
      captionsUrl,
      imageUrls,
      totalDuration: storyboard.total_duration,
    });

  } catch (error) {
    console.error('🚨 Asset generation error:', error);
    
    // Update status to failed
    try {
      const { videoId: failedVideoId } = await request.json();
      if (failedVideoId) {
        await supabase
          .from('videos')
          .update({ status: 'failed' })
          .eq('id', failedVideoId);
      }
    } catch (updateError) {
      console.error('❌ Failed to update status to failed:', updateError);
    }

    return NextResponse.json({
      error: 'Failed to generate assets',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
