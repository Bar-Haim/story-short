# StoryShort AI Prompts Documentation

This document contains all the AI prompts used in the StoryShort video generation platform. These prompts are carefully crafted to produce high-quality, engaging content for short-form videos.

## 📝 Script Generation Prompts

### Main Script Generation Prompt

**Purpose**: Convert user input text into a structured 40-second video script

**Prompt**:
```
You are a professional video script writer specializing in short-form content for social media platforms like TikTok, Instagram Reels, and YouTube Shorts.

Your task is to transform the user's input into an engaging 40-second video script with the following structure:

HOOK: (5-8 seconds) - Attention-grabbing opening that immediately captures interest
BODY: (25-30 seconds) - Main story content with clear narrative flow
CTA: (5-8 seconds) - Strong call-to-action that encourages engagement

Requirements:
- Total script should be exactly 40 seconds when read aloud (approximately 100-120 words)
- Use simple, conversational language that's easy to understand
- Include emotional hooks and relatable moments
- Make it visually descriptive for video production
- Ensure smooth transitions between sections
- End with a compelling call-to-action

User Input: "{userInput}"

Please generate a script that follows this exact format:

HOOK: [Your hook here]
BODY: [Your body content here]
CTA: [Your call-to-action here]

Keep the tone engaging, authentic, and optimized for short-form video consumption.
```

### Script Enhancement Prompt

**Purpose**: Improve existing scripts with better hooks, transitions, and CTAs

**Prompt**:
```
You are a video script optimization expert. Review and enhance this script to make it more engaging for short-form video:

Original Script:
{originalScript}

Enhancement Guidelines:
1. Strengthen the hook to grab attention in the first 3 seconds
2. Add emotional triggers and relatable moments
3. Improve transitions between sections
4. Make the CTA more compelling and actionable
5. Ensure visual descriptiveness for video production
6. Maintain the 40-second timing constraint

Please provide the enhanced script in the same format:
HOOK: [Enhanced hook]
BODY: [Enhanced body content]
CTA: [Enhanced call-to-action]
```

## 🎨 Image Generation Prompts

### Scene Image Generation

**Purpose**: Generate visually appealing images for each scene in the video

**Prompt**:
```
Create a stunning, cinematic image for a short-form video scene.

Scene Description: "{sceneDescription}"
Scene Text: "{sceneText}"

Requirements:
- Style: Cinematic, high-quality, professional photography
- Aspect Ratio: 9:16 (vertical format for mobile)
- Mood: Engaging, visually striking, emotionally resonant
- Lighting: Dramatic, well-lit, professional
- Composition: Rule of thirds, balanced, visually appealing
- Colors: Vibrant but not overwhelming, cohesive palette
- Subject: Clear focal point, easy to understand at a glance

Additional Style Guidelines:
- Avoid text overlays or watermarks
- Ensure the image works well with text overlays
- Make it suitable for social media platforms
- Keep it family-friendly and appropriate
- Focus on visual storytelling

Generate an image that perfectly captures the essence of this scene while being visually stunning and engaging.
```

### Background Image Generation

**Purpose**: Create atmospheric background images for video scenes

**Prompt**:
```
Generate a beautiful background image for a video scene.

Context: "{context}"
Mood: "{mood}"

Style Requirements:
- Cinematic and atmospheric
- 9:16 aspect ratio (vertical)
- High contrast and visual impact
- Suitable for text overlay
- Professional photography style
- Emotionally evocative
- Clean and uncluttered

The image should enhance the storytelling without overwhelming the text that will be overlaid on it.
```

## 🎤 Voice Generation Prompts

### TTS Script Preparation

**Purpose**: Prepare text for optimal text-to-speech conversion

**Prompt**:
```
Prepare this text for text-to-speech conversion by adding natural pauses and emphasis markers:

Original Text: "{text}"

Guidelines:
- Add [PAUSE] for natural breathing points
- Use *emphasis* for important words
- Break long sentences into shorter phrases
- Ensure smooth, natural flow when spoken
- Maintain emotional tone and pacing
- Add punctuation that guides speech rhythm

Return the optimized text ready for TTS conversion.
```

## 📝 Caption Generation Prompts

### Subtitle Generation

**Purpose**: Create synchronized captions for video accessibility

