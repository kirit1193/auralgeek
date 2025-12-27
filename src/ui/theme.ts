/**
 * Theme Manager
 * Modular dark/light theme system with persistence
 */

export type Theme = 'dark' | 'light';

class ThemeManagerClass {
  private _current: Theme = 'dark';
  private _listeners: Set<(theme: Theme) => void> = new Set();

  get current(): Theme {
    return this._current;
  }

  /**
   * Initialize theme from localStorage or default to dark
   */
  init(): void {
    const saved = localStorage.getItem('auralgeek-theme') as Theme | null;
    if (saved === 'dark' || saved === 'light') {
      this._current = saved;
    }
    this._applyTheme();
  }

  /**
   * Set theme and persist to localStorage
   */
  set(theme: Theme): void {
    if (theme !== this._current) {
      this._current = theme;
      localStorage.setItem('auralgeek-theme', theme);
      this._applyTheme();
      this._notifyListeners();
    }
  }

  /**
   * Toggle between dark and light
   */
  toggle(): void {
    this.set(this._current === 'dark' ? 'light' : 'dark');
  }

  /**
   * Subscribe to theme changes
   */
  subscribe(callback: (theme: Theme) => void): () => void {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  private _applyTheme(): void {
    document.documentElement.setAttribute('data-theme', this._current);
  }

  private _notifyListeners(): void {
    this._listeners.forEach(cb => cb(this._current));
  }
}

export const ThemeManager = new ThemeManagerClass();
