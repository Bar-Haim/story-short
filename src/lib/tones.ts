export interface Tone {
  id: string;
  name: string;
  displayName: string;
  emoji: string;
  description: string;
  promptModifier: string;
  color: string;
}

export const tones: Tone[] = [
  {
    id: 'inspirational',
    name: 'inspirational',
    displayName: 'Inspirational',
    emoji: '✨',
    description: 'Uplifting and motivational content',
    promptModifier: 'Create an inspiring and motivational script that uplifts the audience and encourages positive action',
    color: '#8b5cf6'
  },
  {
    id: 'funny',
    name: 'funny',
    displayName: 'Funny',
    emoji: '😂',
    description: 'Humorous and entertaining content',
    promptModifier: 'Create a humorous and entertaining script that makes people laugh and includes witty observations',
    color: '#f59e0b'
  },
  {
    id: 'educational',
    name: 'educational',
    displayName: 'Educational',
    emoji: '🎓',
    description: 'Informative and educational content',
    promptModifier: 'Create an educational script that teaches and informs the audience with clear explanations and examples',
    color: '#10b981'
  },
  {
    id: 'marketing',
    name: 'marketing',
    displayName: 'Marketing',
    emoji: '📢',
    description: 'Promotional and persuasive content',
    promptModifier: 'Create a persuasive marketing script that promotes and sells with compelling calls to action',
    color: '#ef4444'
  },
  {
    id: 'emotional',
    name: 'emotional',
    displayName: 'Emotional',
    emoji: '💔',
    description: 'Emotional and touching content',
    promptModifier: 'Create an emotional script that touches the heart and creates empathy with moving storytelling',
    color: '#ec4899'
  }
];

export const getToneById = (id: string): Tone | undefined => {
  return tones.find(tone => tone.id === id);
};

export const getDefaultTone = (): Tone => {
  return tones[0]; // inspirational
}; 