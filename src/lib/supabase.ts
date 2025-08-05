import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Only create client if both URL and key are provided
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// ========================================
// DATABASE TYPES
// ========================================

export type VideoStatus = 
  | 'pending' 
  | 'script_generated' 
  | 'generating_assets' 
  | 'assets_generated' 
  | 'rendering' 
  | 'completed' 
  | 'failed'
  | 'cancelled';

export interface Video {
  id: string;
  status: VideoStatus;
  input_text: string;
  script: string | null;
  storyboard_json: any | null;
  audio_url: string | null;
  captions_url: string | null;
  image_urls: string[] | null;
  total_duration: number | null;
  final_video_url: string | null;
  error_message: string | null;
  image_upload_progress: number | null; // NEW: Track image upload progress (0-100)
  created_at: string;
  updated_at: string;
}

export interface CreateVideoRequest {
  input_text: string;
}

export interface UpdateVideoRequest {
  status?: VideoStatus;
  script?: string;
  storyboard_json?: any;
  audio_url?: string;
  captions_url?: string;
  image_urls?: string[];
  total_duration?: number;
  final_video_url?: string;
  error_message?: string;
  image_upload_progress?: number; // NEW: Track image upload progress (0-100)
}

// ========================================
// DATABASE OPERATIONS
// ========================================

export class VideoService {
  private static supabase = supabase;

  /**
   * Create a new video record
   */
  static async createVideo(inputText: string): Promise<{ success: boolean; videoId?: string; error?: string }> {
    if (!this.supabase) {
      return { success: false, error: 'Supabase client not configured' };
    }

    try {
      const { data, error } = await this.supabase
        .from('videos')
        .insert({
          input_text: inputText,
          status: 'pending'
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error creating video:', error);
        return { success: false, error: error.message };
      }

      return { success: true, videoId: data.id };
    } catch (error) {
      console.error('Exception creating video:', error);
      return { success: false, error: 'Failed to create video record' };
    }
  }

  /**
   * Update video status and data
   */
  static async updateVideo(videoId: string, updates: UpdateVideoRequest): Promise<{ success: boolean; error?: string }> {
    if (!this.supabase) {
      return { success: false, error: 'Supabase client not configured' };
    }

    try {
      const { error } = await this.supabase
        .from('videos')
        .update(updates)
        .eq('id', videoId);

      if (error) {
        console.error('Error updating video:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Exception updating video:', error);
      return { success: false, error: 'Failed to update video record' };
    }
  }

  /**
   * Get video by ID
   */
  static async getVideo(videoId: string): Promise<{ success: boolean; video?: Video; error?: string }> {
    if (!this.supabase) {
      return { success: false, error: 'Supabase client not configured' };
    }

    try {
      const { data, error } = await this.supabase
        .from('videos')
        .select('*')
        .eq('id', videoId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching video:', error);
        return { success: false, error: error.message };
      }

      if (!data) {
        return { success: false, error: 'Video not found' };
      }

      return { success: true, video: data };
    } catch (error) {
      console.error('Exception fetching video:', error);
      return { success: false, error: 'Failed to fetch video record' };
    }
  }

  /**
   * Get all videos with optional filtering
   */
  static async getVideos(status?: VideoStatus): Promise<{ success: boolean; videos?: Video[]; error?: string }> {
    if (!this.supabase) {
      return { success: false, error: 'Supabase client not configured' };
    }

    try {
      let query = this.supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching videos:', error);
        return { success: false, error: error.message };
      }

      return { success: true, videos: data };
    } catch (error) {
      console.error('Exception fetching videos:', error);
      return { success: false, error: 'Failed to fetch video records' };
    }
  }

  /**
   * Delete video by ID
   */
  static async deleteVideo(videoId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.supabase) {
      return { success: false, error: 'Supabase client not configured' };
    }

    try {
      const { error } = await this.supabase
        .from('videos')
        .delete()
        .eq('id', videoId);

      if (error) {
        console.error('Error deleting video:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Exception deleting video:', error);
      return { success: false, error: 'Failed to delete video record' };
    }
  }
}

// ========================================
// STORAGE OPERATIONS
// ========================================

export class StorageService {
  private static supabase = supabase;

  /**
   * Upload file to assets bucket
   */
  static async uploadFile(
    path: string, 
    file: File | Buffer | string, 
    contentType?: string
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    if (!this.supabase) {
      return { success: false, error: 'Supabase client not configured' };
    }

    try {
      const { data, error } = await this.supabase.storage
        .from('assets')
        .upload(path, file, {
          contentType,
          upsert: true
        });

      if (error) {
        console.error('Error uploading file:', error);
        return { success: false, error: error.message };
      }

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from('assets')
        .getPublicUrl(path);

      return { success: true, url: urlData.publicUrl };
    } catch (error) {
      console.error('Exception uploading file:', error);
      return { success: false, error: 'Failed to upload file' };
    }
  }

  /**
   * Delete file from assets bucket
   */
  static async deleteFile(path: string): Promise<{ success: boolean; error?: string }> {
    if (!this.supabase) {
      return { success: false, error: 'Supabase client not configured' };
    }

    try {
      const { error } = await this.supabase.storage
        .from('assets')
        .remove([path]);

      if (error) {
        console.error('Error deleting file:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Exception deleting file:', error);
      return { success: false, error: 'Failed to delete file' };
    }
  }

  /**
   * Get public URL for file
   */
  static getPublicUrl(path: string): string | null {
    if (!this.supabase) {
      return null;
    }

    const { data } = this.supabase.storage
      .from('assets')
      .getPublicUrl(path);

    return data.publicUrl;
  }
} 