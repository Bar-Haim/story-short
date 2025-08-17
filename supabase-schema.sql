-- Supabase Schema for StoryShort Video Generation
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create videos table with EXACT column names from spec
CREATE TABLE IF NOT EXISTS public.videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  input_text TEXT NOT NULL,
  script TEXT,
  storyboard_json JSONB,
  audio_url TEXT,
  captions_url TEXT,
  image_urls JSONB,
  final_video_url TEXT,
  total_duration INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'script_generated',
    'script_approved',
    'storyboard_generated',
    'storyboard_failed',
    'assets_generating',
    'assets_generated',
    'assets_failed',
    'rendering',
    'completed',
    'failed',
    'render_failed'
  )),
  script_text TEXT, -- User-approved script for TTS and captions
  storyboard_version INTEGER DEFAULT 1, -- Increment on storyboard edits
  dirty_scenes JSONB DEFAULT '[]'::JSONB, -- Array of scene indices needing image regen
  error_message TEXT,
  image_upload_progress INTEGER DEFAULT 0 CHECK (image_upload_progress >= 0 AND image_upload_progress <= 100),
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

-- Create storage buckets for assets
-- Note: These will be created by the storage setup script
-- renders/images/...
-- renders/audio/...
-- renders/captions/...
-- renders/videos/...

-- ============================================================================
-- MIGRATION: Add missing columns for wizard workflow (idempotent)
-- ============================================================================

-- Add columns if they don't exist
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS script_text TEXT,
  ADD COLUMN IF NOT EXISTS storyboard_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS dirty_scenes INTEGER[] NOT NULL DEFAULT '{}';

-- Update status check constraint to include all workflow states
ALTER TABLE public.videos DROP CONSTRAINT IF EXISTS videos_status_check;
ALTER TABLE public.videos ADD CONSTRAINT videos_status_check 
  CHECK (status IN (
    'pending',
    'created', 
    'script_generating',
    'script_generated',
    'script_approved',
    'storyboard_generated',
    'storyboard_failed',
    'assets_generating',
    'assets_generated',
    'assets_failed',
    'rendering',
    'completed',
    'failed',
    'render_failed'
  ));

-- Add helpful comments
COMMENT ON COLUMN public.videos.script_text IS 'User-approved script for TTS and captions (wizard workflow)';
COMMENT ON COLUMN public.videos.storyboard_version IS 'Increment on any storyboard edit';
COMMENT ON COLUMN public.videos.dirty_scenes IS 'Array of scene indices needing image regeneration';

-- ============================================================================
-- FIX: Add updated_at column and safe trigger (addresses "no field updated_at")
-- ============================================================================

-- A) Ensure updated_at column exists
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- B) Upsert trigger function to maintain updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- C) Create trigger only if it doesn't exist yet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'tr_videos_set_updated_at'
  ) THEN
    CREATE TRIGGER tr_videos_set_updated_at
    BEFORE UPDATE ON public.videos
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- D) Initialize updated_at for existing rows
UPDATE public.videos
SET updated_at = COALESCE(updated_at, NOW())
WHERE updated_at IS NULL;

-- IMPORTANT: refresh PostgREST schema cache so the API sees new columns
NOTIFY pgrst, 'reload schema'; 

-- Add progress column for rendering progress tracking
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS progress integer DEFAULT 0;

-- Add total_duration column for video duration in milliseconds
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS total_duration integer; 