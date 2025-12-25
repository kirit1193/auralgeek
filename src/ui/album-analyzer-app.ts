/**
 * Album Analyzer App - Main Component
 * LitElement web component for audio analysis
 */

import { LitElement, html } from "lit";
import type { AlbumAnalysis } from "../core/types";
import { decodeToPCM } from "../analysis/decode";
import { appStyles } from "./styles";
import { renderReport, type AlbumReportContext } from "./renderers/index.js";

type WorkerMsg =
  | { type: "progress"; current: number; total: number; filename: string; stage?: string; stageProgress?: number }
  | { type: "result"; album: AlbumAnalysis }
  | { type: "error"; message: string };

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
            <svg class="logo-icon" viewBox="0 0 32 32" width="36" height="36">
              <circle cx="16" cy="16" r="15" fill="#141414" stroke="#333" stroke-width="1"/>
              <path d="M 5 20 A 11 11 0 0 1 27 20" fill="none" stroke="#2a2a2a" stroke-width="3" stroke-linecap="round"/>
              <path d="M 8 18 A 9 9 0 0 1 18 8" fill="none" stroke="#e8973c" stroke-width="2.5" stroke-linecap="round"/>
              <line x1="16" y1="20" x2="11" y2="10" stroke="#e8973c" stroke-width="2" stroke-linecap="round"/>
              <circle cx="16" cy="20" r="2" fill="#e8973c"/>
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
      </div>
    `;
  }

  private renderAlbumReport(album: AlbumAnalysis) {
    const ctx: AlbumReportContext = {
      viewMode: this.viewMode,
      expandedTracks: this.expandedTracks,
      jsonVisible: this.jsonVisible,
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
