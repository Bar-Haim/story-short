// Script to check and create the videos bucket
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

async function createVideosBucket() {
  console.log('🔍 Checking and creating videos bucket...');
  
  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing required environment variables');
    return;
  }
  
  console.log('✅ Environment variables verified');
  
  // Create Supabase client
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  console.log('✅ Supabase client created with service role key');
  
  try {
    // List existing buckets
    console.log('📋 Listing existing buckets...');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Failed to list buckets:', listError);
      return;
    }
    
    console.log('📋 Existing buckets:');
    buckets.forEach(bucket => {
      console.log(`   - ${bucket.name} (${bucket.public ? 'public' : 'private'})`);
    });
    
    // Check if videos bucket exists
    const videosBucketExists = buckets.some(bucket => bucket.name === 'videos');
    
    if (videosBucketExists) {
      console.log('✅ Videos bucket already exists');
    } else {
      console.log('📦 Creating videos bucket...');
      
      const { data: createData, error: createError } = await supabase.storage.createBucket('videos', {
        public: true
      });
      
      if (createError) {
        console.error('❌ Failed to create videos bucket:', createError);
        return;
      }
      
      console.log('✅ Videos bucket created successfully:', createData);
    }
    
    // Test bucket access
    console.log('🧪 Testing videos bucket access...');
    
    const { data: testData, error: testError } = await supabase.storage
      .from('videos')
      .list();
    
    if (testError) {
      console.error('❌ Failed to access videos bucket:', testError);
    } else {
      console.log('✅ Videos bucket access successful');
      console.log('📋 Files in videos bucket:', testData.length);
    }
    
    console.log('\n🎉 Videos bucket setup completed!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createVideosBucket(); 