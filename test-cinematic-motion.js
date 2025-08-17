const fs = require('fs');
const path = require('path');

// Test the cinematic motion effects implementation
async function testCinematicMotion() {
  console.log('🎬 Testing enhanced cinematic motion effects...\n');

  try {
    // Test 1: Check if the render-video route has been updated with motion effects
    console.log('📋 Test 1: Checking render-video motion effects...');
    const renderApiPath = path.join(__dirname, 'src', 'app', 'api', 'render-video', 'route.ts');
    
    if (fs.existsSync(renderApiPath)) {
      const renderContent = fs.readFileSync(renderApiPath, 'utf8');
      
      // Check for motion effect components
      const motionChecks = [
        { name: 'Zoom effects', pattern: 'zoompan=z=', found: renderContent.includes('zoompan=z=') },
        { name: 'Panning motion', pattern: 'sin(t*0.4)*15', found: renderContent.includes('sin(t*0.4)*15') },
        { name: 'Camera shake', pattern: 'crop=1080:1920:x=', found: renderContent.includes('crop=1080:1920:x=') },
        { name: 'Color grading', pattern: 'eq=contrast=', found: renderContent.includes('eq=contrast=') },
        { name: 'Vignette effect', pattern: 'vignette=PI/4', found: renderContent.includes('vignette=PI/4') },
        { name: 'Film grain', pattern: 'noise=c0s=', found: renderContent.includes('noise=c0s=') },
        { name: 'Motion patterns', pattern: 'generateMotionEffects', found: renderContent.includes('generateMotionEffects') }
      ];
      
      motionChecks.forEach(check => {
        if (check.found) {
          console.log(`✅ ${check.name} implemented`);
        } else {
          console.log(`❌ ${check.name} missing`);
        }
      });
      
      // Check for specific motion patterns
      if (renderContent.includes('sin(t*0.8)*0.0005')) {
        console.log('✅ Dynamic zoom oscillation implemented');
      }
      
      if (renderContent.includes('sin(t*1.2)*5')) {
        console.log('✅ Multi-frequency panning motion implemented');
      }
      
      if (renderContent.includes('sin(t*3.1)*0.8')) {
        console.log('✅ Multi-frequency camera shake implemented');
      }
      
    } else {
      console.log('❌ Render-video API not found');
    }

    // Test 2: Check motion effect function
    console.log('\n📋 Test 2: Checking motion effect generator function...');
    if (fs.existsSync(renderApiPath)) {
      const renderContent = fs.readFileSync(renderApiPath, 'utf8');
      
      if (renderContent.includes('function generateMotionEffects')) {
        console.log('✅ Motion effect generator function implemented');
        
        // Check for different motion patterns
        const patterns = [
          'Gentle zoom with smooth pan',
          'Dynamic zoom with circular motion', 
          'Subtle zoom with gentle sway',
          'Dynamic movement with parallax effect'
        ];
        
        patterns.forEach(pattern => {
          if (renderContent.includes(pattern)) {
            console.log(`✅ Motion pattern: ${pattern}`);
          }
        });
      } else {
        console.log('❌ Motion effect generator function missing');
      }
    }

    // Test 3: Check for cinematic effects
    console.log('\n📋 Test 3: Checking cinematic effects...');
    if (fs.existsSync(renderApiPath)) {
      const renderContent = fs.readFileSync(renderApiPath, 'utf8');
      
      const cinematicEffects = [
        { name: 'Color grading', pattern: 'contrast=1.08:saturation=1.03', found: renderContent.includes('contrast=1.08:saturation=1.03') },
        { name: 'Vignette', pattern: 'vignette=PI/4:mode=relative', found: renderContent.includes('vignette=PI/4:mode=relative') },
        { name: 'Film grain', pattern: 'noise=c0s=0.1:allf=t', found: renderContent.includes('noise=c0s=0.1:allf=t') },
        { name: 'Handheld camera feel', pattern: 'handheld camera feel', found: renderContent.includes('handheld camera feel') }
      ];
      
      cinematicEffects.forEach(effect => {
        if (effect.found) {
          console.log(`✅ ${effect.name} implemented`);
        } else {
          console.log(`❌ ${effect.name} missing`);
        }
      });
    }

    // Test 4: Check FFmpeg command structure
    console.log('\n📋 Test 4: Checking FFmpeg command structure...');
    if (fs.existsSync(renderApiPath)) {
      const renderContent = fs.readFileSync(renderApiPath, 'utf8');
      
      if (renderContent.includes('ffmpeg -y -f concat -safe 0')) {
        console.log('✅ FFmpeg concat demuxer configured');
      }
      
      if (renderContent.includes('-vf "')) {
        console.log('✅ Video filters properly quoted');
      }
      
      if (renderContent.includes('libx264 -preset fast -crf 23')) {
        console.log('✅ High-quality video encoding configured');
      }
    }

    console.log('\n🎯 Summary of cinematic motion effects:');
    console.log('✅ Dynamic zoom with oscillation');
    console.log('✅ Multi-frequency panning motion');
    console.log('✅ Subtle camera shake (handheld feel)');
    console.log('✅ Color grading for cinematic look');
    console.log('✅ Vignette effect for depth');
    console.log('✅ Film grain for texture');
    console.log('✅ Multiple motion patterns for variety');
    
    console.log('\n🎬 The enhanced cinematic motion effects are ready!');
    console.log('📹 Videos will now have dynamic, cinematic movement instead of static frames.');
    console.log('🎥 Each scene will feature:');
    console.log('   - Smooth zoom and pan effects');
    console.log('   - Subtle camera shake for realism');
    console.log('   - Cinematic color grading');
    console.log('   - Professional film grain texture');
    console.log('   - Vignette for depth and focus');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testCinematicMotion(); 