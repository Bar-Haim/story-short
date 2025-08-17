-- Supabase Storage Setup for Asset Orchestration
-- Run this script in your Supabase SQL editor to create the required buckets

-- Create renders-audio bucket for TTS audio files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('renders-audio', 'renders-audio', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Create renders-captions bucket for SRT caption files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('renders-captions', 'renders-captions', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Create public read policies for audio files
CREATE POLICY "Public read audio" ON storage.objects 
FOR SELECT USING (bucket_id = 'renders-audio');

-- Create public read policies for caption files
CREATE POLICY "Public read captions" ON storage.objects 
FOR SELECT USING (bucket_id = 'renders-captions');

-- Create insert policies for authenticated users (optional, for admin uploads)
CREATE POLICY "Authenticated users can upload audio" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'renders-audio' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can upload captions" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'renders-captions' AND auth.role() = 'authenticated');

-- Create update policies for authenticated users (optional, for admin updates)
CREATE POLICY "Authenticated users can update audio" ON storage.objects 
FOR UPDATE USING (bucket_id = 'renders-audio' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update captions" ON storage.objects 
FOR UPDATE USING (bucket_id = 'renders-captions' AND auth.role() = 'authenticated');

-- Create delete policies for authenticated users (optional, for admin cleanup)
CREATE POLICY "Authenticated users can delete audio" ON storage.objects 
FOR DELETE USING (bucket_id = 'renders-audio' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete captions" ON storage.objects 
FOR DELETE USING (bucket_id = 'renders-captions' AND auth.role() = 'authenticated'); 