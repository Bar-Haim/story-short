# Supabase Storage Setup Guide

## 🗂️ Required Storage Buckets

The application needs a storage bucket called `assets` to store video assets.

### 1. Create the Storage Bucket

1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **Create a new bucket**
4. Set the following:
   - **Name**: `assets`
   - **Public bucket**: ✅ Check this (so assets can be accessed via URL)
   - **File size limit**: 50 MB (or higher if needed)
   - **Allowed MIME types**: Leave empty for all types

### 2. Set Up Storage Policies

After creating the bucket, you need to set up policies to allow uploads and downloads:

#### Policy 1: Allow Public Read Access
```sql
-- Allow anyone to read files from the assets bucket
CREATE POLICY "Public read access" ON storage.objects
FOR SELECT USING (bucket_id = 'assets');
```

#### Policy 2: Allow Authenticated Uploads
```sql
-- Allow authenticated users to upload files
CREATE POLICY "Authenticated uploads" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'assets' AND auth.role() = 'authenticated');
```

#### Policy 3: Allow All Operations (for development)
```sql
-- Allow all operations on assets bucket (for development only)
CREATE POLICY "Allow all operations" ON storage.objects
FOR ALL USING (bucket_id = 'assets');
```

### 3. Test the Storage Setup

You can test if the storage is working by running the API test:

```bash
node test-apis.js
```

The Supabase test should show "✅ Working" if everything is set up correctly.

## 📁 Expected File Structure

The application will create the following structure in your `assets` bucket:

```
assets/
├── renders/
│   └── {video-id}/
│       ├── scene_1.png
│       ├── scene_2.png
│       ├── ...
│       ├── audio.mp3
│       └── captions.vtt
```

## 🔧 Troubleshooting

### "Bucket not found" Error
- Make sure the bucket name is exactly `assets` (lowercase)
- Check that the bucket is created in the correct project

### "Permission denied" Error
- Make sure the storage policies are set up correctly
- Check that RLS (Row Level Security) is properly configured

### "File upload failed" Error
- Check the file size limit in your bucket settings
- Verify the MIME types are allowed 