import { NextRequest, NextResponse } from 'next/server';
import { VideoService, StorageService } from '@/lib/supabase';

// Helper function to parse script into sections
function parseScript(scriptText: string): { hook: string; body: string; cta: string } | null {
  const lines = scriptText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  let hook = '', body = '', cta = '';
  
  for (const line of lines) {
    if (line.startsWith('HOOK:')) {
      hook = line.substring(5).trim();
    } else if (line.startsWith('BODY:')) {
      body = line.substring(5).trim();
    } else if (line.startsWith('CTA:')) {
      cta = line.substring(4).trim();
    }
  }
  
  if (hook && body && cta) {
    return { hook, body, cta };
  }
  
  return null;
}

// Generate storyboard using OpenRouter
async function generateStoryboard(script: string): Promise<any> {
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterApiKey) {
    throw new Error('OpenRouter API key not configured for storyboard generation.');
  }

  const parsedScript = parseScript(script);
  if (!parsedScript) {
    throw new Error('Failed to parse script into sections.');
  }

  const prompt = `Create a storyboard for a 40-second video based on this script:

HOOK: ${parsedScript.hook}
BODY: ${parsedScript.body}
CTA: ${parsedScript.cta}

Generate a JSON storyboard with 6-8 scenes. Each scene should have:
- scene_number: number
- description: brief visual description
- duration: estimated seconds (total should be ~40)
- image_prompt: detailed prompt for AI image generation (vertical 1080x1920 format)

Return ONLY valid JSON, no other text. Example format:
{
  "scenes": [
    {
      "scene_number": 1,
      "description": "Opening shot of golden retrievers in a field",
      "duration": 6,
      "image_prompt": "Cinematic wide shot of golden retrievers running through a sunlit flower field, vertical composition, 1080x1920, natural lighting, warm colors"
    }
  ]
}`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openRouterApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://storyshort.app',
      'X-Title': 'StoryShort - AI Video Generation',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    let errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch (err) {
      errorData = { error: 'Failed to parse error response', raw: errorText };
    }
    throw new Error(`Storyboard generation failed: ${errorData.error || errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content?.trim();
  
  if (!content) {
    throw new Error('No storyboard content received from OpenRouter');
  }

  // Try to extract JSON from the response
  let storyboard;
  try {
    // First try direct JSON parsing
    storyboard = JSON.parse(content);
  } catch (err) {
    // If that fails, try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      try {
        storyboard = JSON.parse(jsonMatch[1]);
      } catch (err2) {
        throw new Error('Failed to parse storyboard JSON from response');
      }
    } else {
      throw new Error('No valid JSON found in storyboard response');
    }
  }

  if (!storyboard.scenes || !Array.isArray(storyboard.scenes)) {
    throw new Error('Invalid storyboard format: missing scenes array');
  }

  return storyboard;
}

// Generate image using OpenAI DALL-E 3
async function generateImage(prompt: string): Promise<ArrayBuffer> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured for image generation.');
  }

  // Enhanced prompt for better quality vertical images
  const enhancedPrompt = `Create a high-quality, cinematic vertical image (9:16 aspect ratio) for a short video. 
  
  Scene description: ${prompt}
  
  Requirements:
  - Ultra-high resolution and sharp details
  - Cinematic lighting and composition
  - Professional photography style
  - Rich colors and textures
  - Suitable for mobile video content
  - No text, watermarks, or logos
  - Clean, modern aesthetic
  
  Style: Professional photography, cinematic, high-quality, detailed`;

  console.log('🎨 Generating high-quality image with enhanced prompt:', enhancedPrompt);

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: enhancedPrompt,
      n: 1,
      size: '1024x1792', // Vertical format for mobile
      quality: 'hd', // Use HD quality for better results
      style: 'natural',
    }),
  });

  if (!response.ok) {
    let errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch (err) {
      errorData = { error: 'Failed to parse error response', raw: errorText };
    }
    
    const errorMessage = errorData.error?.message || errorText;
    
    // Validate errorMessage is a string before using .includes()
    if (typeof errorMessage === 'string') {
      // Handle specific Stability AI billing limit errors
      if (errorMessage.includes('Billing hard limit has been reached') || 
          errorMessage.includes('billing hard limit') ||
          errorMessage.includes('quota exceeded') ||
          errorMessage.includes('insufficient credits')) {
        throw new Error(`Billing limit reached: Your Stability AI account has reached its billing limit. Please upgrade your plan or add more credits to continue generating images.`);
      }
      
      // Handle other common API errors
      if (errorMessage.includes('invalid api key') || errorMessage.includes('authentication')) {
        throw new Error(`API Key Error: Invalid or expired API key. Please check your Stability AI configuration.`);
      }
      
      if (errorMessage.includes('content policy') || errorMessage.includes('safety')) {
        throw new Error(`Content Policy Violation: The image prompt violates content policies. Please modify your prompt and try again.`);
      }
    }
    
    throw new Error(`Image generation failed: ${errorMessage}`);
  }

  const data = await response.json();
  const imageUrl = data.data[0].url;
  
  if (!imageUrl) {
    throw new Error('No image URL received from OpenAI');
  }

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image: ${imageResponse.statusText}`);
  }

  return await imageResponse.arrayBuffer();
}

