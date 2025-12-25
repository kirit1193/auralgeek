/**
 * Track Card Renderers
 * Simple and advanced track display components
 */

import { html, TemplateResult } from 'lit';
import type { TrackAnalysis } from '../../core/types.js';
import { formatTime, getRatingClass, calculateTrackScores } from '../helpers/index.js';
import { renderMeter, renderMetricRow } from './metrics.js';
import { renderPlatformCard } from './platforms.js';

export function renderTrackCard(
  t: TrackAnalysis,
  isExpanded: boolean,
  onToggle: () => void
): TemplateResult {
  const statusClass = t.distributionReady ? "badge-ok" : t.issues.length ? "badge-bad" : "badge-warn";
  const scores = calculateTrackScores(t);

  return html`
    <div class="track-item ${isExpanded ? 'expanded' : ''}">
      <div class="track-header" @click=${onToggle}>
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
            <h4 class="module-title"><span class="module-icon">◐</span> Loudness<span class="module-rating ${getRatingClass(scores.loudness)}">${scores.loudness.toFixed(1)}</span></h4>
            ${renderMeter("Integrated", "Gated loudness per EBU R128. Target: -14 LUFS (Spotify), -16 (Apple).", t.loudness.integratedLUFS, "LUFS", "loudness", (v) => ((v+24)/20)*100, ["-24", "-19", "-14", "-9", "-4"])}
            ${renderMetricRow("Ungated", "Integrated loudness without gating.", `${t.loudness.integratedUngatedLUFS?.toFixed(1) ?? "—"} LUFS`, "", { numValue: t.loudness.integratedUngatedLUFS, type: "center", min: -24, max: -4 })}
            <div class="section-subtitle">Short-term Analysis</div>
            ${renderMetricRow("Max Momentary", "Peak 400ms loudness.", `${t.loudness.maxMomentaryLUFS?.toFixed(1) ?? "—"} LUFS`, "", { numValue: t.loudness.maxMomentaryLUFS, type: "center", min: -24, max: 0 })}
            ${renderMetricRow("Max Short-term", "Peak 3s loudness.", `${t.loudness.maxShortTermLUFS?.toFixed(1) ?? "—"} LUFS`, "", { numValue: t.loudness.maxShortTermLUFS, type: "center", min: -24, max: 0 })}
            ${renderMetricRow("LRA", "Loudness Range (EBU Tech 3342). Higher = more dynamic.", `${t.loudness.loudnessRangeLU?.toFixed(1) ?? "—"} LU`, (t.loudness.loudnessRangeLU ?? 10) < 4 ? "warning" : "", { numValue: t.loudness.loudnessRangeLU, type: "high-good", min: 0, max: 20 })}
            ${renderMetricRow("Loudest @", "Time of loudest section.", formatTime(t.loudness.loudestSegmentTime), "")}
            ${renderMetricRow("Quietest @", "Time of quietest section.", formatTime(t.loudness.quietestSegmentTime), "")}
            <div class="section-subtitle">Macro-dynamics</div>
            ${renderMetricRow("Loudness Slope", "Trend over time. Positive = gets louder.", `${t.loudness.loudnessSlopeDBPerMin?.toFixed(2) ?? "—"} dB/min`, Math.abs(t.loudness.loudnessSlopeDBPerMin ?? 0) > 0.5 ? "warning" : "", { numValue: t.loudness.loudnessSlopeDBPerMin, type: "center", min: -2, max: 2 })}
            ${renderMetricRow("Volatility", "Std-dev of short-term LUFS. Low = controlled.", `${t.loudness.loudnessVolatilityLU?.toFixed(1) ?? "—"} LU`, (t.loudness.loudnessVolatilityLU ?? 0) > 6 ? "warning" : "", { numValue: t.loudness.loudnessVolatilityLU, type: "low-good", min: 0, max: 10 })}
          </div>

          <!-- PEAKS & HEADROOM -->
          <div class="metric-module primary">
            <h4 class="module-title"><span class="module-icon">▲</span> Peaks<span class="module-rating ${getRatingClass(scores.peaks)}">${scores.peaks.toFixed(1)}</span></h4>
            ${renderMeter("True Peak", `Inter-sample peak (${t.loudness.truePeakOversampling ?? 4}x oversampled). Keep ≤ -1 dBTP.`, t.loudness.truePeakDBTP, "dBTP", "peak", (v) => ((v+12)/12)*100, ["-12", "-9", "-6", "-3", "0"])}
            ${renderMetricRow("Sample Peak", "Non-oversampled peak.", `${t.loudness.samplePeakDBFS?.toFixed(1) ?? "—"} dBFS`, "", { numValue: t.loudness.samplePeakDBFS, type: "level", min: -24, max: 0 })}
            ${renderMetricRow("ISP Margin", "True Peak vs Sample Peak. High = ISP risk.", `${t.loudness.ispMarginDB?.toFixed(2) ?? "—"} dB`, (t.loudness.ispMarginDB ?? 0) > 0.5 ? "warning" : "", { numValue: t.loudness.ispMarginDB, type: "low-good", min: 0, max: 2 })}
            <div class="section-subtitle">Peak Clustering</div>
            ${renderMetricRow("Pattern", "Sporadic = transients, Persistent = limiter.", t.loudness.peakClusteringType ?? "—", t.loudness.peakClusteringType === "persistent" ? "warning" : "")}
            ${renderMetricRow("Cluster Count", "Number of peak clusters.", `${t.loudness.peakClusterCount ?? "—"}`, "")}
            ${renderMetricRow("TP/Loudness", "TP vs short-term at peak. High = brittle.", `${t.loudness.tpToLoudnessAtPeak?.toFixed(1) ?? "—"} dB`, (t.loudness.tpToLoudnessAtPeak ?? 0) > 3 ? "warning" : "", { numValue: t.loudness.tpToLoudnessAtPeak, type: "low-good", min: 0, max: 6 })}
            <div class="section-subtitle">Headroom to</div>
            ${renderMetricRow("0 dBTP", "Headroom to digital ceiling.", `${t.loudness.truePeakDBTP !== null ? (-t.loudness.truePeakDBTP).toFixed(1) : "—"} dB`, "")}
            ${renderMetricRow("-1 dBTP", "Headroom to streaming safe.", `${t.loudness.truePeakDBTP !== null ? (-1 - t.loudness.truePeakDBTP).toFixed(1) : "—"} dB`, (t.loudness.truePeakDBTP ?? -10) > -1 ? "danger" : "")}
          </div>

          <!-- DYNAMICS -->
          <div class="metric-module primary">
            <h4 class="module-title"><span class="module-icon">◧</span> Dynamics<span class="module-rating ${getRatingClass(scores.dynamics)}">${scores.dynamics.toFixed(1)}</span></h4>
            ${renderMeter("Dynamic Range", "Percentile-based DR. Higher = more dynamic.", t.dynamics.dynamicRangeDB, "dB", "dynamics", (v) => (v/40)*100, ["0", "10", "20", "30", "40"])}
            ${renderMetricRow("PLR", "Peak-to-Loudness Ratio. Lower = squashed.", `${t.dynamics.plrDB?.toFixed(1) ?? "—"} dB`, (t.dynamics.plrDB ?? 20) < 8 ? "warning" : "", { numValue: t.dynamics.plrDB, type: "high-good", min: 0, max: 20 })}
            ${renderMetricRow("PSR", "Peak-to-Short-term Ratio.", `${t.dynamics.psrDB?.toFixed(1) ?? "—"} dB`, "", { numValue: t.dynamics.psrDB, type: "high-good", min: 0, max: 15 })}
            ${renderMetricRow("Crest Factor", "Peak to RMS ratio. Higher = more punch.", `${t.dynamics.crestFactorDB?.toFixed(1) ?? "—"} dB`, (t.dynamics.crestFactorDB ?? 10) < 6 ? "warning" : "", { numValue: t.dynamics.crestFactorDB, type: "high-good", min: 0, max: 20 })}
            <div class="section-subtitle">Envelope Shape</div>
            ${renderMetricRow("Attack Speed", "Median attack slope. Higher = punchier.", `${t.dynamics.attackSpeedIndex?.toFixed(1) ?? "—"} dB/ms`, "", { numValue: t.dynamics.attackSpeedIndex, type: "high-good", min: 0, max: 10 })}
            ${renderMetricRow("Release Tail", "Median decay time. Long = sustained.", `${t.dynamics.releaseTailMs?.toFixed(0) ?? "—"} ms`, "", { numValue: t.dynamics.releaseTailMs, type: "center", min: 0, max: 500 })}
            <div class="section-subtitle">Microdynamics</div>
            ${renderMetricRow("Transient Density", "Attack events per minute.", `${t.dynamics.transientDensity?.toFixed(0) ?? "—"} /min`, "", { numValue: t.dynamics.transientDensity, type: "center", min: 0, max: 300 })}
            ${renderMetricRow("Micro Contrast", "Median short-window crest.", `${t.dynamics.microdynamicContrast?.toFixed(1) ?? "—"} dB`, "", { numValue: t.dynamics.microdynamicContrast, type: "high-good", min: 0, max: 15 })}
            <div class="section-subtitle">Clipping</div>
            ${renderMetricRow("Status", "Digital clipping detection.", t.dynamics.hasClipping ? `${t.dynamics.clipEventCount ?? 0} events` : "None", t.dynamics.hasClipping ? "danger" : "good")}
            ${t.dynamics.hasClipping ? html`
              ${renderMetricRow("Clipped Samples", "Total clipped sample count.", `${t.dynamics.clippedSampleCount ?? 0}`, "danger")}
              ${renderMetricRow("Clip Density", "Clip events per minute.", `${t.dynamics.clipDensityPerMinute?.toFixed(1) ?? "—"} /min`, "warning")}
            ` : null}
            <div class="section-subtitle">Silence</div>
            ${renderMetricRow("Start", "Leading silence.", `${t.dynamics.silenceAtStartMs ?? 0} ms`, (t.dynamics.silenceAtStartMs ?? 0) > 500 ? "warning" : "")}
            ${renderMetricRow("End", "Trailing silence.", `${t.dynamics.silenceAtEndMs ?? 0} ms`, (t.dynamics.silenceAtEndMs ?? 0) > 2000 ? "warning" : "")}
            ${renderMetricRow("DC Offset", "Should be near zero.", `${t.dynamics.dcOffset?.toFixed(6) ?? "—"}`, Math.abs(t.dynamics.dcOffset ?? 0) > 0.001 ? "warning" : "")}
          </div>

          <!-- STEREO FIELD -->
          <div class="metric-module">
            <h4 class="module-title"><span class="module-icon">◑</span> Stereo<span class="module-rating ${getRatingClass(scores.stereo)}">${scores.stereo.toFixed(1)}</span></h4>
            ${renderMeter("Stereo Width", "Side/mid ratio. 50-80% is typical.", t.stereo.stereoWidthPct, "%", "width", (v) => (v/120)*100, ["0", "30", "60", "90", "120"])}
            ${renderMetricRow("Mid Energy", "Center channel energy.", `${t.stereo.midEnergyDB?.toFixed(1) ?? "—"} dB`, "", { numValue: t.stereo.midEnergyDB, type: "level", min: -40, max: 0 })}
            ${renderMetricRow("Side Energy", "Stereo difference energy.", `${t.stereo.sideEnergyDB?.toFixed(1) ?? "—"} dB`, "", { numValue: t.stereo.sideEnergyDB, type: "level", min: -40, max: 0 })}
            ${renderMetricRow("L/R Balance", "0 = centered.", `${t.stereo.balanceDB?.toFixed(2) ?? "—"} dB`, Math.abs(t.stereo.balanceDB ?? 0) > 1.5 ? "warning" : "", { numValue: t.stereo.balanceDB, type: "center", min: -6, max: 6 })}
            <div class="section-subtitle">Correlation</div>
            ${renderMetricRow("Mean", "Average L/R correlation.", `${t.stereo.correlationMean?.toFixed(2) ?? "—"}`, (t.stereo.correlationMean ?? 1) < 0.3 ? "warning" : "", { numValue: t.stereo.correlationMean, type: "high-good", min: -1, max: 1 })}
            ${renderMetricRow("Energy-Weighted", "Correlation ignoring quiet sections.", `${t.stereo.correlationEnergyWeighted?.toFixed(2) ?? "—"}`, (t.stereo.correlationEnergyWeighted ?? 1) < 0.3 ? "warning" : "", { numValue: t.stereo.correlationEnergyWeighted, type: "high-good", min: -1, max: 1 })}
            ${renderMetricRow("Worst 1%", "Lowest correlation regions.", `${t.stereo.correlationWorst1Pct?.toFixed(2) ?? "—"}`, (t.stereo.correlationWorst1Pct ?? 0) < -0.3 ? "warning" : "", { numValue: t.stereo.correlationWorst1Pct, type: "high-good", min: -1, max: 1 })}
            <div class="section-subtitle">Channel Balance</div>
            ${renderMetricRow("Spectral Asymmetry", "L/R brightness difference.", `${t.stereo.spectralAsymmetryHz?.toFixed(0) ?? "—"} Hz`, Math.abs(t.stereo.spectralAsymmetryHz ?? 0) > 200 ? "warning" : "", { numValue: t.stereo.spectralAsymmetryHz, type: "center", min: -500, max: 500 })}
            ${t.stereo.spectralAsymmetryNote ? html`<div class="metric-note" style="font-size: 0.6rem; color: var(--led-amber); padding: 2px 0;">${t.stereo.spectralAsymmetryNote}</div>` : null}
            <div class="section-subtitle">Band Width</div>
            ${renderMetricRow("Low (20-150Hz)", "Bass stereo width.", `${t.stereo.lowBandWidthPct?.toFixed(0) ?? "—"}%`, (t.stereo.lowBandWidthPct ?? 0) > 50 ? "warning" : "", { numValue: t.stereo.lowBandWidthPct, type: "low-good", min: 0, max: 100 })}
            ${renderMetricRow("Presence (2-6k)", "Vocal/presence width.", `${t.stereo.presenceBandWidthPct?.toFixed(0) ?? "—"}%`, "", { numValue: t.stereo.presenceBandWidthPct, type: "center", min: 0, max: 100 })}
            ${renderMetricRow("Air (10-20k)", "High frequency width.", `${t.stereo.airBandWidthPct?.toFixed(0) ?? "—"}%`, "", { numValue: t.stereo.airBandWidthPct, type: "center", min: 0, max: 100 })}
            <div class="section-subtitle">Mono Compatibility</div>
            ${renderMetricRow("Mono Loss", "Loudness diff when summed to mono.", `${t.stereo.monoLoudnessDiffDB?.toFixed(1) ?? "—"} dB`, (t.stereo.monoLoudnessDiffDB ?? 0) < -3 ? "danger" : "", { numValue: t.stereo.monoLoudnessDiffDB, type: "high-good", min: -6, max: 3 })}
            ${renderMetricRow("Sub-bass Mono", "Low freq phase compatibility.", t.stereo.subBassMonoCompatible === null ? "—" : t.stereo.subBassMonoCompatible ? "OK" : "Issues", t.stereo.subBassMonoCompatible === false ? "warning" : "good")}
            ${renderMetricRow("LF Phase", "Low-end phase anomalies.", t.stereo.lowEndPhaseIssues ? "Detected" : "OK", t.stereo.lowEndPhaseIssues ? "warning" : "good")}
          </div>

          <!-- SPECTRAL -->
          <div class="metric-module">
            <h4 class="module-title"><span class="module-icon">◔</span> Spectral<span class="module-rating ${getRatingClass(scores.spectral)}">${scores.spectral.toFixed(1)}</span></h4>
            ${renderMetricRow("Tilt", "Spectral slope. Negative = dark, Positive = bright.", `${t.spectral.spectralTiltDBPerOctave?.toFixed(1) ?? "—"} dB/oct`, Math.abs(t.spectral.spectralTiltDBPerOctave ?? 0) > 4 ? "warning" : "", { numValue: t.spectral.spectralTiltDBPerOctave, type: "center", min: -8, max: 4 })}
            ${renderMetricRow("Centroid", "Brightness indicator.", `${t.spectral.spectralCentroidHz?.toFixed(0) ?? "—"} Hz`, "", { numValue: t.spectral.spectralCentroidHz, type: "center", min: 500, max: 6000 })}
            ${renderMetricRow("Rolloff", "85% energy cutoff.", `${t.spectral.spectralRolloffHz?.toFixed(0) ?? "—"} Hz`, "", { numValue: t.spectral.spectralRolloffHz, type: "center", min: 2000, max: 16000 })}
            <div class="section-subtitle">Band Ratios</div>
            ${renderMetricRow("Bass/Mid", "Low end vs mids.", `${t.spectral.bassToMidRatioDB?.toFixed(1) ?? "—"} dB`, "", { numValue: t.spectral.bassToMidRatioDB, type: "center", min: -12, max: 12 })}
            ${renderMetricRow("Mid/High", "Mids vs highs.", `${t.spectral.midToHighRatioDB?.toFixed(1) ?? "—"} dB`, "", { numValue: t.spectral.midToHighRatioDB, type: "center", min: -12, max: 12 })}
            <div class="section-subtitle">Perceptual (raw)</div>
            ${renderMetricRow("Harshness", "2-5kHz prominence. Lower is better.", `${t.spectral.harshnessIndex?.toFixed(0) ?? "—"}%`, (t.spectral.harshnessIndex ?? 0) > 30 ? "warning" : "", { numValue: t.spectral.harshnessIndex, type: "low-good", min: 0, max: 50 })}
            ${renderMetricRow("Sibilance", "5-10kHz peaks. Lower is better.", `${t.spectral.sibilanceIndex?.toFixed(0) ?? "—"}%`, (t.spectral.sibilanceIndex ?? 0) > 25 ? "warning" : "", { numValue: t.spectral.sibilanceIndex, type: "low-good", min: 0, max: 40 })}
            <div class="section-subtitle">Perceptual (A-weighted)</div>
            ${renderMetricRow("Harshness (A)", "A-weighted for perception.", `${t.spectral.harshnessIndexWeighted?.toFixed(0) ?? "—"}%`, (t.spectral.harshnessIndexWeighted ?? 0) > 25 ? "warning" : "", { numValue: t.spectral.harshnessIndexWeighted, type: "low-good", min: 0, max: 50 })}
            ${renderMetricRow("Sibilance (A)", "A-weighted sibilance.", `${t.spectral.sibilanceIndexWeighted?.toFixed(0) ?? "—"}%`, (t.spectral.sibilanceIndexWeighted ?? 0) > 20 ? "warning" : "", { numValue: t.spectral.sibilanceIndexWeighted, type: "low-good", min: 0, max: 40 })}
            ${renderMetricRow("Tilt (A)", "A-weighted spectral slope.", `${t.spectral.spectralTiltWeightedDBPerOctave?.toFixed(1) ?? "—"} dB/oct`, Math.abs(t.spectral.spectralTiltWeightedDBPerOctave ?? 0) > 3 ? "warning" : "", { numValue: t.spectral.spectralTiltWeightedDBPerOctave, type: "center", min: -6, max: 3 })}
            <div class="section-subtitle">Balance</div>
            ${renderMetricRow("Status", "Overall tonal balance.", t.spectral.spectralBalanceStatus ?? "—", "")}
            ${t.spectral.spectralBalanceNote ? html`<div class="metric-note" style="font-size: 0.6rem; color: var(--text-secondary); padding: 2px 0;">${t.spectral.spectralBalanceNote}</div>` : null}
            ${renderMetricRow("Flatness", "0 = tonal, 1 = noise.", `${t.spectral.spectralFlatness?.toFixed(2) ?? "—"}`, "", { numValue: t.spectral.spectralFlatness, type: "center", min: 0, max: 1 })}
          </div>

          <!-- MUSICAL + STREAMING + ARTIFACTS (stacked) -->
          <div class="stacked-modules">
            <div class="metric-module tertiary">
              <h4 class="module-title"><span class="module-icon">♪</span> Musical<span class="module-rating ${getRatingClass(scores.musical)}">${scores.musical.toFixed(1)}</span></h4>
              <div class="music-feature-row">
                <span class="music-primary">${t.musicalFeatures.bpmPrimary ?? "—"} BPM</span>
                <span class="music-confidence">${t.musicalFeatures.bpmConfidence ?? 0}%</span>
                ${t.musicalFeatures.halfDoubleAmbiguity ? html`<span class="music-badge">½/2x</span>` : null}
              </div>
              <div class="music-feature-row">
                <span class="music-primary">${t.musicalFeatures.keyPrimary ?? "—"}</span>
                <span class="music-confidence">${t.musicalFeatures.keyConfidence ?? 0}%</span>
              </div>
              ${renderMetricRow("Beat Stability", "Timing consistency.", `${t.musicalFeatures.beatStabilityScore ?? 0}%`, "", { numValue: t.musicalFeatures.beatStabilityScore, type: "high-good", min: 0, max: 100 })}
              ${renderMetricRow("Tempo Drift", "Beat interval variation. Low = steady.", `${t.musicalFeatures.tempoDriftIndex?.toFixed(1) ?? "—"}%`, (t.musicalFeatures.tempoDriftIndex ?? 0) > 8 ? "warning" : "", { numValue: t.musicalFeatures.tempoDriftIndex, type: "low-good", min: 0, max: 15 })}
              ${t.musicalFeatures.tempoDriftNote ? html`<div class="metric-note" style="font-size: 0.6rem; color: var(--text-secondary); padding: 2px 0;">${t.musicalFeatures.tempoDriftNote}</div>` : null}
              ${renderMetricRow("Tonalness", "How well audio fits key model.", `${t.musicalFeatures.tonalnessScore ?? 0}%`, "", { numValue: t.musicalFeatures.tonalnessScore, type: "high-good", min: 0, max: 100 })}
              ${renderMetricRow("Key Stability", "Consistency of detected key.", `${t.musicalFeatures.keyStabilityPct?.toFixed(0) ?? "—"}%`, (t.musicalFeatures.keyStabilityPct ?? 100) < 70 ? "warning" : "", { numValue: t.musicalFeatures.keyStabilityPct, type: "high-good", min: 0, max: 100 })}
              ${t.musicalFeatures.keyStabilityNote ? html`<div class="metric-note" style="font-size: 0.6rem; color: var(--text-secondary); padding: 2px 0;">${t.musicalFeatures.keyStabilityNote}</div>` : null}
            </div>

            <div class="metric-module tertiary">
              <h4 class="module-title"><span class="module-icon">☁</span> Streaming<span class="module-rating ${getRatingClass(scores.streaming)}">${scores.streaming.toFixed(1)}</span></h4>
              <div class="platform-grid">
                ${renderPlatformCard(t.streamingSimulation.spotify)}
                ${renderPlatformCard(t.streamingSimulation.appleMusic)}
                ${renderPlatformCard(t.streamingSimulation.youtube)}
                ${renderPlatformCard(t.streamingSimulation.tidal)}
              </div>
              ${t.streamingSimulation.recommendation ? html`
                <div class="recommendation-box">
                  <div class="recommendation-title">Recommendation</div>
                  ${t.streamingSimulation.recommendation}
                </div>
              ` : null}
            </div>

            <div class="metric-module tertiary">
              <h4 class="module-title"><span class="module-icon">◍</span> Artifacts<span class="module-rating ${getRatingClass(scores.artifacts)}">${scores.artifacts.toFixed(1)}</span></h4>
              ${renderMetricRow("AI Score", "Lower is better. Detects unnatural HF shimmer.", `${t.aiArtifacts.overallAIScore?.toFixed(0) ?? 0}/100`, t.aiArtifacts.overallAIScore && t.aiArtifacts.overallAIScore > 30 ? "warning" : "good", { numValue: t.aiArtifacts.overallAIScore, type: "low-good", min: 0, max: 100 })}
              ${renderMetricRow("Shimmer", "HF shimmer detection.", t.aiArtifacts.shimmerDetected ? "Detected" : "None", t.aiArtifacts.shimmerDetected ? "warning" : "good")}
              <div class="section-subtitle">Source Quality</div>
              ${renderMetricRow("Noise Floor", "Median low-level energy.", `${t.parameters.noiseFloorDB?.toFixed(1) ?? "—"} dB`, (t.parameters.noiseFloorDB ?? -90) > -60 ? "warning" : "", { numValue: t.parameters.noiseFloorDB ?? null, type: "low-good", min: -96, max: -40 })}
              ${renderMetricRow("Codec Suspicion", "Lossy source indicators.", `${t.parameters.codecSuspicionScore?.toFixed(0) ?? 0}%`, (t.parameters.codecSuspicionScore ?? 0) > 50 ? "warning" : "", { numValue: t.parameters.codecSuspicionScore ?? null, type: "low-good", min: 0, max: 100 })}
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

export function renderSimpleTrackCard(t: TrackAnalysis): TemplateResult {
  const statusClass = t.distributionReady ? "badge-ok" : t.issues.length ? "badge-bad" : "badge-warn";

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
