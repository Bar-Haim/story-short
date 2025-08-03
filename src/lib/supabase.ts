import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface Video {
  id: string;
  status: 'pending' | 'script_generated' | 'rendering' | 'completed' | 'failed';
  input_text: string;
  script: {
    hook: string;
    body: string;
    cta: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface CreateVideoRequest {
  input_text: string;
}

export interface UpdateVideoRequest {
  status?: Video['status'];
  script?: Video['script'];
} 