// Generate audio using ElevenLabs
async function generateAudio(script: string, voiceId: string): Promise<ArrayBuffer> {
  const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenLabsApiKey) {
    throw new Error('ElevenLabs API key not configured for audio generation.');
  }

  const parsedScript = parseScript(script);
  if (!parsedScript) {
    throw new Error('Failed to parse script for audio generation.');
  }

  const textToRead = `${parsedScript.hook} ${parsedScript.body} ${parsedScript.cta}`.trim();

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': elevenLabsApiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
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
    let errorData;
    try {
      errorData = await response.json();
    } catch (err) {
      errorData = { error: 'Failed to parse error response' };
    }
    
    let errorMessage = 'Failed to generate voice from ElevenLabs';
    if (errorData.status === 'quota_exceeded') {
      errorMessage = 'Insufficient ElevenLabs credits. Please add more credits to your account.';
    } else if (errorData.status === 'invalid_api_key') {
      errorMessage = 'Invalid ElevenLabs API key. Please check your configuration.';
    } else if (errorData.status === 'invalid_voice_id') {
      errorMessage = 'Invalid voice ID. Please check the voice configuration.';
    }
    
    throw new Error(errorMessage);
  }

  return await response.arrayBuffer();
}

// Generate VTT captions
function generateCaptions(script: string): string {
  const parsedScript = parseScript(script);
  if (!parsedScript) {
    throw new Error('Failed to parse script for caption generation.');
  }

  const text = `${parsedScript.hook} ${parsedScript.body} ${parsedScript.cta}`.trim();
  const words = text.split(' ');
  const wordsPerSecond = 2.5; // Average speaking rate
  const totalDuration = words.length / wordsPerSecond;
  
  let vtt = 'WEBVTT\n\n';
  let currentTime = 0;
  let currentText = '';
  let wordCount = 0;
  
  for (const word of words) {
    currentText += (currentText ? ' ' : '') + word;
    wordCount++;
    
    if (wordCount % 8 === 0 || wordCount === words.length) {
      const endTime = Math.min((wordCount / wordsPerSecond), totalDuration);
      const startTimeStr = formatTime(currentTime);
      const endTimeStr = formatTime(endTime);
      
      vtt += `${startTimeStr} --> ${endTimeStr}\n${currentText}\n\n`;
      
      currentTime = endTime;
      currentText = '';
    }
  }
  
  return vtt;
}

// Format time for VTT
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

