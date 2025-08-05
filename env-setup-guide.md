# Environment Variables Setup Guide

## 🔑 Required API Keys

### 1. OpenRouter API Key (for script generation)
```bash
OPENROUTER_API_KEY=sk-proj--your-openrouter-key-here
```
- Used for: Script generation, storyboard generation
- Get it from: https://openrouter.ai/keys
- Format: `sk-proj--` or `sk-or-`

### 2. OpenAI API Key (for image generation)
```bash
OPENAI_API_KEY=sk-your-openai-key-here
```
- Used for: DALL-E 3 image generation
- Get it from: https://platform.openai.com/api-keys
- Format: `sk-` (different from OpenRouter!)

### 3. ElevenLabs API Key (for voice generation)
```bash
ELEVENLABS_API_KEY=your-elevenlabs-key-here
```
- Used for: Text-to-speech audio generation
- Get it from: https://elevenlabs.io/speech-synthesis
- Format: Usually starts with letters/numbers

### 4. Supabase Configuration
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```
- Used for: Database storage and asset management
- Get it from: Your Supabase project settings

## 📝 Complete .env.local Example

```bash
# OpenRouter (for script generation)
OPENROUTER_API_KEY=sk-proj--your-openrouter-key-here

# OpenAI (for image generation) - DIFFERENT from OpenRouter!
OPENAI_API_KEY=sk-your-openai-key-here

# ElevenLabs (for voice generation)
ELEVENLABS_API_KEY=your-elevenlabs-key-here

# Supabase (for database and storage)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## ⚠️ Important Notes

1. **OpenAI and OpenRouter are different services** - you need separate API keys
2. **OpenAI key format**: `sk-...` (starts with sk-)
3. **OpenRouter key format**: `sk-proj--...` or `sk-or-...` (starts with sk-proj- or sk-or-)
4. **Restart the dev server** after updating `.env.local`

## 🧪 Testing Your Setup

Run this command to test all APIs:
```bash
node test-apis.js
```

All APIs should show "✅ Working" for the pipeline to function correctly. 