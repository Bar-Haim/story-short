export interface Language {
  code: string;
  name: string;
  nativeName: string;
  voiceId: string;
  flag: string;
  rtl?: boolean;
}

export const languages: Language[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    voiceId: 'Dslrhjl3ZpzrctukrQSN',
    flag: '🇺🇸'
  },
  {
    code: 'he',
    name: 'Hebrew',
    nativeName: 'עברית',
    voiceId: 'pNInz6obpgDQGjFmJhdz',
    flag: '🇮🇱',
    rtl: true
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    voiceId: '21m00Tcm4TlvDq8ikWAM',
    flag: '🇪🇸'
  }
];

export const getLanguageByCode = (code: string): Language | undefined => {
  return languages.find(lang => lang.code === code);
};

export const getDefaultLanguage = (): Language => {
  return languages[0]; // English
};

export const getLanguagePrompt = (language: Language): string => {
  const prompts = {
    en: 'Generate the script in English',
    he: 'Generate the script in Hebrew (עברית)',
    es: 'Generate the script in Spanish (Español)'
  };
  
  return prompts[language.code as keyof typeof prompts] || prompts.en;
}; 