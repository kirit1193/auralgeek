import type { TrackAnalysis } from "../core/types";

export function evaluateDistribution(track: TrackAnalysis): { ready: boolean; issues: string[]; warnings: string[] } {
  const issues: string[] = [];
  const warnings: string[] = [];
  let ready = true;

  const p = track.parameters;
  const l = track.loudness;
  const d = track.dynamics;
  const st = track.stereo;
  const sp = track.spectral;

  // === FORMAT QUALITY ===
  if (p.sampleRate !== undefined && p.sampleRate < 44100) {
    issues.push(`Sample rate ${p.sampleRate} Hz below 44.1 kHz.`);
    ready = false;
  }
  if (p.bitDepth !== undefined && p.bitDepth < 16) {
    issues.push(`Bit depth ${p.bitDepth}-bit below 16-bit.`);
    ready = false;
  }
  if (p.channels !== undefined && p.channels < 2) {
    warnings.push("Mono file: consider stereo for streaming.");
  }
  if (p.effectiveBitDepth !== undefined && p.effectiveBitDepth < 14) {
    warnings.push(`Low effective bit depth (~${p.effectiveBitDepth}-bit): may indicate lossy source or heavy limiting.`);
  }
  if (p.isTrueStereo === false && p.channels === 2) {
    warnings.push("Dual mono detected: L and R channels are identical.");
  }

  // === LOUDNESS & PEAKS ===
  if (l.truePeakDBTP !== null && l.truePeakDBTP > -1.0) {
    issues.push(`True peak ${l.truePeakDBTP.toFixed(1)} dBTP exceeds -1.0 dBTP (may clip on lossy encoding).`);
    ready = false;
  }
  if (l.integratedLUFS !== null && l.integratedLUFS > -9) {
    warnings.push(`Very loud (${l.integratedLUFS.toFixed(1)} LUFS): may cause listener fatigue and heavy attenuation on streaming.`);
  }
  if (l.ispMarginDB !== null && l.ispMarginDB > 0.5) {
    warnings.push(`High ISP margin (${l.ispMarginDB.toFixed(2)} dB): inter-sample peaks significantly exceed sample peak.`);
  }
  if (l.loudnessRangeLU !== null && l.loudnessRangeLU < 3) {
    warnings.push(`Low loudness range (${l.loudnessRangeLU.toFixed(1)} LU): track may sound flat/over-compressed.`);
  }
  if (l.loudnessRangeLU !== null && l.loudnessRangeLU > 20) {
    warnings.push(`High loudness range (${l.loudnessRangeLU.toFixed(1)} LU): may need dynamic processing for streaming.`);
  }

  // === DYNAMICS ===
  if (d.hasClipping) {
    issues.push("Digital clipping detected.");
    ready = false;
  }
  if (d.clipEventCount !== null && d.clipEventCount > 10) {
    issues.push(`${d.clipEventCount} clipping events detected.`);
    ready = false;
  }
  if (d.dcOffset !== null && Math.abs(d.dcOffset) > 0.001) {
    warnings.push(`DC offset detected (${d.dcOffset.toFixed(6)}): may cause clicks on playback.`);
  }
  if (d.crestFactorDB !== null && d.crestFactorDB < 6) {
    warnings.push(`Low crest factor (${d.crestFactorDB.toFixed(1)} dB): heavily limited, may lack punch.`);
  }
  if (d.plrDB !== null && d.plrDB < 8) {
    warnings.push(`Low PLR (${d.plrDB.toFixed(1)} dB): track is heavily compressed.`);
  }

  // === SILENCE ===
  if (d.silenceAtStartMs !== null && d.silenceAtStartMs > 1000) {
    warnings.push(`Long silence at start (${(d.silenceAtStartMs / 1000).toFixed(1)}s).`);
  }
  if (d.silenceAtEndMs !== null && d.silenceAtEndMs > 3000) {
    warnings.push(`Long silence at end (${(d.silenceAtEndMs / 1000).toFixed(1)}s).`);
  }

  // === STEREO ===
  if (st.correlation !== null && st.correlation < 0) {
    warnings.push(`Negative stereo correlation (${st.correlation.toFixed(2)}): out-of-phase content may cause mono cancellation.`);
  }
  if (st.correlationWorst1Pct !== null && st.correlationWorst1Pct < -0.5) {
    warnings.push(`Severe phase issues in some sections (worst 1% correlation: ${st.correlationWorst1Pct.toFixed(2)}).`);
  }
  if (st.lowEndPhaseIssues) {
    warnings.push("Low frequency phase issues detected: may cause bass loss on mono playback.");
  }
  if (st.subBassMonoCompatible === false) {
    warnings.push("Sub-bass is wide/out-of-phase: may cause translation issues on mono/club systems.");
  }
  if (st.monoLoudnessDiffDB !== null && st.monoLoudnessDiffDB < -3) {
    warnings.push(`Significant mono summing loss (${st.monoLoudnessDiffDB.toFixed(1)} dB): phase cancellation issues.`);
  }
  if (st.balanceDB !== null && Math.abs(st.balanceDB) > 2) {
    const side = st.balanceDB > 0 ? "right" : "left";
    warnings.push(`Unbalanced stereo: ${Math.abs(st.balanceDB).toFixed(1)} dB ${side} heavy.`);
  }
  if (st.lowBandWidthPct !== null && st.lowBandWidthPct > 50) {
    warnings.push(`Wide low frequencies (${st.lowBandWidthPct.toFixed(0)}% side energy): may cause vinyl cutting or club system issues.`);
  }

  // === SPECTRAL ===
  if (sp.harshnessIndex !== null && sp.harshnessIndex > 30) {
    warnings.push(`High harshness index (${sp.harshnessIndex.toFixed(0)}%): 2-5kHz region is prominent, may cause ear fatigue.`);
  }
  if (sp.sibilanceIndex !== null && sp.sibilanceIndex > 25) {
    warnings.push(`High sibilance index (${sp.sibilanceIndex.toFixed(0)}%): 5-10kHz region is prominent, may sound harsh.`);
  }
  if (sp.spectralTiltDBPerOctave !== null && sp.spectralTiltDBPerOctave > 0) {
    warnings.push(`Bright spectral tilt (+${sp.spectralTiltDBPerOctave.toFixed(1)} dB/oct): may sound fatiguing over time.`);
  }
  if (sp.spectralTiltDBPerOctave !== null && sp.spectralTiltDBPerOctave < -6) {
    warnings.push(`Dark spectral tilt (${sp.spectralTiltDBPerOctave.toFixed(1)} dB/oct): may lack clarity.`);
  }

  // === STREAMING PLATFORM RISKS ===
  const streaming = track.streamingSimulation;
  if (streaming.spotify?.riskFlags && streaming.spotify.riskFlags.length > 0) {
    for (const flag of streaming.spotify.riskFlags) {
      if (flag.includes("clip")) {
        warnings.push(`Spotify: ${flag}`);
      }
    }
  }

  return { ready, issues, warnings };
}
