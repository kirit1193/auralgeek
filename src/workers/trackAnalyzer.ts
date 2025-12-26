/**
 * Track analysis module
 * Handles per-track audio analysis pipeline
 */

import type { TrackAnalysis, AudioParameters } from '../core/types.js';
import { computeLoudness } from '../analysis/loudness.js';
import { computeDynamics, computeStereo, computeBandEnergiesMono, computeTHD } from '../analysis/dsp/index.js';
import { computeMusicalFeatures, computeStreamingSimulation } from '../analysis/musical/index.js';
import { bytesToMB, formatDuration, clamp } from '../core/format.js';
import { evaluateDistribution } from '../analysis/rules.js';

export interface DecodedTrackData {
  filename: string;
  filesize: number;
  sampleRate: number;
  channels: number;
  channelData: Float32Array[];
}

export function scoreTrack(t: TrackAnalysis): number {
  let score = 10;

  score -= t.issues.length * 1.5;
  score -= t.warnings.length * 0.3;

  if (t.aiArtifacts.overallAIScore !== null && t.aiArtifacts.overallAIScore > 50) score -= 1.0;

  if (t.dynamics.hasClipping) score -= 0.5;
  if (t.stereo.lowEndPhaseIssues) score -= 0.3;
  if (t.loudness.ispMarginDB !== null && t.loudness.ispMarginDB > 1) score -= 0.2;

  return clamp(score, 0, 10);
}

function detectAIArtifacts(track: TrackAnalysis): TrackAnalysis['aiArtifacts'] {
  const hf = track.spectral.highFreqEnergy8k16kDB;
  const shimmer = hf !== null && hf > -25;
  const shimmerScore = shimmer ? Math.min(100, (hf + 25) * 10) : 0;

  // Check for robotic timing (very regular transient spacing)
  const timingChar = track.dynamics.transientTimingCharacter;
  const spacingCV = track.dynamics.transientSpacingCV;
  const roboticTiming = timingChar === 'robotic';
  // Lower CV = more uniform = more robotic (invert for score where higher = more robotic)
  const timingScore = spacingCV !== null
    ? Math.min(100, Math.max(0, (1 - spacingCV) * 100))
    : null;

  // Combined AI score: shimmer contributes 60%, timing contributes 40%
  let overall = 0;
  if (shimmer) overall += shimmerScore * 0.6;
  if (roboticTiming && timingScore !== null) overall += timingScore * 0.4;
  overall = Math.min(100, overall);

  return {
    shimmerDetected: shimmer,
    shimmerScore,
    roboticTiming,
    timingScore,
    overallAIScore: overall > 0 ? overall : null
  };
}

function detectTrueStereo(L: Float32Array, R: Float32Array): boolean {
  const sampleCount = Math.min(10000, L.length);
  const step = Math.floor(L.length / sampleCount);

  let diffSum = 0;
  for (let i = 0; i < L.length; i += step) {
    diffSum += Math.abs(L[i] - R[i]);
  }

  const avgDiff = diffSum / sampleCount;
  return avgDiff > 0.0001;
}

function estimateEffectiveBitDepth(mono: Float32Array): { bits: number; noiseFloorDB: number } {
  const windowSize = 4096;
  let minEnergy = Infinity;

  for (let i = 0; i < mono.length - windowSize; i += windowSize) {
    let energy = 0;
    for (let j = 0; j < windowSize; j++) {
      energy += mono[i + j] * mono[i + j];
    }
    if (energy < minEnergy && energy > 0) {
      minEnergy = energy;
    }
  }

  const noiseFloorDB = minEnergy > 0 ? 10 * Math.log10(minEnergy / windowSize) : -120;
  const effectiveBits = Math.min(24, Math.max(8, Math.round((-noiseFloorDB - 6) / 6)));
  return { bits: effectiveBits, noiseFloorDB };
}

// === NEW: Codec Quality Detection ===
function estimateCodecQuality(
  spectralRolloffHz: number | null,
  effectiveBitDepth: number,
  noiseFloorDB: number
): { score: number; cutoffHz: number | null; note: string | null } {
  let score = 100;
  const issues: string[] = [];
  let detectedCutoff: number | null = null;

  // Check for lossy codec spectral cutoff
  // MP3 128kbps typically cuts off around 16kHz
  // MP3 192kbps around 18kHz
  // AAC 128kbps around 15kHz
  if (spectralRolloffHz !== null) {
    if (spectralRolloffHz < 15000) {
      score -= 40;
      detectedCutoff = spectralRolloffHz;
      issues.push(`Spectral cutoff at ${Math.round(spectralRolloffHz / 1000)}kHz indicates lossy compression`);
    } else if (spectralRolloffHz < 17000) {
      score -= 20;
      detectedCutoff = spectralRolloffHz;
      issues.push(`Reduced high-frequency content (${Math.round(spectralRolloffHz / 1000)}kHz)`);
    } else if (spectralRolloffHz < 19000) {
      score -= 10;
      detectedCutoff = spectralRolloffHz;
    }
  }

  // Penalize low effective bit depth
  if (effectiveBitDepth <= 12) {
    score -= 25;
    issues.push(`Low effective bit depth (~${effectiveBitDepth}-bit)`);
  } else if (effectiveBitDepth <= 14) {
    score -= 15;
  } else if (effectiveBitDepth <= 16) {
    score -= 5;
  }

  // Elevated noise floor
  if (noiseFloorDB > -60) {
    score -= 15;
    issues.push("Elevated noise floor");
  } else if (noiseFloorDB > -70) {
    score -= 5;
  }

  score = Math.max(0, Math.min(100, score));

  let note: string | null = null;
  if (issues.length > 0) {
    note = issues.join("; ");
  } else if (score >= 90) {
    note = "High quality source";
  }

  return { score, cutoffHz: detectedCutoff, note };
}