export async function POST(request: NextRequest) {
  let videoId: string | null = null;
  let script: string | null = null;
  let voiceId: string | null = null;

  try {
    console.log('🎬 Starting asset generation...');
    
    // Validate environment
    console.log('🔍 Validating environment...');
    
    const requiredEnvVars = {
      'OPENROUTER_API_KEY': process.env.OPENROUTER_API_KEY,
      'OPENAI_API_KEY': process.env.OPENAI_API_KEY,
      'ELEVENLABS_API_KEY': process.env.ELEVENLABS_API_KEY,
    };

    const missingVars = Object.entries(requiredEnvVars)
      .filter(([_, value]) => !value)
      .map(([key, _]) => key);

    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    console.log('✅ Environment variables validated');

    // Parse request body
    const body = await request.json();
    videoId = body.videoId;
    script = body.script;
    voiceId = body.voiceId || 'Dslrhjl3ZpzrctukrQSN';

    // Validate inputs
    if (!script || typeof script !== 'string') {
      throw new Error('Missing or invalid script parameter');
    }

    if (!videoId || typeof videoId !== 'string') {
      console.log('⚠️ Invalid videoId format, generating new UUID');
      videoId = crypto.randomUUID();
    }

    // Update video status to generating_assets
    if (videoId) {
      await VideoService.updateVideo(videoId, { status: 'generating_assets' });
      console.log('✅ Updated status to generating_assets');
    }

    // Generate storyboard
    console.log('📝 Generating storyboard...');
    let storyboard;
    try {
      storyboard = await generateStoryboard(script);
      console.log('✅ Storyboard generated successfully');
    } catch (storyboardError) {
      console.error('❌ Storyboard generation failed:', storyboardError);
      if (videoId) {
        await VideoService.updateVideo(videoId, { 
          status: 'failed', 
          error_message: `Storyboard generation failed: ${storyboardError instanceof Error ? storyboardError.message : 'Unknown error'}` 
        });
      }
      throw storyboardError;
    }

    // Generate images for each scene
    console.log('🖼️ Generating images...');
    const imageUrls: string[] = [];
    const imageErrors: string[] = [];
    const totalImages = storyboard.scenes.length;

    for (let i = 0; i < storyboard.scenes.length; i++) {
      const scene = storyboard.scenes[i];
      let imageGenerated = false;
      let retryCount = 0;
      const maxRetries = 1; // Retry once for failed images
      
      while (!imageGenerated && retryCount <= maxRetries) {
        try {
          if (retryCount > 0) {
            console.log(`   🔄 Retrying image ${i + 1}/${totalImages} (attempt ${retryCount + 1}/${maxRetries + 1})`);
          } else {
            console.log(`   Generating image ${i + 1}/${totalImages}: ${scene.description}`);
          }
          
          // Update progress to show current image being generated
          if (videoId) {
            const currentProgress = Math.round((i / totalImages) * 100);
            await VideoService.updateVideo(videoId, {
              image_upload_progress: currentProgress
            });
            console.log(`   📊 Progress: Generating image ${i + 1}/${totalImages} (${currentProgress}%)`);
          }
          
                    const imageBuffer = await generateImage(scene.image_prompt);
          
          const imagePath = `renders/${videoId || 'temp'}/images/scene_${i + 1}.png`;
          const uploadResult = await StorageService.uploadFile(imagePath, Buffer.from(imageBuffer), 'image/png');
          
          if (uploadResult.success && uploadResult.url) {
            imageUrls.push(uploadResult.url);
            console.log(`   ✅ Image ${i + 1} uploaded successfully`);
            
            // Update image upload progress in database
            if (videoId) {
              const progressPercentage = Math.round(((i + 1) / totalImages) * 100);
              await VideoService.updateVideo(videoId, {
                image_upload_progress: progressPercentage
              });
              console.log(`   📊 Progress: ${i + 1}/${totalImages} images uploaded (${progressPercentage}%)`);
            }
            
            imageGenerated = true; // Mark as successful
          } else {
            throw new Error(uploadResult.error || 'Upload failed');
          }
        } catch (imageError) {
          let errorMsg = `Scene ${i + 1} image generation failed: ${imageError instanceof Error ? imageError.message : 'Unknown error'}`;
          
          // Provide more specific error messages for common issues
          if (imageError instanceof Error && typeof imageError.message === 'string') {
            if (imageError.message.includes('Billing limit reached') || 
                imageError.message.includes('billing hard limit') || 
                imageError.message.includes('quota exceeded') ||
                imageError.message.includes('insufficient credits')) {
              errorMsg = `Scene ${i + 1} image generation failed: Billing limit reached. Please upgrade your Stability AI plan or add more credits to continue.`;
            } else if (imageError.message.includes('invalid api key') || imageError.message.includes('authentication')) {
              errorMsg = `Scene ${i + 1} image generation failed: Invalid API key. Please check your Stability AI configuration.`;
            } else if (imageError.message.includes('content policy') || imageError.message.includes('safety')) {
              errorMsg = `Scene ${i + 1} image generation failed: Content policy violation. Please modify your prompt.`;
            }
          }
          
          console.error(`   ❌ ${errorMsg}`);
          imageErrors.push(errorMsg);
          
          // If this is a billing limit error, stop processing more images to save credits
          if (imageError instanceof Error && typeof imageError.message === 'string' &&
              (imageError.message.includes('Billing limit reached') || 
               imageError.message.includes('billing hard limit'))) {
            console.warn(`   ⚠️ Billing limit detected. Stopping further image generation to save credits.`);
            break; // Stop the loop to prevent wasting more credits
          }
          
          retryCount++;
          if (retryCount > maxRetries) {
            console.error(`   ❌ Failed to generate image ${i + 1} after ${maxRetries + 1} attempts`);
          }
        }
      }
    }

    // Generate audio
    console.log('🎵 Generating audio...');
    let audioUrl: string | null = null;
    try {
      const audioBuffer = await generateAudio(script, voiceId || 'Dslrhjl3ZpzrctukrQSN');
      const audioPath = `renders/${videoId || 'temp'}/audio/voiceover.mp3`;
      const uploadResult = await StorageService.uploadFile(audioPath, Buffer.from(audioBuffer), 'audio/mpeg');
      
      if (uploadResult.success && uploadResult.url) {
        audioUrl = uploadResult.url;
        console.log('✅ Audio uploaded successfully');
      } else {
        throw new Error(uploadResult.error || 'Audio upload failed');
      }
    } catch (audioError) {
      console.error('❌ Audio generation failed:', audioError);
      throw audioError;
    }

    // Generate captions
    console.log('📝 Generating captions...');
    let captionsUrl: string | null = null;
    try {
      const captions = generateCaptions(script);
      const captionsPath = `renders/${videoId || 'temp'}/captions/subtitles.vtt`;
      const uploadResult = await StorageService.uploadFile(captionsPath, captions, 'text/vtt');
      
      if (uploadResult.success && uploadResult.url) {
        captionsUrl = uploadResult.url;
        console.log('✅ Captions uploaded successfully');
      } else {
        throw new Error(uploadResult.error || 'Captions upload failed');
      }
    } catch (captionsError) {
      console.error('❌ Captions generation failed:', captionsError);
      throw captionsError;
    }

    // Calculate total duration
    const totalDuration = storyboard.scenes.reduce((sum: number, scene: any) => sum + (scene.duration || 0), 0);

    // Validate that at least some images were generated successfully
    const successfulImageCount = imageUrls.length;
    const totalImageCount = storyboard.scenes.length;
    
    if (successfulImageCount === 0) {
      console.error('❌ All images failed to generate. Marking video as failed.');
      
      if (videoId) {
        await VideoService.updateVideo(videoId, {
          status: 'failed',
          storyboard_json: storyboard,
          audio_url: audioUrl,
          captions_url: captionsUrl,
          image_urls: [],
          total_duration: totalDuration,
          error_message: `All ${totalImageCount} images failed to generate. ${imageErrors.join('; ')}`
        });
      }
      
      throw new Error(`All ${totalImageCount} images failed to generate. Please check your billing status or try again later.`);
    }

    // Check if we have a critical failure rate (more than 50% of images failed)
    const failureRate = imageErrors.length / totalImageCount;
    if (failureRate > 0.5) {
      console.warn(`⚠️ High image failure rate: ${Math.round(failureRate * 100)}% of images failed`);
    }

    // Update video record with all generated assets
    if (videoId) {
      const updateResult = await VideoService.updateVideo(videoId, {
        status: 'assets_generated',
        storyboard_json: storyboard,
        audio_url: audioUrl,
        captions_url: captionsUrl,
        image_urls: imageUrls,
        total_duration: totalDuration,
        error_message: imageErrors.length > 0 ? `Some images failed to generate: ${imageErrors.join('; ')}` : undefined
      });

      if (!updateResult.success) {
        throw new Error('Failed to update video record with generated assets');
      }
    }

    console.log('✅ Assets generation completed successfully');

    const summary = {
      videoId,
      storyboard: {
        scenes: storyboard.scenes.length,
        totalDuration
      },
      images: {
        generated: imageUrls.length,
        failed: imageErrors.length,
        errors: imageErrors
      },
      audio: audioUrl ? 'Generated' : 'Failed',
      captions: captionsUrl ? 'Generated' : 'Failed'
    };

    return NextResponse.json({
      error: false,
      message: 'Assets generated successfully',
      data: {
        videoId,
        storyboard,
        imageUrls,
        audioUrl,
        captionsUrl,
        totalDuration
      },
      summary
    });

  } catch (error) {
    console.error('❌ Asset generation failed:', error);
    
    // Update video status to failed if we have a videoId
    if (videoId) {
      await VideoService.updateVideo(videoId, {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error during asset generation'
      });
    }

    return NextResponse.json({
      error: true,
      message: 'Failed to generate assets',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        videoId,
        script: script ? 'Provided' : 'Missing'
      }
    }, { status: 500 });
  }
}
