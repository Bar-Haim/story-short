-- Add final_video_url column to videos table
-- Run this in your Supabase SQL Editor

-- Add the final_video_url column
ALTER TABLE public.videos 
ADD COLUMN IF NOT EXISTS final_video_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.videos.final_video_url IS 'URL to the final rendered MP4 video with burned-in subtitles';

-- Update the status enum to include 'rendering' if not already present
-- (This should already be there, but just in case)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type 
        WHERE typname = 'video_status_enum'
    ) THEN
        CREATE TYPE video_status_enum AS ENUM (
            'pending', 
            'script_generated', 
            'generating_assets', 
            'assets_generated', 
            'rendering', 
            'completed', 
            'failed'
        );
    END IF;
END$$;

-- Verify the column was added
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'videos' 
AND table_schema = 'public'
AND column_name = 'final_video_url';

-- Show current table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'videos' 
AND table_schema = 'public'
ORDER BY ordinal_position; 