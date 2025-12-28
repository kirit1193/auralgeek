/**
 * Album Analyzer App Styles
 * Studio console theme inspired by SSL/Neve mixing consoles, VU meters, and control room aesthetics
 */

import { css } from 'lit';

export const appStyles = css`
    /* === STUDIO CONSOLE THEME === */
    /* Inspired by SSL/Neve mixing consoles, VU meters, and control room aesthetics */

    :host {
      --bg-deep: #0a0a0a;
      --bg-panel: #141414;
      --bg-module: #1a1a1a;
      --bg-inset: #0f0f0f;
      --border-subtle: #2a2a2a;
      --border-panel: #333;

      /* VU Meter inspired accent colors */
      --accent-amber: #e8973c;
      --accent-amber-dim: #b36d1a;
      --accent-amber-glow: rgba(232, 151, 60, 0.4);

      /* LED Status colors */
      --led-green: #4ade80;
      --led-green-glow: rgba(74, 222, 128, 0.5);
      --led-amber: #fbbf24;
      --led-amber-glow: rgba(251, 191, 36, 0.5);
      --led-red: #f87171;
      --led-red-glow: rgba(248, 113, 113, 0.5);

      /* Text hierarchy */
      --text-primary: #e5e5e5;
      --text-secondary: #888;
      --text-dim: #555;
      --text-label: #666;

      /* Meter zone colors - hardware inspired */
      --zone-optimal: #22c55e;
      --zone-warn: #eab308;
      --zone-danger: #dc2626;
      --zone-cold: #3b82f6;

      display: block;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-deep);
      color: var(--text-primary);
      min-height: 100vh;
      min-height: 100dvh;
      line-height: 1.5;
      font-size: 14px;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* === LIGHT THEME === */
    :host([data-theme="light"]) {
      --bg-deep: #f0f0f0;
      --bg-panel: #ffffff;
      --bg-module: #fafafa;
      --bg-inset: #f5f5f5;
      --border-subtle: #e0e0e0;
      --border-panel: #d0d0d0;

      /* Text hierarchy - inverted for light */
      --text-primary: #1a1a1a;
      --text-secondary: #555;
      --text-dim: #888;
      --text-label: #666;

      /* Accent colors adjusted for light */
      --accent-amber: #c77a2a;
      --accent-amber-dim: #a56520;
      --accent-amber-glow: rgba(199, 122, 42, 0.3);

      /* LED colors - slightly adjusted for contrast */
      --led-green: #16a34a;
      --led-green-glow: rgba(22, 163, 74, 0.4);
      --led-amber: #d97706;
      --led-amber-glow: rgba(217, 119, 6, 0.4);
      --led-red: #dc2626;
      --led-red-glow: rgba(220, 38, 38, 0.4);

      /* Zone colors - adjusted for light background */
      --zone-optimal: #16a34a;
      --zone-warn: #ca8a04;
      --zone-danger: #dc2626;
      --zone-cold: #2563eb;
    }

    /* Light theme specific overrides */
    :host([data-theme="light"]) .header-module,
    :host([data-theme="light"]) .panel {
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.8),
        0 2px 8px rgba(0,0,0,0.08);
    }

    :host([data-theme="light"]) .score-module {
      box-shadow:
        inset 0 2px 8px rgba(0,0,0,0.1),
        0 1px 0 rgba(255,255,255,0.5);
    }

    :host([data-theme="light"]) .btn-primary {
      background: linear-gradient(180deg, var(--accent-amber) 0%, var(--accent-amber-dim) 100%);
      color: #fff;
    }

    :host([data-theme="light"]) .info-tooltip {
      background: #fff;
      border-color: var(--border-panel);
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    }

    :host([data-theme="light"]) .info-tooltip::after {
      border-top-color: #fff;
    }

    :host([data-theme="light"]) .meter-marker,
    :host([data-theme="light"]) .mini-meter-marker {
      background: #1a1a1a;
      box-shadow:
        0 0 0 1px rgba(255,255,255,0.5),
        0 0 6px rgba(0,0,0,0.5),
        0 0 10px rgba(0,0,0,0.3);
    }

    :host([data-theme="light"]) .spectrogram-time-scale {
      color: rgba(0, 0, 0, 0.7);
      background: linear-gradient(transparent, rgba(255,255,255,0.7));
    }

    :host([data-theme="light"]) .platform-card::before {
      opacity: 0.25;
    }

    :host([data-theme="light"]) .metric-module.primary {
      background: var(--bg-inset);
      border-color: var(--border-panel);
    }

    :host([data-theme="light"]) .metric-module {
      background: var(--bg-inset);
    }

    /* Fix Safari white border */
    :host::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--bg-deep);
      z-index: -1;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    .container {
      max-width: 960px;
      margin: 0 auto;
      padding: 16px;
      padding-bottom: max(16px, env(safe-area-inset-bottom));
    }

    /* === HEADER MODULE === */
    .header-module {
      background: var(--bg-panel);
      border: 1px solid var(--border-panel);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 16px;
      position: relative;

      /* Hardware panel inset effect */
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.03),
        0 2px 8px rgba(0,0,0,0.4);
    }

    .brand-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 4px;
    }

    .logo-icon {
      flex-shrink: 0;
      filter: drop-shadow(0 0 4px rgba(232, 151, 60, 0.3));
    }

    .logo {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--accent-amber);
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin: 0;
    }

    .version-badge {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.6rem;
      color: var(--text-dim);
      background: var(--bg-inset);
      padding: 2px 6px;
      border-radius: 3px;
      letter-spacing: 0.02em;
    }

    .tagline {
      font-size: 0.75rem;
      color: var(--text-dim);
      margin-bottom: 16px;
      letter-spacing: 0.01em;
    }

    .status-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
    }

    .status-led {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--text-dim);
      transition: all 0.3s ease;
    }

    .status-led.ready {
      background: var(--led-green);
      box-shadow: 0 0 8px var(--led-green-glow);
    }

    .status-led.busy {
      background: var(--led-amber);
      box-shadow: 0 0 8px var(--led-amber-glow);
      animation: pulse-led 1s ease-in-out infinite;
    }

    .status-led.error {
      background: var(--led-red);
      box-shadow: 0 0 8px var(--led-red-glow);
    }

    @keyframes pulse-led {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .status-text {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.7rem;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    /* === BUTTONS === */
    .btn-row {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }

    .btn {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-weight: 600;
      font-size: 0.8rem;
      padding: 12px 20px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
      text-transform: uppercase;
      letter-spacing: 0.03em;

      /* Touch-friendly minimum size */
      min-height: 44px;
      min-width: 44px;
    }

    .btn-primary {
      background: linear-gradient(180deg, var(--accent-amber) 0%, var(--accent-amber-dim) 100%);
      color: #000;
      box-shadow:
        0 1px 0 rgba(255,255,255,0.2) inset,
        0 2px 4px rgba(0,0,0,0.3);
    }

    .btn-primary:hover:not(:disabled) {
      filter: brightness(1.1);
      transform: translateY(-1px);
    }

    .btn-primary:active:not(:disabled) {
      transform: translateY(0);
      filter: brightness(0.95);
    }

    .btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      transform: none !important;
    }

    .btn-secondary {
      background: var(--bg-inset);
      color: var(--text-secondary);
      border: 1px solid var(--border-subtle);
    }

    .btn-secondary:hover:not(:disabled) {
      background: var(--bg-module);
      color: var(--text-primary);
      border-color: var(--border-panel);
    }

    /* === DROP ZONE === */
    .drop-zone {
      border: 2px dashed var(--border-panel);
      border-radius: 8px;
      padding: 32px 20px;
      text-align: center;
      transition: all 0.2s ease;
      background: var(--bg-inset);
    }

    .drop-zone:hover,
    .drop-zone.dragover {
      border-color: var(--accent-amber);
      background: rgba(232, 151, 60, 0.05);
    }

    .drop-icon {
      font-size: 2rem;
      margin-bottom: 8px;
      opacity: 0.4;
    }

    .drop-text {
      color: var(--text-dim);
      font-size: 0.85rem;
    }

    .drop-hint {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.65rem;
      color: var(--text-dim);
      margin-top: 8px;
      opacity: 0.6;
    }

    /* === PROGRESS DISPLAY === */
    .progress-display {
      padding: 24px;
      text-align: center;
    }

    .progress-ring {
      width: 48px;
      height: 48px;
      margin: 0 auto 16px;
      position: relative;
    }

    .progress-ring::before {
      content: '';
      position: absolute;
      inset: 0;
      border: 3px solid var(--bg-inset);
      border-radius: 50%;
    }

    .progress-ring::after {
      content: '';
      position: absolute;
      inset: 0;
      border: 3px solid transparent;
      border-top-color: var(--accent-amber);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .progress-count {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.9rem;
      color: var(--accent-amber);
      font-weight: 500;
    }

    .progress-filename {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.7rem;
      color: var(--text-dim);
      margin-top: 8px;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .progress-stage {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.6rem;
      color: var(--text-secondary);
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .progress-bars {
      margin-top: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .progress-bar-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .progress-bar-label {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.6rem;
      color: var(--text-dim);
      width: 50px;
      text-align: right;
      text-transform: uppercase;
    }

    .progress-bar-track {
      flex: 1;
      height: 6px;
      background: var(--bg-deep);
      border-radius: 3px;
      overflow: hidden;
    }

    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--accent-amber-dim), var(--accent-amber));
      border-radius: 3px;
      transition: width 0.2s ease;
    }

    .progress-bar-pct {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.6rem;
      color: var(--text-secondary);
      width: 35px;
    }

    /* === ALERTS === */
    .alert {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 4px;
      margin-top: 6px;
      font-size: 0.7rem;
    }

    .alert:first-child {
      margin-top: 0;
    }

    .alert-danger {
      background: rgba(248, 113, 113, 0.1);
      border: 1px solid rgba(248, 113, 113, 0.3);
      color: var(--led-red);
    }

    .alert-warning {
      background: rgba(251, 191, 36, 0.1);
      border: 1px solid rgba(251, 191, 36, 0.3);
      color: var(--led-amber);
    }

    /* === PANEL / CARD === */
    .panel {
      background: var(--bg-panel);
      border: 1px solid var(--border-panel);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.02),
        0 2px 8px rgba(0,0,0,0.3);
    }

    .panel-title {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.65rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-dim);
      margin: 0 0 14px 0;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border-subtle);
    }

    /* === SCORE DISPLAY === */
    .summary-row {
      display: flex;
      gap: 20px;
      align-items: center;
      flex-wrap: wrap;
    }

    .score-module {
      width: 80px;
      height: 80px;
      background: var(--bg-inset);
      border: 2px solid var(--border-panel);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      position: relative;
      flex-shrink: 0;
      --score-glow: transparent;
      filter: drop-shadow(0 0 12px var(--score-glow));
      transition: filter 0.3s ease;
      /* Inset hardware look */
      box-shadow:
        inset 0 2px 8px rgba(0,0,0,0.5),
        0 1px 0 rgba(255,255,255,0.05);
    }

    .score-module.excellent {
      --score-glow: rgba(74, 222, 128, 0.3);
    }

    .score-module.good {
      --score-glow: rgba(251, 191, 36, 0.25);
    }

    .score-module.poor {
      --score-glow: rgba(248, 113, 113, 0.25);
    }

    .score-module::before {
      content: '';
      position: absolute;
      inset: 4px;
      border-radius: 50%;
      background: conic-gradient(
        from 135deg,
        var(--zone-optimal) 0deg,
        var(--zone-optimal) calc(var(--score, 0) * 36deg),
        transparent calc(var(--score, 0) * 36deg)
      );
      opacity: 0.8;
    }

    .score-inner {
      position: relative;
      z-index: 1;
      text-align: center;
      background: var(--bg-inset);
      width: 56px;
      height: 56px;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1px;
    }

    .score-number {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.95rem;
      font-weight: 500;
      color: var(--text-primary);
      line-height: 1;
      letter-spacing: -0.02em;
      margin-top: 2px;
    }

    .score-label {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.45rem;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .summary-info {
      flex: 1;
      min-width: 0;
    }

    .album-title {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 6px 0;
      word-break: break-word;
    }

    .album-meta {
      display: flex;
      gap: 16px;
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.7rem;
      color: var(--text-dim);
      margin-bottom: 10px;
      flex-wrap: wrap;
    }

    /* === BADGES / STATUS LEDS === */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 4px;
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.65rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .badge::before {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .badge-ok {
      background: rgba(74, 222, 128, 0.1);
      color: var(--led-green);
      border: 1px solid rgba(74, 222, 128, 0.3);
    }

    .badge-ok::before {
      background: var(--led-green);
      box-shadow: 0 0 6px var(--led-green-glow);
    }

    .badge-warn {
      background: rgba(251, 191, 36, 0.1);
      color: var(--led-amber);
      border: 1px solid rgba(251, 191, 36, 0.3);
    }

    .badge-warn::before {
      background: var(--led-amber);
      box-shadow: 0 0 6px var(--led-amber-glow);
    }

    .badge-bad {
      background: rgba(248, 113, 113, 0.1);
      color: var(--led-red);
      border: 1px solid rgba(248, 113, 113, 0.3);
    }

    .badge-bad::before {
      background: var(--led-red);
      box-shadow: 0 0 6px var(--led-red-glow);
    }

    .badge-neutral {
      background: var(--bg-inset);
      color: var(--text-secondary);
      border: 1px solid var(--border-subtle);
    }

    .badge-neutral::before {
      display: none;
    }

    /* === SUMMARY METERS === */
    .summary-meters {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 12px;
      margin-top: 16px;
    }

    /* === SUMMARY STATS GRID === */
    .summary-stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px solid var(--border-subtle);
    }

    @media (max-width: 800px) {
      .summary-stats {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 500px) {
      .summary-stats {
        grid-template-columns: 1fr;
      }
    }

    .stat-group {
      background: var(--bg-inset);
      border: 1px solid var(--border-subtle);
      border-radius: 5px;
      padding: 8px 10px;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    .stat-group:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }

    .stat-group-title {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.52rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-dim);
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .stat-group-title span:first-child {
      font-size: 0.7rem;
      opacity: 0.8;
    }

    .stat-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 2px 0;
      font-size: 0.65rem;
    }

    .stat-label {
      color: var(--text-secondary);
    }

    .stat-value {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-weight: 600;
      color: var(--text-primary);
      font-size: 0.65rem;
      font-variant-numeric: tabular-nums;
    }

    .stat-value.good { color: var(--led-green); }
    .stat-value.warning { color: var(--led-amber); }
    .stat-value.danger { color: var(--led-red); }
    .stat-value.empty { color: var(--text-dim); font-style: italic; }

    .stat-inline {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .stat-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      background: var(--bg-deep);
      border: 1px solid var(--border-subtle);
      border-radius: 4px;
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.6rem;
    }

    .stat-chip-label {
      color: var(--text-dim);
    }

    .stat-chip-value {
      color: var(--text-primary);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    /* === TRACK LIST === */
    .track-item {
      background: var(--bg-module);
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      margin-bottom: 8px;
      overflow: hidden;
      transition: border-color 0.15s;
    }

    .track-item:hover {
      border-color: var(--border-panel);
    }

    .track-item.expanded {
      border-color: var(--accent-amber-dim);
      overflow: visible;
    }

    .track-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      cursor: pointer;
      transition: background 0.1s;
      min-height: 52px; /* Touch friendly */
    }

    .track-header:hover {
      background: var(--bg-module);
    }

    .track-header:focus-visible {
      outline: 2px solid var(--accent-amber);
      outline-offset: -2px;
    }

    .track-num {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.65rem;
      color: var(--text-dim);
      width: 22px;
      flex-shrink: 0;
    }

    .track-info {
      flex: 0 0 auto;
      max-width: 45%;
    }

    .track-name {
      font-weight: 500;
      color: var(--text-primary);
      font-size: 0.8rem;
      word-break: break-word;
    }

    .track-meta {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.6rem;
      color: var(--text-dim);
      margin-top: 1px;
    }

    .track-badges {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-shrink: 0;
    }

    /* Hide secondary badge on very small screens */
    @media (max-width: 400px) {
      .track-badges .badge-neutral {
        display: none;
      }
    }

    .expand-icon {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-secondary);
      font-size: 0.8rem;
      transition: transform 0.25s ease, color 0.15s;
      border-radius: 4px;
      background: var(--bg-inset);
      margin-left: auto;
      flex-shrink: 0;
    }

    .track-item.expanded .expand-icon {
      transform: rotate(180deg);
      color: var(--accent-amber);
    }

    /* Mobile track header optimizations */
    @media (max-width: 600px) {
      .track-header {
        gap: 6px;
        padding: 8px 10px;
        overflow: hidden;
      }

      .track-info {
        flex: 1 1 auto;
        min-width: 0;
        max-width: none;
      }

      .track-name {
        font-size: 0.75rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .track-meta {
        font-size: 0.55rem;
      }

      .track-badges {
        gap: 4px;
      }

      .track-badges .badge {
        padding: 2px 5px;
        font-size: 0.5rem;
      }

      .expand-icon {
        width: 24px;
        height: 24px;
        font-size: 0.7rem;
      }
    }

    .track-content {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.35s ease;
    }

    .track-item.expanded .track-content {
      max-height: 5000px;
      overflow: visible; /* Allow tooltips to overflow */
    }

    .track-content-inner {
      padding: 6px 10px 12px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 8px;
      overflow: visible;
    }

    @media (min-width: 900px) {
      .track-content-inner {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    @media (max-width: 600px) {
      .track-content-inner {
        grid-template-columns: 1fr;
        padding: 4px 6px 8px;
      }
    }

    /* === METRIC MODULES === */
    .metric-module {
      background: var(--bg-inset);
      border: 1px solid var(--border-subtle);
      border-radius: 5px;
      padding: 10px;
      overflow: visible; /* Allow tooltips to overflow */
    }

    /* Visual hierarchy: Primary modules are more prominent */
    .metric-module.primary {
      border-color: var(--border-panel);
      background: linear-gradient(180deg, var(--bg-inset) 0%, rgba(20,20,20,0.8) 100%);
    }

    /* Tertiary modules are slightly subdued */
    .metric-module.tertiary {
      opacity: 0.9;
      padding: 6px 8px;
    }

    .metric-module.tertiary .module-title {
      font-size: 0.46rem;
      margin-bottom: 4px;
    }

    .module-title {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.48rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-dim);
      margin: 0 0 5px 0;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .module-icon {
      font-size: 0.55rem;
      opacity: 0.7;
    }

    .module-rating {
      margin-left: auto;
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.5rem;
      font-weight: 500;
      padding: 1px 4px;
      border-radius: 3px;
      background: var(--bg-deep);
    }

    .module-rating.excellent {
      color: var(--led-green);
      border: 1px solid rgba(74, 222, 128, 0.3);
    }

    .module-rating.good {
      color: #22d3ee;
      border: 1px solid rgba(34, 211, 238, 0.3);
    }

    .module-rating.fair {
      color: var(--led-amber);
      border: 1px solid rgba(251, 191, 36, 0.3);
    }

    .module-rating.poor {
      color: var(--led-red);
      border: 1px solid rgba(248, 113, 113, 0.3);
    }

    /* === METERS === */
    .meter-wrap {
      margin-bottom: 5px;
    }

    .meter-wrap:last-child {
      margin-bottom: 0;
    }

    .meter-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 3px;
    }

    .meter-label-wrap {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .meter-label {
      font-size: 0.65rem;
      color: var(--text-secondary);
    }

    /* === INFO TOOLTIP === */
    .info-wrap {
      position: relative;
      display: inline-flex;
      z-index: 1;
    }

    .info-btn {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--border-subtle);
      border: none;
      color: var(--text-dim);
      font-size: 0.55rem;
      font-weight: 700;
      cursor: help;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
    }

    .info-btn:hover {
      background: var(--accent-amber-dim);
      color: var(--bg-deep);
    }

    .info-tooltip {
      position: absolute;
      bottom: calc(100% + 6px);
      left: 50%;
      transform: translateX(-50%);
      width: 200px;
      max-width: calc(100vw - 32px);
      padding: 8px 10px;
      background: var(--bg-panel);
      border: 1px solid var(--border-panel);
      border-radius: 6px;
      font-size: 0.65rem;
      color: var(--text-secondary);
      line-height: 1.4;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition: opacity 0.15s, visibility 0.15s;
      z-index: 10000;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
      white-space: normal;
      word-wrap: break-word;
    }

    /* Arrow pointing down */
    .info-tooltip::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 5px solid transparent;
      border-top-color: var(--bg-panel);
    }

    .info-wrap:hover .info-tooltip,
    .info-wrap:focus-within .info-tooltip {
      opacity: 1;
      visibility: visible;
    }

    /* Mobile: tap to show tooltip */
    @media (hover: none) {
      .info-btn:focus + .info-tooltip {
        opacity: 1;
        visibility: visible;
      }
    }

    .meter-value {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.65rem;
      font-weight: 500;
      color: var(--text-primary);
    }

    /* === METER BAR (VU Style) === */
    .meter-bar {
      height: 7px;
      background: var(--bg-deep);
      border-radius: 2px;
      position: relative;
      overflow: hidden;
      border: 1px solid var(--border-subtle);
    }

    .meter-gradient {
      position: absolute;
      inset: 0;
      /* Smooth gradient: blue -> green -> yellow -> orange -> red */
      background: linear-gradient(90deg,
        #1e40af 0%,
        #3b82f6 15%,
        #22c55e 35%,
        #22c55e 50%,
        #eab308 65%,
        #f97316 80%,
        #dc2626 100%
      );
      opacity: 0.85;
    }

    /* Loudness meter: reversed (red on left for too quiet, green in middle, red on right for too loud) */
    .meter-bar.loudness .meter-gradient {
      background: linear-gradient(90deg,
        #dc2626 0%,
        #f97316 10%,
        #eab308 20%,
        #22c55e 35%,
        #22c55e 55%,
        #eab308 70%,
        #f97316 85%,
        #dc2626 100%
      );
    }

    /* True peak meter: green on left (good headroom), yellow, red on right (clipping) */
    .meter-bar.peak .meter-gradient {
      background: linear-gradient(90deg,
        #22c55e 0%,
        #22c55e 60%,
        #eab308 75%,
        #f97316 88%,
        #dc2626 100%
      );
    }

    /* Dynamic range: red (crushed) -> yellow -> green (dynamic) -> yellow (too sparse) */
    .meter-bar.dynamics .meter-gradient {
      background: linear-gradient(90deg,
        #dc2626 0%,
        #f97316 15%,
        #eab308 30%,
        #22c55e 50%,
        #22c55e 70%,
        #eab308 85%,
        #f97316 100%
      );
    }

    /* Width: mono warning -> optimal -> too wide warning */
    .meter-bar.width .meter-gradient {
      background: linear-gradient(90deg,
        #f97316 0%,
        #eab308 20%,
        #22c55e 35%,
        #22c55e 65%,
        #eab308 80%,
        #f97316 100%
      );
    }

    /* Artifact: green (clean) -> yellow -> red (artifacts) */
    .meter-bar.artifact .meter-gradient {
      background: linear-gradient(90deg,
        #22c55e 0%,
        #22c55e 30%,
        #eab308 50%,
        #f97316 70%,
        #dc2626 100%
      );
    }

    .meter-marker {
      position: absolute;
      top: -2px;
      width: 3px;
      height: 11px;
      background: #fff;
      border-radius: 2px;
      transform: translateX(-50%);
      box-shadow:
        0 0 0 1px rgba(0,0,0,0.5),
        0 0 6px rgba(255,255,255,1),
        0 0 10px rgba(255,255,255,0.5);
      z-index: 2;
    }

    .meter-ticks {
      display: flex;
      justify-content: space-between;
      margin-top: 3px;
    }

    .meter-tick {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.5rem;
      color: var(--text-dim);
    }

    /* === METRIC ROWS === */
    .metric-row {
      display: flex;
      flex-direction: column;
      gap: 1px;
      padding: 3px 0;
      border-bottom: 1px solid var(--border-subtle);
      font-size: 0.65rem;
    }

    .metric-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .metric-row-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .metric-label-row {
      display: flex;
      align-items: center;
      gap: 4px;
      color: var(--text-secondary);
    }

    .metric-val {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-weight: 600;
      font-size: 0.65rem;
      color: var(--text-primary);
      font-variant-numeric: tabular-nums;
    }

    .metric-val.good { color: var(--led-green); }
    .metric-val.warning { color: var(--led-amber); }
    .metric-val.danger { color: var(--led-red); }
    .metric-val.empty { color: var(--text-dim); font-style: italic; }

    /* Mini meter bar for metric rows */
    .mini-meter {
      height: 5px;
      background: var(--bg-deep);
      border-radius: 2px;
      position: relative;
      overflow: hidden;
    }

    .mini-meter-gradient {
      position: absolute;
      inset: 0;
      opacity: 0.7;
    }

    /* Different gradient types for mini meters */
    .mini-meter.type-level .mini-meter-gradient {
      background: linear-gradient(90deg, #22c55e 0%, #22c55e 70%, #eab308 85%, #dc2626 100%);
    }

    .mini-meter.type-center .mini-meter-gradient {
      background: linear-gradient(90deg, #f97316 0%, #eab308 25%, #22c55e 45%, #22c55e 55%, #eab308 75%, #f97316 100%);
    }

    .mini-meter.type-low-good .mini-meter-gradient {
      background: linear-gradient(90deg, #22c55e 0%, #22c55e 40%, #eab308 60%, #f97316 80%, #dc2626 100%);
    }

    .mini-meter.type-high-good .mini-meter-gradient {
      background: linear-gradient(90deg, #dc2626 0%, #f97316 20%, #eab308 40%, #22c55e 60%, #22c55e 100%);
    }

    .mini-meter.type-bool-good .mini-meter-gradient {
      background: linear-gradient(90deg, #22c55e 0%, #22c55e 100%);
    }

    .mini-meter.type-bool-bad .mini-meter-gradient {
      background: linear-gradient(90deg, #dc2626 0%, #dc2626 100%);
    }

    .mini-meter-marker {
      position: absolute;
      top: -2px;
      width: 3px;
      height: 9px;
      background: #fff;
      border-radius: 1px;
      transform: translateX(-50%);
      box-shadow:
        0 0 0 1px rgba(0,0,0,0.5),
        0 0 6px rgba(255,255,255,1),
        0 0 10px rgba(255,255,255,0.5);
      z-index: 2;
    }

    /* === STREAMING PLATFORM CARDS === */
    .platform-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6px;
    }

    .platform-card {
      background: var(--bg-deep);
      border: 1px solid var(--border-subtle);
      border-radius: 4px;
      padding: 6px 8px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }

    .platform-card::before {
      content: '';
      position: absolute;
      left: -12px;
      top: -4px;
      bottom: -4px;
      width: 44px;
      opacity: 0.18;
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
    }

    /* Spotify - green circle with waves */
    .platform-card[data-platform="spotify"]::before {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%231DB954'%3E%3Ccircle cx='12' cy='12' r='12'/%3E%3Cpath fill='%23000' d='M17.9 10.9C14.7 9 9.35 8.8 6.3 9.75c-.5.15-1-.15-1.15-.6-.15-.5.15-1 .6-1.15 3.55-1.05 9.4-.85 13.1 1.35.45.25.6.85.35 1.3-.25.35-.85.5-1.3.25zm-.1 2.8c-.25.35-.7.5-1.05.25-2.7-1.65-6.8-2.15-9.95-1.15-.4.1-.85-.1-.95-.5-.1-.4.1-.85.5-.95 3.65-1.1 8.15-.55 11.25 1.35.3.15.45.65.2 1zm-1.2 2.75c-.2.3-.55.4-.85.2-2.35-1.45-5.3-1.75-8.8-.95-.35.1-.65-.15-.75-.45-.1-.35.15-.65.45-.75 3.8-.85 7.1-.5 9.7 1.1.35.15.4.55.25.85z'/%3E%3C/svg%3E");
    }

    /* Apple Music - apple shape */
    .platform-card[data-platform="apple"]::before,
    .platform-card[data-platform="applemusic"]::before {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23FA57C1'%3E%3Cpath d='M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z'/%3E%3C/svg%3E");
    }

    /* YouTube Music - play button */
    .platform-card[data-platform="youtube"]::before,
    .platform-card[data-platform="youtubemusic"]::before {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23FF0000'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z'/%3E%3C/svg%3E");
    }

    /* Tidal - wave pattern */
    .platform-card[data-platform="tidal"]::before {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2300FFFF'%3E%3Cpath d='M12.012 3.992L8.008 7.996 4.004 3.992 0 7.996l4.004 4.004L0 16.004l4.004 4.004 4.004-4.004 4.004 4.004 4.004-4.004-4.004-4.004 4.004-4.004-4.004-4.004zm7.992 0l-4.004 4.004 4.004 4.004-4.004 4.004 4.004 4.004L24 16.004l-4.004-4.004L24 7.996l-3.996-4.004z'/%3E%3C/svg%3E");
    }

    .platform-name {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.55rem;
      font-weight: 600;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 3px;
    }

    .platform-gain {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.75rem;
      font-weight: 500;
      margin-bottom: 2px;
    }

    .platform-gain.positive { color: var(--led-green); }
    .platform-gain.negative { color: var(--led-amber); }
    .platform-gain.severe { color: var(--led-red); }

    .platform-tp {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.55rem;
      color: var(--text-dim);
    }

    .platform-risk {
      font-size: 0.55rem;
      color: var(--led-red);
      margin-top: 2px;
    }

    /* === MUSICAL FEATURES === */
    .music-feature-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
      border-bottom: 1px solid var(--border-subtle);
    }

    .music-feature-row:last-child {
      border-bottom: none;
    }

    .music-primary {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--accent-amber);
      min-width: 70px;
    }

    .music-confidence {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.6rem;
      color: var(--text-dim);
    }

    .music-candidates {
      font-size: 0.6rem;
      color: var(--text-dim);
      flex: 1;
    }

    .music-badge {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.5rem;
      background: var(--bg-inset);
      border: 1px solid var(--border-subtle);
      padding: 2px 5px;
      border-radius: 3px;
      color: var(--text-secondary);
    }

    /* === RECOMMENDATION BOX === */
    .recommendation-box {
      background: rgba(232, 151, 60, 0.08);
      border: 1px solid rgba(232, 151, 60, 0.3);
      border-radius: 4px;
      padding: 8px;
      margin-top: 8px;
      font-size: 0.65rem;
      color: var(--accent-amber);
    }

    .recommendation-title {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.55rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
      color: var(--accent-amber-dim);
    }

    /* === STACKED MODULES (for smaller panels) === */
    .stacked-modules {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .stacked-modules .metric-module {
      flex: 1;
    }

    /* === SECTION DIVIDER === */
    .section-divider {
      grid-column: 1 / -1;
      border-top: 1px solid var(--border-subtle);
      margin: 4px 0;
      padding-top: 4px;
    }

    .section-subtitle {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.45rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-dim);
      margin: 4px 0 2px 0;
      padding-top: 3px;
      border-top: 1px dashed var(--border-subtle);
    }

    /* === JSON PREVIEW === */
    .json-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      padding: 4px 0;
      min-height: 44px;
    }

    .json-toggle-icon {
      color: var(--text-dim);
      font-size: 0.7rem;
      transition: transform 0.2s;
    }

    .json-preview.visible + .json-toggle-icon,
    .panel:has(.json-preview.visible) .json-toggle-icon {
      transform: rotate(180deg);
    }

    .json-preview {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.3s ease;
    }

    .json-preview.visible {
      max-height: 500px;
    }

    pre {
      white-space: pre-wrap;
      word-break: break-word;
      background: var(--bg-deep);
      padding: 14px;
      border-radius: 4px;
      border: 1px solid var(--border-subtle);
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.65rem;
      max-height: 400px;
      overflow: auto;
      color: var(--text-dim);
      margin: 12px 0 0 0;
    }

    /* === ISSUES === */
    .issues-wrap {
      margin: 8px 10px 12px;
      padding-top: 8px;
      border-top: 1px solid var(--border-subtle);
    }

    /* === RESPONSIVE === */
    @media (max-width: 600px) {
      .container {
        padding: 12px;
      }

      .header-module,
      .panel {
        padding: 14px;
      }

      .summary-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
      }

      .score-module {
        width: 72px;
        height: 72px;
      }

      .score-inner {
        width: 48px;
        height: 48px;
      }

      .score-number {
        font-size: 0.85rem;
      }

      .summary-meters {
        grid-template-columns: 1fr;
      }

      .album-meta {
        flex-direction: column;
        gap: 4px;
      }

      .btn-row {
        flex-direction: column;
      }

      .btn {
        width: 100%;
        justify-content: center;
      }
    }

    /* Safe area for notched phones */
    @supports (padding: env(safe-area-inset-left)) {
      .container {
        padding-left: max(16px, env(safe-area-inset-left));
        padding-right: max(16px, env(safe-area-inset-right));
      }
    }

    /* === VIEW MODE TOGGLE === */
    .view-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }

    .view-toggle-label {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.6rem;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .view-toggle-btns {
      display: flex;
      background: var(--bg-inset);
      border: 1px solid var(--border-subtle);
      border-radius: 4px;
      overflow: hidden;
    }

    .view-toggle-btn {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.6rem;
      padding: 6px 12px;
      border: none;
      background: transparent;
      color: var(--text-dim);
      cursor: pointer;
      transition: all 0.15s;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .view-toggle-btn:hover:not(.active) {
      background: var(--bg-module);
      color: var(--text-secondary);
    }

    .view-toggle-btn:focus-visible {
      outline: 2px solid var(--accent-amber);
      outline-offset: -2px;
    }

    .view-toggle-btn.active {
      background: var(--accent-amber);
      color: var(--bg-deep);
      font-weight: 600;
    }

    /* === SIMPLE MODE === */
    .simple-metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 6px;
      padding: 6px 8px;
    }

    .simple-metric {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 8px;
      background: var(--bg-inset);
      border-radius: 4px;
      border: 1px solid var(--border-subtle);
      transition: border-color 0.15s ease;
    }

    .simple-metric:hover {
      border-color: var(--border-panel);
    }

    .simple-metric-label {
      font-size: 0.6rem;
      color: var(--text-secondary);
    }

    .simple-metric-value {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.65rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .simple-metric-value.good { color: var(--led-green); }
    .simple-metric-value.warning { color: var(--led-amber); }
    .simple-metric-value.danger { color: var(--led-red); }
    .simple-metric-value.info { color: var(--text-primary); }

    /* Simple mode mobile optimizations */
    @media (max-width: 600px) {
      .simple-metrics {
        grid-template-columns: repeat(2, 1fr);
        gap: 4px;
        padding: 4px 6px;
      }

      .simple-metric {
        padding: 5px 6px;
      }

      .simple-metric-label {
        font-size: 0.55rem;
      }

      .simple-metric-value {
        font-size: 0.6rem;
      }
    }

    /* === INFO BADGE (neutral) === */
    .badge-info {
      background: var(--bg-inset);
      color: var(--text-secondary);
      border: 1px solid var(--border-subtle);
    }

    .badge-info::before {
      background: var(--text-dim);
    }

    /* === PRIMARY CONCERN === */
    .primary-concern {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 0.7rem;
      color: var(--led-amber);
      padding: 8px 12px;
      background: rgba(251, 191, 36, 0.08);
      border-left: 3px solid var(--led-amber);
      border-radius: 0 4px 4px 0;
      margin: 4px 10px 8px;
    }

    .primary-concern::before {
      content: '⚠';
      flex-shrink: 0;
      font-size: 0.8rem;
    }

    .primary-concern.critical {
      color: var(--led-red);
      background: rgba(248, 113, 113, 0.08);
      border-left-color: var(--led-red);
    }

    .primary-concern.critical::before {
      content: '⛔';
    }

    /* === SPECTROGRAM (Inline in header - simple mode) === */
    .spectrogram-inline {
      flex: 1 1 0;
      min-width: 60px;
      height: 28px;
      border-radius: 4px;
      overflow: hidden;
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid var(--border-subtle);
      opacity: 0.85;
      transition: opacity 0.15s ease, border-color 0.15s ease;
      margin: 0 14px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .track-header:hover .spectrogram-inline {
      opacity: 1;
      border-color: var(--border-panel);
    }

    .spectrogram-canvas-inline {
      display: block;
      width: 100%;
      height: 100%;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      border-radius: 3px;
    }

    .spectrogram-placeholder {
      flex: 1 1 0;
      min-width: 60px;
      height: 28px;
      margin: 0 14px;
    }

    /* Hide spectrogram on mobile screens */
    @media (max-width: 600px) {
      .spectrogram-inline,
      .spectrogram-placeholder {
        display: none;
      }
    }

    /* Legacy container style (if needed) */
    .spectrogram-container {
      margin: 8px 10px;
      border-radius: 4px;
      overflow: hidden;
      border: 1px solid var(--border-subtle);
      background: var(--bg-deep);
      position: relative;
    }

    .spectrogram-time-scale {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 14px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding: 0 6px 2px;
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.5rem;
      color: rgba(255, 255, 255, 0.6);
      background: linear-gradient(transparent, rgba(0,0,0,0.6));
      pointer-events: none;
    }

    .spectrogram-canvas {
      display: block;
      width: 100%;
      height: 80px;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    }

    /* === HEADER CONTROLS (Theme & Help) === */
    .header-controls {
      position: absolute;
      top: 16px;
      right: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .header-icon-btn {
      width: 32px;
      height: 32px;
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      background: var(--bg-inset);
      color: var(--text-secondary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
      transition: all 0.15s ease;
    }

    .header-icon-btn:focus-visible {
      outline: 2px solid var(--accent-amber);
      outline-offset: 2px;
    }

    /* === HELP MODAL === */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
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

    :host([data-theme="light"]) .modal-backdrop {
      background: rgba(0, 0, 0, 0.4);
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

    :host([data-theme="light"]) .modal-card {
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.2);
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

    /* Category sections */
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

    /* Geek mode details */
    .metric-geek-details {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px dashed var(--border-subtle);
      display: none;
    }

    .geek-mode-active .metric-geek-details {
      display: block;
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

    /* No results */
    .no-results {
      text-align: center;
      padding: 40px 20px;
      color: var(--text-dim);
      font-size: 0.85rem;
    }

    @media (max-width: 600px) {
      .modal-card {
        max-height: 90vh;
      }

      .modal-header {
        flex-wrap: wrap;
        gap: 12px;
      }

      .geek-toggle {
        order: 3;
        width: 100%;
        justify-content: center;
      }

      .header-controls {
        position: static;
        margin-top: 12px;
        justify-content: flex-end;
      }
    }

    /* === FOOTER === */
    .app-footer {
      margin-top: 24px;
      padding: 16px 0;
      border-top: 1px solid var(--border-subtle);
      text-align: center;
    }

    .footer-content {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      flex-wrap: wrap;
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.65rem;
      color: var(--text-dim);
    }

    .footer-content a {
      color: var(--text-secondary);
      text-decoration: none;
      transition: color 0.15s ease;
    }

    .footer-content a:hover {
      color: var(--accent-amber);
    }

    .footer-sep {
      color: var(--text-dim);
      opacity: 0.5;
    }

    /* === TOAST NOTIFICATIONS === */
    .toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--bg-module);
      color: var(--text-primary);
      padding: 10px 20px;
      border-radius: 6px;
      border: 1px solid var(--border-panel);
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.75rem;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      animation: toast-in 0.2s ease-out;
    }

    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }

    /* === BRAND LINK (Logo + Title clickable) === */
    .brand-link {
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      cursor: pointer;
      transition: opacity 0.15s ease;
      border-radius: 6px;
      padding: 4px 8px;
      margin: -4px -8px;
    }

    .brand-link:hover {
      opacity: 0.8;
    }

    .brand-link:hover .logo-icon {
      filter: drop-shadow(0 0 8px rgba(232, 151, 60, 0.5));
    }

    .brand-link:focus-visible {
      outline: 2px solid var(--accent-amber);
      outline-offset: 2px;
    }

    .brand-link:active {
      opacity: 0.7;
    }

    /* === BUTTON MICRO-INTERACTIONS === */
    .btn:active:not(:disabled) {
      transform: scale(0.97);
    }

    .header-icon-btn:hover {
      background: var(--bg-module);
      border-color: var(--accent-amber-dim);
      color: var(--accent-amber);
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(232, 151, 60, 0.15);
    }

    .header-icon-btn:active {
      transform: scale(0.92) translateY(0);
      box-shadow: none;
    }
`;
