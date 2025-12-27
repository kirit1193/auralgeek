/**
 * Album Summary Renderer
 * Report view with album-level stats
 */

import { html, TemplateResult } from 'lit';
import type { AlbumAnalysis, TrackAnalysis } from '../../core/types.js';
import { renderMeter, renderInfoBtn } from './metrics.js';
import { renderTrackCard, renderSimpleTrackCard } from './trackCard.js';

export interface AlbumReportContext {
  viewMode: 'simple' | 'advanced';
  expandedTracks: Set<number>;
  jsonVisible: boolean;
  spectrograms?: Map<number, ImageBitmap>;
  onToggleTrack: (trackNumber: number) => void;
  onToggleJson: () => void;
  onViewModeChange: (mode: 'simple' | 'advanced') => void;
}

export function renderReport(album: AlbumAnalysis, ctx: AlbumReportContext): TemplateResult {
  const s = album.summary;
  return html`
    <div class="panel">
      <div class="summary-row">
        <div class="score-module ${album.overallScore >= 8 ? 'excellent' : album.overallScore >= 6 ? 'good' : 'poor'}" style="--score:${album.overallScore}" title="${album.scoreBreakdown ? `Loudness: ${album.scoreBreakdown.loudness}/10\nDynamics: ${album.scoreBreakdown.dynamics}/10\nTranslation: ${album.scoreBreakdown.translation}/10\nSpectral: ${album.scoreBreakdown.spectral}/10\nStreaming: ${album.scoreBreakdown.streaming}/10` : ''}">
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
        ${renderMeter("Average Loudness", "Integrated loudness (LUFS) per EBU R128. Target: -14 LUFS for Spotify, -16 for Apple Music.", s.avgLUFS ?? null, "LUFS", "loudness", (v) => ((v + 24) / 20) * 100, ["-24", "-19", "-14", "-9", "-4"])}
        ${renderMeter("Max True Peak", "Highest inter-sample peak. Keep below -1 dBTP to prevent clipping.", s.maxTruePeak ?? null, "dBTP", "peak", (v) => ((v + 12) / 12) * 100, ["-12", "-9", "-6", "-3", "0"])}
      </div>

      <!-- Enhanced Summary Stats -->
      <div class="summary-stats">
        <!-- Loudness Stats -->
        <div class="stat-group">
          <div class="stat-group-title"><span>◐</span> Loudness</div>
          <div class="stat-row">
            <span class="stat-label">Range ${renderInfoBtn("Min to max integrated loudness across all tracks. Smaller range = more cohesive album.")}</span>
            <span class="stat-value">${s.lufsRange ?? '—'}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Consistency ${renderInfoBtn("Standard deviation of track loudness. Under 2 LU is ideal for cohesive albums.")}</span>
            <span class="stat-value ${(s.lufsConsistency ?? 0) > 3 ? 'warning' : ''}">${s.lufsConsistency?.toFixed(1) ?? '—'} LU σ</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Avg LRA ${renderInfoBtn("Average Loudness Range per EBU Tech 3342. Higher = more dynamic. 6-12 LU typical for pop/rock.")}</span>
            <span class="stat-value">${s.avgLRA?.toFixed(1) ?? '—'} LU</span>
          </div>
        </div>

        <!-- Peaks Stats -->
        <div class="stat-group">
          <div class="stat-group-title"><span>▲</span> Peaks</div>
          <div class="stat-row">
            <span class="stat-label">Avg True Peak ${renderInfoBtn("Average inter-sample peak across tracks. Keep below -1 dBTP for streaming safety.")}</span>
            <span class="stat-value">${s.avgTruePeak?.toFixed(1) ?? '—'} dBTP</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Max True Peak ${renderInfoBtn("Highest true peak in the album. Above -1 dBTP risks clipping after codec conversion.")}</span>
            <span class="stat-value ${(s.maxTruePeak ?? -10) > -1 ? 'danger' : ''}">${s.maxTruePeak?.toFixed(1) ?? '—'} dBTP</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Above -1 dBTP ${renderInfoBtn("Number of tracks exceeding the -1 dBTP streaming ceiling. These may clip on some platforms.")}</span>
            <span class="stat-value ${(s.tracksAboveNeg1dBTP ?? 0) > 0 ? 'warning' : 'good'}">${s.tracksAboveNeg1dBTP ?? 0} tracks</span>
          </div>
        </div>

        <!-- Dynamics Stats -->
        <div class="stat-group">
          <div class="stat-group-title"><span>◧</span> Dynamics</div>
          <div class="stat-row">
            <span class="stat-label">Avg DR ${renderInfoBtn("Average dynamic range. Higher values mean more dynamics preserved. Under 6 dB suggests heavy limiting.")}</span>
            <span class="stat-value">${s.avgDynamicRange?.toFixed(1) ?? '—'} dB</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Avg Crest ${renderInfoBtn("Average peak-to-RMS ratio. Higher = more punch. Under 8 dB may sound flat.")}</span>
            <span class="stat-value">${s.avgCrestFactor?.toFixed(1) ?? '—'} dB</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Clipping ${renderInfoBtn("Tracks with detected digital clipping. Any clipping should be addressed before release.")}</span>
            <span class="stat-value ${(s.tracksWithClipping ?? 0) > 0 ? 'danger' : 'good'}">${s.tracksWithClipping ?? 0} tracks</span>
          </div>
        </div>

        <!-- Stereo Stats -->
        <div class="stat-group">
          <div class="stat-group-title"><span>◑</span> Stereo</div>
          <div class="stat-row">
            <span class="stat-label">Avg Width ${renderInfoBtn("Average stereo width across tracks. 50-80% is typical. Very wide mixes may have mono compatibility issues.")}</span>
            <span class="stat-value">${s.avgStereoWidth ?? '—'}%</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Avg Correlation ${renderInfoBtn("L/R channel correlation. 1 = mono, 0 = uncorrelated. Below 0.5 may have phase issues.")}</span>
            <span class="stat-value ${(s.avgCorrelation ?? 1) < 0.5 ? 'warning' : ''}">${s.avgCorrelation?.toFixed(2) ?? '—'}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Phase Issues ${renderInfoBtn("Tracks with detected phase problems. These may sound hollow or lose bass in mono playback.")}</span>
            <span class="stat-value ${(s.tracksWithPhaseIssues ?? 0) > 0 ? 'warning' : 'good'}">${s.tracksWithPhaseIssues ?? 0} tracks</span>
          </div>
        </div>

        <!-- Spectral Stats -->
        <div class="stat-group">
          <div class="stat-group-title"><span>◔</span> Spectral</div>
          <div class="stat-row">
            <span class="stat-label">Avg Tilt ${renderInfoBtn("Average spectral slope. Negative = dark/warm, Positive = bright. -2 to -4 dB/oct typical for mastered music.")}</span>
            <span class="stat-value">${s.avgSpectralTilt?.toFixed(1) ?? '—'} dB/oct</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Avg Harshness ${renderInfoBtn("Average 2-5kHz energy prominence. Above 30% may cause listener fatigue on extended listening.")}</span>
            <span class="stat-value ${(s.avgHarshness ?? 0) > 30 ? 'warning' : ''}">${s.avgHarshness ?? '—'}%</span>
          </div>
        </div>

        <!-- Quality Stats -->
        <div class="stat-group">
          <div class="stat-group-title"><span>✓</span> Quality</div>
          <div class="stat-row">
            <span class="stat-label">Issues ${renderInfoBtn("Critical problems that should be fixed before release. These affect audio quality or playback.")}</span>
            <span class="stat-value ${(s.tracksWithIssues ?? 0) > 0 ? 'danger' : 'good'}">${s.tracksWithIssues ?? 0} tracks (${s.totalIssues ?? 0} total)</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Warnings ${renderInfoBtn("Potential concerns that may or may not need attention depending on artistic intent.")}</span>
            <span class="stat-value ${(s.tracksWithWarnings ?? 0) > 0 ? 'warning' : 'good'}">${s.tracksWithWarnings ?? 0} tracks (${s.totalWarnings ?? 0} total)</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Artifacts ${renderInfoBtn("Tracks with detected processing artifacts like unnatural high-frequency shimmer or timing anomalies.")}</span>
            <span class="stat-value ${(s.tracksWithArtifacts ?? 0) > 0 ? 'warning' : 'good'}">${s.tracksWithArtifacts ?? 0} tracks</span>
          </div>
        </div>

        <!-- Album Cohesion -->
        <div class="stat-group">
          <div class="stat-group-title"><span>⟷</span> Album Cohesion</div>
          <div class="stat-row">
            <span class="stat-label">LUFS Spread ${renderInfoBtn("Difference between loudest and quietest track. Under 3 LU is cohesive, over 5 LU may feel inconsistent.")}</span>
            <span class="stat-value ${(s.albumLoudnessSpread ?? 0) > 4 ? 'warning' : ''}">${s.albumLoudnessSpread?.toFixed(1) ?? '—'} LU</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Sequence Flow ${renderInfoBtn("Penalizes large loudness jumps between adjacent tracks. 100% = smooth transitions throughout.")}</span>
            <span class="stat-value ${(s.sequenceConsistencyScore ?? 100) < 85 ? 'warning' : 'good'}">${s.sequenceConsistencyScore ?? '—'}%</span>
          </div>
          ${s.sequenceConsistencyNote ? html`
            <div class="stat-row">
              <span class="stat-label" style="font-size: 0.6rem; color: var(--led-amber);">${s.sequenceConsistencyNote}</span>
            </div>
          ` : null}
          <div class="stat-row">
            <span class="stat-label">Spectral Match ${renderInfoBtn("How consistent the tonal character is across tracks. Low scores indicate tracks that may sound out of place.")}</span>
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
              <span class="stat-label">Avg Tilt ${renderInfoBtn("Album's overall spectral slope. This defines the general brightness/warmth of the collection.")}</span>
              <span class="stat-value">${s.spectralFingerprint.avgTilt.toFixed(1)} dB/oct</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Avg Harshness ${renderInfoBtn("Album's overall harshness level. Consistent values across tracks contribute to cohesive sound.")}</span>
              <span class="stat-value">${s.spectralFingerprint.avgHarshness.toFixed(0)}%</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Avg Width ${renderInfoBtn("Album's overall stereo width character. Consistent width helps maintain a unified listening experience.")}</span>
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
            <button class="view-toggle-btn ${ctx.viewMode === 'simple' ? 'active' : ''}" @click=${() => ctx.onViewModeChange('simple')}>Simple</button>
            <button class="view-toggle-btn ${ctx.viewMode === 'advanced' ? 'active' : ''}" @click=${() => ctx.onViewModeChange('advanced')}>Advanced</button>
          </div>
        </div>
      </div>
      <div style="border-bottom: 1px solid var(--border-subtle); margin: 10px 0 14px;"></div>
      ${album.tracks.map((t: TrackAnalysis) => ctx.viewMode === 'simple'
        ? renderSimpleTrackCard(t, ctx.spectrograms?.get(t.trackNumber))
        : renderTrackCard(t, ctx.expandedTracks.has(t.trackNumber), () => ctx.onToggleTrack(t.trackNumber), ctx.spectrograms?.get(t.trackNumber))
      )}
    </div>

    <div class="panel">
      <div class="json-toggle" @click=${ctx.onToggleJson}>
        <h3 class="panel-title" style="margin:0;border:0;padding:0">Raw Data</h3>
        <span class="json-toggle-icon">${ctx.jsonVisible ? '▲' : '▼'}</span>
      </div>
      <div class="json-preview ${ctx.jsonVisible ? 'visible' : ''}">
        <pre>${JSON.stringify(album, null, 2)}</pre>
      </div>
    </div>
  `;
}
