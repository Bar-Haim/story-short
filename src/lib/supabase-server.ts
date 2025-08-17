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