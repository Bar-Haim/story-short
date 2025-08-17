export function parseScriptSections(raw?: string | null): { hook: string; body: string; cta: string } {
  // Parse script with labels + fallback
  const empty = { hook: '', body: '', cta: '' };
  if (!raw) return empty;

  const text = raw.replace(/\r\n/g, '\n').trim();
  const hookMatch = /(^|\n)\s*HOOK:\s*([\s\S]*?)(?=\n\s*BODY:|\n\s*CTA:|\s*$)/i.exec(text);
  const bodyMatch = /(^|\n)\s*BODY:\s*([\s\S]*?)(?=\n\s*CTA:|\s*$)/i.exec(text);
  const ctaMatch  = /(^|\n)\s*CTA:\s*([\s\S]*)$/i.exec(text);

  if (hookMatch || bodyMatch || ctaMatch) {
    return {
      hook: (hookMatch?.[2] ?? '').trim(),
      body: (bodyMatch?.[2] ?? '').trim(),
      cta:  (ctaMatch?.[2]  ?? '').trim(),
    };
  }

  const parts = text.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
  if (parts.length >= 3) return { hook: parts[0], body: parts.slice(1, -1).join('\n\n'), cta: parts.at(-1)! };
  if (parts.length === 2) return { hook: parts[0], body: '', cta: parts[1] };
  if (parts.length === 1) return { hook: parts[0], body: '', cta: '' };
  return empty;
}

export function toPlainNarration(sections: {hook:string;body:string;cta:string}) {
  // No labels: used for TTS + captions
  return [sections.hook, sections.body, sections.cta]
    .map(s => s.trim())
    .filter(Boolean)
    .join('\n\n');
}

export function stripMeta(s: string) {
  const bad = [
    /as an ai\b/i,
    /i (cannot|can't|am not able)/i,
    /i am an? (ai|assistant)/i,
    /i don'?t have the ability/i,
  ];
  let out = s.trim();
  bad.forEach(r => { out = out.replace(r, ''); });
  return out.replace(/^"|"$/g,'').trim();
} 