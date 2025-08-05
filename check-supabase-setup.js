require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

console.log('🔍 Supabase Setup Diagnostic & Fix Script');
console.log('==========================================\n');

// Check environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Missing Supabase environment variables:');
  console.log('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.log('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? '✅ Set' : '❌ Missing');
  console.log('\n💡 Please add these to your .env.local file');
  process.exit(1);
}

console.log('✅ Supabase environment variables found');
console.log('🔗 URL:', supabaseUrl);
console.log('🔑 Key:', supabaseKey.substring(0, 20) + '...');

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSupabaseConnection() {
  console.log('\n🔌 Testing Supabase connection...');
  
  try {
    const { data, error } = await supabase.from('videos').select('count').limit(1);
    
    if (error) {
      console.log('❌ Connection failed:', error.message);
      return false;
    }
    
    console.log('✅ Supabase connection successful');
    return true;
  } catch (error) {
    console.log('❌ Connection error:', error.message);
    return false;
  }
}

async function checkVideosTable() {
  console.log('\n📊 Checking videos table...');
  
  try {
    // Check if table exists by trying to select from it
    const { data, error } = await supabase.from('videos').select('*').limit(1);
    
    if (error) {
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log('❌ Videos table does not exist');
        return false;
      } else {
        console.log('❌ Error checking videos table:', error.message);
        return false;
      }
    }
    
    console.log('✅ Videos table exists');
    return true;
  } catch (error) {
    console.log('❌ Error checking videos table:', error.message);
    return false;
  }
}

async function createVideosTable() {
  console.log('\n🔨 Creating videos table...');
  
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS public.videos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      input_text TEXT,
      script TEXT,
      status TEXT DEFAULT 'pending',
      audio_url TEXT,
      captions_url TEXT,
      image_urls JSONB,
      storyboard_json JSONB,
      total_duration INTEGER,
      error_message TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_videos_status ON public.videos(status);
    CREATE INDEX IF NOT EXISTS idx_videos_created_at ON public.videos(created_at);
    
    -- Enable RLS
    ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
    
    -- Create RLS policy
    CREATE POLICY IF NOT EXISTS "Allow all operations on videos"
    ON public.videos
    FOR ALL
    USING (true)
    WITH CHECK (true);
    
    -- Create updated_at trigger
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ language 'plpgsql';
    
    DROP TRIGGER IF EXISTS update_videos_updated_at ON public.videos;
    CREATE TRIGGER update_videos_updated_at
        BEFORE UPDATE ON public.videos
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
  `;
  
  try {
    const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL });
    
    if (error) {
      console.log('❌ Failed to create videos table:', error.message);
      return false;
    }
    
    console.log('✅ Videos table created successfully');
    return true;
  } catch (error) {
    console.log('❌ Error creating videos table:', error.message);
    return false;
  }
}

async function checkTableColumns() {
  console.log('\n📋 Checking videos table columns...');
  
  const requiredColumns = [
    'input_text', 'script', 'status', 'audio_url', 'captions_url', 
    'image_urls', 'storyboard_json', 'total_duration', 'created_at'
  ];
  
  try {
    // Get column information
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'videos'
        ORDER BY ordinal_position;
      `
    });
    
    if (error) {
      console.log('❌ Error checking columns:', error.message);
      return false;
    }
    
    const existingColumns = data.map(row => row.column_name);
    console.log('📊 Existing columns:', existingColumns.join(', '));
    
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length === 0) {
      console.log('✅ All required columns exist');
      return true;
    } else {
      console.log('❌ Missing columns:', missingColumns.join(', '));
      return false;
    }
  } catch (error) {
    console.log('❌ Error checking columns:', error.message);
    return false;
  }
}

