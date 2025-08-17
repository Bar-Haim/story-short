-- Phase M4: Advanced Features & Personalization Schema Updates
-- This script adds support for theme packs, multilingual support, script style selection, and user profiles

-- Add new columns to videos table
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS theme VARCHAR(50) DEFAULT 'cinematic',
ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en',
ADD COLUMN IF NOT EXISTS tone VARCHAR(50) DEFAULT 'inspirational',
ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);

-- Create index for user_id for better query performance
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);

-- Create a themes table for reference (optional)
CREATE TABLE IF NOT EXISTS themes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    image_style_prompt TEXT,
    font_style VARCHAR(100),
    transition_style VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default themes
INSERT INTO themes (name, display_name, description, image_style_prompt, font_style, transition_style) VALUES
('cinematic', 'Cinematic', 'Professional movie-like style with dramatic lighting and composition', 'cinematic, professional photography, dramatic lighting, high contrast, film grain', 'sans-serif, bold', 'fade'),
('illustrated', 'Illustrated / Anime', 'Artistic illustrated style with vibrant colors and cartoon-like characters', 'illustrated, anime style, vibrant colors, cartoon characters, artistic', 'rounded, playful', 'slide'),
('vintage', 'Vintage', 'Retro style with warm colors and nostalgic feel', 'vintage, retro, warm colors, nostalgic, film photography style', 'serif, elegant', 'dissolve'),
('modern', 'Modern / Minimal', 'Clean, minimalist style with simple compositions', 'modern, minimalist, clean, simple composition, neutral colors', 'sans-serif, thin', 'cut'),
('storybook', 'Children''s Storybook', 'Whimsical storybook style with soft colors and magical elements', 'storybook, whimsical, soft colors, magical, children''s book illustration', 'handwritten, friendly', 'zoom')
ON CONFLICT (name) DO NOTHING;

-- Create a languages table for reference
CREATE TABLE IF NOT EXISTS languages (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    native_name VARCHAR(100) NOT NULL,
    voice_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert supported languages
INSERT INTO languages (code, name, native_name, voice_id) VALUES
('en', 'English', 'English', 'Dslrhjl3ZpzrctukrQSN'),
('he', 'Hebrew', 'עברית', 'pNInz6obpgDQGjFmJhdz'),
('es', 'Spanish', 'Español', '21m00Tcm4TlvDq8ikWAM')
ON CONFLICT (code) DO NOTHING;

-- Create a tones table for reference
CREATE TABLE IF NOT EXISTS tones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    emoji VARCHAR(10),
    description TEXT,
    prompt_modifier TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert tone options
INSERT INTO tones (name, display_name, emoji, description, prompt_modifier) VALUES
('inspirational', 'Inspirational', '✨', 'Uplifting and motivational content', 'Create an inspiring and motivational script that uplifts the audience'),
('funny', 'Funny', '😂', 'Humorous and entertaining content', 'Create a humorous and entertaining script that makes people laugh'),
('educational', 'Educational', '🎓', 'Informative and educational content', 'Create an educational script that teaches and informs the audience'),
('marketing', 'Marketing', '📢', 'Promotional and persuasive content', 'Create a persuasive marketing script that promotes and sells'),
('emotional', 'Emotional', '💔', 'Emotional and touching content', 'Create an emotional script that touches the heart and creates empathy')
ON CONFLICT (name) DO NOTHING;

-- Create a user_profiles table for user management (optional)
CREATE TABLE IF NOT EXISTS user_profiles (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255),
    display_name VARCHAR(100),
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for user_profiles
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON COLUMN videos.theme IS 'Visual theme/style for the video (cinematic, illustrated, vintage, modern, storybook)';
COMMENT ON COLUMN videos.language IS 'Language code for the video (en, he, es)';
COMMENT ON COLUMN videos.tone IS 'Script tone/style (inspirational, funny, educational, marketing, emotional)';
COMMENT ON COLUMN videos.user_id IS 'User identifier for personalization';

-- Create view for video statistics with theme/language breakdown
CREATE OR REPLACE VIEW video_stats AS
SELECT 
    COUNT(*) as total_videos,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_videos,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_videos,
    theme,
    language,
    tone,
    DATE_TRUNC('day', created_at) as created_date
FROM videos 
GROUP BY theme, language, tone, DATE_TRUNC('day', created_at);

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT ON video_stats TO anon;
-- GRANT SELECT ON themes TO anon;
-- GRANT SELECT ON languages TO anon;
-- GRANT SELECT ON tones TO anon; 