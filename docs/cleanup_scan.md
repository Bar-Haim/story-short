# 🧹 Repository Cleanup Scan Report

## 📊 Repository Analysis

**Branch:** `cleanup/remove-nonessential`  
**Date:** $(date)  
**Status:** In Progress

## 🎯 Cleanup Strategy

**Conservative Approach:** Keep-if-doubt policy  
**Goal:** Remove only non-essential files with 0 references  
**Safety:** Preserve all runtime-required functionality

## 📋 High-Confidence Delete Buckets

### 1. Build/Cache Artifacts
- [ ] `.next/**` - Next.js build cache and artifacts
- [ ] `.turbo/**` - Turbo build cache
- [ ] `dist/**` - Build output directories
- [ ] `build/**` - Build artifacts
- [ ] `out/**` - Export output
- [ ] `coverage/**` - Test coverage reports
- [ ] `.vercel/**` - Vercel deployment cache
- [ ] `.eslintcache` - ESLint cache
- [ ] `node_modules/**` - Dependencies (should never be committed)

### 2. Test/Dev Tools
- [ ] `**/test-*.{js,ts,mjs,cjs}` - Test files
- [ ] `**/__tests__/**` - Test directories
- [ ] `**/__mocks__/**` - Mock directories
- [ ] `cypress/**` - E2E testing
- [ ] `playwright/**` - Browser testing
- [ ] `e2e/**` - End-to-end tests
- [ ] `scripts/generated-images/**` - Demo/test images
- [ ] `**/*-debug.*` - Debug files
- [ ] `**/*-demo.*` - Demo files
- [ ] `samples/**` - Sample files
- [ ] `examples/**` - Example files
- [ ] `fixtures/**` - Test fixtures
- [ ] `sandbox/**` - Sandbox files
- [ ] `tmp/**` - Temporary files

### 3. Large Media Files (0 refs only)
- [ ] `**/*.mp4` - Video files
- [ ] `**/*.mov` - Movie files
- [ ] `**/*.wav` - Audio files
- [ ] `**/*.mkv` - Video files
- [ ] Large images in `public/**` with 0 references

## 🛡️ Always-Keep List

### Core Application
- `package.json`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`
- `tsconfig.json`, `next.config.*`
- `tailwind.config.*`, `postcss.config.*`
- `.eslintrc*`, `.prettierrc*`
- `README*`, `LICENSE`

### Source Code
- `src/**` - All source code
- `app/**` - Next.js app directory
- `components/**` - React components
- `types/**` - TypeScript type definitions
- `lib/**` - Library code
- `utils/**` - Utility functions

### Configuration & Assets
- `public/**` - Public assets (unless proven unreferenced)
- `supabase/**` - Supabase configuration
- `scripts/**` - Build/deployment scripts (except test/demo)

### Environment
- `.env.example`, `.env.local.example`

## 🔍 Reference Analysis

### Files with References (KEEP)
*To be populated during scan*

### Files with 0 References (Candidates)
*To be populated during scan*

### Uncertain Files (KEEP)
*To be populated during scan*

## 📈 Size Impact

### Before Cleanup
*To be measured*

### After Cleanup
*To be measured*

### Reduction
*To be calculated*

## 🚀 Execution Plan

### Phase 1: Safe Removals
- [ ] Remove build artifacts
- [ ] Remove test directories
- [ ] Remove demo files

### Phase 2: Reference Validation
- [ ] Scan for asset references
- [ ] Identify unreferenced files
- [ ] Mark uncertain items

### Phase 3: Build Validation
- [ ] Run `npm ci`
- [ ] Run `npm run build`
- [ ] Verify functionality

## 📝 Notes

*Cleanup progress and decisions will be documented here*

---

*Report generated during cleanup process*