async function addMissingColumns() {
  console.log('\n🔧 Adding missing columns...');
  
  const columnDefinitions = [
    'ADD COLUMN IF NOT EXISTS audio_url TEXT',
    'ADD COLUMN IF NOT EXISTS captions_url TEXT',
    'ADD COLUMN IF NOT EXISTS image_urls JSONB',
    'ADD COLUMN IF NOT EXISTS storyboard_json JSONB',
    'ADD COLUMN IF NOT EXISTS total_duration INTEGER',
    'ADD COLUMN IF NOT EXISTS error_message TEXT'
  ];
  
  try {
    const alterSQL = `ALTER TABLE public.videos ${columnDefinitions.join(', ')};`;
    const { error } = await supabase.rpc('exec_sql', { sql: alterSQL });
    
    if (error) {
      console.log('❌ Failed to add columns:', error.message);
      return false;
    }
    
    console.log('✅ Missing columns added successfully');
    return true;
  } catch (error) {
    console.log('❌ Error adding columns:', error.message);
    return false;
  }
}

async function checkStorageBuckets() {
  console.log('\n🪣 Checking storage buckets...');
  
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.log('❌ Error listing buckets:', error.message);
      return false;
    }
    
    console.log('📁 Available buckets:', buckets.map(b => b.id).join(', '));
    
    const assetsBucket = buckets.find(b => b.id === 'assets');
    
    if (assetsBucket) {
      console.log('✅ Assets bucket exists');
      console.log('   Public:', assetsBucket.public);
      console.log('   File size limit:', assetsBucket.fileSizeLimit);
      return true;
    } else {
      console.log('❌ Assets bucket does not exist');
      return false;
    }
  } catch (error) {
    console.log('❌ Error checking buckets:', error.message);
    return false;
  }
}

async function createAssetsBucket() {
  console.log('\n🔨 Creating assets bucket...');
  
  try {
    const { data, error } = await supabase.storage.createBucket('assets', {
      public: true,
      fileSizeLimit: 52428800, // 50MB
      allowedMimeTypes: ['image/*', 'audio/*', 'video/*', 'text/*', 'application/*']
    });
    
    if (error) {
      console.log('❌ Failed to create assets bucket:', error.message);
      return false;
    }
    
    console.log('✅ Assets bucket created successfully');
    return true;
  } catch (error) {
    console.log('❌ Error creating assets bucket:', error.message);
    return false;
  }
}