export interface AnalysisProgress {
  stage: string;
  stageIdx: number;
}

export function analyzeTrack(
  decoded: DecodedTrackData,
  trackNumber: number,
  onProgress?: (progress: AnalysisProgress) => void
): TrackAnalysis {
  const durationSeconds = decoded.channelData[0].length / decoded.sampleRate;

  // Create mono mix
  const n = decoded.channelData[0].length;
  const mono = new Float32Array(n);
  for (let s = 0; s < n; s++) {
    let x = 0;
    for (let ch = 0; ch < decoded.channelData.length; ch++) {
      x += decoded.channelData[ch][s] ?? 0;
    }
    mono[s] = x / decoded.channelData.length;
  }

  // Detect true stereo vs dual mono
  const isTrueStereo = decoded.channelData.length >= 2
    ? detectTrueStereo(decoded.channelData[0], decoded.channelData[1])
    : false;

  // Estimate effective bit depth and noise floor
  const bitDepthResult = estimateEffectiveBitDepth(mono);

  // Initial params (codec quality added after spectral analysis)
  const params: AudioParameters = {
    filename: decoded.filename,
    filesizeMB: bytesToMB(decoded.filesize),
    durationSeconds,
    durationFormatted: formatDuration(durationSeconds),
    format: undefined,
    sampleRate: decoded.sampleRate,
    decodedSampleRate: decoded.sampleRate,
    channels: decoded.channels,
    bitDepth: undefined,
    effectiveBitDepth: bitDepthResult.bits,
    noiseFloorDB: bitDepthResult.noiseFloorDB,
    overallBitrate: undefined,
    isTrueStereo
  };

  // Compute all metrics with stage progress
  onProgress?.({ stage: 'Loudness', stageIdx: 0 });
  const loud = computeLoudness(decoded.sampleRate, decoded.channelData);

  onProgress?.({ stage: 'Dynamics', stageIdx: 1 });
  const dyn = computeDynamics(decoded.channelData, decoded.sampleRate);

  onProgress?.({ stage: 'Stereo', stageIdx: 2 });
  const st = computeStereo(decoded.channelData, decoded.sampleRate);

  onProgress?.({ stage: 'Spectral', stageIdx: 3 });
  const bands = computeBandEnergiesMono(mono, decoded.sampleRate);

  // Compute THD (harmonic distortion)
  const harmonicDistortion = computeTHD(mono, decoded.sampleRate);

  // Compute codec quality after spectral analysis (needs spectralRolloffHz)
  const codecQuality = estimateCodecQuality(
    bands.spectralRolloffHz,
    bitDepthResult.bits,
    bitDepthResult.noiseFloorDB
  );
  params.spectralCutoffHz = codecQuality.cutoffHz ?? undefined;
  params.codecQualityScore = codecQuality.score;
  params.codecQualityNote = codecQuality.note ?? undefined;

  onProgress?.({ stage: 'Musical', stageIdx: 4 });
  const musical = computeMusicalFeatures(mono, decoded.sampleRate);

  onProgress?.({ stage: 'Streaming', stageIdx: 5 });
  const streaming = computeStreamingSimulation(loud.integratedLUFS, loud.truePeakDBTP);

  // Compute PLR/PSR
  const plrDB = loud.truePeakDBTP - loud.integratedLUFS;
  const psrDB = loud.truePeakDBTP - loud.maxShortTermLUFS;

  const track: TrackAnalysis = {
    trackNumber,
    parameters: params,
    loudness: {
      integratedLUFS: loud.integratedLUFS,
      integratedUngatedLUFS: loud.integratedUngatedLUFS,
      truePeakDBTP: loud.truePeakDBTP,
      samplePeakDBFS: loud.samplePeakDBFS,
      truePeakOversampling: loud.truePeakOversampling,
      ispMarginDB: loud.ispMarginDB,
      maxMomentaryLUFS: loud.maxMomentaryLUFS,
      maxShortTermLUFS: loud.maxShortTermLUFS,
      shortTermP10: loud.shortTermP10,
      shortTermP50: loud.shortTermP50,
      shortTermP90: loud.shortTermP90,
      shortTermP95: loud.shortTermP95,
      loudnessRangeLU: loud.loudnessRangeLU,
      shortTermTimeline: loud.shortTermTimeline,
      loudestSegmentTime: loud.loudestSegmentTime,
      quietestSegmentTime: loud.quietestSegmentTime,
      abruptChanges: loud.abruptChanges,
      loudnessSlopeDBPerMin: loud.loudnessSlopeDBPerMin,
      loudnessVolatilityLU: loud.loudnessVolatilityLU,
      peakClusteringType: loud.peakClusteringType,
      peakClusterCount: loud.peakClusterCount,
      tpToLoudnessAtPeak: loud.tpToLoudnessAtPeak,
      // === NEW: Loudness Correction ===
      loudnessCorrectionDB: loud.loudnessCorrectionDB,
      loudnessCorrectionNote: loud.loudnessCorrectionNote,
      // === NEW: Per-Band Loudness (Phase 2.1) ===
      perBandLoudness: loud.perBandLoudness
    },
    dynamics: {
      peakDBFS: dyn.peakDBFS,
      rmsDBFS: dyn.rmsDBFS,
      crestFactorDB: dyn.crestFactorDB,
      dynamicRangeDB: dyn.dynamicRangeDB,
      dcOffset: dyn.dcOffset,
      hasClipping: dyn.hasClipping,
      silenceAtStartMs: dyn.silenceAtStartMs,
      silenceAtEndMs: dyn.silenceAtEndMs,
      plrDB,
      psrDB,
      transientDensity: dyn.transientDensity,
      microdynamicContrast: dyn.microdynamicContrast,
      clippedSampleCount: dyn.clippedSampleCount,
      clipEventCount: dyn.clipEventCount,
      clipDensityPerMinute: dyn.clipDensityPerMinute,
      worstClipTimestamps: dyn.worstClipTimestamps,
      attackSpeedIndex: dyn.attackSpeedIndex,
      releaseTailMs: dyn.releaseTailMs,
      // === NEW: Dynamics enhancements ===
      dynamicPreservationScore: dyn.dynamicPreservationScore,
      dynamicPreservationNote: dyn.dynamicPreservationNote,
      transientSpacingCV: dyn.transientSpacingCV,
      transientTimingCharacter: dyn.transientTimingCharacter,
      compressionEstimate: dyn.compressionEstimate,
      transientSharpness: dyn.transientSharpness
    },
    spectral: {
      spectralCentroidHz: bands.spectralCentroidHz,
      spectralRolloffHz: bands.spectralRolloffHz,
      highFreqEnergy8k16kDB: bands.highFreqEnergy8k16kDB,
      sibilanceEnergy4k10kDB: bands.sibilanceEnergy4k10kDB,
      subBassEnergy20_80DB: bands.subBassEnergy20_80DB,
      spectralTiltDBPerOctave: bands.spectralTiltDBPerOctave,
      bassToMidRatioDB: bands.bassToMidRatioDB,
      midToHighRatioDB: bands.midToHighRatioDB,
      harshnessIndex: bands.harshnessIndex,
      sibilanceIndex: bands.sibilanceIndex,
      spectralFlatness: bands.spectralFlatness,
      harmonicToNoiseRatio: bands.harmonicToNoiseRatio,
      crestByBand: bands.crestByBand,
      harshnessIndexWeighted: bands.harshnessIndexWeighted,
      sibilanceIndexWeighted: bands.sibilanceIndexWeighted,
      spectralTiltWeightedDBPerOctave: bands.spectralTiltWeightedDBPerOctave,
      spectralBalanceStatus: bands.spectralBalanceStatus,
      spectralBalanceNote: bands.spectralBalanceNote,
      // === NEW: Harmonic Distortion (Phase 4.1) ===
      harmonicDistortion
    },
    stereo: {
      stereoWidthPct: st.stereoWidthPct,
      midEnergyDB: st.midEnergyDB,
      sideEnergyDB: st.sideEnergyDB,
      correlation: st.correlation,
      subBassMonoCompatible: st.subBassMonoCompatible,
      balanceDB: st.balanceDB,
      correlationMean: st.correlationMean,
      correlationWorst1Pct: st.correlationWorst1Pct,
      worstCorrelationTimestamps: st.worstCorrelationTimestamps,
      lowBandWidthPct: st.lowBandWidthPct,
      presenceBandWidthPct: st.presenceBandWidthPct,
      airBandWidthPct: st.airBandWidthPct,
      monoLoudnessDiffDB: st.monoLoudnessDiffDB,
      worstCancellationTimestamps: st.worstCancellationTimestamps,
      lowEndPhaseIssues: st.lowEndPhaseIssues,
      correlationEnergyWeighted: st.correlationEnergyWeighted,
      spectralAsymmetryHz: st.spectralAsymmetryHz,
      spectralAsymmetryNote: st.spectralAsymmetryNote
    },
    aiArtifacts: {
      shimmerDetected: false,
      shimmerScore: null,
      roboticTiming: false,
      timingScore: null,
      overallAIScore: null
    },
    musicalFeatures: musical,
    streamingSimulation: streaming,
    distributionReady: true,
    issues: [],
    warnings: []
  };

  track.aiArtifacts = detectAIArtifacts(track);

  const evalRes = evaluateDistribution(track);
  track.distributionReady = evalRes.ready;
  track.issues = evalRes.issues;
  track.warnings = evalRes.warnings;

  return track;
}
