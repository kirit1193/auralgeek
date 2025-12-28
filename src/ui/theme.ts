/**
 * Theme Manager
 * Modular dark/light theme system with persistence and smooth transitions
 */

export type Theme = 'dark' | 'light';

class ThemeManagerClass {
  private _current: Theme = 'dark';
  private _listeners: Set<(theme: Theme) => void> = new Set();
  private _isTransitioning = false;
  private _overlay: HTMLElement | null = null;

  get current(): Theme {
    return this._current;
  }

  get isTransitioning(): boolean {
    return this._isTransitioning;
  }

  /**
   * Initialize theme from localStorage or default to dark
   */
  init(): void {
    const saved = localStorage.getItem('auralgeek-theme') as Theme | null;
    if (saved === 'dark' || saved === 'light') {
      this._current = saved;
    }
    this._applyTheme(false);
    this._createOverlay();
  }

  /**
   * Set theme and persist to localStorage
   */
  set(theme: Theme): void {
    if (theme !== this._current && !this._isTransitioning) {
      this._current = theme;
      localStorage.setItem('auralgeek-theme', theme);
      this._applyTheme(true);
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

  private _createOverlay(): void {
    if (this._overlay) return;

    const overlay = document.createElement('div');
    overlay.id = 'theme-transition-overlay';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 99999;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s ease-out;
    `;
    document.body.appendChild(overlay);
    this._overlay = overlay;
  }

  private _applyTheme(animate: boolean): void {
    const root = document.documentElement;

    if (animate && this._overlay) {
      this._isTransitioning = true;

      // Use a subtle semi-transparent veil (not fully opaque)
      const targetColor = this._current === 'light'
        ? 'rgba(240, 240, 240, 0.6)'
        : 'rgba(10, 10, 10, 0.6)';
      this._overlay.style.background = targetColor;

      // Fade in overlay (subtle veil)
      this._overlay.style.opacity = '1';

      // Switch theme while veil is visible
      setTimeout(() => {
        root.setAttribute('data-theme', this._current);

        // Fade out overlay
        setTimeout(() => {
          if (this._overlay) {
            this._overlay.style.opacity = '0';
          }
          this._isTransitioning = false;
        }, 80);
      }, 150);
    } else {
      root.setAttribute('data-theme', this._current);
    }
  }

  private _notifyListeners(): void {
    this._listeners.forEach(cb => cb(this._current));
  }
}

export const ThemeManager = new ThemeManagerClass();
