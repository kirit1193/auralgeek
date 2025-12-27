/**
 * Help Modal Component
 * Searchable metric reference with geek mode
 */

import { LitElement, html, css } from 'lit';
import {
  METRIC_DEFINITIONS,
  CATEGORY_INFO,
  getCategories,
  searchMetrics,
  type MetricDefinition,
  type MetricCategory,
} from '../data/metric-definitions.js';
import { ThemeManager, type Theme } from '../theme.js';

export class HelpModal extends LitElement {
  static styles = css`
    /* Dark theme (default) */
    :host {
      --bg-deep: #0a0a0a;
      --bg-panel: #141414;
      --bg-module: #1a1a1a;
      --bg-inset: #0f0f0f;
      --border-subtle: #2a2a2a;
      --border-panel: #333;
      --text-primary: #e5e5e5;
      --text-secondary: #888;
      --text-dim: #555;
      --accent-amber: #e8973c;
      --accent-amber-dim: #b36d1a;
      --led-green: #4ade80;
      --led-amber: #fbbf24;
      --backdrop-bg: rgba(0, 0, 0, 0.7);
    }

    /* Light theme */
    :host([data-theme="light"]) {
      --bg-deep: #f0f0f0;
      --bg-panel: #ffffff;
      --bg-module: #fafafa;
      --bg-inset: #f5f5f5;
      --border-subtle: #e0e0e0;
      --border-panel: #d0d0d0;
      --text-primary: #1a1a1a;
      --text-secondary: #666;
      --text-dim: #999;
      --accent-amber: #d07a20;
      --accent-amber-dim: #b36d1a;
      --led-green: #22c55e;
      --led-amber: #d97706;
      --backdrop-bg: rgba(0, 0, 0, 0.4);
    }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: var(--backdrop-bg);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s ease, visibility 0.2s ease;
    }

    .modal-backdrop.visible {
      opacity: 1;
      visibility: visible;
    }

    .modal-card {
      background: var(--bg-panel);
      border: 1px solid var(--border-panel);
      border-radius: 12px;
      width: 100%;
      max-width: 700px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
      transform: scale(0.95);
      transition: transform 0.2s ease;
    }

    .modal-backdrop.visible .modal-card {
      transform: scale(1);
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border-subtle);
      flex-shrink: 0;
    }

    .modal-title {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-primary);
      letter-spacing: 0.02em;
    }

    .modal-header-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .geek-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.65rem;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: background 0.15s ease;
    }

    .geek-toggle:hover {
      background: var(--bg-inset);
    }

    .geek-toggle-switch {
      width: 32px;
      height: 18px;
      background: var(--bg-inset);
      border: 1px solid var(--border-subtle);
      border-radius: 9px;
      position: relative;
      transition: all 0.2s ease;
    }

    .geek-toggle-switch::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 12px;
      height: 12px;
      background: var(--text-dim);
      border-radius: 50%;
      transition: all 0.2s ease;
    }

    .geek-toggle.active .geek-toggle-switch {
      background: var(--accent-amber);
      border-color: var(--accent-amber);
    }

    .geek-toggle.active .geek-toggle-switch::after {
      left: 16px;
      background: var(--bg-deep);
    }

    .modal-close-btn {
      width: 28px;
      height: 28px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      transition: all 0.15s ease;
    }

    .modal-close-btn:hover {
      background: var(--bg-inset);
      color: var(--text-primary);
    }

    .modal-search {
      padding: 12px 20px;
      border-bottom: 1px solid var(--border-subtle);
      flex-shrink: 0;
    }

    .modal-search-input {
      width: 100%;
      padding: 10px 14px;
      background: var(--bg-inset);
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 0.85rem;
      color: var(--text-primary);
      outline: none;
      transition: border-color 0.15s ease;
      box-sizing: border-box;
    }

    .modal-search-input::placeholder {
      color: var(--text-dim);
    }

    .modal-search-input:focus {
      border-color: var(--accent-amber);
    }

    .modal-content {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px;
    }

    .metric-category {
      margin-bottom: 16px;
    }

    .metric-category:last-child {
      margin-bottom: 0;
    }

    .category-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      cursor: pointer;
      user-select: none;
    }

    .category-icon {
      font-size: 0.9rem;
      opacity: 0.7;
    }

    .category-title {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-secondary);
    }

    .category-chevron {
      margin-left: auto;
      font-size: 0.7rem;
      color: var(--text-dim);
      transition: transform 0.2s ease;
    }

    .metric-category.collapsed .category-chevron {
      transform: rotate(-90deg);
    }

    .category-items {
      padding-left: 4px;
      border-left: 2px solid var(--border-subtle);
      margin-left: 8px;
    }

    .metric-category.collapsed .category-items {
      display: none;
    }

    .metric-item {
      padding: 10px 12px;
      border-bottom: 1px solid var(--border-subtle);
    }

    .metric-item:last-child {
      border-bottom: none;
    }

    .metric-item-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }

    .metric-item-name {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .metric-item-unit {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.6rem;
      color: var(--text-dim);
      background: var(--bg-inset);
      padding: 1px 5px;
      border-radius: 3px;
    }

    .metric-item-mode {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.5rem;
      color: var(--accent-amber);
      margin-left: auto;
      text-transform: uppercase;
    }

    .metric-item-desc {
      font-size: 0.7rem;
      color: var(--text-secondary);
      line-height: 1.5;
      margin-bottom: 4px;
    }

    .metric-item-range {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.65rem;
      color: var(--led-green);
      margin-bottom: 2px;
    }

    .metric-item-action {
      font-size: 0.65rem;
      color: var(--text-dim);
      font-style: italic;
    }

    .metric-geek-details {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px dashed var(--border-subtle);
    }

    .metric-geek-row {
      display: flex;
      gap: 8px;
      font-size: 0.65rem;
      margin-bottom: 4px;
    }

    .metric-geek-row:last-child {
      margin-bottom: 0;
    }

    .metric-geek-label {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      color: var(--text-dim);
      text-transform: uppercase;
      font-size: 0.55rem;
      min-width: 60px;
    }

    .metric-geek-value {
      color: var(--text-secondary);
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
    }

    .no-results {
      text-align: center;
      padding: 40px 20px;
      color: var(--text-dim);
      font-size: 0.85rem;
    }

    @media (max-width: 600px) {
      .modal-backdrop {
        padding: 10px;
      }

      .modal-card {
        max-height: 90vh;
        border-radius: 8px;
      }

      .modal-header {
        flex-wrap: wrap;
        gap: 8px;
        padding: 12px;
      }

      .modal-title {
        font-size: 0.75rem;
      }

      .modal-search {
        padding: 8px 12px;
      }

      .modal-search-input {
        padding: 8px 10px;
        font-size: 0.8rem;
      }

      .modal-content {
        padding: 12px;
      }

      .geek-toggle {
        order: 3;
        width: 100%;
        justify-content: center;
      }
    }
  `;

