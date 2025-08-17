-- Progress-first flow migration for StoryShort
-- This migration adds progress tracking and pipeline timestamps
-- Run this in your Supabase SQL Editor

-- Add progress tracking columns
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'storyboard_generated',
  ADD COLUMN IF NOT EXISTS progress jsonb,
  ADD COLUMN IF NOT EXISTS final_video_url text;

-- Add pipeline timestamps for tracking each stage
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS script_started_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS script_done_at    timestamptz NULL,
  ADD COLUMN IF NOT EXISTS storyboard_started_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS storyboard_done_at    timestamptz NULL,
  ADD COLUMN IF NOT EXISTS assets_started_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS assets_done_at    timestamptz NULL,
  ADD COLUMN IF NOT EXISTS render_started_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS render_done_at    timestamptz NULL;

-- Update status constraint to include all valid states
ALTER TABLE public.videos DROP CONSTRAINT IF EXISTS videos_status_check;
ALTER TABLE public.videos 
ADD CONSTRAINT videos_status_check CHECK (status IN (
  'pending',
  'script_started',
  'script_generated',
  'storyboard_started', 
  'storyboard_generated',
  'assets_started',
  'assets_generating',
  'assets_generated',
  'render_started',
  'rendering',
  'completed',
  'failed'
));

-- Create index on status for performance
CREATE INDEX IF NOT EXISTS idx_videos_status_progress ON public.videos(status);

-- Add comments for documentation
COMMENT ON COLUMN public.videos.progress IS 'JSON object tracking generation progress: {imagesDone: number, imagesTotal: number, audioDone: boolean, captionsDone: boolean}';
COMMENT ON COLUMN public.videos.final_video_url IS 'URL to the final rendered video with burned-in subtitles';
COMMENT ON COLUMN public.videos.script_started_at IS 'When script generation started';
COMMENT ON COLUMN public.videos.script_done_at IS 'When script generation completed';
COMMENT ON COLUMN public.videos.storyboard_started_at IS 'When storyboard generation started';
COMMENT ON COLUMN public.videos.storyboard_done_at IS 'When storyboard generation completed';
COMMENT ON COLUMN public.videos.assets_started_at IS 'When asset generation started';
COMMENT ON COLUMN public.videos.assets_done_at IS 'When asset generation completed';
COMMENT ON COLUMN public.videos.render_started_at IS 'When video rendering started';
COMMENT ON COLUMN public.videos.render_done_at IS 'When video rendering completed';

-- Verify the migration
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'videos' 
AND table_schema = 'public'
AND column_name IN ('status', 'progress', 'final_video_url', 'script_started_at', 'script_done_at', 'storyboard_started_at', 'storyboard_done_at', 'assets_started_at', 'assets_done_at', 'render_started_at', 'render_done_at')
ORDER BY column_name;