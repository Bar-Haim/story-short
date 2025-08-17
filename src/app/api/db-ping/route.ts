import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,              // must be https://...supabase.co (no trailing slash)
      process.env.SUPABASE_SERVICE_ROLE_KEY!  // service role key (NOT anon key)
    );
    const { data, error } = await supabase.from('videos').select('id').limit(1);
    if (error) return NextResponse.json({ ok:false, stage:'select', error: error.message }, { status: 500 });
    return NextResponse.json({ ok:true, rows: data?.length ?? 0 });
  } catch (e:any) {
    return NextResponse.json({ ok:false, stage:'fetch', error: String(e?.message || e) }, { status: 500 });
  }
} 