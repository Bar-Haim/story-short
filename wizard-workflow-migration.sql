-- Wizard workflow migration for StoryShort
-- This migration adds columns needed for the 4-step wizard with explicit user approvals
-- Run this in your Supabase SQL Editor

-- Add new columns for wizard workflow
ALTER TABLE public.videos 
  ADD COLUMN IF NOT EXISTS script_text TEXT,
  ADD COLUMN IF NOT EXISTS storyboard_version INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dirty_scenes INTEGER[] DEFAULT '{}';

-- Update status constraint to include new wizard states
ALTER TABLE public.videos DROP CONSTRAINT IF EXISTS videos_status_check;
ALTER TABLE public.videos 
ADD CONSTRAINT videos_status_check CHECK (status IN (
  'pending',
  'script_generated',
  'script_approved',
  'storyboard_generated',
  'assets_generating',
  'assets_generated',
  'rendering',
  'completed',
  'script_failed',
  'storyboard_failed',
  'assets_failed',
  'render_failed'
));

-- Create indexes for better performance on new columns
CREATE INDEX IF NOT EXISTS idx_videos_script_text ON public.videos(script_text) WHERE script_text IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_videos_storyboard_version ON public.videos(storyboard_version);

-- Add comments for documentation
COMMENT ON COLUMN public.videos.script_text IS 'User-approved script text used for TTS and captions';
COMMENT ON COLUMN public.videos.storyboard_version IS 'Version counter incremented on any storyboard edit';
COMMENT ON COLUMN public.videos.dirty_scenes IS 'Array of scene indices needing image regeneration';

-- Migrate existing data: copy script to script_text where available
UPDATE public.videos 
SET script_text = script 
WHERE script IS NOT NULL AND script_text IS NULL;

-- Verify the migration
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'videos' 
AND table_schema = 'public'
AND column_name IN ('script_text', 'storyboard_version', 'dirty_scenes')
ORDER BY column_name;