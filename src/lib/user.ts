export interface UserProfile {
  user_id: string;
  email?: string;
  display_name?: string;
  preferences: {
    default_theme?: string;
    default_language?: string;
    default_tone?: string;
    auto_save?: boolean;
  };
  created_at: string;
  updated_at: string;
}

export class UserService {
  private static readonly USER_ID_KEY = 'storyshort_user_id';
  private static readonly USER_PREFERENCES_KEY = 'storyshort_user_preferences';

  /**
   * Generate or retrieve user ID
   */
  static getUserId(): string {
    if (typeof window === 'undefined') return 'anonymous';
    
    let userId = localStorage.getItem(this.USER_ID_KEY);
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
      localStorage.setItem(this.USER_ID_KEY, userId);
    }
    return userId;
  }

  /**
   * Get user preferences from localStorage
   */
  static getUserPreferences(): UserProfile['preferences'] {
    if (typeof window === 'undefined') return {};
    
    const stored = localStorage.getItem(this.USER_PREFERENCES_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse user preferences:', e);
      }
    }
    
    return {
      default_theme: 'cinematic',
      default_language: 'en',
      default_tone: 'inspirational',
      auto_save: true
    };
  }

  /**
   * Save user preferences to localStorage
   */
  static saveUserPreferences(preferences: Partial<UserProfile['preferences']>): void {
    if (typeof window === 'undefined') return;
    
    const current = this.getUserPreferences();
    const updated = { ...current, ...preferences };
    localStorage.setItem(this.USER_PREFERENCES_KEY, JSON.stringify(updated));
  }

  /**
   * Get user profile (from localStorage for now)
   */
  static getUserProfile(): UserProfile {
    const userId = this.getUserId();
    const preferences = this.getUserPreferences();
    
    return {
      user_id: userId,
      preferences,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Clear user data (for logout)
   */
  static clearUserData(): void {
    if (typeof window === 'undefined') return;
    
    localStorage.removeItem(this.USER_ID_KEY);
    localStorage.removeItem(this.USER_PREFERENCES_KEY);
  }

  /**
   * Check if user is anonymous
   */
  static isAnonymous(): boolean {
    const userId = this.getUserId();
    return userId.startsWith('user_') && userId.includes('anonymous');
  }
} 