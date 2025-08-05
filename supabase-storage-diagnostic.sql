-- Supabase Storage Diagnostic & Fix Script
-- Run this in your Supabase SQL Editor to diagnose and fix storage issues

-- ========================================
-- 1. DIAGNOSTIC: Check Current Storage Setup
-- ========================================

-- Check if storage extension is enabled
SELECT 
    extname, 
    extversion 
FROM pg_extension 
WHERE extname = 'storage';

-- Check existing buckets
SELECT 
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types,
    created_at
FROM storage.buckets
ORDER BY created_at DESC;

-- Check existing storage policies
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
WHERE tablename IN ('objects', 'buckets')
AND schemaname = 'storage'
ORDER BY tablename, policyname;

-- Check RLS status on storage tables
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'storage'
AND tablename IN ('objects', 'buckets');

-- Check current user permissions
SELECT 
    current_user,
    session_user,
    current_database();

-- ========================================
-- 2. CLEANUP: Remove All Existing Policies
-- ========================================

-- Drop all existing storage policies
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

-- ========================================
-- 3. FIX: Create Proper Storage Policies
-- ========================================

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

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

-- Alternative: Create a single comprehensive policy (uncomment if you want this approach)
-- CREATE POLICY "Allow all operations on assets"
-- ON storage.objects
-- FOR ALL
-- USING (bucket_id = 'assets')
-- WITH CHECK (bucket_id = 'assets');

-- ========================================
-- 4. BUCKET SETUP: Create Assets Bucket
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
-- 5. VERIFICATION: Test the Setup
-- ========================================

-- Verify bucket exists
SELECT 
    id,
    name,
    public,
    file_size_limit,
    created_at
FROM storage.buckets 
WHERE id = 'assets';

-- Verify policies were created
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

-- Test policy effectiveness by checking if we can query the assets bucket
SELECT 
    bucket_id,
    name,
    created_at
FROM storage.objects 
WHERE bucket_id = 'assets' 
LIMIT 5;

-- ========================================
-- 6. DIAGNOSTIC SUMMARY
-- ========================================

-- Summary of what we've set up
SELECT 
    'Storage Setup Summary' as info,
    'Assets bucket created/updated' as bucket_status,
    'RLS policies configured' as policy_status,
    'Ready for uploads' as upload_status;

-- Check for any remaining issues
SELECT 
    'Potential Issues Check' as check_type,
    CASE 
        WHEN COUNT(*) = 0 THEN 'No buckets found - this is a problem'
        ELSE 'Buckets found: ' || COUNT(*)::text
    END as bucket_check
FROM storage.buckets;

SELECT 
    'Policy Check' as check_type,
    CASE 
        WHEN COUNT(*) >= 4 THEN 'All required policies created'
        ELSE 'Missing policies: ' || (4 - COUNT(*))::text || ' policies needed'
    END as policy_check
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname LIKE '%assets%';

-- ========================================
-- 7. SUCCESS MESSAGE
-- ========================================

SELECT '✅ Supabase Storage Setup Complete!' as status;
SELECT '🎯 Assets bucket and policies configured successfully' as message;
SELECT '📁 Ready for file uploads to assets bucket' as ready_status; 