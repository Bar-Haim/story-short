-- Comprehensive Supabase Fix Script for StoryShort
-- Run this in your Supabase SQL Editor to fix all setup issues

-- ========================================
-- 1. FIX DATABASE SCHEMA
-- ========================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing videos table if it exists (to recreate with proper schema)
DROP TABLE IF EXISTS public.videos CASCADE;

-- Create videos table with complete schema
CREATE TABLE public.videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 
    'script_generated', 
    'generating_assets', 
    'assets_generated', 
    'rendering', 
    'completed', 
    'failed'
  )),
  input_text TEXT NOT NULL,
  script TEXT,
  storyboard_json JSONB,
  audio_url TEXT,
  captions_url TEXT,
  image_urls TEXT[],
  total_duration INTEGER,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_videos_status ON public.videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON public.videos(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (for development)
CREATE POLICY "Allow all operations on videos" ON public.videos
  FOR ALL USING (true);

-- Create function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_videos_updated_at ON public.videos;
CREATE TRIGGER update_videos_updated_at
  BEFORE UPDATE ON public.videos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert a test record
INSERT INTO public.videos (input_text, status, script) 
VALUES (
  'Test video generation',
  'pending',
  'HOOK: This is a test hook\nBODY: This is a test body\nCTA: This is a test CTA'
) ON CONFLICT DO NOTHING;

-- ========================================
-- 2. FIX STORAGE SETUP
-- ========================================

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop all existing storage policies to start fresh
DROP POLICY IF EXISTS "Allow all operations" ON storage.objects;
DROP POLICY IF EXISTS "Allow all operations on assets" ON storage.objects;
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Enable read access for all users" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access" ON storage.objects;
DROP POLICY IF EXISTS "Allow insert into assets bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow read from assets bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow update in assets bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete from assets bucket" ON storage.objects;

-- Create comprehensive policies for the assets bucket
CREATE POLICY "Allow insert into assets bucket"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'assets');

CREATE POLICY "Allow read from assets bucket"
ON storage.objects
FOR SELECT
USING (bucket_id = 'assets');

CREATE POLICY "Allow update in assets bucket"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'assets')
WITH CHECK (bucket_id = 'assets');

CREATE POLICY "Allow delete from assets bucket"
ON storage.objects
FOR DELETE
USING (bucket_id = 'assets');

-- ========================================
-- 3. CREATE ASSETS BUCKET
-- ========================================

-- Insert the assets bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'assets',
    'assets',
    true,
    52428800, -- 50MB
    ARRAY['image/*', 'audio/*', 'video/*', 'text/*', 'application/*']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ========================================
-- 4. VERIFICATION QUERIES
-- ========================================

-- Verify videos table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'videos' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Verify storage policies
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname LIKE '%assets%'
ORDER BY policyname;

-- Verify assets bucket exists
SELECT 
    id,
    name,
    public,
    file_size_limit,
    created_at
FROM storage.buckets 
WHERE id = 'assets';

-- ========================================
-- 5. SUCCESS MESSAGE
-- ========================================

SELECT '✅ Supabase Setup Complete!' as status;
SELECT '🎯 Database schema and storage configured successfully' as message;
SELECT '📁 Assets bucket and policies ready' as ready_status;
SELECT '🚀 Ready for video generation pipeline' as pipeline_status; 