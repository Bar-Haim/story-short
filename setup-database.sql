-- Create the videos table for StoryShort
-- Run this in your Supabase SQL Editor

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the videos table
CREATE TABLE IF NOT EXISTS public.videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    input_text TEXT,
    script TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Asset generation fields
    storyboard_json JSONB,
    audio_url TEXT,
    captions_url TEXT,
    image_urls TEXT[],
    total_duration INTEGER,
    
    -- Error tracking
    error_message TEXT
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_videos_status ON public.videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON public.videos(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations (you can restrict this later)
CREATE POLICY "Allow all operations" ON public.videos
    FOR ALL USING (true);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a trigger to automatically update updated_at
CREATE TRIGGER update_videos_updated_at 
    BEFORE UPDATE ON public.videos 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert a test record to verify the table works
INSERT INTO public.videos (input_text, script, status) 
VALUES ('Test video', 'HOOK: Test hook\nBODY: Test body\nCTA: Test CTA', 'pending')
ON CONFLICT DO NOTHING;

-- Show the table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'videos' 
AND table_schema = 'public'
ORDER BY ordinal_position; 