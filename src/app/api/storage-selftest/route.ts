import { NextRequest, NextResponse } from 'next/server';
import { sbServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_req: NextRequest) {
  const results: any = {
    ok: false,
    timestamp: new Date().toISOString(),
    tests: {}
  };

  try {
    const supabase = sbServer();
    const buckets = ['renders-images', 'renders-audio', 'renders-captions', 'renders-videos'];
    
    // Test 1: Verify buckets exist and are accessible
    results.tests.bucket_access = { status: 'running' };
    try {
      const { data: bucketList, error: listError } = await supabase.storage.listBuckets();
      if (listError) throw listError;
      
      const availableBuckets = (bucketList || []).map(b => b.name);
      const missingBuckets = buckets.filter(b => !availableBuckets.includes(b));
      
      if (missingBuckets.length > 0) {
        results.tests.bucket_access = { 
          status: 'failed', 
          error: `Missing buckets: ${missingBuckets.join(', ')}`,
          available: availableBuckets,
          required: buckets
        };
      } else {
        results.tests.bucket_access = { 
          status: 'passed', 
          buckets: availableBuckets.filter(b => buckets.includes(b))
        };
      }
    } catch (e: any) {
      results.tests.bucket_access = { status: 'failed', error: e.message };
    }

    // Test 2: Upload, read, and delete test file
    results.tests.upload_read_delete = { status: 'running' };
    try {
      const testBucket = 'renders-images';
      const fileName = `storage-selftest-${Date.now()}.png`;
      
      // Create 1x1 transparent PNG
      const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottwAAAABJRU5ErkJggg==';
      const buffer = Buffer.from(pngBase64, 'base64');
      const blob = new Blob([buffer], { type: 'image/png' });

      // Upload test
      const { error: uploadError } = await supabase.storage
        .from(testBucket)
        .upload(fileName, blob, { contentType: 'image/png', upsert: false });

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      // Get public URL
      const { data: urlData } = supabase.storage.from(testBucket).getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;

      // Test public URL accessibility
      const urlResponse = await fetch(publicUrl);
      if (!urlResponse.ok) {
        throw new Error(`Public URL not accessible: ${urlResponse.status} ${urlResponse.statusText}`);
      }

      // Test signed URL generation
      const { data: signedData, error: signedError } = await supabase.storage
        .from(testBucket)
        .createSignedUrl(fileName, 3600); // 1 hour expiry

      if (signedError) throw new Error(`Signed URL failed: ${signedError.message}`);

      // Test signed URL accessibility
      const signedResponse = await fetch(signedData.signedUrl);
      if (!signedResponse.ok) {
        throw new Error(`Signed URL not accessible: ${signedResponse.status} ${signedResponse.statusText}`);
      }

      // Cleanup - delete test file
      const { error: deleteError } = await supabase.storage
        .from(testBucket)
        .remove([fileName]);

      if (deleteError) {
        console.warn(`Cleanup warning: ${deleteError.message}`);
      }

      results.tests.upload_read_delete = {
        status: 'passed',
        bucket: testBucket,
        fileName,
        publicUrl,
        signedUrl: signedData.signedUrl,
        fileSize: buffer.length,
        cleaned: !deleteError
      };

    } catch (e: any) {
      results.tests.upload_read_delete = { status: 'failed', error: e.message };
    }

    // Test 3: Service role permissions
    results.tests.service_role_permissions = { status: 'running' };
    try {
      // Test bucket listing (requires service role)
      const { error: listError } = await supabase.storage.from('renders-images').list('', { limit: 1 });
      if (listError) throw new Error(`List permission failed: ${listError.message}`);

      results.tests.service_role_permissions = { status: 'passed' };
    } catch (e: any) {
      results.tests.service_role_permissions = { status: 'failed', error: e.message };
    }

    // Overall result
    const allPassed = Object.values(results.tests).every((test: any) => test.status === 'passed');
    results.ok = allPassed;
    results.summary = allPassed ? 'All storage tests passed' : 'Some storage tests failed';

    const statusCode = allPassed ? 200 : 500;
    return NextResponse.json(results, { 
      status: statusCode,
      headers: { 'Cache-Control': 'no-store' }
    });

  } catch (err: any) {
    results.tests.fatal_error = { status: 'failed', error: err?.message ?? String(err) };
    results.summary = 'Fatal error during storage testing';
    
    return NextResponse.json(results, { 
      status: 500,
      headers: { 'Cache-Control': 'no-store' }
    });
  }
}
