-- Placeholder tracking migration for StoryShort
-- This migration adds support for tracking placeholder usage and regeneration
-- Run this in your Supabase SQL Editor

-- Add placeholder tracking columns to videos table
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS placeholder_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scenes_with_placeholders INTEGER[] DEFAULT '{}';

-- Add comments for documentation
COMMENT ON COLUMN public.videos.placeholder_count IS 'Number of scenes that used placeholder images';
COMMENT ON COLUMN public.videos.scenes_with_placeholders IS 'Array of scene indices that used placeholders';

-- Create index for placeholder queries
CREATE INDEX IF NOT EXISTS idx_videos_placeholder_count ON public.videos(placeholder_count) WHERE placeholder_count > 0;

-- Create a function to update placeholder count when storyboard changes
CREATE OR REPLACE FUNCTION update_placeholder_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Count scenes with placeholder_used = true
  IF NEW.storyboard_json IS NOT NULL AND NEW.storyboard_json ? 'scenes' THEN
    NEW.placeholder_count = (
      SELECT COUNT(*) 
      FROM jsonb_array_elements(NEW.storyboard_json->'scenes') AS scene
      WHERE (scene->>'placeholder_used')::boolean = true
    );
    
    -- Update scenes_with_placeholders array
    NEW.scenes_with_placeholders = (
      SELECT ARRAY_AGG(index) 
      FROM (
        SELECT (row_number() OVER () - 1)::int as index, scene
        FROM jsonb_array_elements(NEW.storyboard_json->'scenes') AS scene
        WHERE (scene->>'placeholder_used')::boolean = true
      ) AS placeholder_scenes
    );
  ELSE
    NEW.placeholder_count = 0;
    NEW.scenes_with_placeholders = '{}';
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update placeholder count
DROP TRIGGER IF EXISTS update_videos_placeholder_count ON public.videos;
CREATE TRIGGER update_videos_placeholder_count
  BEFORE UPDATE ON public.videos
  FOR EACH ROW
  EXECUTE FUNCTION update_placeholder_count();

-- Update existing videos to calculate placeholder counts
UPDATE public.videos 
SET 
  placeholder_count = (
    SELECT COUNT(*) 
    FROM jsonb_array_elements(storyboard_json->'scenes') AS scene
    WHERE (scene->>'placeholder_used')::boolean = true
  ),
  scenes_with_placeholders = (
    SELECT ARRAY_AGG(index) 
    FROM (
      SELECT (row_number() OVER () - 1)::int as index, scene
      FROM jsonb_array_elements(storyboard_json->'scenes') AS scene
      WHERE (scene->>'placeholder_used')::boolean = true
    ) AS placeholder_scenes
  )
WHERE storyboard_json IS NOT NULL AND storyboard_json ? 'scenes';

-- Verify the migration
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'videos' 
AND table_schema = 'public'
AND column_name IN ('placeholder_count', 'scenes_with_placeholders')
ORDER BY column_name;

-- Show sample data
SELECT 
    id,
    status,
    placeholder_count,
    scenes_with_placeholders
FROM public.videos 
WHERE placeholder_count > 0
LIMIT 5; 