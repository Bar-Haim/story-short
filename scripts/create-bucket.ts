import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

// בדיקה שהערכים באמת מגיעים
console.log("📦 SUPABASE URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("🔑 SERVICE ROLE KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY);

// יצירת לקוח Supabase עם הרשאות מלאות
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function createBucket() {
  try {
    const { data, error } = await supabase.storage.createBucket('assets', {
      public: true,
    });

    if (error) {
      if (
        error.message.includes('violates row-level security policy') ||
        error.message.includes('already exists')
      ) {
        console.log('ℹ️ Bucket already exists or RLS blocked insert – skipping creation.');
      } else {
        throw error;
      }
    } else {
      console.log('✅ Bucket created successfully:', data);
    }
  } catch (err: any) {
    console.error('❌ Unexpected error while creating bucket:', err.message || err);
  }
}

createBucket();
