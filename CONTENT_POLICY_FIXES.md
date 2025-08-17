# StoryShort Content Policy Fixes & 409 Prevention

## Overview
This document summarizes the implementation of fixes for content policy violations and 409 churn prevention in StoryShort.

## Fix A: Prevent 409 Churn During Assets Generation

### Problem
The storyboard page was calling `/api/generate-preview-images` even when the video status was `assets_generating`, causing unnecessary 409 conflicts.

### Solution
Updated `src/app/storyboard/[id]/page.tsx` to:
- Check video status before calling preview endpoint
- Only call preview in states: `storyboard_generated` or `script_approved`
- Skip preview calls when status is `assets_generating`
- Gracefully handle 409 responses by continuing to poll

### Code Changes
```typescript
// Only call preview in these states:
const canPreview = status === 'storyboard_generated' || status === 'script_approved';
if (!canPreview) return; // if it's assets_generating, just poll

// Ignore 409 (someone else generating). Just continue polling.
if (!r.ok && r.status !== 409) {
  console.warn('generate-preview-images failed', r.status);
}
```

## Fix B: Auto-Sanitize Prompts & Policy-Aware Retry

### Problem
OpenAI content policy violations were causing image generation to fail completely, with no automatic recovery.

### Solution
Created comprehensive safety utilities and implemented policy-aware retry logic.

#### 1. Safety Utilities (`src/lib/safety.ts`)
- **`softenImagePrompt(prompt)`**: Removes/replaces sensitive tokens
- **`addSafePrefix(prompt)`**: Adds wholesome, family-friendly prefix
- **`isContentPolicyViolation(error)`**: Detects policy violations

#### 2. Policy-Aware Retry Logic
Both `generate-assets` and `generate-preview-images` routes now:
- Add safe prefix to every prompt
- Try original prompt first
- On policy violation, automatically soften and retry once
- Provide clear error messages for manual fixes

#### 3. Structured Error Handling
- Collect per-scene failure reasons
- Set `assets_failed` status with helpful error messages
- Return structured failure data to UI

### Code Changes
```typescript
// First try with original prompt (already "safe" prompts pass)
try {
  return await providerGenerateImage(safePrompt);
} catch (e: any) {
  const blocked = isContentPolicyViolation(e);
  if (!blocked) throw e; // rethrow other errors

  // retry once with softened prompt
  const softened = softenImagePrompt(scene.prompt);
  if (softened === scene.prompt) throw e; // nothing to soften

  try {
    return await providerGenerateImage(addSafePrefix(softened));
  } catch (e2: any) {
    // final failure → bubble up with a scene-specific message
    const finalMsg = `Image blocked by content filter. Please edit the prompt to be family-friendly.\nOriginal: "${scene.prompt}"\nSoftened tried: "${softened}"`;
    const err = new Error(finalMsg);
    (err as any).code = 'content_policy_violation';
    throw err;
  }
}
```

## Fix C: Enhanced UI for Failed Scenes

### Problem
Users couldn't easily identify which scenes failed or why, making recovery difficult.

### Solution
Enhanced the storyboard UI to:
- Show content policy violation alerts
- Highlight failed scenes with red styling
- Display "Blocked" badges on failed scenes
- Disable Continue button until all scenes are fixed
- Provide clear guidance on how to resolve issues

### UI Changes
1. **Content Policy Alert**: Orange warning box explaining the issue
2. **Failed Scene Indicators**: Red borders, backgrounds, and "Blocked" badges
3. **Visual Feedback**: Different styling for dirty vs. failed scenes
4. **Button States**: Continue button disabled until all scenes resolved
5. **Helpful Messages**: Clear instructions on what to do

### Code Changes
```typescript
// Scene status detection
const isFailed = video?.status === 'assets_failed' && !hasImage && !isDirty;

// Conditional styling
className={`
  ${isDirty ? 'border-orange-300 bg-orange-50' : ''}
  ${isFailed ? 'border-red-300 bg-red-50' : ''}
  ${!isDirty && !isFailed ? 'border-gray-200' : ''}
`}

// Continue button state
disabled={generating || (video?.status === 'assets_failed' && !images.every(Boolean))}
```

## Files Modified

### New Files Created
- `src/lib/safety.ts` - Safety utilities for prompt sanitization

### Files Updated
- `src/app/storyboard/[id]/page.tsx` - 409 prevention and enhanced UI
- `src/app/api/generate-assets/route.ts` - Policy-aware retry logic
- `src/app/api/generate-preview-images/route.ts` - Policy-aware retry logic

## Testing Flow

### 1. Normal Flow (No Policy Violations)
1. User creates storyboard → `storyboard_generated`
2. Preview images generate successfully
3. User finalizes → assets generate → video renders

### 2. Policy Violation Flow
1. User creates storyboard with problematic prompts
2. Preview generation fails for some scenes
3. UI shows failed scenes with red styling
4. User edits prompts to be family-friendly
5. User clicks "Regenerate" on failed scenes
6. Once all scenes succeed, user can continue

### 3. 409 Prevention Flow
1. User is on storyboard page
2. Assets generation starts in background
3. Storyboard page detects `assets_generating` status
4. Preview calls are skipped, only polling continues
5. No unnecessary 409 conflicts

## Benefits

### For Users
- Clear visibility into what went wrong
- Automatic recovery attempts
- Easy identification of problematic scenes
- Guided resolution process

### For System
- Reduced API conflicts (409 prevention)
- Better error handling and recovery
- Improved user experience during failures
- Structured error reporting

### For Content Safety
- Automatic prompt sanitization
- Family-friendly defaults
- Clear policy violation feedback
- Encourages appropriate content

## Future Enhancements

### Optional Improvements
1. **Batch Retry**: Allow retrying all failed scenes at once
2. **Prompt Suggestions**: AI-powered prompt improvement suggestions
3. **Content Filtering**: Client-side prompt validation before submission
4. **Analytics**: Track common policy violations for better guidance

### Monitoring
- Log content policy violations for analysis
- Track retry success rates
- Monitor user behavior after failures
- Identify patterns in problematic prompts 