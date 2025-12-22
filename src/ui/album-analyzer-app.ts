import { LitElement, css, html, TemplateResult } from "lit";
import type { AlbumAnalysis, TrackAnalysis } from "../core/types";
import { decodeToPCM } from "../analysis/decode";

type WorkerMsg =
  | { type: "progress"; current: number; total: number; filename: string }
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

    /* === ALERTS === */
    .alert {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 14px;
      border-radius: 6px;
      margin-top: 12px;
      font-size: 0.8rem;
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
      max-height: 3000px;
    }

    .track-content-inner {
      padding: 4px 14px 16px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 12px;
    }

    @media (max-width: 600px) {
      .track-content-inner {
        grid-template-columns: 1fr;
      }
    }

    /* === METRIC MODULES === */
    .metric-module {
      background: var(--bg-inset);
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      padding: 14px;
    }

    .module-title {
      font-family: 'Geist Mono', monospace;
      font-size: 0.6rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-dim);
      margin: 0 0 12px 0;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .module-icon {
      font-size: 0.75rem;
      opacity: 0.7;
    }

    /* === METERS === */
    .meter-wrap {
      margin-bottom: 12px;
    }

    .meter-wrap:last-child {
      margin-bottom: 0;
    }

    .meter-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }

    .meter-label-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .meter-label {
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    /* === INFO TOOLTIP === */
    .info-wrap {
      position: relative;
      display: inline-flex;
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
      left: 50%;
      bottom: calc(100% + 8px);
      transform: translateX(-50%);
      width: 240px;
      padding: 10px 12px;
      background: var(--bg-panel);
      border: 1px solid var(--border-panel);
      border-radius: 6px;
      font-size: 0.75rem;
      color: var(--text-secondary);
      line-height: 1.5;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition: opacity 0.2s, visibility 0.2s;
      z-index: 1000;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    }

    .info-tooltip::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 6px solid transparent;
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
      font-size: 0.8rem;
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
      top: -2px;
      width: 3px;
      height: 12px;
      background: #fff;
      border-radius: 1px;
      transform: translateX(-50%);
      box-shadow: 0 0 6px rgba(255,255,255,0.8);
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
      gap: 4px;
      padding: 8px 0;
      border-bottom: 1px solid var(--border-subtle);
      font-size: 0.75rem;
    }

    .metric-row:last-child {
      border-bottom: none;
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
      top: -1px;
      width: 2px;
      height: 6px;
      background: #fff;
      border-radius: 1px;
      transform: translateX(-50%);
      box-shadow: 0 0 4px rgba(255,255,255,0.8);
      z-index: 2;
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
      margin: 12px 14px 0;
      padding-top: 12px;
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
  `;

  static properties = {
    busy: { state: true },
    status: { state: true },
    progress: { state: true },
    album: { state: true },
    error: { state: true },
    expandedTracks: { state: true },
    jsonVisible: { state: true },
  };

  private busy = false;
  private status = "Ready";
  private progress: { current: number; total: number; filename: string } | null = null;
  private album: AlbumAnalysis | null = null;
  private error: string | null = null;
  private expandedTracks: Set<number> = new Set();
  private jsonVisible = false;
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
      input.accept = 'audio/*';
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
          this.progress = { current: msg.current, total: msg.total, filename: msg.filename };
          this.status = `Analyzing ${msg.current}/${msg.total}`;
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
              <div class="progress-count">${this.progress.current} / ${this.progress.total}</div>
              <div class="progress-filename">${this.progress.filename}</div>
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
    return html`
      <div class="panel">
        <div class="summary-row">
          <div class="score-module" style="--score:${album.overallScore}">
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
            <span class="badge ${album.distributionReady ? 'badge-ok' : 'badge-warn'}">
              ${album.distributionReady ? 'Distribution Ready' : 'Needs Attention'}
            </span>
          </div>
        </div>
        <div class="summary-meters">
          ${this.renderMeter("Average Loudness", "Integrated loudness (LUFS) per EBU R128. Target: -14 LUFS for Spotify, -16 for Apple Music.", album.summary.avgLUFS ?? null, "LUFS", "loudness", (v) => ((v + 24) / 20) * 100, ["-24", "-18", "-14", "-9", "-4"])}
          ${this.renderMeter("Max True Peak", "Highest inter-sample peak. Keep below -1 dBTP to prevent clipping.", album.summary.maxTruePeak ?? null, "dBTP", "peak", (v) => ((v + 12) / 12) * 100, ["-12", "-6", "-3", "-1", "0"])}
        </div>
      </div>

      <div class="panel">
        <h3 class="panel-title">Track Analysis</h3>
        ${album.tracks.map(t => this.renderTrackCard(t))}
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

    return html`
      <div class="track-item ${isExpanded ? 'expanded' : ''}">
        <div class="track-header" @click=${() => this.toggleTrack(t.trackNumber)}>
          <span class="track-num">${String(t.trackNumber).padStart(2, '0')}</span>
          <div class="track-info">
            <div class="track-name">${t.parameters.filename}</div>
            <div class="track-meta">${t.parameters.durationFormatted} · ${t.parameters.sampleRate ?? "—"} Hz · ${t.parameters.channels ?? "—"}ch</div>
          </div>
          <div class="track-badges">
            <span class="badge ${statusClass}">${t.distributionReady ? 'OK' : 'Check'}</span>
            <span class="badge badge-neutral">${t.loudness.integratedLUFS?.toFixed(1) ?? "—"} LUFS</span>
          </div>
          <div class="expand-icon">▼</div>
        </div>

        <div class="track-content">
          <div class="track-content-inner">
            <div class="metric-module">
              <h4 class="module-title"><span class="module-icon">◐</span> Loudness</h4>
              ${this.renderMeter("Integrated", "Perceived loudness per EBU R128.", t.loudness.integratedLUFS, "LUFS", "loudness", (v) => ((v+24)/20)*100, ["-24", "-18", "-14", "-9", "-4"])}
              ${this.renderMeter("True Peak", "Maximum inter-sample peak level.", t.loudness.truePeakDBTP, "dBTP", "peak", (v) => ((v+12)/12)*100, ["-12", "-6", "-3", "-1", "0"])}
            </div>

            <div class="metric-module">
              <h4 class="module-title"><span class="module-icon">◧</span> Dynamics</h4>
              ${this.renderMeter("Dynamic Range", "Difference between loud and quiet sections.", t.dynamics.dynamicRangeDB, "dB", "dynamics", (v) => (v/40)*100, ["0", "10", "20", "30", "40"])}
              ${this.renderMetricRow("RMS Level", "Average signal energy.", `${t.dynamics.rmsDBFS?.toFixed(1) ?? "—"} dBFS`, "", { numValue: t.dynamics.rmsDBFS, type: "level", min: -60, max: 0 })}
              ${this.renderMetricRow("Peak", "Maximum sample peak.", `${t.dynamics.peakDBFS?.toFixed(1) ?? "—"} dBFS`, "", { numValue: t.dynamics.peakDBFS, type: "level", min: -60, max: 0 })}
              ${this.renderMetricRow("Crest Factor", "Peak to RMS ratio. Higher = more dynamic.", `${t.dynamics.crestFactorDB?.toFixed(1) ?? "—"} dB`, "", { numValue: t.dynamics.crestFactorDB, type: "high-good", min: 0, max: 30 })}
              ${this.renderMetricRow("DC Offset", "Should be near zero.", `${t.dynamics.dcOffset?.toFixed(6) ?? "—"}`, Math.abs(t.dynamics.dcOffset ?? 0) > 0.001 ? "warning" : "", { numValue: t.dynamics.dcOffset !== null ? Math.abs(t.dynamics.dcOffset) * 1000 : null, type: "low-good", min: 0, max: 10 })}
              ${this.renderMetricRow("Clipping", "Digital distortion detection.", t.dynamics.hasClipping ? "Detected" : "None", t.dynamics.hasClipping ? "danger" : "good", { numValue: t.dynamics.hasClipping ? 100 : 0, type: t.dynamics.hasClipping ? "bool-bad" : "bool-good", min: 0, max: 100 })}
              ${this.renderMetricRow("Silence Start", "Leading silence duration.", `${t.dynamics.silenceAtStartMs ?? 0} ms`, (t.dynamics.silenceAtStartMs ?? 0) > 500 ? "warning" : "", { numValue: t.dynamics.silenceAtStartMs, type: "low-good", min: 0, max: 2000 })}
              ${this.renderMetricRow("Silence End", "Trailing silence duration.", `${t.dynamics.silenceAtEndMs ?? 0} ms`, (t.dynamics.silenceAtEndMs ?? 0) > 2000 ? "warning" : "", { numValue: t.dynamics.silenceAtEndMs, type: "low-good", min: 0, max: 5000 })}
            </div>

            <div class="metric-module">
              <h4 class="module-title"><span class="module-icon">◑</span> Stereo Field</h4>
              ${this.renderMeter("Stereo Width", "Side/mid energy ratio. 50-80% is typical.", t.stereo.stereoWidthPct, "%", "width", (v) => (v/150)*100, ["0%", "50%", "100%", "150%"])}
              ${this.renderMetricRow("Mid Energy", "Center channel energy.", `${t.stereo.midEnergyDB?.toFixed(1) ?? "—"} dB`, "", { numValue: t.stereo.midEnergyDB, type: "level", min: -60, max: 0 })}
              ${this.renderMetricRow("Side Energy", "Stereo difference energy.", `${t.stereo.sideEnergyDB?.toFixed(1) ?? "—"} dB`, "", { numValue: t.stereo.sideEnergyDB, type: "level", min: -60, max: 0 })}
              ${this.renderMetricRow("L/R Balance", "Channel balance. 0 = centered.", `${t.stereo.balanceDB?.toFixed(2) ?? "—"} dB`, Math.abs(t.stereo.balanceDB ?? 0) > 1.5 ? "warning" : "", { numValue: t.stereo.balanceDB, type: "center", min: -6, max: 6 })}
              ${this.renderMetricRow("Correlation", "L/R correlation. 1 = mono, -1 = out of phase.", `${t.stereo.correlation?.toFixed(2) ?? "—"}`, "", { numValue: t.stereo.correlation, type: "high-good", min: -1, max: 1 })}
              ${this.renderMetricRow("Sub-bass Mono", "Low freq mono compatibility.", t.stereo.subBassMonoCompatible === null ? "—" : t.stereo.subBassMonoCompatible ? "OK" : "Phase Issues", t.stereo.subBassMonoCompatible === false ? "warning" : "good", { numValue: t.stereo.subBassMonoCompatible === null ? null : t.stereo.subBassMonoCompatible ? 100 : 0, type: t.stereo.subBassMonoCompatible ? "bool-good" : "bool-bad", min: 0, max: 100 })}
            </div>

            <div class="metric-module">
              <h4 class="module-title"><span class="module-icon">◔</span> Spectrum</h4>
              ${this.renderMetricRow("Centroid", "Brightness indicator. Higher = brighter.", `${t.spectral.spectralCentroidHz?.toFixed(0) ?? "—"} Hz`, "", { numValue: t.spectral.spectralCentroidHz, type: "center", min: 500, max: 8000 })}
              ${this.renderMetricRow("Rolloff", "85% energy frequency.", `${t.spectral.spectralRolloffHz?.toFixed(0) ?? "—"} Hz`, "", { numValue: t.spectral.spectralRolloffHz, type: "center", min: 2000, max: 16000 })}
              ${this.renderMetricRow("Sub-bass", "20-80Hz energy.", `${t.spectral.subBassEnergy20_80DB?.toFixed(1) ?? "—"} dB`, "", { numValue: t.spectral.subBassEnergy20_80DB, type: "center", min: -60, max: -10 })}
              ${this.renderMetricRow("Sibilance", "4-10kHz energy.", `${t.spectral.sibilanceEnergy4k10kDB?.toFixed(1) ?? "—"} dB`, "", { numValue: t.spectral.sibilanceEnergy4k10kDB, type: "low-good", min: -60, max: -15 })}
              ${this.renderMetricRow("High Freq", "8-16kHz energy. Watch for harshness.", `${t.spectral.highFreqEnergy8k16kDB?.toFixed(1) ?? "—"} dB`, (t.spectral.highFreqEnergy8k16kDB ?? -100) > -25 ? "warning" : "", { numValue: t.spectral.highFreqEnergy8k16kDB, type: "low-good", min: -60, max: -15 })}
            </div>

            <div class="metric-module">
              <h4 class="module-title"><span class="module-icon">◍</span> Artifacts</h4>
              ${this.renderMeter("Artifact Score", "Lower is better. Detects unnatural audio characteristics.", t.aiArtifacts.overallAIScore, "/100", "artifact", (v) => v, ["0", "25", "50", "75", "100"])}
              ${this.renderMetricRow("Shimmer", "HF shimmer detection.", t.aiArtifacts.shimmerDetected ? "Detected" : "None", t.aiArtifacts.shimmerDetected ? "warning" : "good", { numValue: t.aiArtifacts.shimmerDetected ? 100 : 0, type: t.aiArtifacts.shimmerDetected ? "bool-bad" : "bool-good", min: 0, max: 100 })}
              ${this.renderMetricRow("Shimmer Level", "Shimmer intensity. Lower is better.", `${t.aiArtifacts.shimmerScore?.toFixed(0) ?? "0"}`, "", { numValue: t.aiArtifacts.shimmerScore, type: "low-good", min: 0, max: 100 })}
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
}

if (!customElements.get("album-analyzer-app")) {
  customElements.define("album-analyzer-app", AlbumAnalyzerApp);
}
