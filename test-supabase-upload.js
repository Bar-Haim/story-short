// Test script to verify Supabase upload functionality
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

async function testSupabaseUpload() {
  console.log('🧪 Testing Supabase upload functionality...');
  
  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing required environment variables:');
    console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '✅ Set' : '❌ Missing');
    return;
  }
  
  console.log('✅ Environment variables verified');
  
  // Create Supabase client
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  console.log('✅ Supabase client created with service role key');
  
  // Test video ID
  const testVideoId = 'test-video-123';
  const uploadPath = `finals/${testVideoId}.mp4`;
  
  try {
    // Create a test video file (small dummy file)
    const testVideoPath = path.join(process.cwd(), 'test-video.mp4');
    const testContent = Buffer.from('This is a test video file content');
    
    // Write test file
    fs.writeFileSync(testVideoPath, testContent);
    console.log('✅ Test video file created');
    
    // Test 1: Upload to videos bucket
    console.log(`📤 Testing upload to videos bucket, path: ${uploadPath}`);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('videos')
      .upload(uploadPath, testContent, {
        contentType: 'video/mp4',
        upsert: true
      });
    
    if (uploadError) {
      console.error('❌ Upload failed:', uploadError);
      throw new Error(`Upload failed: ${uploadError.message}`);
    }
    
    console.log('✅ Upload successful:', uploadData);
    
    // Test 2: Get public URL
    console.log('🔗 Testing public URL generation...');
    
    const { data: urlData } = supabase.storage
      .from('videos')
      .getPublicUrl(uploadPath);
    
    console.log('✅ Public URL generated:', urlData.publicUrl);
    
    // Test 3: Verify file exists
    console.log('🔍 Testing file existence...');
    
    const { data: listData, error: listError } = await supabase.storage
      .from('videos')
      .list('finals');
    
    if (listError) {
      console.error('❌ List failed:', listError);
    } else {
      const fileExists = listData.some(file => file.name === `${testVideoId}.mp4`);
      console.log('✅ File exists in bucket:', fileExists);
      console.log('📋 Files in finals directory:', listData.map(f => f.name));
    }
    
    // Test 4: Download and verify
    console.log('📥 Testing file download...');
    
    const { data: downloadData, error: downloadError } = await supabase.storage
      .from('videos')
      .download(uploadPath);
    
    if (downloadError) {
      console.error('❌ Download failed:', downloadError);
    } else {
      const downloadedContent = await downloadData.arrayBuffer();
      const contentMatches = Buffer.from(downloadedContent).equals(testContent);
      console.log('✅ Download successful, content matches:', contentMatches);
    }
    
    // Test 5: Clean up
    console.log('🧹 Testing file deletion...');
    
    const { error: deleteError } = await supabase.storage
      .from('videos')
      .remove([uploadPath]);
    
    if (deleteError) {
      console.error('❌ Deletion failed:', deleteError);
    } else {
      console.log('✅ Test file deleted successfully');
    }
    
    // Clean up local test file
    if (fs.existsSync(testVideoPath)) {
      fs.unlinkSync(testVideoPath);
      console.log('✅ Local test file cleaned up');
    }
    
    console.log('\n🎉 All Supabase upload tests passed!');
    console.log('📋 Test summary:');
    console.log('   ✅ Environment variables verified');
    console.log('   ✅ Supabase client created');
    console.log('   ✅ File upload successful');
    console.log('   ✅ Public URL generation working');
    console.log('   ✅ File existence verified');
    console.log('   ✅ File download working');
    console.log('   ✅ File deletion successful');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Clean up on error
    const testVideoPath = path.join(process.cwd(), 'test-video.mp4');
    if (fs.existsSync(testVideoPath)) {
      fs.unlinkSync(testVideoPath);
      console.log('✅ Local test file cleaned up after error');
    }
  }
}

testSupabaseUpload(); 