-- Complete Fix for StoryShort Video Generation Pipeline
-- Run this in your Supabase SQL Editor to fix all issues

-- 1. Fix Storage RLS Policies
-- ===========================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all operations" ON storage.objects;
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Enable read access for all users" ON storage.objects;

-- Create a policy that allows all operations on the assets bucket
CREATE POLICY "Allow all operations" ON storage.objects
FOR ALL USING (bucket_id = 'assets');

-- Alternative: More restrictive policies (uncomment if you want more security)
-- CREATE POLICY "Public read access" ON storage.objects
-- FOR SELECT USING (bucket_id = 'assets');

-- CREATE POLICY "Authenticated uploads" ON storage.objects
-- FOR INSERT WITH CHECK (bucket_id = 'assets');

-- CREATE POLICY "Authenticated updates" ON storage.objects
-- FOR UPDATE USING (bucket_id = 'assets');

-- CREATE POLICY "Authenticated deletes" ON storage.objects
-- FOR DELETE USING (bucket_id = 'assets');

-- 2. Add Missing Columns to Videos Table
-- ======================================

-- Add audio_url column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'videos' 
                   AND column_name = 'audio_url' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.videos ADD COLUMN audio_url TEXT;
        RAISE NOTICE 'Added audio_url column';
    ELSE
        RAISE NOTICE 'audio_url column already exists';
    END IF;
END $$;

-- Add captions_url column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'videos' 
                   AND column_name = 'captions_url' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.videos ADD COLUMN captions_url TEXT;
        RAISE NOTICE 'Added captions_url column';
    ELSE
        RAISE NOTICE 'captions_url column already exists';
    END IF;
END $$;

-- Add image_urls column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'videos' 
                   AND column_name = 'image_urls' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.videos ADD COLUMN image_urls TEXT[];
        RAISE NOTICE 'Added image_urls column';
    ELSE
        RAISE NOTICE 'image_urls column already exists';
    END IF;
END $$;

-- Add storyboard_json column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'videos' 
                   AND column_name = 'storyboard_json' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.videos ADD COLUMN storyboard_json JSONB;
        RAISE NOTICE 'Added storyboard_json column';
    ELSE
        RAISE NOTICE 'storyboard_json column already exists';
    END IF;
END $$;

-- Add total_duration column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'videos' 
                   AND column_name = 'total_duration' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.videos ADD COLUMN total_duration INTEGER;
        RAISE NOTICE 'Added total_duration column';
    ELSE
        RAISE NOTICE 'total_duration column already exists';
    END IF;
END $$;

-- Add error_message column (for better error tracking)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'videos' 
                   AND column_name = 'error_message' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.videos ADD COLUMN error_message TEXT;
        RAISE NOTICE 'Added error_message column';
    ELSE
        RAISE NOTICE 'error_message column already exists';
    END IF;
END $$;

-- 3. Create Assets Bucket (if it doesn't exist)
-- =============================================

-- Note: This will be handled by the application, but we need the policies in place first

-- 4. Verify the Changes
-- =====================

-- Show the updated table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'videos' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Show storage policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage';

-- 5. Test the Setup
-- =================

-- Test database access
SELECT COUNT(*) as video_count FROM public.videos;

-- Test storage access (this will show if policies are working)
-- Note: This is just a test query, actual uploads will be done by the application
SELECT bucket_id, name, created_at 
FROM storage.objects 
WHERE bucket_id = 'assets' 
LIMIT 5;

-- 6. Success Message
-- ==================

SELECT '✅ StoryShort pipeline setup completed successfully!' as status; 