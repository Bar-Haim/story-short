// Video types for StoryShort application

export type VideoStatus = 
  | 'pending'
  | 'script_generated'
  | 'script_approved' 
  | 'storyboard_generated'
  | 'assets_generating'
  | 'assets_generated'
  | 'rendering'
  | 'completed'
  | 'script_failed'
  | 'storyboard_failed'
  | 'assets_failed'
  | 'render_failed';

export interface VideoProgress {
  imagesDone: number;
  imagesTotal: number;
  audioDone: boolean;
  captionsDone: boolean;
}

export interface VideoStatusResponse {
  id: string;
  status: VideoStatus;
  final_video_url: string | null;
  progress: VideoProgress;
  canEdit: boolean;
  canFinalize: boolean;
  canView: boolean;
  error_message?: string;
  image_urls?: string[];
  audio_url?: string;
  captions_url?: string;
  storyboard_json?: Storyboard;
  total_duration?: number;
  created_at?: string;
  updated_at?: string;
  ready?: {
    images: boolean;
    audio: boolean;
    captions: boolean;
  };
  render_progress?: number;
}

export interface Scene {
  id: number;
  text: string;
  image_prompt?: string;
  duration: number;
  startTime?: number;
  endTime?: number;
}

export interface Storyboard {
  scenes: Scene[];
  totalDuration: number;
}

export interface VideoData {
  id: string;
  status: VideoStatus;
  input_text: string;
  script_text?: string;
  storyboard_json?: Storyboard;
  audio_url?: string;
  captions_url?: string;
  image_urls?: string[];
  final_video_url?: string;
  progress?: VideoProgress;
  error_message?: string;
  created_at: string;
  updated_at: string;
  storyboard_version?: number;
  dirty_scenes?: number[];
  // Legacy field for backwards compatibility
  script?: string;
}

// Alias for backwards compatibility
export type Video = VideoData;

// API response wrapper
export interface ApiResponse<T> {
  data: T;
  error?: string;
}

// For video creation requests
export interface CreateVideoRequest {
  input_text: string;
}

export interface GenerateAssetsRequest {
  id: string;
}

export interface FinalizeVideoRequest {
  id: string;
}

// New wizard-specific request types
export interface UpdateScriptRequest {
  id: string;
  script_text: string;
}

export interface ReorderScenesRequest {
  id: string;
  order: number[];
}

export interface UpdateSceneRequest {
  id: string;
  index: number;
  text?: string;
  image_prompt?: string;
}

export interface DeleteSceneRequest {
  id: string;
  index: number;
}

export interface RegenerateSceneImageRequest {
  id: string;
  index: number;
}