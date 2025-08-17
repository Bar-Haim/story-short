# Asset Orchestration System

This document describes the new asset orchestration system that automatically generates missing audio and captions when needed.

## Overview

The asset orchestration system proactively generates missing assets (TTS audio and SRT captions) when a user visits the finalize page, ensuring all required assets are ready for video rendering.

## Key Features

- **Proactive Generation**: Automatically generates missing audio and captions
- **Idempotent Operations**: Safe to run multiple times
- **Comprehensive Logging**: Detailed tracking of what was generated
- **Error Handling**: Graceful fallback when individual assets fail
- **Status Management**: New status states for better asset tracking

## New Status States

- `render_ready`: All assets (images, audio, captions) are ready for rendering
- `assets_partial`: Some assets are ready but not all
- `assets_generating`: Currently generating assets

## API Changes

### `/api/generate-assets`

**New Behavior**: Proactively generates missing assets instead of requiring all images first.

**Response Format**:
```json
{
  "ok": true,
  "ran": {
    "audio": true,
    "captions": false
  },
  "urls": {
    "audio": "https://...",
    "captions": "https://..."
  },
  "nextStatus": "render_ready",
  "message": "All assets ready for rendering",
  "assets": {
    "images": 5,
    "totalScenes": 5,
    "audio": true,
    "captions": true
  }
}
```

### `/api/video-status`

**New Response Field**: `assets` object with composite readiness information.

```json
{
  "assets": {
    "images": 5,
    "audio": true,
    "captions": true,
    "renderReady": true
  }
}
```

## New Helper Files

### `src/lib/tts.ts`

- `ensureBucket(name)`: Creates storage bucket if it doesn't exist
- `generateTTS(video)`: Generates TTS audio and uploads to Supabase

### `src/lib/captions.ts`

- `generateCaptions(video)`: Generates SRT captions with estimated timing
- Uses word count to estimate duration (150 words/minute)

## Storage Buckets

- `renders-audio`: Stores generated TTS audio files
- `renders-captions`: Stores generated SRT caption files

## Environment Variables

Required in `.env.local`:
```
ELEVENLABS_API_KEY=your_key_here
ELEVENLABS_VOICE_ID=default_voice_id
```

## Setup Instructions

1. **Run SQL Script**: Execute `supabase-storage-setup.sql` in your Supabase SQL editor
2. **Verify Environment**: Ensure `ELEVENLABS_API_KEY` is set
3. **Test Flow**: Visit `/finalize/[id]` page to trigger asset generation

## Workflow

1. User visits `/finalize/[id]` page
2. System automatically calls `/api/generate-assets` if status allows
3. Missing audio and captions are generated proactively
4. Status updates to `render_ready` when all assets are complete
5. User can click "Finalize Video" to proceed with rendering

## Error Handling

- **Missing API Key**: Clear error message with suggestion to check environment
- **Asset Generation Failures**: Individual failures don't block other assets
- **Partial Success**: Status reflects what was successfully generated

## Logging

All operations include detailed logging:
- `[assets]` prefix for asset orchestration
- `[tts]` prefix for TTS operations  
- `[captions]` prefix for caption operations
- Clear success/failure messages with URLs

## Benefits

- **Better UX**: Users don't need to manually trigger asset generation
- **Faster Workflow**: Assets are ready when user reaches finalize page
- **Reliability**: Automatic retry and error handling
- **Transparency**: Clear status and progress information 