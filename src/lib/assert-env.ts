import 'server-only';

export function assertEnv() {
  const missing: string[] = [];
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    missing.push('NEXT_PUBLIC_SUPABASE_URL');
  }
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    missing.push('SUPABASE_SERVICE_ROLE_KEY');
  }
  
  if (missing.length > 0) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Missing required environment variables:', missing.join(', '));
      console.error('Please check your .env.local file and ensure all Supabase variables are set.');
    }
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  if (process.env.NODE_ENV === 'development') {
    console.log('✅ All required Supabase environment variables are present');
  }
}