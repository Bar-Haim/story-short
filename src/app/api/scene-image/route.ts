import { NextRequest, NextResponse } from 'next/server';
import { VideoService, sbServer } from '@/lib/supabase-server';
import { softenImagePrompt, addSafePrefix, isContentPolicyViolation } from '@/lib/safety';

export const dynamic = 'force-dynamic';

// Image orientation detection and correction
async function detectAndFixImageOrientation(imageBuffer: Buffer): Promise<{ buffer: Buffer; wasFixed: boolean; message: string }> {
  try {
    // Check if image appears upside down by analyzing pixel patterns
    // This is a simple heuristic - in a real implementation, you might use a more sophisticated approach
    const isLikelyUpsideDown = await analyzeImageOrientation(imageBuffer);
    
    if (isLikelyUpsideDown) {
      console.log('🔄 Detected potentially upside-down image, attempting correction...');
      const correctedBuffer = await rotateImage180(imageBuffer);
      return { 
        buffer: correctedBuffer, 
        wasFixed: true, 
        message: 'Image orientation corrected and regenerating...' 
      };
    }
    
    return { buffer: imageBuffer, wasFixed: false, message: 'Image orientation looks correct' };
  } catch (error) {
    console.warn('⚠️ Image orientation detection failed, proceeding with original:', error);
    return { buffer: imageBuffer, wasFixed: false, message: 'Could not detect orientation, using original' };
  }
}

// Simple heuristic to detect upside-down images
async function analyzeImageOrientation(imageBuffer: Buffer): Promise<boolean> {
  // This is a placeholder implementation
  // In a real system, you might use image analysis libraries or AI to detect orientation
  // For now, we'll assume images are correct and let the user manually identify issues
  
  // You could implement:
  // - Face detection (if images contain people)
  // - Text detection (if images contain text)
  // - Sky/ground color analysis
  // - Edge detection patterns
  
  return false; // Assume correct orientation for now
}

// Rotate image 180 degrees
async function rotateImage180(imageBuffer: Buffer): Promise<Buffer> {
  // This is a placeholder implementation
  // In a real system, you would use an image processing library like Sharp or Jimp
  // For now, return the original buffer
  
  // Example with Sharp (if you add it as a dependency):
  // const sharp = require('sharp');
  // return await sharp(imageBuffer).rotate(180).jpeg().toBuffer();
  
  console.log('🔄 Image rotation would happen here with proper image processing library');
  return imageBuffer;
}

async function generateImageBufferForPrompt(prompt: string): Promise<Buffer> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) throw new Error('OpenAI API key not configured');

  console.log(`🎨 Generating image for prompt: ${prompt.substring(0, 50)}...`);

  // Log the exact prompt for debugging (but don't expose to user if sensitive)
  console.log(`[DEBUG] Full prompt sent to OpenAI: ${prompt}`);

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: `${prompt} Cinematic vertical composition, 1080x1920, high quality, detailed`,
      n: 1,
      size: '1024x1792',
      quality: 'standard',
      response_format: 'b64_json',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorData;
    
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { error: { message: errorText } };
    }

    // Check for content policy violations
    if (errorData.error?.code === 'content_policy_violation' || 
        errorData.error?.message?.includes('content_policy_violation') ||
        errorData.error?.message?.includes('blocked by our content filters') ||
        errorData.error?.message?.includes('inappropriate content') ||
        errorData.error?.message?.includes('violates our content policy')) {
      
      const policyError = new Error('Content policy violation');
      (policyError as any).code = 'content_policy_violation';
      (policyError as any).originalPrompt = prompt;
      (policyError as any).apiError = errorData;
      throw policyError;
    }

    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const base64Data = data.data[0].b64_json;
  
  if (!base64Data) throw new Error('No image data received from OpenAI');
  
  return Buffer.from(base64Data, 'base64');
}

