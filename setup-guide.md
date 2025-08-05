# StoryShort Video Generation Pipeline Setup Guide

## 🎯 **Goal**
Ensure the entire pipeline (script → storyboard → images → audio → captions → final video) completes without errors and saves all files correctly to Supabase.

## 📋 **Current Status**
Based on the verification script, here's what we found:

### ✅ **Working Components:**
- Environment Variables: ✅ Configured
- OpenAI API: ✅ Working (68 models available)
- ElevenLabs API: ✅ Working (24 voices available)
- Supabase Connection: ✅ Configured
- Database Table: ✅ Working

### ❌ **Issues to Fix:**
1. **Missing database columns** - Videos table missing required columns
2. **Storage RLS policy issues** - Row-level security blocking bucket creation

## 🔧 **Step-by-Step Fix Instructions**

### **Step 1: Fix Supabase Database and Storage**

1. **Go to your Supabase project dashboard**
   - Navigate to: https://supabase.com/dashboard
   - Select your project

2. **Open the SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query"

3. **Run the Complete Fix Script**
   - Copy the entire contents of `complete-fix.sql`
   - Paste it into the SQL Editor
   - Click "Run"

4. **Verify the Results**
   - You should see success messages for each column addition
   - The storage policies should be created
   - The table structure should show all required columns

### **Step 2: Test the Fix**

After running the SQL script, test everything:

```bash
node verify-and-fix-pipeline.js
```

You should see:
- ✅ Environment Variables: Configured
- ✅ OpenAI API: Working
- ✅ ElevenLabs API: Working
- ✅ Supabase Connection: Configured
- ✅ Database Table: Working
- ✅ Storage Bucket: Working

### **Step 3: Test the Full Pipeline**

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Open the application in your browser:**
   - Go to: http://localhost:4000

3. **Test video generation:**
   - Enter a story prompt
   - Click "Generate Script"
   - Wait for script generation
   - Click "Make Video"
   - Monitor the progress through all steps

## 📊 **Expected Pipeline Flow**

### **1. Script Generation** ✅
- **Service**: OpenRouter (GPT-4)
- **Output**: 3-part script (HOOK, BODY, CTA)
- **Storage**: Saved to `videos.script` column

### **2. Storyboard Generation** ✅
- **Service**: OpenRouter (GPT-4)
- **Output**: 6-8 scenes with descriptions and image prompts
- **Storage**: Saved to `videos.storyboard_json` column

### **3. Image Generation** ✅
- **Service**: OpenAI (DALL-E 3)
- **Output**: 6-8 vertical images (1080x1920)
- **Storage**: Uploaded to `assets/renders/{video-id}/scene_*.png`
- **Database**: URLs saved to `videos.image_urls` array

### **4. Audio Generation** ✅
- **Service**: ElevenLabs TTS
- **Output**: MP3 audio file of full script
- **Storage**: Uploaded to `assets/renders/{video-id}/audio.mp3`
- **Database**: URL saved to `videos.audio_url`

### **5. Captions Generation** ✅
- **Service**: Local generation
- **Output**: VTT captions file with timing
- **Storage**: Uploaded to `assets/renders/{video-id}/captions.vtt`
- **Database**: URL saved to `videos.captions_url`

### **6. Final Status Update** ✅
- **Database**: Status updated to `assets_generated`
- **Duration**: Total duration saved to `videos.total_duration`

## 🎬 **User Experience Flow**

### **After Successful Generation:**
1. **Automatic Preview**: Video opens in preview window
2. **Scene Editor**: User can edit each scene (images, text, etc.)
3. **Download Options**: User can download individual assets or final video
4. **Share Options**: User can share the generated video

## 🔍 **Troubleshooting**

### **If you encounter issues:**

1. **Check the logs** in your terminal for detailed error messages
2. **Run the verification script** again: `node verify-and-fix-pipeline.js`
3. **Check Supabase logs** in the dashboard for database/storage errors
4. **Verify API keys** are correct and have sufficient credits

### **Common Issues:**

- **"Billing hard limit reached"**: Add billing info to OpenAI account
- **"Storage policy violation"**: Run the SQL fix script again
- **"Missing column"**: Ensure all SQL commands executed successfully
- **"API key invalid"**: Check your `.env.local` file

## ✅ **Success Criteria**

The pipeline is working correctly when:

1. ✅ Script generates successfully
2. ✅ Storyboard creates 6-8 scenes
3. ✅ Images generate and upload (6-8 vertical images)
4. ✅ Audio generates and uploads (MP3 file)
5. ✅ Captions generate and upload (VTT file)
6. ✅ Database updates with all URLs and metadata
7. ✅ User can preview and edit the generated video

## 🎉 **Next Steps**

Once the pipeline is working:

1. **Test with different story prompts**
2. **Customize voice selection**
3. **Adjust image generation parameters**
4. **Add video rendering capabilities**
5. **Implement user authentication**
6. **Add video sharing features**

---

**Need Help?** If you encounter any issues, check the troubleshooting section above or run the verification script to identify specific problems. 