import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import { withRetry } from '@/lib/withRetry';

// Force Node.js runtime (not Edge) to avoid fetch/env issues
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Meta text stripping functions
function stripMeta(s: string): string {
  const bad = [
    /as an ai\b/i,
    /i (cannot|can't|am not able)/i,
    /i am an? (ai|assistant)/i,
    /i don'?t have the ability/i,
    /i'm sorry,? but/i,
    /unfortunately/i,
    /i would like to/i,
    /let me help you/i,
    /i can help you/i,
    /here's a/i,
    /here is a/i,
  ];
  let out = (s || '').trim();
  bad.forEach(r => { out = out.replace(r, ''); });
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

function clamp(s: string, max = 200): string {
  return s.length <= max ? s : s.slice(0, max).replace(/\s+\S*$/, '') + '…';
}

function parseScriptSections(text: string): { hook: string; body: string; cta: string } {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let hook = '', body = '', cta = '';
  
  for (const line of lines) {
    if (line.startsWith('HOOK:')) {
      hook = line.replace(/^HOOK:\s*/, '').trim();
    } else if (line.startsWith('BODY:')) {
      body = line.replace(/^BODY:\s*/, '').trim();
    } else if (line.startsWith('CTA:')) {
      cta = line.replace(/^CTA:\s*/, '').trim();
    }
  }
  
  return { hook, body, cta };
}

// Debug environment variables at startup
console.log('[env] SUPABASE_URL =', process.env.SUPABASE_URL);
console.log('[env] SERVICE_KEY length =', process.env.SUPABASE_SERVICE_ROLE_KEY?.length);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const inputText: string = String(body?.inputText ?? '').trim();
    if (!inputText) {
      return NextResponse.json({ ok: false, error: 'Missing inputText' }, { status: 400 });
    }

    console.log('📥 Received script generation request');
    console.log(`🔍 [generate-script] inputText length: ${inputText.length}`);
    console.log(`🔍 [generate-script] inputText first 200 chars: ${inputText.substring(0, 200)}`);

    // Create client (SERVICE ROLE KEY!)
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // --- 1) Create video record with a pre-generated id (idempotent)
    const videoId = randomUUID();
    const insertPayload = { id: videoId, input_text: inputText, status: 'created' as const };

    await withRetry(async () => {
      const { error } = await supabase
        .from('videos')
        .upsert(insertPayload, { onConflict: 'id' }); // idempotent
      if (error) throw new Error(error.message);
      return true;
    }, { label: 'supabase.insert(video)', maxRetries: 3 });

    console.log('✅ Video record created with ID:', videoId);

    // --- 2) Call OpenRouter with timeout + retries
    const openrouterUrl = 'https://openrouter.ai/api/v1/chat/completions';
    
    const systemPrompt = `You are a concise copywriter. 
DO NOT include any meta commentary (no "as an AI...", "I can't...", "I'm sorry but...").
Return EXACTLY:
HOOK: <max 200 chars>
BODY: <max 200 chars>
CTA: <max 200 chars>
No extra lines.`;

    const userPrompt = `Create a 40-second script from this premise:
"${inputText}"

Rules:
- No meta/capability mentions.
- Keep total <= 600 chars.
- Plain language, present tense.
- Return ONLY the 3 labeled lines.`;

    const payload = {
      model: 'openai/gpt-4',
      max_tokens: 300,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    };

    const res = await withRetry(async () => {
      const r = await fetchWithTimeout(openrouterUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY!}`,
          'HTTP-Referer': 'https://storyshort.app',
          'X-Title': 'StoryShort - AI Video Generation'
        },
        body: JSON.stringify(payload)
      }, 20000);
      if (!r.ok) {
        const text = await r.text().catch(() => '<no body>');
        throw new Error(`OpenRouter ${r.status}: ${text}`);
      }
      return r;
    }, { label: 'openrouter.fetch', maxRetries: 3, baseDelayMs: 800 });

    const data = await res.json();
    const aiScriptText: string =
      data?.choices?.[0]?.message?.content?.trim?.() || '';

    if (!aiScriptText) {
      return NextResponse.json({ ok: false, error: 'Empty script from OpenRouter' }, { status: 502 });
    }

    console.log('📝 Generated script:', aiScriptText);

    // --- 3) Clean and format the script
    const cleaned = stripMeta(aiScriptText);
    const { hook, body: bodyText, cta } = parseScriptSections(cleaned);
    
    // Ensure each section is properly formatted and clamped
    const finalHook = clamp(hook, 200);
    const finalBody = clamp(bodyText, 200);
    const finalCta = clamp(cta, 200);
    
    const finalText = `HOOK: ${finalHook}\n\nBODY: ${finalBody}\n\nCTA: ${finalCta}`;
    
    console.log('🧹 Cleaned script:', finalText);

    // --- 4) Save the cleaned script (script_text + legacy script) + status
    await withRetry(async () => {
      const { error } = await supabase
        .from('videos')
        .update({
          script_text: finalText,
          script: finalText,               // keep legacy in sync
          status: 'script_generated',
          error_message: null
        })
        .eq('id', videoId);
      if (error) throw new Error(error.message);
      return true;
    }, { label: 'supabase.update(script)', maxRetries: 3 });

    console.log('[script] DONE', { videoId });

    return NextResponse.json({ ok: true, videoId });
  } catch (e: any) {
    console.error('[generate-script] fatal:', e?.message || e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
