import { LitElement, css, html, TemplateResult } from "lit";
import type { AlbumAnalysis, TrackAnalysis } from "../core/types";
import { decodeToPCM } from "../analysis/decode";

type WorkerMsg =
  | { type: "progress"; current: number; total: number; filename: string; stage?: string; stageProgress?: number }
  | { type: "result"; album: AlbumAnalysis }
  | { type: "error"; message: string };

export class AlbumAnalyzerApp extends LitElement {
  static styles = css`
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
  `;

  static properties = {
    busy: { state: true },
    status: { state: true },
    progress: { state: true },
    album: { state: true },
    error: { state: true },
    expandedTracks: { state: true },
    jsonVisible: { state: true },
    viewMode: { state: true },
  };

  private busy = false;
  private status = "Ready";
  private progress: { current: number; total: number; filename: string; stage?: string; stageProgress?: number } | null = null;
  private album: AlbumAnalysis | null = null;
  private error: string | null = null;
  private expandedTracks: Set<number> = new Set();
  private jsonVisible = false;
  private viewMode: 'simple' | 'advanced' = 'simple';
  private worker: Worker | null = null;
  private lightDomInput: HTMLInputElement | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.worker) return;

    if (!document.getElementById('auralgeek-file-input')) {
      const input = document.createElement('input');
      input.id = 'auralgeek-file-input';
      input.type = 'file';
      input.multiple = true;
      input.accept = 'audio/*,.wav,.wave,.flac,.mp3,.m4a,.aac,.ogg,.aiff,.aif';
      input.style.display = 'none';
      document.body.appendChild(input);
      this.lightDomInput = input;

      input.addEventListener('change', async (e) => {
        const target = e.target as HTMLInputElement;
        const files = target.files ? Array.from(target.files) : [];
        if (files.length > 0) {
          target.value = '';
          await this.runAnalysis(files);
        }
      });
    } else {
      this.lightDomInput = document.getElementById('auralgeek-file-input') as HTMLInputElement;
    }

    try {
      this.worker = new Worker(
        new URL("../workers/analyzer.worker.ts", import.meta.url),
        { type: "module" }
      );

      this.worker.onerror = (e) => {
        console.error("Worker Load Error:", e);
        this.error = `Worker failed to load.`;
        this.busy = false;
        this.status = "Error";
        this.requestUpdate();
      };

      this.worker.onmessage = (ev: MessageEvent<WorkerMsg>) => {
        const msg = ev.data;
        if (msg.type === "progress") {
          this.progress = {
            current: msg.current,
            total: msg.total,
            filename: msg.filename,
            stage: msg.stage,
            stageProgress: msg.stageProgress
          };
          this.status = msg.stage ? `${msg.stage} ${msg.current}/${msg.total}` : `Analyzing ${msg.current}/${msg.total}`;
          this.requestUpdate();
        } else if (msg.type === "result") {
          this.album = msg.album;
          this.busy = false;
          this.progress = null;
          this.status = "Complete";
          this.expandedTracks = msg.album.tracks.length > 0 ? new Set([1]) : new Set();
          this.requestUpdate();
        } else if (msg.type === "error") {
          this.error = msg.message;
          this.busy = false;
          this.progress = null;
          this.status = "Error";
          this.requestUpdate();
        }
      };
    } catch (e) {
      this.error = `Failed to initialize: ${e}`;
      this.status = "Error";
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    if (this.lightDomInput && this.lightDomInput.parentNode) {
      this.lightDomInput.parentNode.removeChild(this.lightDomInput);
      this.lightDomInput = null;
    }
  }

  private onPickFiles() {
    if (this.busy) return;
    this.lightDomInput?.click();
  }

  private async onDrop(ev: DragEvent) {
    ev.preventDefault();
    if (this.busy) return;
    const dt = ev.dataTransfer;
    if (!dt) return;
    await this.runAnalysis(Array.from(dt.files));
  }

  private async runAnalysis(files: File[]) {
    this.error = null;
    this.album = null;
    this.expandedTracks = new Set();
    this.jsonVisible = false;

    const audio = files.filter((f) => {
      const extMatch = /\.(wav|flac|aiff|aif|mp3|m4a|aac|ogg)$/i.test(f.name);
      const mimeMatch = f.type.startsWith("audio/");
      return extMatch || mimeMatch;
    }).sort((a, b) => a.name.localeCompare(b.name));

    if (!audio.length) {
      this.status = "No audio files";
      this.requestUpdate();
      return;
    }

    if (!this.worker) {
      this.status = "Worker error";
      this.error = "Analysis worker not available.";
      return;
    }

    this.busy = true;
    this.requestUpdate();

    try {
      const decodedTracks: Array<{
        filename: string;
        filesize: number;
        sampleRate: number;
        channels: number;
        channelData: Float32Array[];
      }> = [];

      for (let i = 0; i < audio.length; i++) {
        const file = audio[i];
        this.status = `Decoding ${i + 1}/${audio.length}`;
        this.progress = { current: i + 1, total: audio.length, filename: file.name };
        this.requestUpdate();

        const decoded = await decodeToPCM(file);
        decodedTracks.push({
          filename: file.name,
          filesize: file.size,
          sampleRate: decoded.sampleRate,
          channels: decoded.channels,
          channelData: decoded.channelData
        });
      }

      this.status = `Analyzing...`;
      this.requestUpdate();

      const transferables: Transferable[] = [];
      for (const track of decodedTracks) {
        for (const ch of track.channelData) {
          transferables.push(ch.buffer);
        }
      }

      this.worker.postMessage(
        { type: "analyze", albumName: "Album", tracks: decodedTracks },
        transferables
      );
    } catch (e) {
      this.error = `Analysis failed: ${e}`;
      this.busy = false;
      this.progress = null;
      this.status = "Error";
      this.requestUpdate();
    }
  }

  private exportJSON() {
    if (!this.album) return;
    const blob = new Blob([JSON.stringify(this.album, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "auralgeek-analysis.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  private toggleTrack(trackNumber: number) {
    const newSet = new Set(this.expandedTracks);
    if (newSet.has(trackNumber)) newSet.delete(trackNumber);
    else newSet.add(trackNumber);
    this.expandedTracks = newSet;
    this.requestUpdate();
  }

  private clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
  }

  // Section scoring functions - returns 0-10 score
  private scoreLoudness(t: TrackAnalysis): number {
    let score = 10;
    const lufs = t.loudness.integratedLUFS ?? -14;
    const lra = t.loudness.loudnessRangeLU ?? 8;

    // Ideal range: -16 to -12 LUFS
    if (lufs > -9) score -= 2.5; // Very loud, likely over-compressed
    else if (lufs > -12) score -= 1.0; // Hot but acceptable
    else if (lufs < -20) score -= 1.5; // Too quiet

    // LRA penalty
    if (lra < 4) score -= 2.0; // Very flat dynamics
    else if (lra < 6) score -= 1.0;
    else if (lra > 18) score -= 0.5; // Potentially too sparse

    return this.clamp(score, 0, 10);
  }

  private scorePeaks(t: TrackAnalysis): number {
    let score = 10;
    const tp = t.loudness.truePeakDBTP ?? -3;
    const isp = t.loudness.ispMarginDB ?? 0;

    // True peak penalties
    if (tp > -0.5) score -= 3.0; // Severe clipping risk
    else if (tp > -1.0) score -= 1.5; // Above streaming threshold
    else if (tp > -1.5) score -= 0.5; // Marginal headroom

    // ISP margin (high = inter-sample peak risk)
    if (isp > 1.0) score -= 1.5;
    else if (isp > 0.5) score -= 0.5;

    return this.clamp(score, 0, 10);
  }

  private scoreDynamics(t: TrackAnalysis): number {
    let score = 10;
    const dr = t.dynamics.dynamicRangeDB ?? 12;
    const crest = t.dynamics.crestFactorDB ?? 10;
    const plr = t.dynamics.plrDB ?? 12;

    // Clipping is a major issue
    if (t.dynamics.hasClipping) {
      const clipCount = t.dynamics.clipEventCount ?? 0;
      if (clipCount > 100) score -= 3.0;
      else if (clipCount > 10) score -= 2.0;
      else score -= 1.0;
    }

    // Dynamic range
    if (dr < 6) score -= 2.0;
    else if (dr < 10) score -= 1.0;

    // Crest factor
    if (crest < 6) score -= 1.5;
    else if (crest < 8) score -= 0.5;

    // PLR
    if (plr < 8) score -= 1.0;

    // DC offset
    if (Math.abs(t.dynamics.dcOffset ?? 0) > 0.01) score -= 0.5;

    return this.clamp(score, 0, 10);
  }

  private scoreStereo(t: TrackAnalysis): number {
    let score = 10;
    const corr = t.stereo.correlationMean ?? 0.8;
    const worst = t.stereo.correlationWorst1Pct ?? 0;
    const monoLoss = t.stereo.monoLoudnessDiffDB ?? 0;
    const balance = Math.abs(t.stereo.balanceDB ?? 0);

    // Correlation issues
    if (corr < 0) score -= 2.5; // Out of phase
    else if (corr < 0.3) score -= 1.5;
    else if (corr < 0.5) score -= 0.5;

    // Worst correlation
    if (worst < -0.5) score -= 1.5;
    else if (worst < 0) score -= 0.5;

    // Mono compatibility
    if (monoLoss < -4) score -= 2.0;
    else if (monoLoss < -2) score -= 1.0;

    // Balance
    if (balance > 3) score -= 1.5;
    else if (balance > 1.5) score -= 0.5;

    // Phase issues
    if (t.stereo.lowEndPhaseIssues) score -= 1.0;
    if (t.stereo.subBassMonoCompatible === false) score -= 0.5;

    return this.clamp(score, 0, 10);
  }

  private scoreSpectral(t: TrackAnalysis): number {
    let score = 10;
    const tilt = t.spectral.spectralTiltDBPerOctave ?? -3;
    const harsh = t.spectral.harshnessIndex ?? 20;
    const sib = t.spectral.sibilanceIndex ?? 15;

    // Spectral tilt - ideal is slightly negative (-4 to 0)
    if (tilt > 1) score -= 1.5; // Too bright
    else if (tilt > 0) score -= 0.5;
    if (tilt < -6) score -= 1.0; // Too dark

    // Harshness (2-5kHz)
    if (harsh > 35) score -= 2.0;
    else if (harsh > 28) score -= 1.0;

    // Sibilance (5-10kHz)
    if (sib > 30) score -= 1.5;
    else if (sib > 22) score -= 0.5;

    return this.clamp(score, 0, 10);
  }

  private scoreStreaming(t: TrackAnalysis): number {
    let score = 10;
    const spotify = t.streamingSimulation.spotify;

    if (spotify) {
      const projTP = spotify.projectedTruePeakDBTP;
      const gain = spotify.gainChangeDB;

      // Post-normalization clipping risk
      if (projTP > 0) score -= 3.0;
      else if (projTP > -1) score -= 1.5;

      // Severe attenuation (loudness war penalty)
      if (gain < -8) score -= 1.5;
      else if (gain < -4) score -= 0.5;
    }

    return this.clamp(score, 0, 10);
  }

  private scoreMusical(t: TrackAnalysis): number {
    let score = 10;
    const bpmConf = t.musicalFeatures.bpmConfidence ?? 0;
    const keyConf = t.musicalFeatures.keyConfidence ?? 0;
    const tonal = t.musicalFeatures.tonalnessScore ?? 50;
    const stability = t.musicalFeatures.beatStabilityScore ?? 50;

    // Low confidence = ambiguous content
    if (bpmConf < 30) score -= 1.5;
    else if (bpmConf < 50) score -= 0.5;

    if (keyConf < 30) score -= 1.0;
    else if (keyConf < 50) score -= 0.3;

    // Tonalness
    if (tonal < 30) score -= 1.0;

    // Beat stability
    if (stability < 40) score -= 0.5;

    return this.clamp(score, 0, 10);
  }

  private scoreArtifacts(t: TrackAnalysis): number {
    let score = 10;
    const aiScore = t.aiArtifacts.overallAIScore ?? 0;

    if (aiScore > 70) score -= 3.0;
    else if (aiScore > 50) score -= 2.0;
    else if (aiScore > 30) score -= 1.0;

    if (t.aiArtifacts.shimmerDetected) score -= 0.5;

    return this.clamp(score, 0, 10);
  }

  private getRatingClass(score: number): string {
    if (score >= 8.5) return "excellent";
    if (score >= 7.0) return "good";
    if (score >= 5.0) return "fair";
    return "poor";
  }

  private renderInfoBtn(text: string): TemplateResult {
    return html`<span class="info-wrap"><button class="info-btn" tabindex="0">?</button><span class="info-tooltip">${text}</span></span>`;
  }

  private renderMeter(
    label: string,
    tooltip: string,
    value: number | null,
    unit: string,
    meterType: "loudness" | "peak" | "dynamics" | "width" | "artifact",
    valueToPos: (v: number) => number,
    rangeLabels: string[]
  ): TemplateResult {
    const displayValue = value !== null ? value.toFixed(1) : "—";
    const pos = value !== null ? this.clamp(valueToPos(value), 0, 100) : 50;
    return html`
      <div class="meter-wrap">
        <div class="meter-header">
          <div class="meter-label-wrap">
            <span class="meter-label">${label}</span>
            ${this.renderInfoBtn(tooltip)}
          </div>
          <span class="meter-value">${displayValue} ${unit}</span>
        </div>
        <div class="meter-bar ${meterType}">
          <div class="meter-gradient"></div>
          ${value !== null ? html`<div class="meter-marker" style="left:${pos}%"></div>` : null}
        </div>
        <div class="meter-ticks">${rangeLabels.map(l => html`<span class="meter-tick">${l}</span>`)}</div>
      </div>
    `;
  }

  private renderMetricRow(
    label: string,
    tooltip: string,
    value: string,
    statusClass: string = "",
    meterConfig?: {
      numValue: number | null;
      type: "level" | "center" | "low-good" | "high-good" | "bool-good" | "bool-bad";
      min: number;
      max: number;
    }
  ): TemplateResult {
    let meterPos = 50;
    if (meterConfig && meterConfig.numValue !== null) {
      const range = meterConfig.max - meterConfig.min;
      meterPos = this.clamp(((meterConfig.numValue - meterConfig.min) / range) * 100, 0, 100);
    }

    return html`
      <div class="metric-row">
        <div class="metric-row-header">
          <div class="metric-label-row">
            <span>${label}</span>
            ${this.renderInfoBtn(tooltip)}
          </div>
          <span class="metric-val ${statusClass}">${value}</span>
        </div>
        ${meterConfig ? html`
          <div class="mini-meter type-${meterConfig.type}">
            <div class="mini-meter-gradient"></div>
            ${meterConfig.numValue !== null ? html`<div class="mini-meter-marker" style="left:${meterPos}%"></div>` : null}
          </div>
        ` : null}
      </div>
    `;
  }

  private getLedClass(): string {
    if (this.error) return "error";
    if (this.busy) return "busy";
    return "ready";
  }

  override render() {
    return html`
      <div class="container">
        <div class="header-module">
          <div class="brand-row">
            <h1 class="logo">Auralgeek</h1>
            <span class="version-badge">v1.0</span>
          </div>
          <p class="tagline">Deep audio mastering analysis</p>

          <div class="status-row">
            <div class="status-led ${this.getLedClass()}"></div>
            <span class="status-text">${this.status}</span>
          </div>

          <div class="btn-row">
            <button class="btn btn-primary" ?disabled=${this.busy} @click=${this.onPickFiles}>
              ${this.busy ? 'Processing...' : 'Select Audio Files'}
            </button>
            <button class="btn btn-secondary" ?disabled=${!this.album} @click=${this.exportJSON}>
              Export JSON
            </button>
          </div>

          ${this.busy && this.progress ? html`
            <div class="progress-display">
              <div class="progress-ring"></div>
              <div class="progress-count">Track ${this.progress.current} / ${this.progress.total}</div>
              <div class="progress-filename">${this.progress.filename}</div>
              ${this.progress.stage ? html`<div class="progress-stage">${this.progress.stage}</div>` : null}
              <div class="progress-bars">
                <div class="progress-bar-wrap">
                  <span class="progress-bar-label">Track</span>
                  <div class="progress-bar-track">
                    <div class="progress-bar-fill" style="width:${Math.round((this.progress.current / this.progress.total) * 100)}%"></div>
                  </div>
                  <span class="progress-bar-pct">${Math.round((this.progress.current / this.progress.total) * 100)}%</span>
                </div>
                ${this.progress.stageProgress !== undefined ? html`
                  <div class="progress-bar-wrap">
                    <span class="progress-bar-label">Stage</span>
                    <div class="progress-bar-track">
                      <div class="progress-bar-fill" style="width:${this.progress.stageProgress}%"></div>
                    </div>
                    <span class="progress-bar-pct">${this.progress.stageProgress}%</span>
                  </div>
                ` : null}
              </div>
            </div>
          ` : !this.busy && !this.album ? html`
            <div class="drop-zone" @dragover=${(e: DragEvent) => e.preventDefault()} @drop=${this.onDrop}>
              <div class="drop-icon">◉</div>
              <div class="drop-text">Drop audio files here</div>
              <div class="drop-hint">WAV, FLAC, MP3, AAC, OGG</div>
            </div>
          ` : null}

          ${this.error ? html`<div class="alert alert-danger">${this.error}</div>` : null}
        </div>

        ${this.album ? this.renderReport(this.album) : null}
      </div>
    `;
  }

  private renderReport(album: AlbumAnalysis) {
    const s = album.summary;
    return html`
      <div class="panel">
        <div class="summary-row">
          <div class="score-module" style="--score:${album.overallScore}" title="${album.scoreBreakdown ? `Loudness: ${album.scoreBreakdown.loudness}/10\nDynamics: ${album.scoreBreakdown.dynamics}/10\nTranslation: ${album.scoreBreakdown.translation}/10\nSpectral: ${album.scoreBreakdown.spectral}/10\nStreaming: ${album.scoreBreakdown.streaming}/10` : ''}">
            <div class="score-inner">
              <div class="score-number">${album.overallScore.toFixed(1)}</div>
              <div class="score-label">Score</div>
            </div>
          </div>
          <div class="summary-info">
            <h2 class="album-title">${album.albumName}</h2>
            <div class="album-meta">
              <span>${album.totalTracks} tracks</span>
              <span>${album.totalDuration}</span>
              <span>${album.totalSizeMB.toFixed(1)} MB</span>
            </div>
            <span class="badge ${album.distributionReady ? 'badge-ok' : 'badge-warn'}" title="${album.distributionReadyNote ?? ''}">
              ${album.distributionReadyNote ?? (album.distributionReady ? 'Distribution Ready' : 'Needs Attention')}
            </span>
          </div>
        </div>
        <div class="summary-meters">
          ${this.renderMeter("Average Loudness", "Integrated loudness (LUFS) per EBU R128. Target: -14 LUFS for Spotify, -16 for Apple Music.", s.avgLUFS ?? null, "LUFS", "loudness", (v) => ((v + 24) / 20) * 100, ["-24", "-19", "-14", "-9", "-4"])}
          ${this.renderMeter("Max True Peak", "Highest inter-sample peak. Keep below -1 dBTP to prevent clipping.", s.maxTruePeak ?? null, "dBTP", "peak", (v) => ((v + 12) / 12) * 100, ["-12", "-9", "-6", "-3", "0"])}
        </div>

        <!-- Enhanced Summary Stats -->
        <div class="summary-stats">
          <!-- Loudness Stats -->
          <div class="stat-group">
            <div class="stat-group-title"><span>◐</span> Loudness</div>
            <div class="stat-row">
              <span class="stat-label">Range ${this.renderInfoBtn("Min to max integrated loudness across all tracks. Smaller range = more cohesive album.")}</span>
              <span class="stat-value">${s.lufsRange ?? '—'}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Consistency ${this.renderInfoBtn("Standard deviation of track loudness. Under 2 LU is ideal for cohesive albums.")}</span>
              <span class="stat-value ${(s.lufsConsistency ?? 0) > 3 ? 'warning' : ''}">${s.lufsConsistency?.toFixed(1) ?? '—'} LU σ</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Avg LRA ${this.renderInfoBtn("Average Loudness Range per EBU Tech 3342. Higher = more dynamic. 6-12 LU typical for pop/rock.")}</span>
              <span class="stat-value">${s.avgLRA?.toFixed(1) ?? '—'} LU</span>
            </div>
          </div>

          <!-- Peaks Stats -->
          <div class="stat-group">
            <div class="stat-group-title"><span>▲</span> Peaks</div>
            <div class="stat-row">
              <span class="stat-label">Avg True Peak ${this.renderInfoBtn("Average inter-sample peak across tracks. Keep below -1 dBTP for streaming safety.")}</span>
              <span class="stat-value">${s.avgTruePeak?.toFixed(1) ?? '—'} dBTP</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Max True Peak ${this.renderInfoBtn("Highest true peak in the album. Above -1 dBTP risks clipping after codec conversion.")}</span>
              <span class="stat-value ${(s.maxTruePeak ?? -10) > -1 ? 'danger' : ''}">${s.maxTruePeak?.toFixed(1) ?? '—'} dBTP</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Above -1 dBTP ${this.renderInfoBtn("Number of tracks exceeding the -1 dBTP streaming ceiling. These may clip on some platforms.")}</span>
              <span class="stat-value ${(s.tracksAboveNeg1dBTP ?? 0) > 0 ? 'warning' : 'good'}">${s.tracksAboveNeg1dBTP ?? 0} tracks</span>
            </div>
          </div>

          <!-- Dynamics Stats -->
          <div class="stat-group">
            <div class="stat-group-title"><span>◧</span> Dynamics</div>
            <div class="stat-row">
              <span class="stat-label">Avg DR ${this.renderInfoBtn("Average dynamic range. Higher values mean more dynamics preserved. Under 6 dB suggests heavy limiting.")}</span>
              <span class="stat-value">${s.avgDynamicRange?.toFixed(1) ?? '—'} dB</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Avg Crest ${this.renderInfoBtn("Average peak-to-RMS ratio. Higher = more punch. Under 8 dB may sound flat.")}</span>
              <span class="stat-value">${s.avgCrestFactor?.toFixed(1) ?? '—'} dB</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Clipping ${this.renderInfoBtn("Tracks with detected digital clipping. Any clipping should be addressed before release.")}</span>
              <span class="stat-value ${(s.tracksWithClipping ?? 0) > 0 ? 'danger' : 'good'}">${s.tracksWithClipping ?? 0} tracks</span>
            </div>
          </div>

          <!-- Stereo Stats -->
          <div class="stat-group">
            <div class="stat-group-title"><span>◑</span> Stereo</div>
            <div class="stat-row">
              <span class="stat-label">Avg Width ${this.renderInfoBtn("Average stereo width across tracks. 50-80% is typical. Very wide mixes may have mono compatibility issues.")}</span>
              <span class="stat-value">${s.avgStereoWidth ?? '—'}%</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Avg Correlation ${this.renderInfoBtn("L/R channel correlation. 1 = mono, 0 = uncorrelated. Below 0.5 may have phase issues.")}</span>
              <span class="stat-value ${(s.avgCorrelation ?? 1) < 0.5 ? 'warning' : ''}">${s.avgCorrelation?.toFixed(2) ?? '—'}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Phase Issues ${this.renderInfoBtn("Tracks with detected phase problems. These may sound hollow or lose bass in mono playback.")}</span>
              <span class="stat-value ${(s.tracksWithPhaseIssues ?? 0) > 0 ? 'warning' : 'good'}">${s.tracksWithPhaseIssues ?? 0} tracks</span>
            </div>
          </div>

          <!-- Spectral Stats -->
          <div class="stat-group">
            <div class="stat-group-title"><span>◔</span> Spectral</div>
            <div class="stat-row">
              <span class="stat-label">Avg Tilt ${this.renderInfoBtn("Average spectral slope. Negative = dark/warm, Positive = bright. -2 to -4 dB/oct typical for mastered music.")}</span>
              <span class="stat-value">${s.avgSpectralTilt?.toFixed(1) ?? '—'} dB/oct</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Avg Harshness ${this.renderInfoBtn("Average 2-5kHz energy prominence. Above 30% may cause listener fatigue on extended listening.")}</span>
              <span class="stat-value ${(s.avgHarshness ?? 0) > 30 ? 'warning' : ''}">${s.avgHarshness ?? '—'}%</span>
            </div>
          </div>

          <!-- Quality Stats -->
          <div class="stat-group">
            <div class="stat-group-title"><span>✓</span> Quality</div>
            <div class="stat-row">
              <span class="stat-label">Issues ${this.renderInfoBtn("Critical problems that should be fixed before release. These affect audio quality or playback.")}</span>
              <span class="stat-value ${(s.tracksWithIssues ?? 0) > 0 ? 'danger' : 'good'}">${s.tracksWithIssues ?? 0} tracks (${s.totalIssues ?? 0} total)</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Warnings ${this.renderInfoBtn("Potential concerns that may or may not need attention depending on artistic intent.")}</span>
              <span class="stat-value ${(s.tracksWithWarnings ?? 0) > 0 ? 'warning' : 'good'}">${s.tracksWithWarnings ?? 0} tracks (${s.totalWarnings ?? 0} total)</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Artifacts ${this.renderInfoBtn("Tracks with detected processing artifacts like unnatural high-frequency shimmer or timing anomalies.")}</span>
              <span class="stat-value ${(s.tracksWithArtifacts ?? 0) > 0 ? 'warning' : 'good'}">${s.tracksWithArtifacts ?? 0} tracks</span>
            </div>
          </div>

          <!-- Album Cohesion -->
          <div class="stat-group">
            <div class="stat-group-title"><span>⟷</span> Album Cohesion</div>
            <div class="stat-row">
              <span class="stat-label">LUFS Spread ${this.renderInfoBtn("Difference between loudest and quietest track. Under 3 LU is cohesive, over 5 LU may feel inconsistent.")}</span>
              <span class="stat-value ${(s.albumLoudnessSpread ?? 0) > 4 ? 'warning' : ''}">${s.albumLoudnessSpread?.toFixed(1) ?? '—'} LU</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Sequence Flow ${this.renderInfoBtn("Penalizes large loudness jumps between adjacent tracks. 100% = smooth transitions throughout.")}</span>
              <span class="stat-value ${(s.sequenceConsistencyScore ?? 100) < 85 ? 'warning' : 'good'}">${s.sequenceConsistencyScore ?? '—'}%</span>
            </div>
            ${s.sequenceConsistencyNote ? html`
              <div class="stat-row">
                <span class="stat-label" style="font-size: 0.6rem; color: var(--led-amber);">${s.sequenceConsistencyNote}</span>
              </div>
            ` : null}
            <div class="stat-row">
              <span class="stat-label">Spectral Match ${this.renderInfoBtn("How consistent the tonal character is across tracks. Low scores indicate tracks that may sound out of place.")}</span>
              <span class="stat-value ${(s.spectralConsistencyScore ?? 100) < 85 ? 'warning' : 'good'}">${s.spectralConsistencyScore ?? '—'}%</span>
            </div>
            ${s.spectralNote ? html`
              <div class="stat-row">
                <span class="stat-label" style="font-size: 0.6rem; color: var(--led-amber);">${s.spectralNote}</span>
              </div>
            ` : null}
          </div>

          <!-- Album Fingerprint -->
          ${s.spectralFingerprint ? html`
            <div class="stat-group">
              <div class="stat-group-title"><span>◎</span> Album Character</div>
              <div class="stat-row">
                <span class="stat-label">Avg Tilt ${this.renderInfoBtn("Album's overall spectral slope. This defines the general brightness/warmth of the collection.")}</span>
                <span class="stat-value">${s.spectralFingerprint.avgTilt.toFixed(1)} dB/oct</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Avg Harshness ${this.renderInfoBtn("Album's overall harshness level. Consistent values across tracks contribute to cohesive sound.")}</span>
                <span class="stat-value">${s.spectralFingerprint.avgHarshness.toFixed(0)}%</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Avg Width ${this.renderInfoBtn("Album's overall stereo width character. Consistent width helps maintain a unified listening experience.")}</span>
                <span class="stat-value">${s.spectralFingerprint.avgWidth.toFixed(0)}%</span>
              </div>
            </div>
          ` : null}

          <!-- Outlier Tracks -->
          ${s.outlierTracks && s.outlierTracks.length > 0 ? html`
            <div class="stat-group">
              <div class="stat-group-title"><span>⚠</span> Outliers</div>
              ${s.outlierTracks.map(o => html`
                <div class="stat-row">
                  <span class="stat-label">Track ${o.trackNumber}</span>
                  <span class="stat-value warning" style="font-size: 0.6rem;">${o.reason}</span>
                </div>
              `)}
            </div>
          ` : null}
        </div>
      </div>

      <div class="panel">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <h3 class="panel-title" style="margin: 0; border: 0; padding: 0;">Track Analysis</h3>
          <div class="view-toggle">
            <span class="view-toggle-label">View:</span>
            <div class="view-toggle-btns">
              <button class="view-toggle-btn ${this.viewMode === 'simple' ? 'active' : ''}" @click=${() => { this.viewMode = 'simple'; }}>Simple</button>
              <button class="view-toggle-btn ${this.viewMode === 'advanced' ? 'active' : ''}" @click=${() => { this.viewMode = 'advanced'; }}>Advanced</button>
            </div>
          </div>
        </div>
        <div style="border-bottom: 1px solid var(--border-subtle); margin: 10px 0 14px;"></div>
        ${album.tracks.map(t => this.viewMode === 'simple' ? this.renderSimpleTrackCard(t) : this.renderTrackCard(t))}
      </div>

      <div class="panel">
        <div class="json-toggle" @click=${() => { this.jsonVisible = !this.jsonVisible; this.requestUpdate(); }}>
          <h3 class="panel-title" style="margin:0;border:0;padding:0">Raw Data</h3>
          <span class="json-toggle-icon">${this.jsonVisible ? '▲' : '▼'}</span>
        </div>
        <div class="json-preview ${this.jsonVisible ? 'visible' : ''}">
          <pre>${JSON.stringify(album, null, 2)}</pre>
        </div>
      </div>
    `;
  }

  private renderTrackCard(t: TrackAnalysis) {
    const isExpanded = this.expandedTracks.has(t.trackNumber);
    const statusClass = t.distributionReady ? "badge-ok" : t.issues.length ? "badge-bad" : "badge-warn";

    // Helper to format time
    const formatTime = (seconds: number | null): string => {
      if (seconds === null) return "—";
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return `${m}:${String(s).padStart(2, '0')}`;
    };

    // Calculate section scores
    const scores = {
      loudness: this.scoreLoudness(t),
      peaks: this.scorePeaks(t),
      dynamics: this.scoreDynamics(t),
      stereo: this.scoreStereo(t),
      spectral: this.scoreSpectral(t),
      musical: this.scoreMusical(t),
      streaming: this.scoreStreaming(t),
      artifacts: this.scoreArtifacts(t)
    };

    return html`
      <div class="track-item ${isExpanded ? 'expanded' : ''}">
        <div class="track-header" @click=${() => this.toggleTrack(t.trackNumber)}>
          <span class="track-num">${String(t.trackNumber).padStart(2, '0')}</span>
          <div class="track-info">
            <div class="track-name">${t.parameters.filename}</div>
            <div class="track-meta">${t.parameters.durationFormatted} · ${t.parameters.sampleRate ?? "—"} Hz · ${t.parameters.channels ?? "—"}ch${t.parameters.effectiveBitDepth ? ` · ~${t.parameters.effectiveBitDepth}bit` : ''}</div>
          </div>
          <div class="track-badges">
            <span class="badge ${statusClass}">${t.distributionReady ? 'OK' : 'Check'}</span>
            <span class="badge badge-neutral">${t.loudness.integratedLUFS?.toFixed(1) ?? "—"} LUFS</span>
          </div>
          <div class="expand-icon">▼</div>
        </div>

        <div class="track-content">
          <div class="track-content-inner">
            <!-- LOUDNESS MODULE (EBU R128) -->
            <div class="metric-module primary">
              <h4 class="module-title"><span class="module-icon">◐</span> Loudness<span class="module-rating ${this.getRatingClass(scores.loudness)}">${scores.loudness.toFixed(1)}</span></h4>
              ${this.renderMeter("Integrated", "Gated loudness per EBU R128. Target: -14 LUFS (Spotify), -16 (Apple).", t.loudness.integratedLUFS, "LUFS", "loudness", (v) => ((v+24)/20)*100, ["-24", "-19", "-14", "-9", "-4"])}
              ${this.renderMetricRow("Ungated", "Integrated loudness without gating.", `${t.loudness.integratedUngatedLUFS?.toFixed(1) ?? "—"} LUFS`, "", { numValue: t.loudness.integratedUngatedLUFS, type: "center", min: -24, max: -4 })}
              <div class="section-subtitle">Short-term Analysis</div>
              ${this.renderMetricRow("Max Momentary", "Peak 400ms loudness.", `${t.loudness.maxMomentaryLUFS?.toFixed(1) ?? "—"} LUFS`, "", { numValue: t.loudness.maxMomentaryLUFS, type: "center", min: -24, max: 0 })}
              ${this.renderMetricRow("Max Short-term", "Peak 3s loudness.", `${t.loudness.maxShortTermLUFS?.toFixed(1) ?? "—"} LUFS`, "", { numValue: t.loudness.maxShortTermLUFS, type: "center", min: -24, max: 0 })}
              ${this.renderMetricRow("LRA", "Loudness Range (EBU Tech 3342). Higher = more dynamic.", `${t.loudness.loudnessRangeLU?.toFixed(1) ?? "—"} LU`, (t.loudness.loudnessRangeLU ?? 10) < 4 ? "warning" : "", { numValue: t.loudness.loudnessRangeLU, type: "high-good", min: 0, max: 20 })}
              ${this.renderMetricRow("Loudest @", "Time of loudest section.", formatTime(t.loudness.loudestSegmentTime), "")}
              ${this.renderMetricRow("Quietest @", "Time of quietest section.", formatTime(t.loudness.quietestSegmentTime), "")}
              <div class="section-subtitle">Macro-dynamics</div>
              ${this.renderMetricRow("Loudness Slope", "Trend over time. Positive = gets louder.", `${t.loudness.loudnessSlopeDBPerMin?.toFixed(2) ?? "—"} dB/min`, Math.abs(t.loudness.loudnessSlopeDBPerMin ?? 0) > 0.5 ? "warning" : "", { numValue: t.loudness.loudnessSlopeDBPerMin, type: "center", min: -2, max: 2 })}
              ${this.renderMetricRow("Volatility", "Std-dev of short-term LUFS. Low = controlled.", `${t.loudness.loudnessVolatilityLU?.toFixed(1) ?? "—"} LU`, (t.loudness.loudnessVolatilityLU ?? 0) > 6 ? "warning" : "", { numValue: t.loudness.loudnessVolatilityLU, type: "low-good", min: 0, max: 10 })}
            </div>

            <!-- PEAKS & HEADROOM -->
            <div class="metric-module primary">
              <h4 class="module-title"><span class="module-icon">▲</span> Peaks<span class="module-rating ${this.getRatingClass(scores.peaks)}">${scores.peaks.toFixed(1)}</span></h4>
              ${this.renderMeter("True Peak", `Inter-sample peak (${t.loudness.truePeakOversampling ?? 4}x oversampled). Keep ≤ -1 dBTP.`, t.loudness.truePeakDBTP, "dBTP", "peak", (v) => ((v+12)/12)*100, ["-12", "-9", "-6", "-3", "0"])}
              ${this.renderMetricRow("Sample Peak", "Non-oversampled peak.", `${t.loudness.samplePeakDBFS?.toFixed(1) ?? "—"} dBFS`, "", { numValue: t.loudness.samplePeakDBFS, type: "level", min: -24, max: 0 })}
              ${this.renderMetricRow("ISP Margin", "True Peak vs Sample Peak. High = ISP risk.", `${t.loudness.ispMarginDB?.toFixed(2) ?? "—"} dB`, (t.loudness.ispMarginDB ?? 0) > 0.5 ? "warning" : "", { numValue: t.loudness.ispMarginDB, type: "low-good", min: 0, max: 2 })}
              <div class="section-subtitle">Peak Clustering</div>
              ${this.renderMetricRow("Pattern", "Sporadic = transients, Persistent = limiter.", t.loudness.peakClusteringType ?? "—", t.loudness.peakClusteringType === "persistent" ? "warning" : "")}
              ${this.renderMetricRow("Cluster Count", "Number of peak clusters.", `${t.loudness.peakClusterCount ?? "—"}`, "")}
              ${this.renderMetricRow("TP/Loudness", "TP vs short-term at peak. High = brittle.", `${t.loudness.tpToLoudnessAtPeak?.toFixed(1) ?? "—"} dB`, (t.loudness.tpToLoudnessAtPeak ?? 0) > 3 ? "warning" : "", { numValue: t.loudness.tpToLoudnessAtPeak, type: "low-good", min: 0, max: 6 })}
              <div class="section-subtitle">Headroom to</div>
              ${this.renderMetricRow("0 dBTP", "Headroom to digital ceiling.", `${t.loudness.truePeakDBTP !== null ? (-t.loudness.truePeakDBTP).toFixed(1) : "—"} dB`, "")}
              ${this.renderMetricRow("-1 dBTP", "Headroom to streaming safe.", `${t.loudness.truePeakDBTP !== null ? (-1 - t.loudness.truePeakDBTP).toFixed(1) : "—"} dB`, (t.loudness.truePeakDBTP ?? -10) > -1 ? "danger" : "")}
            </div>

            <!-- DYNAMICS -->
            <div class="metric-module primary">
              <h4 class="module-title"><span class="module-icon">◧</span> Dynamics<span class="module-rating ${this.getRatingClass(scores.dynamics)}">${scores.dynamics.toFixed(1)}</span></h4>
              ${this.renderMeter("Dynamic Range", "Percentile-based DR. Higher = more dynamic.", t.dynamics.dynamicRangeDB, "dB", "dynamics", (v) => (v/40)*100, ["0", "10", "20", "30", "40"])}
              ${this.renderMetricRow("PLR", "Peak-to-Loudness Ratio. Lower = squashed.", `${t.dynamics.plrDB?.toFixed(1) ?? "—"} dB`, (t.dynamics.plrDB ?? 20) < 8 ? "warning" : "", { numValue: t.dynamics.plrDB, type: "high-good", min: 0, max: 20 })}
              ${this.renderMetricRow("PSR", "Peak-to-Short-term Ratio.", `${t.dynamics.psrDB?.toFixed(1) ?? "—"} dB`, "", { numValue: t.dynamics.psrDB, type: "high-good", min: 0, max: 15 })}
              ${this.renderMetricRow("Crest Factor", "Peak to RMS ratio. Higher = more punch.", `${t.dynamics.crestFactorDB?.toFixed(1) ?? "—"} dB`, (t.dynamics.crestFactorDB ?? 10) < 6 ? "warning" : "", { numValue: t.dynamics.crestFactorDB, type: "high-good", min: 0, max: 20 })}
              <div class="section-subtitle">Envelope Shape</div>
              ${this.renderMetricRow("Attack Speed", "Median attack slope. Higher = punchier.", `${t.dynamics.attackSpeedIndex?.toFixed(1) ?? "—"} dB/ms`, "", { numValue: t.dynamics.attackSpeedIndex, type: "high-good", min: 0, max: 10 })}
              ${this.renderMetricRow("Release Tail", "Median decay time. Long = sustained.", `${t.dynamics.releaseTailMs?.toFixed(0) ?? "—"} ms`, "", { numValue: t.dynamics.releaseTailMs, type: "center", min: 0, max: 500 })}
              <div class="section-subtitle">Microdynamics</div>
              ${this.renderMetricRow("Transient Density", "Attack events per minute.", `${t.dynamics.transientDensity?.toFixed(0) ?? "—"} /min`, "", { numValue: t.dynamics.transientDensity, type: "center", min: 0, max: 300 })}
              ${this.renderMetricRow("Micro Contrast", "Median short-window crest.", `${t.dynamics.microdynamicContrast?.toFixed(1) ?? "—"} dB`, "", { numValue: t.dynamics.microdynamicContrast, type: "high-good", min: 0, max: 15 })}
              <div class="section-subtitle">Clipping</div>
              ${this.renderMetricRow("Status", "Digital clipping detection.", t.dynamics.hasClipping ? `${t.dynamics.clipEventCount ?? 0} events` : "None", t.dynamics.hasClipping ? "danger" : "good")}
              ${t.dynamics.hasClipping ? html`
                ${this.renderMetricRow("Clipped Samples", "Total clipped sample count.", `${t.dynamics.clippedSampleCount ?? 0}`, "danger")}
                ${this.renderMetricRow("Clip Density", "Clip events per minute.", `${t.dynamics.clipDensityPerMinute?.toFixed(1) ?? "—"} /min`, "warning")}
              ` : null}
              <div class="section-subtitle">Silence</div>
              ${this.renderMetricRow("Start", "Leading silence.", `${t.dynamics.silenceAtStartMs ?? 0} ms`, (t.dynamics.silenceAtStartMs ?? 0) > 500 ? "warning" : "")}
              ${this.renderMetricRow("End", "Trailing silence.", `${t.dynamics.silenceAtEndMs ?? 0} ms`, (t.dynamics.silenceAtEndMs ?? 0) > 2000 ? "warning" : "")}
              ${this.renderMetricRow("DC Offset", "Should be near zero.", `${t.dynamics.dcOffset?.toFixed(6) ?? "—"}`, Math.abs(t.dynamics.dcOffset ?? 0) > 0.001 ? "warning" : "")}
            </div>

            <!-- STEREO FIELD -->
            <div class="metric-module">
              <h4 class="module-title"><span class="module-icon">◑</span> Stereo<span class="module-rating ${this.getRatingClass(scores.stereo)}">${scores.stereo.toFixed(1)}</span></h4>
              ${this.renderMeter("Stereo Width", "Side/mid ratio. 50-80% is typical.", t.stereo.stereoWidthPct, "%", "width", (v) => (v/120)*100, ["0", "30", "60", "90", "120"])}
              ${this.renderMetricRow("Mid Energy", "Center channel energy.", `${t.stereo.midEnergyDB?.toFixed(1) ?? "—"} dB`, "", { numValue: t.stereo.midEnergyDB, type: "level", min: -40, max: 0 })}
              ${this.renderMetricRow("Side Energy", "Stereo difference energy.", `${t.stereo.sideEnergyDB?.toFixed(1) ?? "—"} dB`, "", { numValue: t.stereo.sideEnergyDB, type: "level", min: -40, max: 0 })}
              ${this.renderMetricRow("L/R Balance", "0 = centered.", `${t.stereo.balanceDB?.toFixed(2) ?? "—"} dB`, Math.abs(t.stereo.balanceDB ?? 0) > 1.5 ? "warning" : "", { numValue: t.stereo.balanceDB, type: "center", min: -6, max: 6 })}
              <div class="section-subtitle">Correlation</div>
              ${this.renderMetricRow("Mean", "Average L/R correlation.", `${t.stereo.correlationMean?.toFixed(2) ?? "—"}`, (t.stereo.correlationMean ?? 1) < 0.3 ? "warning" : "", { numValue: t.stereo.correlationMean, type: "high-good", min: -1, max: 1 })}
              ${this.renderMetricRow("Energy-Weighted", "Correlation ignoring quiet sections.", `${t.stereo.correlationEnergyWeighted?.toFixed(2) ?? "—"}`, (t.stereo.correlationEnergyWeighted ?? 1) < 0.3 ? "warning" : "", { numValue: t.stereo.correlationEnergyWeighted, type: "high-good", min: -1, max: 1 })}
              ${this.renderMetricRow("Worst 1%", "Lowest correlation regions.", `${t.stereo.correlationWorst1Pct?.toFixed(2) ?? "—"}`, (t.stereo.correlationWorst1Pct ?? 0) < -0.3 ? "warning" : "", { numValue: t.stereo.correlationWorst1Pct, type: "high-good", min: -1, max: 1 })}
              <div class="section-subtitle">Channel Balance</div>
              ${this.renderMetricRow("Spectral Asymmetry", "L/R brightness difference.", `${t.stereo.spectralAsymmetryHz?.toFixed(0) ?? "—"} Hz`, Math.abs(t.stereo.spectralAsymmetryHz ?? 0) > 200 ? "warning" : "", { numValue: t.stereo.spectralAsymmetryHz, type: "center", min: -500, max: 500 })}
              ${t.stereo.spectralAsymmetryNote ? html`<div class="metric-note" style="font-size: 0.6rem; color: var(--led-amber); padding: 2px 0;">${t.stereo.spectralAsymmetryNote}</div>` : null}
              <div class="section-subtitle">Band Width</div>
              ${this.renderMetricRow("Low (20-150Hz)", "Bass stereo width.", `${t.stereo.lowBandWidthPct?.toFixed(0) ?? "—"}%`, (t.stereo.lowBandWidthPct ?? 0) > 50 ? "warning" : "", { numValue: t.stereo.lowBandWidthPct, type: "low-good", min: 0, max: 100 })}
              ${this.renderMetricRow("Presence (2-6k)", "Vocal/presence width.", `${t.stereo.presenceBandWidthPct?.toFixed(0) ?? "—"}%`, "", { numValue: t.stereo.presenceBandWidthPct, type: "center", min: 0, max: 100 })}
              ${this.renderMetricRow("Air (10-20k)", "High frequency width.", `${t.stereo.airBandWidthPct?.toFixed(0) ?? "—"}%`, "", { numValue: t.stereo.airBandWidthPct, type: "center", min: 0, max: 100 })}
              <div class="section-subtitle">Mono Compatibility</div>
              ${this.renderMetricRow("Mono Loss", "Loudness diff when summed to mono.", `${t.stereo.monoLoudnessDiffDB?.toFixed(1) ?? "—"} dB`, (t.stereo.monoLoudnessDiffDB ?? 0) < -3 ? "danger" : "", { numValue: t.stereo.monoLoudnessDiffDB, type: "high-good", min: -6, max: 3 })}
              ${this.renderMetricRow("Sub-bass Mono", "Low freq phase compatibility.", t.stereo.subBassMonoCompatible === null ? "—" : t.stereo.subBassMonoCompatible ? "OK" : "Issues", t.stereo.subBassMonoCompatible === false ? "warning" : "good")}
              ${this.renderMetricRow("LF Phase", "Low-end phase anomalies.", t.stereo.lowEndPhaseIssues ? "Detected" : "OK", t.stereo.lowEndPhaseIssues ? "warning" : "good")}
            </div>

            <!-- SPECTRAL -->
            <div class="metric-module">
              <h4 class="module-title"><span class="module-icon">◔</span> Spectral<span class="module-rating ${this.getRatingClass(scores.spectral)}">${scores.spectral.toFixed(1)}</span></h4>
              ${this.renderMetricRow("Tilt", "Spectral slope. Negative = dark, Positive = bright.", `${t.spectral.spectralTiltDBPerOctave?.toFixed(1) ?? "—"} dB/oct`, Math.abs(t.spectral.spectralTiltDBPerOctave ?? 0) > 4 ? "warning" : "", { numValue: t.spectral.spectralTiltDBPerOctave, type: "center", min: -8, max: 4 })}
              ${this.renderMetricRow("Centroid", "Brightness indicator.", `${t.spectral.spectralCentroidHz?.toFixed(0) ?? "—"} Hz`, "", { numValue: t.spectral.spectralCentroidHz, type: "center", min: 500, max: 6000 })}
              ${this.renderMetricRow("Rolloff", "85% energy cutoff.", `${t.spectral.spectralRolloffHz?.toFixed(0) ?? "—"} Hz`, "", { numValue: t.spectral.spectralRolloffHz, type: "center", min: 2000, max: 16000 })}
              <div class="section-subtitle">Band Ratios</div>
              ${this.renderMetricRow("Bass/Mid", "Low end vs mids.", `${t.spectral.bassToMidRatioDB?.toFixed(1) ?? "—"} dB`, "", { numValue: t.spectral.bassToMidRatioDB, type: "center", min: -12, max: 12 })}
              ${this.renderMetricRow("Mid/High", "Mids vs highs.", `${t.spectral.midToHighRatioDB?.toFixed(1) ?? "—"} dB`, "", { numValue: t.spectral.midToHighRatioDB, type: "center", min: -12, max: 12 })}
              <div class="section-subtitle">Perceptual (raw)</div>
              ${this.renderMetricRow("Harshness", "2-5kHz prominence. Lower is better.", `${t.spectral.harshnessIndex?.toFixed(0) ?? "—"}%`, (t.spectral.harshnessIndex ?? 0) > 30 ? "warning" : "", { numValue: t.spectral.harshnessIndex, type: "low-good", min: 0, max: 50 })}
              ${this.renderMetricRow("Sibilance", "5-10kHz peaks. Lower is better.", `${t.spectral.sibilanceIndex?.toFixed(0) ?? "—"}%`, (t.spectral.sibilanceIndex ?? 0) > 25 ? "warning" : "", { numValue: t.spectral.sibilanceIndex, type: "low-good", min: 0, max: 40 })}
              <div class="section-subtitle">Perceptual (A-weighted)</div>
              ${this.renderMetricRow("Harshness (A)", "A-weighted for perception.", `${t.spectral.harshnessIndexWeighted?.toFixed(0) ?? "—"}%`, (t.spectral.harshnessIndexWeighted ?? 0) > 25 ? "warning" : "", { numValue: t.spectral.harshnessIndexWeighted, type: "low-good", min: 0, max: 50 })}
              ${this.renderMetricRow("Sibilance (A)", "A-weighted sibilance.", `${t.spectral.sibilanceIndexWeighted?.toFixed(0) ?? "—"}%`, (t.spectral.sibilanceIndexWeighted ?? 0) > 20 ? "warning" : "", { numValue: t.spectral.sibilanceIndexWeighted, type: "low-good", min: 0, max: 40 })}
              ${this.renderMetricRow("Tilt (A)", "A-weighted spectral slope.", `${t.spectral.spectralTiltWeightedDBPerOctave?.toFixed(1) ?? "—"} dB/oct`, Math.abs(t.spectral.spectralTiltWeightedDBPerOctave ?? 0) > 3 ? "warning" : "", { numValue: t.spectral.spectralTiltWeightedDBPerOctave, type: "center", min: -6, max: 3 })}
              <div class="section-subtitle">Balance</div>
              ${this.renderMetricRow("Status", "Overall tonal balance.", t.spectral.spectralBalanceStatus ?? "—", "")}
              ${t.spectral.spectralBalanceNote ? html`<div class="metric-note" style="font-size: 0.6rem; color: var(--text-secondary); padding: 2px 0;">${t.spectral.spectralBalanceNote}</div>` : null}
              ${this.renderMetricRow("Flatness", "0 = tonal, 1 = noise.", `${t.spectral.spectralFlatness?.toFixed(2) ?? "—"}`, "", { numValue: t.spectral.spectralFlatness, type: "center", min: 0, max: 1 })}
            </div>

            <!-- MUSICAL + STREAMING + ARTIFACTS (stacked) -->
            <div class="stacked-modules">
              <div class="metric-module tertiary">
                <h4 class="module-title"><span class="module-icon">♪</span> Musical<span class="module-rating ${this.getRatingClass(scores.musical)}">${scores.musical.toFixed(1)}</span></h4>
                <div class="music-feature-row">
                  <span class="music-primary">${t.musicalFeatures.bpmPrimary ?? "—"} BPM</span>
                  <span class="music-confidence">${t.musicalFeatures.bpmConfidence ?? 0}%</span>
                  ${t.musicalFeatures.halfDoubleAmbiguity ? html`<span class="music-badge">½/2x</span>` : null}
                </div>
                <div class="music-feature-row">
                  <span class="music-primary">${t.musicalFeatures.keyPrimary ?? "—"}</span>
                  <span class="music-confidence">${t.musicalFeatures.keyConfidence ?? 0}%</span>
                </div>
                ${this.renderMetricRow("Beat Stability", "Timing consistency.", `${t.musicalFeatures.beatStabilityScore ?? 0}%`, "", { numValue: t.musicalFeatures.beatStabilityScore, type: "high-good", min: 0, max: 100 })}
                ${this.renderMetricRow("Tempo Drift", "Beat interval variation. Low = steady.", `${t.musicalFeatures.tempoDriftIndex?.toFixed(1) ?? "—"}%`, (t.musicalFeatures.tempoDriftIndex ?? 0) > 8 ? "warning" : "", { numValue: t.musicalFeatures.tempoDriftIndex, type: "low-good", min: 0, max: 15 })}
                ${t.musicalFeatures.tempoDriftNote ? html`<div class="metric-note" style="font-size: 0.6rem; color: var(--text-secondary); padding: 2px 0;">${t.musicalFeatures.tempoDriftNote}</div>` : null}
                ${this.renderMetricRow("Tonalness", "How well audio fits key model.", `${t.musicalFeatures.tonalnessScore ?? 0}%`, "", { numValue: t.musicalFeatures.tonalnessScore, type: "high-good", min: 0, max: 100 })}
                ${this.renderMetricRow("Key Stability", "Consistency of detected key.", `${t.musicalFeatures.keyStabilityPct?.toFixed(0) ?? "—"}%`, (t.musicalFeatures.keyStabilityPct ?? 100) < 70 ? "warning" : "", { numValue: t.musicalFeatures.keyStabilityPct, type: "high-good", min: 0, max: 100 })}
                ${t.musicalFeatures.keyStabilityNote ? html`<div class="metric-note" style="font-size: 0.6rem; color: var(--text-secondary); padding: 2px 0;">${t.musicalFeatures.keyStabilityNote}</div>` : null}
              </div>

              <div class="metric-module tertiary">
                <h4 class="module-title"><span class="module-icon">☁</span> Streaming<span class="module-rating ${this.getRatingClass(scores.streaming)}">${scores.streaming.toFixed(1)}</span></h4>
                <div class="platform-grid">
                  ${this.renderPlatformCard(t.streamingSimulation.spotify)}
                  ${this.renderPlatformCard(t.streamingSimulation.appleMusic)}
                  ${this.renderPlatformCard(t.streamingSimulation.youtube)}
                  ${this.renderPlatformCard(t.streamingSimulation.tidal)}
                </div>
                ${t.streamingSimulation.recommendation ? html`
                  <div class="recommendation-box">
                    <div class="recommendation-title">Recommendation</div>
                    ${t.streamingSimulation.recommendation}
                  </div>
                ` : null}
              </div>

              <div class="metric-module tertiary">
                <h4 class="module-title"><span class="module-icon">◍</span> Artifacts<span class="module-rating ${this.getRatingClass(scores.artifacts)}">${scores.artifacts.toFixed(1)}</span></h4>
                ${this.renderMetricRow("AI Score", "Lower is better. Detects unnatural HF shimmer.", `${t.aiArtifacts.overallAIScore?.toFixed(0) ?? 0}/100`, t.aiArtifacts.overallAIScore && t.aiArtifacts.overallAIScore > 30 ? "warning" : "good", { numValue: t.aiArtifacts.overallAIScore, type: "low-good", min: 0, max: 100 })}
                ${this.renderMetricRow("Shimmer", "HF shimmer detection.", t.aiArtifacts.shimmerDetected ? "Detected" : "None", t.aiArtifacts.shimmerDetected ? "warning" : "good")}
                <div class="section-subtitle">Source Quality</div>
                ${this.renderMetricRow("Noise Floor", "Median low-level energy.", `${t.parameters.noiseFloorDB?.toFixed(1) ?? "—"} dB`, (t.parameters.noiseFloorDB ?? -90) > -60 ? "warning" : "", { numValue: t.parameters.noiseFloorDB ?? null, type: "low-good", min: -96, max: -40 })}
                ${this.renderMetricRow("Codec Suspicion", "Lossy source indicators.", `${t.parameters.codecSuspicionScore?.toFixed(0) ?? 0}%`, (t.parameters.codecSuspicionScore ?? 0) > 50 ? "warning" : "", { numValue: t.parameters.codecSuspicionScore ?? null, type: "low-good", min: 0, max: 100 })}
                ${t.parameters.codecSuspicionNote ? html`<div class="metric-note" style="font-size: 0.6rem; color: var(--led-amber); padding: 2px 0;">${t.parameters.codecSuspicionNote}</div>` : null}
              </div>
            </div>
          </div>

          ${t.issues.length || t.warnings.length ? html`
            <div class="issues-wrap">
              ${t.issues.map(i => html`<div class="alert alert-danger">${i}</div>`)}
              ${t.warnings.map(w => html`<div class="alert alert-warning">${w}</div>`)}
            </div>
          ` : null}
        </div>
      </div>
    `;
  }

  private renderSimpleTrackCard(t: TrackAnalysis) {
    const statusClass = t.distributionReady ? "badge-ok" : t.issues.length ? "badge-bad" : "badge-warn";

    // Helper functions for status
    const lufsStatus = (v: number | null) => {
      if (v === null) return 'info';
      if (v > -9 || v < -20) return 'danger';
      if (v > -11 || v < -18) return 'warning';
      return 'good';
    };

    const tpStatus = (v: number | null) => {
      if (v === null) return 'info';
      if (v > -0.5) return 'danger';
      if (v > -1) return 'warning';
      return 'good';
    };

    const drStatus = (v: number | null) => {
      if (v === null) return 'info';
      if (v < 4) return 'danger';
      if (v < 6) return 'warning';
      return 'good';
    };

    const corrStatus = (v: number | null) => {
      if (v === null) return 'info';
      if (v < 0) return 'danger';
      if (v < 0.5) return 'warning';
      return 'good';
    };

    const harshStatus = (v: number | null) => {
      if (v === null) return 'info';
      if (v > 35) return 'danger';
      if (v > 28) return 'warning';
      return 'good';
    };

    const artifactStatus = (v: number | null) => {
      if (v === null) return 'info';
      if (v > 50) return 'danger';
      if (v > 30) return 'warning';
      return 'good';
    };

    // Determine primary concern
    let primaryConcern: string | null = null;
    if (t.dynamics.hasClipping) {
      primaryConcern = "Clipping detected — may cause distortion";
    } else if ((t.loudness.truePeakDBTP ?? -10) > -0.5) {
      primaryConcern = "True peak too high — risk of inter-sample clipping";
    } else if ((t.stereo.correlationMean ?? 1) < 0.3) {
      primaryConcern = "Low stereo correlation — mono compatibility issues";
    } else if ((t.spectral.harshnessIndex ?? 0) > 35) {
      primaryConcern = "High harshness — may cause listener fatigue";
    } else if ((t.loudness.integratedLUFS ?? -14) > -9) {
      primaryConcern = "Very loud — will be attenuated on streaming platforms";
    }

    return html`
      <div class="track-item">
        <div class="track-header" style="cursor: default;">
          <span class="track-num">${String(t.trackNumber).padStart(2, '0')}</span>
          <div class="track-info">
            <div class="track-name">${t.parameters.filename}</div>
            <div class="track-meta">${t.parameters.durationFormatted} · ${t.parameters.sampleRate ?? "—"} Hz</div>
          </div>
          <div class="track-badges">
            <span class="badge ${statusClass}">${t.distributionReady ? 'OK' : 'Check'}</span>
          </div>
        </div>

        ${primaryConcern ? html`<div class="primary-concern">⚠ ${primaryConcern}</div>` : null}

        <div class="simple-metrics">
          <div class="simple-metric">
            <span class="simple-metric-label">Loudness</span>
            <span class="simple-metric-value ${lufsStatus(t.loudness.integratedLUFS)}">${t.loudness.integratedLUFS?.toFixed(1) ?? '—'} LUFS</span>
          </div>
          <div class="simple-metric">
            <span class="simple-metric-label">True Peak</span>
            <span class="simple-metric-value ${tpStatus(t.loudness.truePeakDBTP)}">${t.loudness.truePeakDBTP?.toFixed(1) ?? '—'} dBTP</span>
          </div>
          <div class="simple-metric">
            <span class="simple-metric-label">Dynamic Range</span>
            <span class="simple-metric-value ${drStatus(t.dynamics.dynamicRangeDB)}">${t.dynamics.dynamicRangeDB?.toFixed(1) ?? '—'} dB</span>
          </div>
          <div class="simple-metric">
            <span class="simple-metric-label">Stereo Corr.</span>
            <span class="simple-metric-value ${corrStatus(t.stereo.correlationMean)}">${t.stereo.correlationMean?.toFixed(2) ?? '—'}</span>
          </div>
          <div class="simple-metric">
            <span class="simple-metric-label">Harshness</span>
            <span class="simple-metric-value ${harshStatus(t.spectral.harshnessIndex)}">${t.spectral.harshnessIndex?.toFixed(0) ?? '—'}%</span>
          </div>
          <div class="simple-metric">
            <span class="simple-metric-label">Artifacts</span>
            <span class="simple-metric-value ${artifactStatus(t.aiArtifacts.overallAIScore)}">${t.aiArtifacts.overallAIScore?.toFixed(0) ?? 0}/100</span>
          </div>
        </div>

        ${t.issues.length || t.warnings.length ? html`
          <div class="issues-wrap" style="margin-top: 0;">
            ${t.issues.map(i => html`<div class="alert alert-danger">${i}</div>`)}
            ${t.warnings.map(w => html`<div class="alert alert-warning">${w}</div>`)}
          </div>
        ` : null}
      </div>
    `;
  }

  private renderPlatformCard(platform: import("../core/types").PlatformNormalization | null): TemplateResult {
    if (!platform) return html``;

    const gainClass = platform.gainChangeDB > 0 ? "positive" :
                     platform.gainChangeDB < -6 ? "severe" : "negative";
    const hasRisk = platform.riskFlags && platform.riskFlags.length > 0;

    return html`
      <div class="platform-card">
        <div class="platform-name">${platform.platform}</div>
        <div class="platform-gain ${gainClass}">
          ${platform.gainChangeDB > 0 ? '+' : ''}${platform.gainChangeDB.toFixed(1)} dB
        </div>
        <div class="platform-tp">→ ${platform.projectedTruePeakDBTP.toFixed(1)} dBTP</div>
        ${hasRisk ? html`<div class="platform-risk">⚠</div>` : null}
      </div>
    `;
  }
}

if (!customElements.get("album-analyzer-app")) {
  customElements.define("album-analyzer-app", AlbumAnalyzerApp);
}
