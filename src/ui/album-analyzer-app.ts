import { LitElement, css, html, TemplateResult } from "lit";
import type { AlbumAnalysis, TrackAnalysis } from "../core/types";

// Standard Vite worker import - works fine once CSP allows 'unsafe-eval'
type WorkerMsg =
  | { type: "progress"; current: number; total: number; filename: string }
  | { type: "result"; album: AlbumAnalysis }
  | { type: "error"; message: string };

export class AlbumAnalyzerApp extends LitElement {
  static styles = css`
    :host { display: block; font-family: ui-sans-serif, system-ui, sans-serif; background: #09090b; color: #fafafa; min-height: 100vh; line-height: 1.5; }
    .container { max-width: 1200px; margin: 0 auto; padding: 24px; }
    .card { background: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 20px; margin-bottom: 16px; }
    button { background: #3b82f6; color: white; border: 0; border-radius: 10px; padding: 10px 18px; cursor: pointer; font-weight: 500; transition: background 0.2s; }
    button:hover:not(:disabled) { background: #2563eb; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .drop { border: 2px dashed #3b82f6; border-radius: 16px; padding: 32px; text-align: center; transition: border-color 0.2s; }
    .drop:hover { border-color: #60a5fa; }
    .row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
    .muted { color: #a1a1aa; }
    h1 { margin: 0 0 8px 0; font-size: 1.75rem; }
    h2 { margin: 0 0 12px 0; font-size: 1.25rem; }
    h3 { margin: 16px 0 12px 0; font-size: 1rem; color: #d4d4d8; }
    h4 { margin: 12px 0 8px 0; font-size: 0.875rem; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.05em; }
    .score-ring { width: 120px; height: 120px; border-radius: 50%; background: conic-gradient(#10b981 0deg, #10b981 calc(var(--score) * 36deg), #27272a calc(var(--score) * 36deg)); display: flex; align-items: center; justify-content: center; position: relative; }
    .score-ring::before { content: ''; width: 90px; height: 90px; background: #18181b; border-radius: 50%; position: absolute; }
    .score-value { position: relative; z-index: 1; text-align: center; }
    .score-number { font-size: 1.75rem; font-weight: 700; }
    .score-label { font-size: 0.75rem; color: #a1a1aa; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 500; }
    .ok { background: #065f46; color: #10b981; }
    .warn { background: #78350f; color: #f59e0b; }
    .bad { background: #7f1d1d; color: #ef4444; }
    .track { margin-top: 12px; padding: 16px; border-radius: 12px; background: #1c1c1f; border: 1px solid #27272a; }
    .track-header { cursor: pointer; }
    .track-content { margin-top: 16px; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
    .metric-section { background: #141416; border-radius: 10px; padding: 14px; }
    .metric-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #27272a; font-size: 0.875rem; }
    .metric-row:last-child { border-bottom: none; }
    .metric-label { color: #a1a1aa; }
    .metric-value { font-weight: 500; }
    .metric-value.good { color: #10b981; }
    .metric-value.warning { color: #f59e0b; }
    .metric-value.danger { color: #ef4444; }
    .meter-container { margin: 10px 0; }
    .meter-header { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.8rem; }
    .meter-label { color: #d4d4d8; cursor: help; border-bottom: 1px dotted #52525b; }
    .meter-value { font-weight: 600; }
    .meter { height: 10px; background: #27272a; border-radius: 5px; position: relative; overflow: hidden; }
    .meter-zones { display: flex; height: 100%; }
    .meter-zone { height: 100%; }
    .meter-zone.danger-low { background: linear-gradient(90deg, #7f1d1d, #991b1b); }
    .meter-zone.warning-low { background: linear-gradient(90deg, #78350f, #92400e); }
    .meter-zone.optimal { background: linear-gradient(90deg, #065f46, #047857); }
    .meter-zone.warning-high { background: linear-gradient(90deg, #92400e, #78350f); }
    .meter-zone.danger-high { background: linear-gradient(90deg, #991b1b, #7f1d1d); }
    .meter-marker { position: absolute; top: -4px; width: 4px; height: 18px; background: #fff; border-radius: 2px; transform: translateX(-50%); box-shadow: 0 0 4px rgba(0,0,0,0.5); }
    .meter-range { display: flex; justify-content: space-between; font-size: 0.65rem; color: #71717a; margin-top: 3px; }
    [data-tooltip] { position: relative; }
    [data-tooltip]::after { content: attr(data-tooltip); position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); background: #000; color: #fff; padding: 6px 10px; border-radius: 6px; font-size: 0.7rem; max-width: 220px; white-space: normal; text-align: left; opacity: 0; visibility: hidden; transition: opacity 0.15s; z-index: 100; pointer-events: none; }
    [data-tooltip]:hover::after { opacity: 1; visibility: visible; }
    .alert { display: flex; gap: 8px; padding: 10px; border-radius: 8px; margin-top: 8px; font-size: 0.875rem; }
    .alert-danger { background: #450a0a; border: 1px solid #7f1d1d; color: #fca5a5; }
    .alert-warning { background: #451a03; border: 1px solid #78350f; color: #fcd34d; }
    pre { white-space: pre-wrap; word-break: break-word; background: #0b0b10; padding: 12px; border-radius: 12px; border: 1px solid #27272a; font-size: 0.75rem; max-height: 400px; overflow: auto; }
    .collapsible { overflow: hidden; transition: max-height 0.3s ease-out; }
    .collapsed { max-height: 0 !important; }
    .expand-icon { transition: transform 0.2s; }
    .expanded .expand-icon { transform: rotate(180deg); }
  `;

