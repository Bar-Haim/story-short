-- Update database schema to add progress tracking and fix status values
-- Run this in your Supabase SQL Editor

-- Add progress column for detailed tracking
ALTER TABLE public.videos 
ADD COLUMN IF NOT EXISTS progress JSONB DEFAULT '{"imagesDone": 0, "imagesTotal": 0, "audioDone": false, "captionsDone": false}';

-- Update status check constraint to match new required values
ALTER TABLE public.videos DROP CONSTRAINT IF EXISTS videos_status_check;
ALTER TABLE public.videos 
ADD CONSTRAINT videos_status_check CHECK (status IN (
  'pending',
  'script_generated',
  'storyboard_generated',
  'assets_generating',
  'assets_generated',
  'rendering',
  'completed',
  'failed'
));

-- Add comment for documentation
COMMENT ON COLUMN public.videos.progress IS 'JSON object tracking asset generation progress: {imagesDone: number, imagesTotal: number, audioDone: boolean, captionsDone: boolean}';

-- Verify the updates
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'videos' 
AND table_schema = 'public'
AND column_name IN ('progress', 'final_video_url', 'status')
ORDER BY column_name;