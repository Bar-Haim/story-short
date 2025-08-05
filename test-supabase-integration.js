require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

console.log('🧪 Supabase Integration Test');
console.log('============================\n');

// Check environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Missing Supabase environment variables');
  console.log('💡 Please check your .env.local file');
  process.exit(1);
}

console.log('✅ Environment variables found');
console.log('🔗 URL:', supabaseUrl);
console.log('🔑 Key:', supabaseKey.substring(0, 20) + '...');

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSupabaseIntegration() {
  console.log('\n🚀 Starting integration test...\n');
  
  try {
    // ========================================
    // 1. TEST DATABASE CONNECTION
    // ========================================
    console.log('📊 Step 1: Testing database connection...');
    
    const { data: testData, error: testError } = await supabase
      .from('videos')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.log('❌ Database connection failed:', testError.message);
      return false;
    }
    
    console.log('✅ Database connection successful');
    
    // ========================================
    // 2. TEST VIDEO RECORD CREATION
    // ========================================
    console.log('\n📝 Step 2: Testing video record creation...');
    
    const testVideo = {
      input_text: 'Test video for integration testing',
      status: 'pending'
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('videos')
      .insert(testVideo)
      .select('id, input_text, status, created_at')
      .single();
    
    if (insertError) {
      console.log('❌ Video creation failed:', insertError.message);
      return false;
    }
    
    console.log('✅ Video record created successfully');
    console.log('   ID:', insertData.id);
    console.log('   Status:', insertData.status);
    console.log('   Created:', insertData.created_at);
    
    const videoId = insertData.id;
    
    // ========================================
    // 3. TEST VIDEO RECORD UPDATE
    // ========================================
    console.log('\n🔄 Step 3: Testing video record update...');
    
    const updateData = {
      status: 'script_generated',
      script: 'HOOK: Test hook\nBODY: Test body\nCTA: Test CTA'
    };
    
    const { data: updateResult, error: updateError } = await supabase
      .from('videos')
      .update(updateData)
      .eq('id', videoId)
      .select('id, status, script, updated_at')
      .single();
    
    if (updateError) {
      console.log('❌ Video update failed:', updateError.message);
      return false;
    }
    
    console.log('✅ Video record updated successfully');
    console.log('   New Status:', updateResult.status);
    console.log('   Updated:', updateResult.updated_at);
    
    // ========================================
    // 4. TEST VIDEO RECORD RETRIEVAL
    // ========================================
    console.log('\n📖 Step 4: Testing video record retrieval...');
    
    const { data: retrieveData, error: retrieveError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();
    
    if (retrieveError) {
      console.log('❌ Video retrieval failed:', retrieveError.message);
      return false;
    }
    
    console.log('✅ Video record retrieved successfully');
    console.log('   Input Text:', retrieveData.input_text);
    console.log('   Script:', retrieveData.script ? 'Present' : 'Missing');
    console.log('   Storyboard:', retrieveData.storyboard_json ? 'Present' : 'Missing');
    console.log('   Audio URL:', retrieveData.audio_url ? 'Present' : 'Missing');
    console.log('   Captions URL:', retrieveData.captions_url ? 'Present' : 'Missing');
    console.log('   Image URLs:', retrieveData.image_urls ? `${retrieveData.image_urls.length} images` : 'None');
    
    // ========================================
    // 5. TEST STORAGE BUCKET ACCESS
    // ========================================
    console.log('\n📁 Step 5: Testing storage bucket access...');
    
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.log('❌ Storage bucket listing failed:', bucketsError.message);
      return false;
    }
    
    console.log('✅ Storage buckets retrieved successfully');
    console.log('   Available buckets:', buckets.map(b => b.id).join(', '));
    
    const assetsBucket = buckets.find(b => b.id === 'assets');
    if (!assetsBucket) {
      console.log('❌ Assets bucket not found');
      console.log('💡 Please create the assets bucket in Supabase Storage');
      return false;
    }
    
    console.log('✅ Assets bucket found');
    console.log('   Public:', assetsBucket.public);
    console.log('   File size limit:', assetsBucket.fileSizeLimit);
    
    // ========================================
    // 6. TEST STORAGE UPLOAD
    // ========================================
    console.log('\n📤 Step 6: Testing storage upload...');
    
    const testContent = 'This is a test file for Supabase integration testing';
    const testPath = `test/integration-test-${Date.now()}.txt`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('assets')
      .upload(testPath, testContent, {
        contentType: 'text/plain',
        upsert: true
      });
    
    if (uploadError) {
      console.log('❌ Storage upload failed:', uploadError.message);
      console.log('💡 This might indicate RLS policy issues');
      return false;
    }
    
    console.log('✅ Storage upload successful');
    console.log('   File path:', uploadData.path);
    console.log('   File ID:', uploadData.id);
    
    // ========================================
    // 7. TEST STORAGE DOWNLOAD
    // ========================================
    console.log('\n📥 Step 7: Testing storage download...');
    
    const { data: downloadData, error: downloadError } = await supabase.storage
      .from('assets')
      .download(testPath);
    
    if (downloadError) {
      console.log('❌ Storage download failed:', downloadError.message);
      return false;
    }
    
    const downloadedText = await downloadData.text();
    console.log('✅ Storage download successful');
    console.log('   Content matches:', downloadedText === testContent);
    
    // ========================================
    // 8. TEST STORAGE CLEANUP
    // ========================================
    console.log('\n🗑️ Step 8: Testing storage cleanup...');
    
    const { error: deleteError } = await supabase.storage
      .from('assets')
      .remove([testPath]);
    
    if (deleteError) {
      console.log('❌ Storage cleanup failed:', deleteError.message);
      return false;
    }
    
    console.log('✅ Storage cleanup successful');
    
    // ========================================
    // 9. TEST VIDEO RECORD CLEANUP
    // ========================================
    console.log('\n🧹 Step 9: Testing video record cleanup...');
    
    const { error: deleteVideoError } = await supabase
      .from('videos')
      .delete()
      .eq('id', videoId);
    
    if (deleteVideoError) {
      console.log('❌ Video cleanup failed:', deleteVideoError.message);
      return false;
    }
    
    console.log('✅ Video record cleanup successful');
    
    // ========================================
    // 10. FINAL SUCCESS
    // ========================================
    console.log('\n🎉 INTEGRATION TEST COMPLETE!');
    console.log('==============================');
    console.log('✅ Database connection working');
    console.log('✅ Video CRUD operations working');
    console.log('✅ Storage bucket accessible');
    console.log('✅ File upload/download working');
    console.log('✅ Cleanup operations working');
    console.log('\n🚀 Your Supabase integration is ready for video generation!');
    
    return true;
    
  } catch (error) {
    console.log('❌ Unexpected error:', error.message);
    console.log('💡 Please check your Supabase configuration');
    return false;
  }
}

// Run the test
testSupabaseIntegration().then(success => {
  if (!success) {
    console.log('\n❌ Integration test failed');
    console.log('💡 Please fix the issues above and try again');
    process.exit(1);
  }
}).catch(error => {
  console.error('\n❌ Test error:', error.message);
  process.exit(1);
}); 