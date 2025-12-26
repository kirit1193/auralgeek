/**
 * Album Analyzer App Styles
 * Studio console theme inspired by SSL/Neve mixing consoles, VU meters, and control room aesthetics
 */

import { css } from 'lit';

export const appStyles = css`
    @import url('https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600&family=Manrope:wght@400;500;600;700&display=swap');

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
      font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
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
      font-family: 'Geist Mono', 'SF Mono', 'Monaco', monospace;
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--accent-amber);
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin: 0;
    }

    .version-badge {
      font-family: 'Geist Mono', monospace;
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
      font-family: 'Geist Mono', monospace;
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
      font-family: 'Manrope', sans-serif;
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
      font-family: 'Geist Mono', monospace;
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
      font-family: 'Geist Mono', monospace;
      font-size: 0.9rem;
      color: var(--accent-amber);
      font-weight: 500;
    }

    .progress-filename {
      font-family: 'Geist Mono', monospace;
      font-size: 0.7rem;
      color: var(--text-dim);
      margin-top: 8px;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .progress-stage {
      font-family: 'Geist Mono', monospace;
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
      font-family: 'Geist Mono', monospace;
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
      font-family: 'Geist Mono', monospace;
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
      font-family: 'Geist Mono', monospace;
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

      /* Inset hardware look */
      box-shadow:
        inset 0 2px 8px rgba(0,0,0,0.5),
        0 1px 0 rgba(255,255,255,0.05);
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
      font-family: 'Geist Mono', monospace;
      font-size: 0.95rem;
      font-weight: 500;
      color: var(--text-primary);
      line-height: 1;
      letter-spacing: -0.02em;
      margin-top: 2px;
    }

    .score-label {
      font-family: 'Geist Mono', monospace;
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
      font-family: 'Geist Mono', monospace;
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
      font-family: 'Geist Mono', monospace;
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
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 10px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--border-subtle);
    }

    .stat-group {
      background: var(--bg-inset);
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      padding: 10px 12px;
    }

    .stat-group-title {
      font-family: 'Geist Mono', monospace;
      font-size: 0.5rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-dim);
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .stat-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 3px 0;
      font-size: 0.7rem;
    }

    .stat-label {
      color: var(--text-secondary);
    }

    .stat-value {
      font-family: 'Geist Mono', monospace;
      font-weight: 500;
      color: var(--text-primary);
    }

    .stat-value.good { color: var(--led-green); }
    .stat-value.warning { color: var(--led-amber); }
    .stat-value.danger { color: var(--led-red); }

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
      font-family: 'Geist Mono', monospace;
      font-size: 0.6rem;
    }

    .stat-chip-label {
      color: var(--text-dim);
    }

    .stat-chip-value {
      color: var(--text-primary);
      font-weight: 500;
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
      gap: 12px;
      padding: 12px 14px;
      cursor: pointer;
      transition: background 0.1s;
      min-height: 56px; /* Touch friendly */
    }

    .track-header:hover {
      background: rgba(255,255,255,0.02);
    }

    .track-num {
      font-family: 'Geist Mono', monospace;
      font-size: 0.7rem;
      color: var(--text-dim);
      width: 24px;
      flex-shrink: 0;
    }

    .track-info {
      flex: 1;
      min-width: 0;
    }

    .track-name {
      font-weight: 500;
      color: var(--text-primary);
      font-size: 0.85rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .track-meta {
      font-family: 'Geist Mono', monospace;
      font-size: 0.65rem;
      color: var(--text-dim);
      margin-top: 2px;
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
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-dim);
      font-size: 0.7rem;
      transition: transform 0.25s ease, color 0.15s;
      flex-shrink: 0;
    }

    .track-item.expanded .expand-icon {
      transform: rotate(180deg);
      color: var(--accent-amber);
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
      padding: 4px 10px 12px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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
        padding: 4px 8px 10px;
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
    }

    .metric-module.tertiary .module-title {
      font-size: 0.48rem;
    }

    .module-title {
      font-family: 'Geist Mono', monospace;
      font-size: 0.5rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-dim);
      margin: 0 0 6px 0;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .module-icon {
      font-size: 0.6rem;
      opacity: 0.7;
    }

    .module-rating {
      margin-left: auto;
      font-family: 'Geist Mono', monospace;
      font-size: 0.55rem;
      font-weight: 500;
      padding: 1px 5px;
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
      margin-bottom: 6px;
    }

    .meter-wrap:last-child {
      margin-bottom: 0;
    }

    .meter-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }

    .meter-label-wrap {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .meter-label {
      font-size: 0.7rem;
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
      font-family: 'Geist Mono', monospace;
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
      font-family: 'Geist Mono', monospace;
      font-size: 0.7rem;
      font-weight: 500;
      color: var(--text-primary);
    }

    /* === METER BAR (VU Style) === */
    .meter-bar {
      height: 8px;
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
      top: -3px;
      width: 4px;
      height: 14px;
      background: #fff;
      border-radius: 2px;
      transform: translateX(-50%);
      box-shadow:
        0 0 0 1px rgba(0,0,0,0.5),
        0 0 8px rgba(255,255,255,1),
        0 0 12px rgba(255,255,255,0.6);
      z-index: 2;
    }

    .meter-ticks {
      display: flex;
      justify-content: space-between;
      margin-top: 4px;
    }

    .meter-tick {
      font-family: 'Geist Mono', monospace;
      font-size: 0.55rem;
      color: var(--text-dim);
    }

    /* === METRIC ROWS === */
    .metric-row {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 4px 0;
      border-bottom: 1px solid var(--border-subtle);
      font-size: 0.7rem;
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
      gap: 6px;
      color: var(--text-secondary);
    }

    .metric-val {
      font-family: 'Geist Mono', monospace;
      font-weight: 500;
      color: var(--text-primary);
    }

    .metric-val.good { color: var(--led-green); }
    .metric-val.warning { color: var(--led-amber); }
    .metric-val.danger { color: var(--led-red); }

    /* Mini meter bar for metric rows */
    .mini-meter {
      height: 4px;
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
      height: 8px;
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
    }

    .platform-name {
      font-family: 'Geist Mono', monospace;
      font-size: 0.55rem;
      font-weight: 600;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 3px;
    }

    .platform-gain {
      font-family: 'Geist Mono', monospace;
      font-size: 0.75rem;
      font-weight: 500;
      margin-bottom: 2px;
    }

    .platform-gain.positive { color: var(--led-green); }
    .platform-gain.negative { color: var(--led-amber); }
    .platform-gain.severe { color: var(--led-red); }

    .platform-tp {
      font-family: 'Geist Mono', monospace;
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
      font-family: 'Geist Mono', monospace;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--accent-amber);
      min-width: 70px;
    }

    .music-confidence {
      font-family: 'Geist Mono', monospace;
      font-size: 0.6rem;
      color: var(--text-dim);
    }

    .music-candidates {
      font-size: 0.6rem;
      color: var(--text-dim);
      flex: 1;
    }

    .music-badge {
      font-family: 'Geist Mono', monospace;
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
      font-family: 'Geist Mono', monospace;
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
      gap: 8px;
    }

    .stacked-modules .metric-module {
      flex: 1;
    }

    /* === SECTION DIVIDER === */
    .section-divider {
      grid-column: 1 / -1;
      border-top: 1px solid var(--border-subtle);
      margin: 6px 0;
      padding-top: 6px;
    }

    .section-subtitle {
      font-family: 'Geist Mono', monospace;
      font-size: 0.5rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-dim);
      margin: 6px 0 4px 0;
      padding-top: 4px;
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
      font-family: 'Geist Mono', monospace;
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
      font-family: 'Geist Mono', monospace;
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
      font-family: 'Geist Mono', monospace;
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

    .view-toggle-btn:hover {
      color: var(--text-secondary);
    }

    .view-toggle-btn.active {
      background: var(--accent-amber-dim);
      color: #fff;
    }

    /* === SIMPLE MODE === */
    .simple-metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 8px;
      padding: 8px 10px;
    }

    .simple-metric {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 10px;
      background: var(--bg-inset);
      border-radius: 4px;
      border: 1px solid var(--border-subtle);
    }

    .simple-metric-label {
      font-size: 0.65rem;
      color: var(--text-secondary);
    }

    .simple-metric-value {
      font-family: 'Geist Mono', monospace;
      font-size: 0.7rem;
      font-weight: 500;
    }

    .simple-metric-value.good { color: var(--led-green); }
    .simple-metric-value.warning { color: var(--led-amber); }
    .simple-metric-value.danger { color: var(--led-red); }
    .simple-metric-value.info { color: var(--text-primary); }

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
      font-size: 0.7rem;
      color: var(--led-amber);
      padding: 6px 10px;
      background: rgba(251, 191, 36, 0.08);
      border-left: 2px solid var(--led-amber);
      margin: 0 10px 8px;
    }

    /* === SPECTROGRAM === */
    .spectrogram-container {
      margin: 8px 10px;
      border-radius: 4px;
      overflow: hidden;
      border: 1px solid var(--border-subtle);
      background: var(--bg-deep);
    }

    .spectrogram-canvas {
      display: block;
      width: 100%;
      height: 80px;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    }
`;