  static properties = {
    open: { type: Boolean },
    searchQuery: { state: true },
    geekMode: { state: true },
    collapsedCategories: { state: true },
    currentTheme: { state: true },
  };

  // Reactive properties (use declare to avoid class field issues with Lit 3.x)
  declare open: boolean;
  declare private searchQuery: string;
  declare private geekMode: boolean;
  declare private collapsedCategories: Set<MetricCategory>;
  declare private currentTheme: Theme;

  private _themeUnsubscribe: (() => void) | null = null;

  constructor() {
    super();
    this.open = false;
    this.searchQuery = '';
    this.collapsedCategories = new Set();
    this.currentTheme = ThemeManager.current;
    // Load geek mode preference from localStorage
    const saved = localStorage.getItem('auralgeek-geekmode');
    this.geekMode = saved === 'true';
  }

  connectedCallback(): void {
    super.connectedCallback();
    // Listen for ESC key
    this._handleKeyDown = this._handleKeyDown.bind(this);
    document.addEventListener('keydown', this._handleKeyDown);

    // Subscribe to theme changes
    this._applyTheme(ThemeManager.current);
    this._themeUnsubscribe = ThemeManager.subscribe((theme) => {
      this.currentTheme = theme;
      this._applyTheme(theme);
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this._handleKeyDown);
    if (this._themeUnsubscribe) {
      this._themeUnsubscribe();
      this._themeUnsubscribe = null;
    }
  }

  private _applyTheme(theme: Theme): void {
    if (theme === 'light') {
      this.setAttribute('data-theme', 'light');
    } else {
      this.removeAttribute('data-theme');
    }
  }

  private _handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.open) {
      this._close();
    }
  }

  private _close(): void {
    this.dispatchEvent(new CustomEvent('close'));
  }

  private _onBackdropClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
      this._close();
    }
  }

  private _onSearchInput(e: InputEvent): void {
    this.searchQuery = (e.target as HTMLInputElement).value;
  }

  private _toggleGeekMode(): void {
    this.geekMode = !this.geekMode;
    localStorage.setItem('auralgeek-geekmode', String(this.geekMode));
  }

  private _toggleCategory(category: MetricCategory): void {
    const newSet = new Set(this.collapsedCategories);
    if (newSet.has(category)) {
      newSet.delete(category);
    } else {
      newSet.add(category);
    }
    this.collapsedCategories = newSet;
  }

  private _getFilteredMetrics(): Map<MetricCategory, MetricDefinition[]> {
    const filtered = searchMetrics(this.searchQuery);
    const grouped = new Map<MetricCategory, MetricDefinition[]>();

    for (const category of getCategories()) {
      const metrics = filtered.filter(m => m.category === category);
      if (metrics.length > 0) {
        grouped.set(category, metrics);
      }
    }

    return grouped;
  }

  private _renderMetricItem(metric: MetricDefinition) {
    return html`
      <div class="metric-item">
        <div class="metric-item-header">
          <span class="metric-item-name">${metric.name}</span>
          ${metric.unit ? html`<span class="metric-item-unit">${metric.unit}</span>` : null}
          <span class="metric-item-mode">${metric.modes.join(' / ')}</span>
        </div>
        <div class="metric-item-desc">${metric.description}</div>
        ${metric.goodRange ? html`<div class="metric-item-range">Target: ${metric.goodRange}</div>` : null}
        ${metric.action ? html`<div class="metric-item-action">${metric.action}</div>` : null}

        ${this.geekMode && (metric.formula || metric.standard || metric.technicalNotes) ? html`
          <div class="metric-geek-details" style="display: block;">
            ${metric.formula ? html`
              <div class="metric-geek-row">
                <span class="metric-geek-label">Formula</span>
                <span class="metric-geek-value">${metric.formula}</span>
              </div>
            ` : null}
            ${metric.standard ? html`
              <div class="metric-geek-row">
                <span class="metric-geek-label">Standard</span>
                <span class="metric-geek-value">${metric.standard}</span>
              </div>
            ` : null}
            ${metric.technicalNotes ? html`
              <div class="metric-geek-row">
                <span class="metric-geek-label">Notes</span>
                <span class="metric-geek-value">${metric.technicalNotes}</span>
              </div>
            ` : null}
          </div>
        ` : null}
      </div>
    `;
  }

  private _renderCategory(category: MetricCategory, metrics: MetricDefinition[]) {
    const info = CATEGORY_INFO[category];
    const isCollapsed = this.collapsedCategories.has(category);

    return html`
      <div class="metric-category ${isCollapsed ? 'collapsed' : ''}">
        <div class="category-header" @click=${() => this._toggleCategory(category)}>
          <span class="category-icon">${info.icon}</span>
          <span class="category-title">${info.title}</span>
          <span class="category-chevron">▼</span>
        </div>
        <div class="category-items">
          ${metrics.map(m => this._renderMetricItem(m))}
        </div>
      </div>
    `;
  }

  render() {
    const grouped = this._getFilteredMetrics();

    return html`
      <div class="modal-backdrop ${this.open ? 'visible' : ''}" @click=${this._onBackdropClick}>
        <div class="modal-card">
          <div class="modal-header">
            <span class="modal-title">Metric Reference</span>
            <div class="modal-header-right">
              <div class="geek-toggle ${this.geekMode ? 'active' : ''}" @click=${this._toggleGeekMode}>
                <span>Geek Mode</span>
                <div class="geek-toggle-switch"></div>
              </div>
              <button class="modal-close-btn" @click=${this._close} title="Close (Esc)">✕</button>
            </div>
          </div>

          <div class="modal-search">
            <input
              type="text"
              class="modal-search-input"
              placeholder="Search metrics..."
              .value=${this.searchQuery}
              @input=${this._onSearchInput}
            />
          </div>

          <div class="modal-content ${this.geekMode ? 'geek-mode-active' : ''}">
            ${grouped.size > 0
              ? Array.from(grouped.entries()).map(([cat, metrics]) =>
                  this._renderCategory(cat, metrics)
                )
              : html`<div class="no-results">No metrics found matching "${this.searchQuery}"</div>`
            }
          </div>
        </div>
      </div>
    `;
  }
}

if (!customElements.get('help-modal')) {
  customElements.define('help-modal', HelpModal);
}
