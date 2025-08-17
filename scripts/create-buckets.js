#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const buckets = [
  'renders-images',
  'renders-audio',
  'renders-captions',
  'renders-videos'
];

(async () => {
  console.log('🪣 Creating Supabase storage buckets...\n');
  
  for (const bucket of buckets) {
    try {
      const { error } = await supabase.storage.createBucket(bucket, {
        public: true
      });
      
      if (error && !error.message.includes('already exists')) {
        console.error(`❌ Error creating bucket ${bucket}:`, error.message);
      } else {
        console.log(`✅ Bucket ${bucket} ready.`);
      }
    } catch (err) {
      console.error(`❌ Unexpected error creating bucket ${bucket}:`, err.message);
    }
  }
  
  console.log('\n🎉 Bucket creation completed!');
})(); 