  static properties = {
    busy: { state: true },
    status: { state: true },
    progress: { state: true },
    album: { state: true },
    error: { state: true },
    expandedTracks: { state: true },
  };

  private busy = false;
  private status = "Drop audio files to analyze. Processing runs locally.";
  private progress: { current: number; total: number; filename: string } | null = null;
  private album: AlbumAnalysis | null = null;
  private error: string | null = null;
  private expandedTracks: Set<number> = new Set();
  private worker: Worker | null = null;
  private lightDomInput: HTMLInputElement | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.worker) return;

    // Light DOM Input for Safari/Firefox reliability
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
        this.error = `Worker failed to load (likely CSP blocked). Check console.`;
        this.busy = false;
        this.status = "Error.";
      };

      this.worker.onmessage = (ev: MessageEvent<WorkerMsg>) => {
        const msg = ev.data;
        if (msg.type === "progress") {
          this.progress = { current: msg.current, total: msg.total, filename: msg.filename };
          this.status = `Analyzing ${msg.filename} (${msg.current}/${msg.total})`;
        } else if (msg.type === "result") {
          this.album = msg.album;
          this.busy = false;
          this.progress = null;
          this.status = "Analysis complete.";
          this.expandedTracks = msg.album.tracks.length > 0 ? new Set([1]) : new Set();
        } else if (msg.type === "error") {
          this.error = msg.message;
          this.busy = false;
          this.progress = null;
          this.status = "Error.";
        }
      };
    } catch (e) {
      this.error = `Failed to create worker: ${e}`;
      this.status = "Error.";
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
    if (this.lightDomInput) {
      this.lightDomInput.click();
    } else {
      const input = document.getElementById('auralgeek-file-input');
      if (input) (input as HTMLElement).click();
    }
  }

  private async onDrop(ev: DragEvent) {
    ev.preventDefault();
    if (this.busy) return;
    const dt = ev.dataTransfer;
    if (!dt) return;
    const files = Array.from(dt.files);
    await this.runAnalysis(files);
  }

  private async runAnalysis(files: File[]) {
    this.error = null;
    this.album = null;
    this.expandedTracks = new Set();

    const audio = files.filter((f) => {
      const extMatch = /\.(wav|flac|aiff|aif|mp3|m4a|aac|ogg)$/i.test(f.name);
      const mimeMatch = f.type.startsWith("audio/");
      return extMatch || mimeMatch;
    }).sort((a, b) => a.name.localeCompare(b.name));

    if (!audio.length) {
      this.status = "No supported audio files found.";
      return;
    }

    if (!this.worker) {
      this.status = "Worker not initialized.";
      this.error = "Internal error: analysis worker not available.";
      this.busy = false;
      return;
    }

    const albumName = "Album";
    this.busy = true;
    this.status = `Starting analysis (${audio.length} tracks)...`;
    
    try {
      this.worker.postMessage({ type: "analyze", albumName, files: audio });
    } catch (e) {
      this.error = `Worker communication failed: ${e}`;
      this.busy = false;
      this.status = "Error.";
    }
  }

  private exportJSON() {
    if (!this.album) return;
    const blob = new Blob([JSON.stringify(this.album, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "album-analysis.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  private toggleTrack(trackNumber: number) {
    const newSet = new Set(this.expandedTracks);
    if (newSet.has(trackNumber)) newSet.delete(trackNumber);
    else newSet.add(trackNumber);
    this.expandedTracks = newSet;
  }

  private clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
  }

  private renderMeter(
    label: string,
    tooltip: string,
    value: number | null,
    unit: string,
    zones: { width: number; type: string }[],
    valueToPos: (v: number) => number,
    rangeLabels: string[]
  ): TemplateResult {
    const displayValue = value !== null ? value.toFixed(1) : "—";
    const pos = value !== null ? this.clamp(valueToPos(value), 0, 100) : 50;
    return html`
      <div class="meter-container">
        <div class="meter-header"><span class="meter-label" data-tooltip="${tooltip}">${label}</span><span class="meter-value">${displayValue} ${unit}</span></div>
        <div class="meter">
          <div class="meter-zones">${zones.map(z => html`<div class="meter-zone ${z.type}" style="width:${z.width}%"></div>`)}</div>
          ${value !== null ? html`<div class="meter-marker" style="left:${pos}%"></div>` : null}
        </div>
        <div class="meter-range">${rangeLabels.map(l => html`<span>${l}</span>`)}</div>
      </div>
    `;
  }

  override render() {
    return html`
      <div class="container">
        <div class="card">
          <h1>Auralgeek</h1>
          <p class="muted" style="margin-bottom:16px">${this.status}</p>
          <div class="row" style="margin-bottom:16px">
            <button ?disabled=${this.busy} @click=${this.onPickFiles}>Choose Files</button>
            <button ?disabled=${!this.album} @click=${this.exportJSON}>Export JSON</button>
          </div>
          <div class="drop" @dragover=${(e: DragEvent) => e.preventDefault()} @drop=${this.onDrop}>
            Drag and drop audio files here
            ${this.progress ? html`<div class="muted" style="margin-top:12px">${this.progress.filename} (${this.progress.current}/${this.progress.total})</div>` : null}
          </div>
          ${this.error ? html`<div class="alert alert-danger" style="margin-top:12px">${this.error}</div>` : null}
        </div>
        ${this.album ? this.renderReport(this.album) : null}
      </div>
    `;
  }

  private renderReport(album: AlbumAnalysis) {
    const scorePercent = album.overallScore;
    return html`
      <div class="card">
        <div class="row" style="gap:24px;align-items:flex-start">
          <div class="score-ring" style="--score:${scorePercent}">
            <div class="score-value"><div class="score-number">${album.overallScore.toFixed(1)}</div><div class="score-label">/ 10</div></div>
          </div>
          <div style="flex:1">
            <h2>${album.albumName}</h2>
            <div class="row muted" style="margin-bottom:12px"><span>${album.totalTracks} tracks</span><span>${album.totalDuration}</span><span>${album.totalSizeMB.toFixed(1)} MB</span></div>
            <span class="badge ${album.distributionReady ? "ok" : "warn"}">${album.distributionReady ? "Distribution Ready" : "Needs Attention"}</span>
          </div>
        </div>
        <div style="margin-top:20px;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">
          ${this.renderMeter("Average Loudness", "Integrated loudness in LUFS per EBU R128. Target: -14 for Spotify, -16 for Apple Music.", album.summary.avgLUFS ?? null, "LUFS", [{width:15,type:"danger-low"},{width:15,type:"warning-low"},{width:25,type:"optimal"},{width:25,type:"warning-high"},{width:20,type:"danger-high"}], (v) => ((v + 24) / 20) * 100, ["-24", "-18", "-14", "-9", "-4"])}
          ${this.renderMeter("Max True Peak", "Highest inter-sample peak. Must stay below -1 dBTP to prevent clipping on playback.", album.summary.maxTruePeak ?? null, "dBTP", [{width:60,type:"optimal"},{width:20,type:"warning-high"},{width:20,type:"danger-high"}], (v) => ((v + 12) / 12) * 100, ["-12", "-6", "-3", "-1", "0"])}
        </div>
      </div>
      <div class="card"><h3 style="margin-top:0">Track Analysis</h3>${album.tracks.map((t) => this.renderTrackCard(t))}</div>
      <div class="card"><h3 style="margin-top:0">Raw JSON Data</h3><pre>${JSON.stringify(album, null, 2)}</pre></div>
    `;
  }

  private renderTrackCard(t: TrackAnalysis) {
    const isExpanded = this.expandedTracks.has(t.trackNumber);
    const statusClass = t.distributionReady ? "ok" : t.issues.length ? "bad" : "warn";
    return html`
      <div class="track ${isExpanded ? "expanded" : ""}">
        <div class="track-header row" @click=${() => this.toggleTrack(t.trackNumber)}>
          <div style="flex:1"><b>${t.trackNumber}. ${t.parameters.filename}</b><div class="muted" style="font-size:0.8rem">${t.parameters.durationFormatted} · ${t.parameters.sampleRate ?? "—"} Hz · ${t.parameters.channels ?? "—"}ch · ${t.parameters.bitDepth ?? "—"}-bit</div></div>
          <span class="badge ${statusClass}">${t.distributionReady ? "Ready" : "Check"}</span><span class="badge" style="background:#27272a;font-size:0.75rem">${t.loudness.integratedLUFS?.toFixed(1) ?? "—"} LUFS</span><span class="expand-icon">▼</span>
        </div>
        <div class="collapsible ${isExpanded ? "" : "collapsed"}" style="max-height:2000px">
          <div class="track-content">
            <div class="metric-section"><h4>Loudness</h4>
              ${this.renderMeter("Integrated", "Perceived loudness...", t.loudness.integratedLUFS, "LUFS", [{width:15,type:"danger-low"},{width:15,type:"warning-low"},{width:25,type:"optimal"},{width:25,type:"warning-high"},{width:20,type:"danger-high"}], (v) => ((v+24)/20)*100, ["-24", "-18", "-14", "-9", "-4"])}
              ${this.renderMeter("True Peak", "Max inter-sample peak...", t.loudness.truePeakDBTP, "dBTP", [{width:60,type:"optimal"},{width:20,type:"warning-high"},{width:20,type:"danger-high"}], (v) => ((v+12)/12)*100, ["-12", "-6", "-3", "-1", "0"])}
            </div>
            <div class="metric-section"><h4>Dynamics</h4>
              ${this.renderMeter("Dynamic Range", "Difference...", t.dynamics.dynamicRangeDB, "dB", [{width:20,type:"danger-low"},{width:30,type:"warning-low"},{width:30,type:"optimal"},{width:20,type:"warning-high"}], (v) => (v/40)*100, ["0", "10", "20", "30", "40"])}
              <div class="metric-row"><span class="metric-label">RMS Level</span><span class="metric-value">${t.dynamics.rmsDBFS?.toFixed(1) ?? "—"} dBFS</span></div>
              <div class="metric-row"><span class="metric-label">Peak Level</span><span class="metric-value">${t.dynamics.peakDBFS?.toFixed(1) ?? "—"} dBFS</span></div>
              <div class="metric-row"><span class="metric-label">Crest Factor</span><span class="metric-value">${t.dynamics.crestFactorDB?.toFixed(1) ?? "—"} dB</span></div>
              <div class="metric-row"><span class="metric-label">DC Offset</span><span class="metric-value ${Math.abs(t.dynamics.dcOffset ?? 0) > 0.001 ? "warning" : "good"}">${t.dynamics.dcOffset?.toFixed(6) ?? "—"}</span></div>
              <div class="metric-row"><span class="metric-label">Clipping</span><span class="metric-value ${t.dynamics.hasClipping ? "danger" : "good"}">${t.dynamics.hasClipping ? "Detected" : "None"}</span></div>
            </div>
            <div class="metric-section"><h4>Stereo Field</h4>
              ${this.renderMeter("Stereo Width", "Ratio of side to mid...", t.stereo.stereoWidthPct, "%", [{width:33,type:"warning-low"},{width:34,type:"optimal"},{width:33,type:"warning-high"}], (v) => (v/150)*100, ["0%", "50%", "100%", "150%"])}
              <div class="metric-row"><span class="metric-label">Mid Energy</span><span class="metric-value">${t.stereo.midEnergyDB?.toFixed(1) ?? "—"} dB</span></div>
              <div class="metric-row"><span class="metric-label">Side Energy</span><span class="metric-value">${t.stereo.sideEnergyDB?.toFixed(1) ?? "—"} dB</span></div>
              <div class="metric-row"><span class="metric-label">Correlation</span><span class="metric-value">${t.stereo.correlation?.toFixed(2) ?? "—"}</span></div>
              <div class="metric-row"><span class="metric-label">Sub-bass Mono</span><span class="metric-value ${t.stereo.subBassMonoCompatible === false ? "warning" : "good"}">${t.stereo.subBassMonoCompatible === null ? "—" : t.stereo.subBassMonoCompatible ? "Compatible" : "Phase Issues"}</span></div>
            </div>
            <div class="metric-section"><h4>Frequency Spectrum</h4>
              <div class="metric-row"><span class="metric-label">Spectral Centroid</span><span class="metric-value">${t.spectral.spectralCentroidHz?.toFixed(0) ?? "—"} Hz</span></div>
              <div class="metric-row"><span class="metric-label">Spectral Rolloff</span><span class="metric-value">${t.spectral.spectralRolloffHz?.toFixed(0) ?? "—"} Hz</span></div>
              <div class="metric-row"><span class="metric-label">Sub-bass (20-80Hz)</span><span class="metric-value">${t.spectral.subBassEnergy20_80DB?.toFixed(1) ?? "—"} dB</span></div>
              <div class="metric-row"><span class="metric-label">Sibilance (4-10kHz)</span><span class="metric-value">${t.spectral.sibilanceEnergy4k10kDB?.toFixed(1) ?? "—"} dB</span></div>
              <div class="metric-row"><span class="metric-label">HF (8-16kHz)</span><span class="metric-value ${(t.spectral.highFreqEnergy8k16kDB ?? -100) > -25 ? "warning" : ""}">${t.spectral.highFreqEnergy8k16kDB?.toFixed(1) ?? "—"} dB</span></div>
            </div>
            <div class="metric-section"><h4>Artifact Detection</h4>
              ${this.renderMeter("Artifact Score", "Combined score...", t.aiArtifacts.overallAIScore, "/100", [{width:30,type:"optimal"},{width:30,type:"warning-high"},{width:40,type:"danger-high"}], (v) => v, ["0", "25", "50", "75", "100"])}
              <div class="metric-row"><span class="metric-label">Shimmer Detected</span><span class="metric-value ${t.aiArtifacts.shimmerDetected ? "warning" : "good"}">${t.aiArtifacts.shimmerDetected ? "Yes" : "No"}</span></div>
              <div class="metric-row"><span class="metric-label">Shimmer Score</span><span class="metric-value">${t.aiArtifacts.shimmerScore?.toFixed(0) ?? "—"}</span></div>
            </div>
          </div>
          ${t.issues.length || t.warnings.length ? html`<div style="margin-top:16px">${t.issues.map(i => html`<div class="alert alert-danger">${i}</div>`)}${t.warnings.map(w => html`<div class="alert alert-warning">${w}</div>`)}</div>` : null}
        </div>
      </div>
    `;
  }
}

if (!customElements.get("album-analyzer-app")) {
  customElements.define("album-analyzer-app", AlbumAnalyzerApp);
}
