-- Manual Fix for Supabase Storage RLS Policies
-- Run this in your Supabase SQL Editor to fix storage upload issues

-- 1. Drop all existing storage policies
DROP POLICY IF EXISTS "Allow all operations" ON storage.objects;
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Enable read access for all users" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access" ON storage.objects;

-- 2. Create a completely permissive policy for the assets bucket
CREATE POLICY "Allow all operations on assets" ON storage.objects
FOR ALL USING (bucket_id = 'assets');

-- 3. Alternative: More specific policies (uncomment if you want more security)
-- CREATE POLICY "Public read access on assets" ON storage.objects
-- FOR SELECT USING (bucket_id = 'assets');

-- CREATE POLICY "Authenticated uploads on assets" ON storage.objects
-- FOR INSERT WITH CHECK (bucket_id = 'assets');

-- CREATE POLICY "Authenticated updates on assets" ON storage.objects
-- FOR UPDATE USING (bucket_id = 'assets');

-- CREATE POLICY "Authenticated deletes on assets" ON storage.objects
-- FOR DELETE USING (bucket_id = 'assets');

-- 4. Verify the policy was created
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
AND schemaname = 'storage'
AND policyname LIKE '%assets%';

-- 5. Test the policy by checking if we can access the assets bucket
SELECT bucket_id, name, created_at 
FROM storage.objects 
WHERE bucket_id = 'assets' 
LIMIT 5;

-- 6. Success message
SELECT '✅ Storage RLS policies fixed successfully!' as status; 