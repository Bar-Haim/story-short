// Auto-Fix Supabase Setup Script
// Run with: node auto-fix-supabase.js

const fs = require('fs');

function loadEnvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          process.env[key.trim()] = value.replace(/^["']|["']$/g, '');
        }
      }
    });
  } catch (error) {
    console.log('No .env.local file found');
  }
}

loadEnvFile('.env.local');

async function autoFixSupabase() {
  console.log('🔧 Auto-Fixing Supabase Setup...');
  console.log('==============================');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    console.log('💡 Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local file');
    return;
  }
  
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('✅ Connected to Supabase');
    
    // 1. Check and create assets bucket
    console.log('\n🔍 Checking storage bucket...');
    try {
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      
      if (bucketsError) {
        console.error('❌ Cannot access storage:', bucketsError.message);
        return;
      }
      
      const assetsBucket = buckets.find(b => b.id === 'assets');
      
      if (!assetsBucket) {
        console.log('📁 Creating assets bucket...');
        const { data: newBucket, error: createError } = await supabase.storage.createBucket('assets', {
          public: true,
          fileSizeLimit: 52428800, // 50MB
        });
        
        if (createError) {
          console.error('❌ Failed to create assets bucket:', createError.message);
        } else {
          console.log('✅ Assets bucket created successfully');
        }
      } else {
        console.log('✅ Assets bucket already exists');
      }
    } catch (error) {
      console.error('❌ Storage operation failed:', error.message);
    }
    
    // 2. Check and create videos table
    console.log('\n🔍 Checking videos table...');
    try {
      const { data, error } = await supabase.from('videos').select('count').limit(1);
      
      if (error) {
        if (error.message.includes('relation "public.videos" does not exist')) {
          console.log('📋 Videos table does not exist');
          console.log('💡 Please run the SQL from setup-database.sql in your Supabase SQL Editor');
          console.log('💡 This script cannot create tables automatically for security reasons');
        } else {
          console.error('❌ Database error:', error.message);
        }
      } else {
        console.log('✅ Videos table exists');
        
        // Check for required columns
        console.log('\n🔍 Checking required columns...');
        const requiredColumns = ['audio_url', 'captions_url', 'image_urls', 'storyboard_json', 'total_duration'];
        
        for (const column of requiredColumns) {
          try {
            // Try to select the column to see if it exists
            const { error: colError } = await supabase
              .from('videos')
              .select(column)
              .limit(1);
            
            if (colError && colError.message.includes('column') && colError.message.includes('does not exist')) {
              console.log(`❌ Missing column: ${column}`);
              console.log(`💡 Add this column to your videos table: ${column} TEXT`);
            } else {
              console.log(`✅ Column exists: ${column}`);
            }
          } catch (colCheckError) {
            console.log(`⚠️ Could not check column ${column}:`, colCheckError.message);
          }
        }
      }
    } catch (dbError) {
      console.error('❌ Database check failed:', dbError.message);
    }
    
    // 3. Test storage policies
    console.log('\n🔍 Testing storage policies...');
    try {
      // Try to upload a test file
      const testContent = 'test';
      const testPath = 'test/validation.txt';
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('assets')
        .upload(testPath, testContent, {
          contentType: 'text/plain',
          upsert: true
        });
      
      if (uploadError) {
        console.error('❌ Storage upload test failed:', uploadError.message);
        console.log('💡 Check your storage policies in Supabase');
        console.log('💡 Run this SQL in your Supabase SQL Editor:');
        console.log(`
CREATE POLICY "Allow all operations" ON storage.objects
FOR ALL USING (bucket_id = 'assets');
        `);
      } else {
        console.log('✅ Storage upload test successful');
        
        // Clean up test file
        await supabase.storage.from('assets').remove([testPath]);
        console.log('✅ Test file cleaned up');
      }
    } catch (policyError) {
      console.error('❌ Storage policy test failed:', policyError.message);
    }
    
    console.log('\n✅ Auto-fix completed!');
    console.log('\n📋 Next Steps:');
    console.log('==============');
    console.log('1. If videos table is missing, run setup-database.sql in Supabase SQL Editor');
    console.log('2. If storage policies failed, set up policies as shown above');
    console.log('3. Run validate-environment.js to verify everything is working');
    
  } catch (error) {
    console.error('❌ Supabase connection failed:', error.message);
  }
}

autoFixSupabase(); 