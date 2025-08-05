# Supabase Setup Guide for StoryShort

This guide will help you set up Supabase for the StoryShort video generation application.

## 🚀 Quick Setup

### 1. Create Supabase Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: `storyshort` (or your preferred name)
   - **Database Password**: Generate a strong password
   - **Region**: Choose closest to your users
5. Click "Create new project"
6. Wait for the project to be created (2-3 minutes)

### 2. Get Project Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (starts with `https://`)
   - **Anon public key** (starts with `eyJ`)

### 3. Configure Environment Variables

Create or update your `.env.local` file in the project root:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# API Keys (if not already configured)
OPENROUTER_API_KEY=your-openrouter-key
OPENAI_API_KEY=your-openai-key
ELEVENLABS_API_KEY=your-elevenlabs-key
```

### 4. Run Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click "New query"
3. Copy and paste the contents of `supabase-schema.sql`
4. Click "Run" to execute the schema

### 5. Set Up Storage

1. In your Supabase dashboard, go to **Storage**
2. Click "Create a new bucket"
3. Enter:
   - **Name**: `assets`
   - **Public bucket**: ✅ Check this
   - **File size limit**: `50 MB`
   - **Allowed MIME types**: Leave empty (allow all)
4. Click "Create bucket"

### 6. Configure Storage Policies

1. Go to **SQL Editor** → **New query**
2. Copy and paste this SQL:

```sql
-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policies for assets bucket
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
```

3. Click "Run"

## 📊 Database Schema

The application uses the following table structure:

### `videos` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key, auto-generated |
| `status` | TEXT | Video generation status |
| `input_text` | TEXT | User's original input |
| `script` | TEXT | Generated script |
| `storyboard_json` | JSONB | AI-generated storyboard |
| `audio_url` | TEXT | URL to generated audio file |
| `captions_url` | TEXT | URL to VTT captions file |
| `image_urls` | TEXT[] | Array of image URLs |
| `total_duration` | INTEGER | Video duration in seconds |
| `error_message` | TEXT | Error details if failed |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

### Status Values

- `pending` - Initial state
- `script_generated` - Script created successfully
- `generating_assets` - Creating images, audio, captions
- `assets_generated` - All assets created
- `rendering` - Final video rendering
- `completed` - Video ready
- `failed` - Error occurred

## 🗄️ Storage Structure

Files are organized in the `assets` bucket as follows:

```
assets/
├── renders/
│   └── {video-id}/
│       ├── images/
│       │   ├── scene_1.png
│       │   ├── scene_2.png
│       │   └── ...
│       ├── audio/
│       │   └── voiceover.mp3
│       └── captions/
│           └── subtitles.vtt
└── test/
    └── upload-test.txt
```

## 🔧 Testing Your Setup

### 1. Test Database Connection

Run the test script:

```bash
node check-supabase-simple.js
```

### 2. Test Storage Upload

Run the storage test:

```bash
node test-upload.js
```

### 3. Test Complete Pipeline

1. Start your development server: `npm run dev`
2. Go to `http://localhost:4000`
3. Enter some text and click "Generate Video"
4. Check the console for any errors

## 🚨 Troubleshooting

### Common Issues

#### 1. "relation 'videos' does not exist"
- **Solution**: Run the `supabase-schema.sql` script in SQL Editor

#### 2. "new row violates row-level security policy"
- **Solution**: Run the storage policies SQL script

#### 3. "Assets bucket does not exist"
- **Solution**: Create the `assets` bucket in Storage section

#### 4. "Invalid API key"
- **Solution**: Check your `.env.local` file and restart the dev server

#### 5. "Failed to upload file"
- **Solution**: Verify storage policies are correctly set

### Debug Commands

```bash
# Test environment variables
node test-env.js

# Test all APIs
node test-apis.js

# Test Supabase connection
node check-supabase-simple.js

# Test storage upload
node test-upload.js
```

## 🔒 Security Considerations

### For Production

1. **Enable Row Level Security (RLS)** on all tables
2. **Create user-specific policies** instead of allowing all operations
3. **Use service role key** for server-side operations
4. **Implement authentication** for user access
5. **Set up proper CORS** policies
6. **Monitor API usage** and set rate limits

### Current Development Setup

The current setup allows all operations for development purposes. For production, you should:

1. Implement user authentication
2. Create user-specific policies
3. Restrict file access based on ownership
4. Add rate limiting
5. Monitor and log all operations

## 📈 Monitoring

### Database Monitoring

1. Go to **Dashboard** → **Database**
2. Monitor:
   - Active connections
   - Query performance
   - Storage usage

### Storage Monitoring

1. Go to **Storage** → **Buckets**
2. Monitor:
   - File count
   - Storage usage
   - Bandwidth usage

### API Monitoring

1. Go to **Settings** → **API**
2. Monitor:
   - API usage
   - Rate limits
   - Error rates

## 🎯 Next Steps

After completing this setup:

1. ✅ Test the complete video generation pipeline
2. ✅ Verify all assets are uploaded correctly
3. ✅ Check that database records are created and updated
4. ✅ Test error handling and recovery
5. ✅ Implement user authentication (for production)
6. ✅ Set up monitoring and alerts
7. ✅ Configure backup and recovery procedures

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review the console logs for detailed error messages
3. Verify all environment variables are set correctly
4. Ensure the Supabase project is active and accessible
5. Check the Supabase status page for any service issues

---

**Happy coding! 🚀** 