async function checkStoragePolicies() {
  console.log('\n🔒 Checking storage policies...');
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT policyname, cmd, qual, with_check
        FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage'
        AND policyname LIKE '%assets%'
        ORDER BY policyname;
      `
    });
    
    if (error) {
      console.log('❌ Error checking policies:', error.message);
      return false;
    }
    
    if (data.length === 0) {
      console.log('❌ No storage policies found for assets bucket');
      return false;
    }
    
    console.log('✅ Found storage policies:');
    data.forEach(policy => {
      console.log(`   - ${policy.policyname} (${policy.cmd})`);
    });
    
    return data.length >= 4; // Should have at least 4 policies (INSERT, SELECT, UPDATE, DELETE)
  } catch (error) {
    console.log('❌ Error checking policies:', error.message);
    return false;
  }
}

async function createStoragePolicies() {
  console.log('\n🔧 Creating storage policies...');
  
  const policies = [
    {
      name: 'Allow insert into assets bucket',
      sql: `CREATE POLICY "Allow insert into assets bucket" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'assets');`
    },
    {
      name: 'Allow read from assets bucket',
      sql: `CREATE POLICY "Allow read from assets bucket" ON storage.objects FOR SELECT USING (bucket_id = 'assets');`
    },
    {
      name: 'Allow update in assets bucket',
      sql: `CREATE POLICY "Allow update in assets bucket" ON storage.objects FOR UPDATE USING (bucket_id = 'assets') WITH CHECK (bucket_id = 'assets');`
    },
    {
      name: 'Allow delete from assets bucket',
      sql: `CREATE POLICY "Allow delete from assets bucket" ON storage.objects FOR DELETE USING (bucket_id = 'assets');`
    }
  ];
  
  try {
    // Drop existing policies first
    const dropSQL = `
      DROP POLICY IF EXISTS "Allow insert into assets bucket" ON storage.objects;
      DROP POLICY IF EXISTS "Allow read from assets bucket" ON storage.objects;
      DROP POLICY IF EXISTS "Allow update in assets bucket" ON storage.objects;
      DROP POLICY IF EXISTS "Allow delete from assets bucket" ON storage.objects;
      DROP POLICY IF EXISTS "Allow all operations" ON storage.objects;
      DROP POLICY IF EXISTS "Allow all operations on assets" ON storage.objects;
    `;
    
    await supabase.rpc('exec_sql', { sql: dropSQL });
    console.log('🗑️ Dropped existing policies');
    
    // Create new policies
    for (const policy of policies) {
      const { error } = await supabase.rpc('exec_sql', { sql: policy.sql });
      
      if (error) {
        console.log(`❌ Failed to create policy "${policy.name}":`, error.message);
        return false;
      }
      
      console.log(`✅ Created policy: ${policy.name}`);
    }
    
    console.log('✅ All storage policies created successfully');
    return true;
  } catch (error) {
    console.log('❌ Error creating policies:', error.message);
    return false;
  }
}

async function testStorageUpload() {
  console.log('\n🧪 Testing storage upload...');
  
  try {
    const testContent = 'test file content';
    const testPath = 'test/validation.txt';
    
    const { data, error } = await supabase.storage
      .from('assets')
      .upload(testPath, testContent, {
        contentType: 'text/plain',
        upsert: true
      });
    
    if (error) {
      console.log('❌ Storage upload test failed:', error.message);
      return false;
    }
    
    console.log('✅ Storage upload test successful');
    
    // Clean up test file
    await supabase.storage.from('assets').remove([testPath]);
    console.log('✅ Test file cleaned up');
    
    return true;
  } catch (error) {
    console.log('❌ Error testing storage upload:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Supabase setup verification...\n');
  
  // Step 1: Check connection
  const connectionOk = await checkSupabaseConnection();
  if (!connectionOk) {
    console.log('\n❌ Cannot proceed without Supabase connection');
    process.exit(1);
  }
  
  // Step 2: Check videos table
  let tableExists = await checkVideosTable();
  if (!tableExists) {
    console.log('\n📝 Creating videos table...');
    tableExists = await createVideosTable();
    if (!tableExists) {
      console.log('\n❌ Failed to create videos table');
      process.exit(1);
    }
  }
  
  // Step 3: Check table columns
  let columnsOk = await checkTableColumns();
  if (!columnsOk) {
    console.log('\n🔧 Adding missing columns...');
    columnsOk = await addMissingColumns();
    if (!columnsOk) {
      console.log('\n❌ Failed to add missing columns');
      process.exit(1);
    }
  }
  
  // Step 4: Check storage bucket
  let bucketExists = await checkStorageBuckets();
  if (!bucketExists) {
    console.log('\n🔨 Creating assets bucket...');
    bucketExists = await createAssetsBucket();
    if (!bucketExists) {
      console.log('\n❌ Failed to create assets bucket');
      process.exit(1);
    }
  }
  
  // Step 5: Check storage policies
  let policiesOk = await checkStoragePolicies();
  if (!policiesOk) {
    console.log('\n🔧 Creating storage policies...');
    policiesOk = await createStoragePolicies();
    if (!policiesOk) {
      console.log('\n❌ Failed to create storage policies');
      process.exit(1);
    }
  }
  
  // Step 6: Test storage upload
  const uploadOk = await testStorageUpload();
  if (!uploadOk) {
    console.log('\n❌ Storage upload test failed');
    process.exit(1);
  }
  
  // Final summary
  console.log('\n🎉 SUPABASE SETUP COMPLETE!');
  console.log('==========================');
  console.log('✅ Connection: Working');
  console.log('✅ Videos table: Exists with all required columns');
  console.log('✅ Assets bucket: Created and configured');
  console.log('✅ Storage policies: All 4 policies created');
  console.log('✅ Storage upload: Test successful');
  console.log('\n🚀 Your Supabase setup is ready for video generation!');
}

// Run the diagnostic
main().catch(error => {
  console.error('\n❌ Unexpected error:', error.message);
  process.exit(1);
}); 