async function uploadImageAndGetPublicURL(videoId: string, sceneIndex: number, buf: Buffer): Promise<string> {
  const supabase = sbServer();
  const path = `videos/${videoId}/images/scene-${sceneIndex + 1}.jpg`;
  
  const { error: uploadError } = await supabase.storage
    .from('renders-images')
    .upload(path, buf, { upsert: true, contentType: 'image/jpeg' });
  
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const { data: urlData } = supabase.storage.from('renders-images').getPublicUrl(path);
  const url = urlData?.publicUrl;
  if (!url) throw new Error('failed_to_get_public_url');
  return url;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, index, newPrompt } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid video ID' }, { status: 400 });
    }

    if (typeof index !== 'number' || index < 0) {
      return NextResponse.json({ error: 'Missing or invalid scene index' }, { status: 400 });
    }

    console.log('🖼️ Regenerating image for video:', id, 'scene:', index);

    // Get current video
    const video = await VideoService.getById(id);
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Verify video has a storyboard
    if (!video.storyboard_json || !video.storyboard_json.scenes) {
      return NextResponse.json({ error: 'No storyboard found' }, { status: 400 });
    }

    const scenes = video.storyboard_json.scenes;
    
    // Validate scene index
    if (index >= scenes.length) {
      return NextResponse.json({ error: 'Invalid scene index' }, { status: 400 });
    }

    const scene = scenes[index];
    // Use new prompt if provided, otherwise fall back to existing
    const imagePrompt = newPrompt || scene.image_prompt || scene.description;

    if (!imagePrompt) {
      return NextResponse.json({ error: 'No image prompt found for scene' }, { status: 400 });
    }

    try {
      // Generate new image
      const imageBuffer = await generateImageBufferForPrompt(imagePrompt);
      
      // Check and fix image orientation if needed
      const { buffer: finalBuffer, wasFixed, message } = await detectAndFixImageOrientation(imageBuffer);
      
      if (wasFixed) {
        console.log('🔄 Image orientation was corrected:', message);
      }
      
      const imageUrl = await uploadImageAndGetPublicURL(id, index, finalBuffer);

      // Update image_urls array
      const currentImageUrls = Array.isArray(video.image_urls) ? [...video.image_urls] : [];
      
      // Ensure array is large enough
      while (currentImageUrls.length <= index) {
        currentImageUrls.push(null);
      }
      
      currentImageUrls[index] = imageUrl;

      // Remove scene from dirty scenes list
      const currentDirtyScenes = Array.isArray(video.dirty_scenes) ? video.dirty_scenes : [];
      const updatedDirtyScenes = currentDirtyScenes.filter(dirtyIndex => dirtyIndex !== index);

      // Update video record
      const updateResult = await VideoService.updateVideo(id, {
        image_urls: currentImageUrls,
        dirty_scenes: updatedDirtyScenes
      });

      if (!updateResult.success) {
        console.error('❌ Failed to update image URL:', updateResult.error);
        return NextResponse.json({ error: 'Failed to update image URL' }, { status: 500 });
      }

      console.log('✅ Scene image regenerated successfully');
      
      return NextResponse.json({
        success: true,
        url: imageUrl,
        dirty_scenes: updatedDirtyScenes,
        orientationFixed: wasFixed,
        message: message
      });

    } catch (error: any) {
      // Handle content policy violations specifically
      if (isContentPolicyViolation(error)) {
        console.log('🚫 Content policy violation detected for scene:', index);
        
        // Try to soften the prompt automatically
        const softenedPrompt = softenImagePrompt(imagePrompt);
        const wasSoftened = softenedPrompt !== imagePrompt;
        
        if (wasSoftened) {
          console.log('🔄 Attempting with softened prompt:', softenedPrompt.substring(0, 50));
          
          try {
            const softenedBuffer = await generateImageBufferForPrompt(addSafePrefix(softenedPrompt));
            const { buffer: finalBuffer, wasFixed, message } = await detectAndFixImageOrientation(softenedBuffer);
            
            const imageUrl = await uploadImageAndGetPublicURL(id, index, finalBuffer);

            // Update image_urls array
            const currentImageUrls = Array.isArray(video.image_urls) ? [...video.image_urls] : [];
            while (currentImageUrls.length <= index) {
              currentImageUrls.push(null);
            }
            currentImageUrls[index] = imageUrl;

            // Remove scene from dirty scenes list
            const currentDirtyScenes = Array.isArray(video.dirty_scenes) ? video.dirty_scenes : [];
            const updatedDirtyScenes = currentDirtyScenes.filter(dirtyIndex => dirtyIndex !== index);

            // Update video record
            const updateResult = await VideoService.updateVideo(id, {
              image_urls: currentImageUrls,
              dirty_scenes: updatedDirtyScenes
            });

            if (!updateResult.success) {
              throw new Error('Failed to update image URL after softening');
            }

            console.log('✅ Scene image regenerated successfully with softened prompt');
            
            return NextResponse.json({
              success: true,
              url: imageUrl,
              dirty_scenes: updatedDirtyScenes,
              orientationFixed: wasFixed,
              message: `Image generated with softened prompt. ${message}`,
              wasSoftened: true,
              originalPrompt: imagePrompt,
              softenedPrompt: softenedPrompt
            });

          } catch (softenedError: any) {
            console.log('❌ Softened prompt also failed:', softenedError.message);
          }
        }

        // Return structured error for content policy violation
        return NextResponse.json({
          success: false,
          error: 'content_policy_violation',
          code: 'content_policy_violation',
          message: 'This image prompt was blocked by content policy. Please edit the prompt to be family-friendly and try again.',
          details: {
            sceneIndex: index,
            originalPrompt: imagePrompt,
            softenedPrompt: wasSoftened ? softenedPrompt : null,
            suggestion: 'Try removing any potentially inappropriate content, violence, or adult themes from your prompt.'
          }
        }, { status: 400 });

      } else {
        // Re-throw other errors
        throw error;
      }
    }

  } catch (error: any) {
    console.error('❌ Error in POST /api/scene-image:', error);
    
    // Return structured error response
    return NextResponse.json({ 
      success: false,
      error: error?.message || 'Internal server error',
      code: error?.code || 'internal_error',
      details: {
        sceneIndex: index,
        message: error?.message || 'An unexpected error occurred'
      }
    }, { status: 500 });
  }
}