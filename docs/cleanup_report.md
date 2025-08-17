# 🧹 Repository Cleanup Report - StoryShort MVP

## 📊 Current Repository State

**Total Repository Size:** 1.42 GB (1,449.49 MB)

### 🎯 Major Size Contributors

| Directory/File Type | Size | Percentage | Status |
|---------------------|------|------------|---------|
| **renders/** | 377.69 MB | 26.1% | 🟡 Needs Review |
| **.next/** | 250.92 MB | 17.3% | 🟢 Safe to Remove |
| **node_modules/** | 432.74 MB | 29.9% | 🟢 Safe to Remove |
| **.git/** | 374.62 MB | 25.8% | 🟡 Git History |
| **scripts/** | 8.98 MB | 0.6% | 🟡 Partial Review |
| **Other Source Files** | ~5.15 MB | 0.3% | 🟢 Keep |

## 🔍 Detailed File Analysis

### Top 20 Largest Files

| Path | Size (MB) | Type | Status |
|------|------------|------|---------|
| `node_modules/@next/swc-win32-x64-msvc/next-swc.win32-x64-msvc.node` | 140.87 | Binary | 🟢 Safe (Dependency) |
| `.next/cache/webpack/server-production/4.pack` | 22.17 | Cache | 🟢 Safe to Remove |
| `.next/cache/webpack/server-production/15.pack` | 21.81 | Cache | 🟢 Safe to Remove |
| `.next/cache/webpack/client-development-fallback/0.pack.gz` | 19.63 | Cache | 🟢 Safe to Remove |
| `node_modules/@img/sharp-win32-x64/lib/libvips-42.dll` | 18.21 | Binary | 🟢 Safe (Dependency) |
| `.next/cache/webpack/client-production/14.pack` | 17.05 | Cache | 🟢 Safe to Remove |
| `.next/cache/webpack/server-production/13.pack` | 15.67 | Cache | 🟢 Safe to Remove |
| `.next/cache/webpack/server-production/7.pack` | 15.10 | Cache | 🟢 Safe to Remove |
| `.next/cache/webpack/client-production/7.pack` | 12.11 | Cache | 🟢 Safe to Remove |
| `node_modules/@esbuild/win32-x64/esbuild.exe` | 10.06 | Binary | 🟢 Safe (Dependency) |
| `renders/videos/5a6d3c34-7d7a-47c5-a4b6-86336d58f33d.mp4` | 8.32 | Video | 🟡 Needs Review |
| `renders/videos/d4f95d34-fcf2-435a-ba0a-be08360489d1.mp4` | 7.82 | Video | 🟡 Needs Review |
| `scripts/generated-images/scene_2.png` | 3.16 | Image | 🟡 Needs Review |
| `scripts/generated-images/scene_3.png` | 3.06 | Image | 🟡 Needs Review |
| `scripts/generated-images/scene_1.png` | 2.53 | Image | 🟡 Needs Review |

## 🚨 Critical Findings

### 1. **renders/** Directory (377.69 MB)
- **Contents:** Generated video assets, temporary images, audio files
- **References Found:** 
  - `src/app/api/generate-subtitles/route.ts` - references captions path
  - `scripts/render-tts.ts` - references output directory
  - `scripts/fix-missing-images.ts` - references image paths
- **Status:** 🟡 **NEEDS REVIEW** - These appear to be runtime-generated assets
- **Recommendation:** Keep for now, but investigate if these should be in Supabase storage
- **Files:** Multiple MP4 videos (8+ MB each), JPG/PNG images (3-4 MB each)

### 2. **.next/** Directory (250.92 MB)
- **Contents:** Next.js build cache and webpack bundles
- **Status:** 🟢 **SAFE TO REMOVE** - Build artifacts
- **Action:** Already in .gitignore, remove from tracking
- **Files:** Webpack cache files (.pack, .gz), build artifacts

### 3. **node_modules/** Directory (432.74 MB)
- **Contents:** NPM dependencies
- **Status:** 🟢 **SAFE TO REMOVE** - Should never be committed
- **Action:** Already in .gitignore, remove from tracking
- **Files:** Binary dependencies, JavaScript libraries

### 4. **scripts/generated-images/** Directory (~8.7 MB)
- **Contents:** AI-generated demo images
- **References Found:**
  - `scripts/generate-video-demo.ts` - generates these images
- **Status:** 🟡 **NEEDS REVIEW** - Demo/test assets
- **Recommendation:** Consider removing if not needed for production

### 5. **.git/** Directory (374.62 MB)
- **Contents:** Git history and objects
- **Status:** 🟡 **Git History** - Large due to binary files in history
- **Action:** Consider `git lfs migrate` for large binaries (separate task)

## 📋 Cleanup Action Plan

### Phase 1: Safe Removals (Immediate - ~683 MB)
- [ ] Remove `.next/` directory from Git tracking (250.92 MB)
- [ ] Remove `node_modules/` from Git tracking (432.74 MB)
- [ ] Update `.gitignore` to prevent re-adding

### Phase 2: Investigation Required (~386 MB)
- [ ] Review `renders/` directory usage in production (377.69 MB)
- [ ] Check if video assets should be in Supabase storage
- [ ] Verify `scripts/generated-images/` purpose (8.7 MB)

### Phase 3: Conditional Cleanup
- [ ] Remove test/scratch files if confirmed unused
- [ ] Clean up temporary files if safe
- [ ] Optimize image assets if needed

## 🛡️ Safety Measures

### Files to NEVER Delete
- `package.json`, `package-lock.json`
- `tsconfig.json`, `next.config.*`
- `src/**`, `app/**`, `components/**`
- `supabase/**`
- `public/favicon*`, `public/robots.txt`
- `.env.example`, `.env.local.example`

### Files to Keep if Uncertain
- Any file referenced in source code
- Configuration files
- Documentation files
- Asset files that might be used dynamically

## 📈 Expected Results

### Conservative Estimate (Phase 1 only)
- **Before:** 1.42 GB
- **After:** ~766 MB
- **Reduction:** ~46%

### Aggressive Estimate (if renders/ can be moved to storage)
- **Before:** 1.42 GB
- **After:** ~389 MB
- **Reduction:** ~73%

## 🔧 Next Steps

1. **Create cleanup branch** (when Git is available from WSL)
2. **Execute Phase 1** (safe removals - ~683 MB)
3. **Investigate Phase 2** items (~386 MB)
4. **Build validation** after each phase
5. **Create PR** with detailed report

## ⚠️ Warnings

- **DO NOT** delete files without understanding their purpose
- **ALWAYS** test build after cleanup
- **KEEP** files if there's any uncertainty
- **DOCUMENT** all decisions and actions

## 📝 File Reference Analysis

### Referenced Files (KEEP)
- `renders/${videoId}/captions/subtitles.vtt` - Used in generate-subtitles API
- `renders/${videoId}/images/scene_${sceneNumber}.png` - Used in fix-missing-images script
- `renders/${videoId}/` - Used as output directory in render-tts script

### Unreferenced Files (Potential Removal)
- `scripts/generated-images/*.png` - Demo images, not referenced in production code
- `renders/videos/*.mp4` - Large video files, check if needed
- `renders/*/temp/*` - Temporary files, likely safe to remove

---

*Report generated on: $(Get-Date)*
*Repository: StoryShort MVP*
*Total files analyzed: 200+*
*Immediate cleanup potential: 683 MB (46% reduction)*
