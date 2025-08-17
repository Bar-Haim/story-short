export function softenImagePrompt(p: string): string {
  // 1) remove/replace common sensitive tokens
  const banned = [
    /\b(nude|nudity|nsfw|explicit|sex|sexy|lingerie|underwear)\b/gi,
    /\b(gore|blood|bloody|violent|violence|weapon|gun|knife|shoot|kill|dead|corpse)\b/gi,
    /\b(child|kid|minor|underage)\b/gi, // avoid minors context
  ];
  let out = p ?? '';
  banned.forEach((rx) => { out = out.replace(rx, ''); });

  // 2) neutralize any remaining edgy phrasing
  out = out
    .replace(/\b(dark|sinister|erotic|fetish|obscene)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // 3) add safe, wholesome style and context
  const safeSuffix = ' wholesome, family-friendly, safe-for-work, bright daylight, positive mood, cinematic, high-quality, stock-photo style';
  // avoid double-appending
  if (!out.toLowerCase().includes('safe-for-work')) out += safeSuffix;

  // 4) OPTIONAL: add explicit "no" tags if your provider supports negative prompts
  // (for OpenAI image, just keep it descriptive)
  return out.trim();
}

// Safe prefix for every prompt to reduce policy trips
export const SAFE_PREFIX = 'A wholesome, family-friendly, safe-for-work scene: ';

export function addSafePrefix(prompt: string): string {
  return SAFE_PREFIX + prompt;
}

export function isContentPolicyViolation(error: any): boolean {
  const msg = String(error?.message || error);
  return msg.includes('content_policy_violation') || 
         msg.includes('blocked by our content filters') ||
         msg.includes('inappropriate content') ||
         msg.includes('violates our content policy');
} 