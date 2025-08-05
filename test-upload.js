require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

console.log('🧪 Supabase Storage Upload Test');
console.log('===============================\n');

// Check environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Missing Supabase environment variables');
  process.exit(1);
}

console.log('✅ Environment variables found');
console.log('🔗 URL:', supabaseUrl);
console.log('🔑 Key:', supabaseKey.substring(0, 20) + '...');

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSupabaseUpload() {
  console.log('\n🚀 Starting upload test...\n');
  
  try {
    // Step 1: Check if assets bucket exists
    console.log('📁 Step 1: Checking if assets bucket exists...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.log('❌ Error listing buckets:', bucketsError.message);
      return false;
    }
    
    console.log('📦 Available buckets:', buckets.map(b => b.id).join(', '));
    
    const assetsBucket = buckets.find(b => b.id === 'assets');
    
    if (!assetsBucket) {
      console.log('❌ Assets bucket does not exist');
      console.log('💡 You need to run the SQL script in Supabase SQL Editor first');
      return false;
    }
    
    console.log('✅ Assets bucket found');
    console.log('   Public:', assetsBucket.public);
    console.log('   File size limit:', assetsBucket.fileSizeLimit);
    
    // Step 2: Test upload to assets bucket
    console.log('\n📤 Step 2: Testing upload to assets bucket...');
    const testContent = 'This is a test file for StoryShort video generation';
    const testPath = 'test/upload-test.txt';
    
    console.log('   Uploading file:', testPath);
    console.log('   Content length:', testContent.length, 'characters');
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('assets')
      .upload(testPath, testContent, {
        contentType: 'text/plain',
        upsert: true
      });
    
    if (uploadError) {
      console.log('❌ Upload failed:', uploadError.message);
      console.log('❌ Error details:', {
        name: uploadError.name,
        message: uploadError.message
      });
      console.log('\n💡 This indicates RLS policy issues');
      console.log('💡 Please run the supabase-storage-diagnostic.sql script in your Supabase SQL Editor');
      return false;
    }
    
    console.log('✅ Upload successful!');
    console.log('   File path:', uploadData.path);
    console.log('   File ID:', uploadData.id);
    
    // Step 3: Test download/read
    console.log('\n📥 Step 3: Testing download from assets bucket...');
    const { data: downloadData, error: downloadError } = await supabase.storage
      .from('assets')
      .download(testPath);
    
    if (downloadError) {
      console.log('❌ Download failed:', downloadError.message);
      return false;
    }
    
    const downloadedText = await downloadData.text();
    console.log('✅ Download successful!');
    console.log('   Downloaded content:', downloadedText);
    console.log('   Content matches:', downloadedText === testContent);
    
    // Step 4: Test file listing
    console.log('\n📋 Step 4: Testing file listing...');
    const { data: files, error: listError } = await supabase.storage
      .from('assets')
      .list('test');
    
    if (listError) {
      console.log('❌ File listing failed:', listError.message);
      return false;
    }
    
    console.log('✅ File listing successful!');
    console.log('   Files in test folder:', files.map(f => f.name).join(', '));
    
    // Step 5: Clean up test file
    console.log('\n🗑️ Step 5: Cleaning up test file...');
    const { error: deleteError } = await supabase.storage
      .from('assets')
      .remove([testPath]);
    
    if (deleteError) {
      console.log('❌ Cleanup failed:', deleteError.message);
      return false;
    }
    
    console.log('✅ Cleanup successful!');
    
    // Final success
    console.log('\n🎉 UPLOAD TEST COMPLETE!');
    console.log('========================');
    console.log('✅ Assets bucket exists');
    console.log('✅ Upload works');
    console.log('✅ Download works');
    console.log('✅ File listing works');
    console.log('✅ Delete works');
    console.log('\n🚀 Your Supabase storage is ready for video generation!');
    
    return true;
    
  } catch (error) {
    console.log('❌ Unexpected error:', error.message);
    console.log('💡 Please run the supabase-storage-diagnostic.sql script in your Supabase SQL Editor');
    return false;
  }
}

// Run the test
testSupabaseUpload().then(success => {
  if (!success) {
    console.log('\n❌ Upload test failed');
    console.log('💡 Please fix the storage policies in Supabase SQL Editor');
    process.exit(1);
  }
}).catch(error => {
  console.error('\n❌ Test error:', error.message);
  process.exit(1);
}); 