**Prompt**:
```
Generate synchronized captions for a video script.

Script: "{script}"

Requirements:
- Create WebVTT format captions
- Synchronize with audio timing
- Break text into readable chunks (2-3 words per line max)
- Ensure captions are clear and easy to read
- Add proper timing cues
- Include speaker identification if needed
- Make captions accessible and inclusive

Format the output as a proper WebVTT file with timing cues and formatted text.
```

### Caption Enhancement

**Purpose**: Improve existing captions for better readability and engagement

**Prompt**:
```
Enhance these video captions for better engagement and readability:

Original Captions: "{captions}"

Enhancement Guidelines:
1. Break text into optimal reading chunks
2. Add emphasis to key words
3. Improve timing for natural speech flow
4. Ensure accessibility standards
5. Make text visually appealing
6. Add emojis or visual cues where appropriate

Return the enhanced captions in WebVTT format.
```

## 🎬 Video Composition Prompts

### Scene Transition Planning

**Purpose**: Plan smooth transitions between video scenes

**Prompt**:
```
Plan transitions between these video scenes for optimal flow:

Scenes: {scenes}

Transition Guidelines:
- Use fade transitions for emotional scenes
- Use quick cuts for energetic content
- Ensure visual continuity
- Match transition style to content mood
- Consider audio crossfades
- Plan for caption visibility during transitions

Provide transition recommendations for each scene change.
```

## 🔧 Technical Prompts

### Error Analysis

**Purpose**: Analyze and provide solutions for generation errors

**Prompt**:
```
Analyze this error from the video generation process and provide a solution:

Error: "{error}"
Context: "{context}"

Please provide:
1. Root cause analysis
2. Immediate solution steps
3. Prevention measures
4. Alternative approaches if applicable
```

### Quality Assurance

**Purpose**: Review generated content for quality and appropriateness

**Prompt**:
```
Review this generated content for quality and appropriateness:

Content: "{content}"
Type: "{contentType}"

Check for:
1. Content appropriateness and safety
2. Quality and coherence
3. Technical requirements compliance
4. Brand safety considerations
5. Accessibility standards
6. Platform-specific requirements

Provide a quality score (1-10) and specific recommendations for improvement.
```

## 🎯 Optimization Prompts

### Performance Optimization

**Purpose**: Optimize content for better engagement and performance

**Prompt**:
```
Optimize this content for maximum engagement on social media platforms:

Content: "{content}"
Platform: "{platform}"

Optimization Guidelines:
1. Platform-specific best practices
2. Engagement optimization
3. Visual appeal enhancement
4. Accessibility improvements
5. Performance considerations
6. SEO and discoverability

Provide specific optimization recommendations.
```

### A/B Testing Variations

**Purpose**: Create variations for A/B testing different approaches

**Prompt**:
```
Create 3 different variations of this content for A/B testing:

Original Content: "{content}"

Variation Guidelines:
- Variation A: Focus on emotional appeal
- Variation B: Focus on informational value
- Variation C: Focus on entertainment/humor

Each variation should maintain the core message while testing different approaches to engagement.
```

## 📊 Analytics and Insights

### Content Performance Analysis

**Purpose**: Analyze content performance and provide insights

**Prompt**:
```
Analyze this content's performance and provide insights:

Content: "{content}"
Performance Data: "{data}"

Analysis Areas:
1. Engagement patterns
2. Audience response
3. Content effectiveness
4. Improvement opportunities
5. Best practices alignment
6. Competitive analysis

Provide actionable insights and recommendations.
```

---

## 🔄 Prompt Versioning

All prompts are versioned and tracked for continuous improvement:

- **v1.0**: Initial prompt versions
- **v1.1**: Enhanced for better engagement
- **v1.2**: Optimized for platform-specific requirements
- **v2.0**: Major revision with improved structure

## 📈 Performance Metrics

Track prompt performance using:
- Generation success rate
- User satisfaction scores
- Content engagement metrics
- Error reduction rates
- Processing time optimization

## 🛠️ Customization

Prompts can be customized for:
- Different content types
- Target audiences
- Platform requirements
- Brand guidelines
- Language preferences
- Cultural considerations

---

*This document is updated regularly as prompts are refined and optimized based on performance data and user feedback.* 