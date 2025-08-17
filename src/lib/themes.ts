export interface Theme {
  id: string;
  name: string;
  displayName: string;
  description: string;
  imageStylePrompt: string;
  fontStyle: string;
  transitionStyle: string;
  colorPalette: string[];
  icon: string;
}

export const themes: Theme[] = [
  {
    id: 'cinematic',
    name: 'cinematic',
    displayName: 'Cinematic',
    description: 'Professional movie-like style with dramatic lighting and composition',
    imageStylePrompt: 'cinematic, professional photography, dramatic lighting, high contrast, film grain, movie poster style',
    fontStyle: 'sans-serif, bold, white with black outline',
    transitionStyle: 'fade',
    colorPalette: ['#000000', '#ffffff', '#ff6b35', '#f7931e'],
    icon: '🎬'
  },
  {
    id: 'illustrated',
    name: 'illustrated',
    displayName: 'Illustrated / Anime',
    description: 'Artistic illustrated style with vibrant colors and cartoon-like characters',
    imageStylePrompt: 'illustrated, anime style, vibrant colors, cartoon characters, artistic, digital art, colorful',
    fontStyle: 'rounded, playful, bold, colorful',
    transitionStyle: 'slide',
    colorPalette: ['#ff6b9d', '#4ecdc4', '#45b7d1', '#96ceb4'],
    icon: '🎨'
  },
  {
    id: 'vintage',
    name: 'vintage',
    displayName: 'Vintage',
    description: 'Retro style with warm colors and nostalgic feel',
    imageStylePrompt: 'vintage, retro, warm colors, nostalgic, film photography style, sepia tones, classic',
    fontStyle: 'serif, elegant, warm colors',
    transitionStyle: 'dissolve',
    colorPalette: ['#8b4513', '#d2691e', '#f4a460', '#deb887'],
    icon: '📷'
  },
  {
    id: 'modern',
    name: 'modern',
    displayName: 'Modern / Minimal',
    description: 'Clean, minimalist style with simple compositions',
    imageStylePrompt: 'modern, minimalist, clean, simple composition, neutral colors, geometric shapes',
    fontStyle: 'sans-serif, thin, clean',
    transitionStyle: 'cut',
    colorPalette: ['#2c3e50', '#34495e', '#7f8c8d', '#bdc3c7'],
    icon: '⚡'
  },
  {
    id: 'storybook',
    name: 'storybook',
    displayName: 'Children\'s Storybook',
    description: 'Whimsical storybook style with soft colors and magical elements',
    imageStylePrompt: 'storybook, whimsical, soft colors, magical, children\'s book illustration, fairy tale',
    fontStyle: 'handwritten, friendly, warm',
    transitionStyle: 'zoom',
    colorPalette: ['#ffb6c1', '#98fb98', '#87ceeb', '#dda0dd'],
    icon: '📚'
  }
];

export const getThemeById = (id: string): Theme | undefined => {
  return themes.find(theme => theme.id === id);
};

export const getDefaultTheme = (): Theme => {
  return themes[0]; // cinematic
}; 