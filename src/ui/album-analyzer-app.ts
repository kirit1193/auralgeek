/**
 * Album Analyzer App - Main Component
 * LitElement web component for audio analysis
 */

import { LitElement, html } from "lit";
import type { AlbumAnalysis } from "../core/types";
import { decodeToPCM } from "../analysis/decode";
import { appStyles } from "./styles";
import { renderReport, type AlbumReportContext } from "./renderers/index.js";
import { ThemeManager, type Theme } from "./theme.js";
import "./components/help-modal.js";

type WorkerMsg =
  | { type: "progress"; current: number; total: number; filename: string; stage?: string; stageProgress?: number }
  | { type: "result"; album: AlbumAnalysis }
  | { type: "error"; message: string }
  | { type: "spectrogram"; trackNumber: number; bitmap: ImageBitmap };

export class AlbumAnalyzerApp extends LitElement {
  static styles = appStyles;

  static properties = {
    busy: { state: true },
    status: { state: true },
    progress: { state: true },
    album: { state: true },
    error: { state: true },
    expandedTracks: { state: true },
    jsonVisible: { state: true },
    viewMode: { state: true },
    spectrograms: { state: true },
    currentTheme: { state: true },
    helpModalOpen: { state: true },
    toastMessage: { state: true },
  };

  // Reactive state properties (use declare to avoid class field issues with Lit 3.x)
  declare private busy: boolean;
  declare private status: string;
  declare private progress: { current: number; total: number; filename: string; stage?: string; stageProgress?: number } | null;
  declare private album: AlbumAnalysis | null;
  declare private error: string | null;
  declare private expandedTracks: Set<number>;
  declare private jsonVisible: boolean;
  declare private viewMode: 'simple' | 'advanced';
  declare private spectrograms: Map<number, ImageBitmap>;
  declare private currentTheme: Theme;
  declare private helpModalOpen: boolean;
  declare private toastMessage: string | null;

  // Non-reactive private fields
  private worker: Worker | null = null;
  private lightDomInput: HTMLInputElement | null = null;
  private _boundKeyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor() {
    super();
    this.busy = false;
    this.status = "Ready";
    this.progress = null;
    this.album = null;
    this.error = null;
    this.expandedTracks = new Set();
    this.jsonVisible = false;
    this.viewMode = 'simple';
    this.spectrograms = new Map();
    this.currentTheme = 'dark';
    this.helpModalOpen = false;
    this.toastMessage = null;
  }

  // Store unsubscribe function for theme changes
  private _themeUnsubscribe: (() => void) | null = null;

  override connectedCallback(): void {
    super.connectedCallback();

    // Initialize theme system
    ThemeManager.init();
    this.currentTheme = ThemeManager.current;
    this._applyTheme();
    this._themeUnsubscribe = ThemeManager.subscribe((theme) => {
      this.currentTheme = theme;
      this._applyTheme();
      this.requestUpdate();
    });

    // Setup keyboard shortcuts
    this._boundKeyHandler = this._handleKeyboard.bind(this);
    document.addEventListener('keydown', this._boundKeyHandler);

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
        } else if (msg.type === "spectrogram") {
          this.spectrograms.set(msg.trackNumber, msg.bitmap);
          this.spectrograms = new Map(this.spectrograms); // Trigger reactivity
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
    if (this._themeUnsubscribe) {
      this._themeUnsubscribe();
      this._themeUnsubscribe = null;
    }
    if (this._boundKeyHandler) {
      document.removeEventListener('keydown', this._boundKeyHandler);
      this._boundKeyHandler = null;
    }
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    if (this.lightDomInput && this.lightDomInput.parentNode) {
      this.lightDomInput.parentNode.removeChild(this.lightDomInput);
      this.lightDomInput = null;
    }
  }

