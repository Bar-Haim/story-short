-- Supabase Schema for StoryShort Video Generation
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create videos table with complete asset tracking
CREATE TABLE IF NOT EXISTS public.videos (
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

-- Create index on status for faster queries
CREATE INDEX IF NOT EXISTS idx_videos_status ON public.videos(status);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON public.videos(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (you can restrict this later for production)
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

-- Insert a test record (optional)
INSERT INTO public.videos (input_text, status, script) 
VALUES (
  'Test video generation',
  'pending',
  'HOOK: This is a test hook\nBODY: This is a test body\nCTA: This is a test CTA'
) ON CONFLICT DO NOTHING;

-- Create storage bucket for assets
-- Note: This will be handled by the storage setup script 