import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { assertEnv } from './assert-env';

// Validate environment variables on module load
assertEnv();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const sbServer = () => createClient(URL, SERVICE);

// Helper for database writes with error handling
async function writeOrThrow(patch: Record<string, any>, videoId: string) {
  const { error } = await sbServer().from('videos').update(patch).eq('id', videoId);
  if (error) {
    // try to persist error_message as well
    try {
      await sbServer().from('videos').update({ error_message: `DB write error: ${error.message}` }).eq('id', videoId);
    } catch {}
    throw new Error(error.message);
  }
}

export const VideoService = {
  async getById(videoId: string) {
    const { data, error } = await sbServer().from('videos').select('*').eq('id', videoId).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  async create(inputText: string, meta?: Partial<Record<string, any>>) {
    const { data, error } = await sbServer()
      .from('videos')
      .insert([{ input_text: inputText, status: 'created', ...(meta || {}) }])
      .select('*')
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data!;
  },

  async markScript(videoId: string, script: string) {
    await writeOrThrow(
      { script, status: 'script_generated', script_done_at: new Date().toISOString(), error_message: null },
      videoId
    );
  },

  async saveStoryboard(videoId: string, storyboard: any) {
    // IMPORTANT: write JSON OBJECT, not string
    await writeOrThrow(
      { storyboard_json: storyboard, storyboard_done_at: new Date().toISOString(), status: 'storyboard_generated' },
      videoId
    );
  },

  async markError(videoId: string, msg: string, status: string = 'storyboard_failed') {
    await writeOrThrow({ status, error_message: msg }, videoId);
  },

  async setStatus(videoId: string, status: string, extra?: Record<string, any>) {
    await writeOrThrow({ status, ...(extra || {}) }, videoId);
  },

  // Backward compatibility methods
  async getVideo(videoId: string) {
    try {
      const video = await this.getById(videoId);
      return { success: true, video, error: null };
    } catch (error) {
      return { success: false, video: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async createVideo(inputText: string, meta?: Partial<Record<string, any>>) {
    try {
      const video = await this.create(inputText, meta);
      return { success: true, videoId: video.id, data: { id: video.id }, error: null };
    } catch (error) {
      return { success: false, videoId: null, data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async updateVideo(videoId: string, updates: Record<string, any>) {
    try {
      await writeOrThrow(updates, videoId);
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
};

// Storage service helper
export const StorageService = {
  getPublicUrl: (bucket: string, path: string) => {
    return sbServer().storage.from(bucket).getPublicUrl(path);
  },
  
  upload: async (bucket: string, path: string, file: File | Blob, options?: any) => {
    return sbServer().storage.from(bucket).upload(path, file, options);
  },

  // Enhanced upload functions with proper bucket configuration and availability checks
  uploadAudio: async (videoId: string, audioBuffer: Buffer): Promise<string> => {
    const supabase = sbServer();
    const bucket = 'renders-audio';
    const path = `videos/${videoId}/audio.mp3`;
    
    console.log(`[StorageService] Uploading audio to ${bucket}/${path}`);
    
    // Upload audio file
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, audioBuffer, { 
        contentType: 'audio/mpeg', 
        upsert: true 
      });
    
    if (uploadError) {
      throw new Error(`Audio upload failed: ${uploadError.message}`);
    }
    
    // Wait for object availability
    const publicUrl = await StorageService.waitForObjectAvailability(bucket, path, 30);
    
    console.log(`[StorageService] Audio uploaded successfully: ${publicUrl}`);
    return publicUrl;
  },

  uploadCaptions: async (videoId: string, captionsContent: string): Promise<string> => {
    const supabase = sbServer();
    const bucket = 'renders-captions';
    const path = `videos/${videoId}/captions.srt`;
    
    console.log(`[StorageService] Uploading captions to ${bucket}/${path}`);
    
    // Create blob from captions content
    const captionsBlob = new Blob([captionsContent], { type: 'text/plain' });
    
    // Upload captions file
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, captionsBlob, { 
        contentType: 'text/plain', 
        upsert: true 
      });
    
    if (uploadError) {
      throw new Error(`Captions upload failed: ${uploadError.message}`);
    }
    
    // Wait for object availability
    const publicUrl = await StorageService.waitForObjectAvailability(bucket, path, 30);
    
    console.log(`[StorageService] Captions uploaded successfully: ${publicUrl}`);
    return publicUrl;
  },

  uploadVideo: async (videoId: string, videoBuffer: Buffer): Promise<string> => {
    const supabase = sbServer();
    const bucket = 'renders-videos';
    const path = `videos/${videoId}/final.mp4`;
    
    console.log(`[StorageService] Uploading video to ${bucket}/${path}`);
    
    // Upload video file
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, videoBuffer, { 
        contentType: 'video/mp4', 
        upsert: true 
      });
    
    if (uploadError) {
      throw new Error(`Video upload failed: ${uploadError.message}`);
    }
    
    // Wait for object availability
    const publicUrl = await StorageService.waitForObjectAvailability(bucket, path, 30);
    
    console.log(`[StorageService] Video uploaded successfully: ${publicUrl}`);
    return publicUrl;
  },

  // Wait for object to be available after upload (race condition fix)
  waitForObjectAvailability: async (bucket: string, path: string, maxAttempts: 30): Promise<string> => {
    const supabase = sbServer();
    
    // Get the public URL first
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
    const publicUrl = urlData.publicUrl;
    
    if (!publicUrl) {
      throw new Error(`Failed to generate public URL for ${bucket}/${path}`);
    }
    
    console.log(`[StorageService] Waiting for object availability: ${publicUrl}`);
    
    // Try to verify object availability with exponential backoff
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Try to get object metadata to verify it's available
        const { data: statData, error: statError } = await supabase.storage
          .from(bucket)
          .list(path.split('/').slice(0, -1).join('/'), {
            limit: 100,
            offset: 0,
            search: path.split('/').pop()
          });
        
        if (!statError && statData && statData.length > 0) {
          console.log(`[StorageService] Object confirmed available after ${attempt + 1} attempts`);
          return publicUrl;
        }
        
        // Alternative: try HEAD request to public URL
        const headResponse = await fetch(publicUrl, { method: 'HEAD' });
        if (headResponse.ok) {
          console.log(`[StorageService] Object confirmed available via HEAD request after ${attempt + 1} attempts`);
          return publicUrl;
        }
        
      } catch (error) {
        // Continue waiting
      }
      
      // Exponential backoff: 200ms → 400ms → 800ms → 1.6s → 2s (max)
      const delay = Math.min(200 * Math.pow(2, attempt), 2000);
      console.log(`[StorageService] Object not yet available, retrying in ${delay}ms (attempt ${attempt + 1}/${maxAttempts})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    throw new Error(`Object not available after ${maxAttempts} attempts: ${bucket}/${path}`);
  },

  // Backward compatibility method
  async uploadFile(path: string, content: string | Buffer, contentType?: string) {
    try {
      const blob = typeof content === 'string' 
        ? new Blob([content], { type: contentType }) 
        : new Blob([new Uint8Array(content)], { type: contentType });
      const { data, error } = await sbServer().storage.from('renders-videos').upload(path, blob, {
        contentType: contentType || 'application/octet-stream',
        upsert: true
      });
      
      if (error) throw new Error(error.message);
      
      const { data: urlData } = sbServer().storage.from('renders-videos').getPublicUrl(path);
      return { success: true, url: urlData.publicUrl, error: null };
    } catch (error) {
      return { success: false, url: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
};