  private _handleKeyboard(e: KeyboardEvent): void {
    // Ignore if typing in an input field
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    switch (e.key) {
      case '?':
        e.preventDefault();
        this._openHelpModal();
        break;
      case 't':
      case 'T':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          this._toggleTheme();
        }
        break;
      case 'Escape':
        if (this.helpModalOpen) {
          this._closeHelpModal();
        } else if (this.album) {
          this._resetAnalysis();
        }
        break;
    }
  }

  private _resetAnalysis(): void {
    this.album = null;
    this.error = null;
    this.expandedTracks = new Set();
    this.jsonVisible = false;
    this.spectrograms = new Map();
    this.status = "Ready";
    this.requestUpdate();
  }

  private _onBrandClick(): void {
    if (this.album || this.error) {
      this._resetAnalysis();
    } else {
      window.location.reload();
    }
  }

  private _showToast(message: string): void {
    this.toastMessage = message;
    this.requestUpdate();
    setTimeout(() => {
      this.toastMessage = null;
      this.requestUpdate();
    }, 2000);
  }

  private _applyTheme(): void {
    this.setAttribute('data-theme', this.currentTheme);
  }

  private _toggleTheme(): void {
    ThemeManager.toggle();
  }

  private _openHelpModal(): void {
    this.helpModalOpen = true;
    this.requestUpdate();
  }

  private _closeHelpModal(): void {
    this.helpModalOpen = false;
    this.requestUpdate();
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
    this.spectrograms = new Map();

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
        {
          type: "analyze",
          albumName: "Album",
          tracks: decodedTracks,
          generateSpectrograms: true,
          spectrogramConfig: { width: 400, height: 80 }
        },
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

    // Generate key findings from analysis
    const keyFindings: string[] = [];
    const recommendations: string[] = [];

    // Loudness findings
    if (this.album.summary.avgLUFS !== undefined) {
      const avgLUFS = this.album.summary.avgLUFS;
      if (avgLUFS > -10) {
        keyFindings.push(`Album is very loud (avg ${avgLUFS.toFixed(1)} LUFS)`);
        recommendations.push("Consider reducing loudness for better streaming platform performance");
      } else if (avgLUFS < -16) {
        keyFindings.push(`Album is relatively quiet (avg ${avgLUFS.toFixed(1)} LUFS)`);
        recommendations.push("May be normalized up on streaming platforms, which is generally fine");
      } else {
        keyFindings.push(`Album loudness is in optimal range (avg ${avgLUFS.toFixed(1)} LUFS)`);
      }
    }

    // Peak findings
    if (this.album.summary.tracksAboveNeg1dBTP && this.album.summary.tracksAboveNeg1dBTP > 0) {
      keyFindings.push(`${this.album.summary.tracksAboveNeg1dBTP} track(s) exceed -1 dBTP true peak`);
      recommendations.push("Consider reducing peaks to below -1 dBTP for codec safety margin");
    }

    // Clipping findings
    if (this.album.summary.tracksWithClipping && this.album.summary.tracksWithClipping > 0) {
      keyFindings.push(`${this.album.summary.tracksWithClipping} track(s) contain clipping`);
      recommendations.push("Review clipped tracks and consider re-mastering");
    }

    // Dynamics findings
    if (this.album.summary.avgDynamicRange !== undefined && this.album.summary.avgDynamicRange < 6) {
      keyFindings.push("Limited dynamic range detected");
      recommendations.push("Consider preserving more dynamics for improved listening experience");
    }

    // Phase issues
    if (this.album.summary.tracksWithPhaseIssues && this.album.summary.tracksWithPhaseIssues > 0) {
      keyFindings.push(`${this.album.summary.tracksWithPhaseIssues} track(s) have phase issues`);
      recommendations.push("Check mono compatibility and low-end phase alignment");
    }

    // Track overview for quick reference
    const trackOverview = this.album.tracks.map(t => ({
      number: t.trackNumber,
      name: t.parameters.filename,
      duration: t.parameters.durationFormatted,
      integratedLUFS: t.loudness.integratedLUFS,
      truePeakDBTP: t.loudness.truePeakDBTP,
      dynamicRangeDB: t.dynamics.dynamicRangeDB,
      issues: t.issues.length,
      warnings: t.warnings.length
    }));

    // Enhanced export structure
    const exportReport = {
      version: "1.0",
      exportDate: new Date().toISOString(),
      summary: {
        albumName: this.album.albumName,
        totalTracks: this.album.totalTracks,
        totalDuration: this.album.totalDuration,
        overallScore: this.album.overallScore,
        distributionReady: this.album.distributionReady,
        keyFindings,
        recommendations
      },
      trackOverview,
      analysis: this.album
    };

    const blob = new Blob([JSON.stringify(exportReport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auralgeek-${this.album.albumName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-analysis.json`;
    a.click();
    URL.revokeObjectURL(url);
    this._showToast("Analysis exported");
  }

  private copyJSONToClipboard() {
    if (!this.album) return;
    navigator.clipboard.writeText(JSON.stringify(this.album, null, 2));
    this._showToast("Copied to clipboard");
  }

  private toggleTrack(trackNumber: number) {
    const newSet = new Set(this.expandedTracks);
    if (newSet.has(trackNumber)) newSet.delete(trackNumber);
    else newSet.add(trackNumber);
    this.expandedTracks = newSet;
    this.requestUpdate();
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
          <div class="header-controls">
            <button class="header-icon-btn" @click=${this._openHelpModal} title="Metric Reference (Press ?)" aria-label="Open metric reference">?</button>
            <button class="header-icon-btn" @click=${this._toggleTheme} title="Toggle theme (Press T)" aria-label="Toggle dark/light theme">
              ${this.currentTheme === 'dark' ? '☀' : '☾'}
            </button>
          </div>
          <div class="brand-row" @click=${this._onBrandClick} role="button" tabindex="0" aria-label="Reset analysis" @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this._onBrandClick()}>
            <svg class="logo-icon" viewBox="0 0 32 32" width="36" height="36">
              <defs>
                <linearGradient id="headerWaveGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stop-color="#22c55e"/>
                  <stop offset="60%" stop-color="#22c55e"/>
                  <stop offset="80%" stop-color="#eab308"/>
                  <stop offset="100%" stop-color="#ef4444"/>
                </linearGradient>
                <linearGradient id="headerBandGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#f0a854"/>
                  <stop offset="50%" stop-color="#e8973c"/>
                  <stop offset="100%" stop-color="#c77a2e"/>
                </linearGradient>
                <linearGradient id="headerCupGradL" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#e8973c"/>
                  <stop offset="100%" stop-color="#b8722a"/>
                </linearGradient>
                <linearGradient id="headerCupGradR" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#e8973c"/>
                  <stop offset="100%" stop-color="#b8722a"/>
                </linearGradient>
              </defs>
              <path d="M 4 17 C 4 8, 8 3, 16 3 C 24 3, 28 8, 28 17" fill="none" stroke="url(#headerBandGrad)" stroke-width="2.5" stroke-linecap="round"/>
              <g transform="rotate(8, 4, 19)">
                <rect x="0.5" y="13" width="7" height="12" rx="1.5" fill="url(#headerCupGradL)" stroke="#c77a2e" stroke-width="0.5"/>
                <rect x="1.5" y="14.2" width="5" height="9.6" rx="1" fill="#1a1a1a"/>
              </g>
              <g transform="rotate(-8, 28, 19)">
                <rect x="24.5" y="13" width="7" height="12" rx="1.5" fill="url(#headerCupGradR)" stroke="#c77a2e" stroke-width="0.5"/>
                <rect x="25.5" y="14.2" width="5" height="9.6" rx="1" fill="#1a1a1a"/>
              </g>
              <rect x="15" y="13" width="2" height="12" rx="1" fill="url(#headerWaveGrad)"/>
              <rect x="11.5" y="15" width="2" height="8" rx="1" fill="url(#headerWaveGrad)"/>
              <rect x="18.5" y="15" width="2" height="8" rx="1" fill="url(#headerWaveGrad)"/>
            </svg>
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
            <button class="btn btn-secondary" ?disabled=${!this.album} @click=${this.copyJSONToClipboard} title="Copy analysis JSON to clipboard">
              Copy
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

        ${this.album ? this.renderAlbumReport(this.album) : null}

        <footer class="app-footer">
          <div class="footer-content">
            <span class="footer-text">Built with</span>
            <a href="https://lit.dev" target="_blank" rel="noopener">Lit</a>
            <span class="footer-sep">·</span>
            <a href="https://github.com/jiixyj/libebur128" target="_blank" rel="noopener">libebur128</a>
            <span class="footer-sep">·</span>
            <a href="https://mediainfo.js.org" target="_blank" rel="noopener">MediaInfo.js</a>
          </div>
        </footer>
      </div>

      <help-modal
        ?open=${this.helpModalOpen}
        @close=${this._closeHelpModal}
      ></help-modal>

      ${this.toastMessage ? html`
        <div class="toast">${this.toastMessage}</div>
      ` : null}
    `;
  }

  private renderAlbumReport(album: AlbumAnalysis) {
    const ctx: AlbumReportContext = {
      viewMode: this.viewMode,
      expandedTracks: this.expandedTracks,
      jsonVisible: this.jsonVisible,
      spectrograms: this.spectrograms,
      onToggleTrack: (trackNumber: number) => this.toggleTrack(trackNumber),
      onToggleJson: () => { this.jsonVisible = !this.jsonVisible; this.requestUpdate(); },
      onViewModeChange: (mode: 'simple' | 'advanced') => { this.viewMode = mode; this.requestUpdate(); }
    };
    return renderReport(album, ctx);
  }
}

if (!customElements.get("album-analyzer-app")) {
  customElements.define("album-analyzer-app", AlbumAnalyzerApp);
}
