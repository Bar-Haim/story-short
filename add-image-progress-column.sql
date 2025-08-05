-- Add image_upload_progress column to track real-time image upload progress
ALTER TABLE public.videos 
ADD COLUMN IF NOT EXISTS image_upload_progress INTEGER DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.videos.image_upload_progress IS 'Progress percentage (0-100) for image uploads during asset generation';

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'videos' AND column_name = 'image_upload_progress';

-- Show table structure
\d public.videos 