import { NextRequest, NextResponse } from 'next/server';
import { sbServer } from '@/lib/supabase-server';

export async function GET(_req: NextRequest) {
  try {
    const supabase = sbServer();
    const buf = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottw==', 'base64');
    const blob = new Blob([buf], { type: 'image/png' });
    const fileName = `selftest-${Date.now()}.png`;
    const { error } = await supabase.storage.from('renders-images').upload(fileName, blob, { contentType:'image/png', upsert:false });
    if (error) return NextResponse.json({ ok:false, stage:'upload', error: error.message }, { status:500 });

    const { data: urlData } = supabase.storage.from('renders-images').getPublicUrl(fileName);
    return NextResponse.json({ ok:true, bucket:'renders-images', fileName, publicUrl: urlData.publicUrl });
  } catch (err:any) {
    return NextResponse.json({ ok:false, error: err?.message ?? String(err) }, { status:500 });
  }
}