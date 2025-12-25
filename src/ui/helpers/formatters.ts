/**
 * UI Helper Functions
 * Formatting utilities and scoring calculations
 */

import type { TrackAnalysis } from '../../core/types.js';

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function formatTime(seconds: number | null): string {
  if (seconds === null) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function getRatingClass(score: number): string {
  if (score >= 8.5) return "excellent";
  if (score >= 7.0) return "good";
  if (score >= 5.0) return "fair";
  return "poor";
}

// Section scoring functions - returns 0-10 score
export function scoreLoudness(t: TrackAnalysis): number {
  let score = 10;
  const lufs = t.loudness.integratedLUFS ?? -14;
  const lra = t.loudness.loudnessRangeLU ?? 8;

  if (lufs > -9) score -= 2.5;
  else if (lufs > -12) score -= 1.0;
  else if (lufs < -20) score -= 1.5;

  if (lra < 4) score -= 2.0;
  else if (lra < 6) score -= 1.0;
  else if (lra > 18) score -= 0.5;

  return clamp(score, 0, 10);
}

export function scorePeaks(t: TrackAnalysis): number {
  let score = 10;
  const tp = t.loudness.truePeakDBTP ?? -3;
  const isp = t.loudness.ispMarginDB ?? 0;

  if (tp > -0.5) score -= 3.0;
  else if (tp > -1.0) score -= 1.5;
  else if (tp > -1.5) score -= 0.5;

  if (isp > 1.0) score -= 1.5;
  else if (isp > 0.5) score -= 0.5;

  return clamp(score, 0, 10);
}

export function scoreDynamics(t: TrackAnalysis): number {
  let score = 10;
  const dr = t.dynamics.dynamicRangeDB ?? 12;
  const crest = t.dynamics.crestFactorDB ?? 10;
  const plr = t.dynamics.plrDB ?? 12;

  if (t.dynamics.hasClipping) {
    const clipCount = t.dynamics.clipEventCount ?? 0;
    if (clipCount > 100) score -= 3.0;
    else if (clipCount > 10) score -= 2.0;
    else score -= 1.0;
  }

  if (dr < 6) score -= 2.0;
  else if (dr < 10) score -= 1.0;

  if (crest < 6) score -= 1.5;
  else if (crest < 8) score -= 0.5;

  if (plr < 8) score -= 1.0;

  if (Math.abs(t.dynamics.dcOffset ?? 0) > 0.01) score -= 0.5;

  return clamp(score, 0, 10);
}

export function scoreStereo(t: TrackAnalysis): number {
  let score = 10;
  const corr = t.stereo.correlationMean ?? 0.8;
  const worst = t.stereo.correlationWorst1Pct ?? 0;
  const monoLoss = t.stereo.monoLoudnessDiffDB ?? 0;
  const balance = Math.abs(t.stereo.balanceDB ?? 0);

  if (corr < 0) score -= 2.5;
  else if (corr < 0.3) score -= 1.5;
  else if (corr < 0.5) score -= 0.5;

  if (worst < -0.5) score -= 1.5;
  else if (worst < 0) score -= 0.5;

  if (monoLoss < -4) score -= 2.0;
  else if (monoLoss < -2) score -= 1.0;

  if (balance > 3) score -= 1.5;
  else if (balance > 1.5) score -= 0.5;

  if (t.stereo.lowEndPhaseIssues) score -= 1.0;
  if (t.stereo.subBassMonoCompatible === false) score -= 0.5;

  return clamp(score, 0, 10);
}

export function scoreSpectral(t: TrackAnalysis): number {
  let score = 10;
  const tilt = t.spectral.spectralTiltDBPerOctave ?? -3;
  const harsh = t.spectral.harshnessIndex ?? 20;
  const sib = t.spectral.sibilanceIndex ?? 15;

  if (tilt > 1) score -= 1.5;
  else if (tilt > 0) score -= 0.5;
  if (tilt < -6) score -= 1.0;

  if (harsh > 35) score -= 2.0;
  else if (harsh > 28) score -= 1.0;

  if (sib > 30) score -= 1.5;
  else if (sib > 22) score -= 0.5;

  return clamp(score, 0, 10);
}

export function scoreStreaming(t: TrackAnalysis): number {
  let score = 10;
  const spotify = t.streamingSimulation.spotify;

  if (spotify) {
    const projTP = spotify.projectedTruePeakDBTP;
    const gain = spotify.gainChangeDB;

    if (projTP > 0) score -= 3.0;
    else if (projTP > -1) score -= 1.5;

    if (gain < -8) score -= 1.5;
    else if (gain < -4) score -= 0.5;
  }

  return clamp(score, 0, 10);
}

export function scoreMusical(t: TrackAnalysis): number {
  let score = 10;
  const bpmConf = t.musicalFeatures.bpmConfidence ?? 0;
  const keyConf = t.musicalFeatures.keyConfidence ?? 0;
  const tonal = t.musicalFeatures.tonalnessScore ?? 50;
  const stability = t.musicalFeatures.beatStabilityScore ?? 50;

  if (bpmConf < 30) score -= 1.5;
  else if (bpmConf < 50) score -= 0.5;

  if (keyConf < 30) score -= 1.0;
  else if (keyConf < 50) score -= 0.3;

  if (tonal < 30) score -= 1.0;

  if (stability < 40) score -= 0.5;

  return clamp(score, 0, 10);
}

export function scoreArtifacts(t: TrackAnalysis): number {
  let score = 10;
  const aiScore = t.aiArtifacts.overallAIScore ?? 0;

  if (aiScore > 70) score -= 3.0;
  else if (aiScore > 50) score -= 2.0;
  else if (aiScore > 30) score -= 1.0;

  if (t.aiArtifacts.shimmerDetected) score -= 0.5;

  return clamp(score, 0, 10);
}

export interface TrackScores {
  loudness: number;
  peaks: number;
  dynamics: number;
  stereo: number;
  spectral: number;
  musical: number;
  streaming: number;
  artifacts: number;
}

export function calculateTrackScores(t: TrackAnalysis): TrackScores {
  return {
    loudness: scoreLoudness(t),
    peaks: scorePeaks(t),
    dynamics: scoreDynamics(t),
    stereo: scoreStereo(t),
    spectral: scoreSpectral(t),
    musical: scoreMusical(t),
    streaming: scoreStreaming(t),
    artifacts: scoreArtifacts(t)
  };
}
