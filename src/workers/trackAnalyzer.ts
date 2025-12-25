/**
 * Track analysis module
 * Handles per-track audio analysis pipeline
 */

import type { TrackAnalysis, AudioParameters } from '../core/types.js';
import { computeLoudness } from '../analysis/loudness.js';
import { computeDynamics, computeStereo, computeBandEnergiesMono } from '../analysis/dsp/index.js';
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

  const overall = shimmer ? shimmerScore : 0;

  return {
    shimmerDetected: shimmer,
    shimmerScore,
    roboticTiming: false,
    timingScore: null,
    overallAIScore: overall
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

function estimateEffectiveBitDepth(mono: Float32Array): number {
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
  return effectiveBits;
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

  // Estimate effective bit depth
  const effectiveBitDepth = estimateEffectiveBitDepth(mono);

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
    effectiveBitDepth,
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
      tpToLoudnessAtPeak: loud.tpToLoudnessAtPeak
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
      releaseTailMs: dyn.releaseTailMs
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
      spectralBalanceNote: bands.spectralBalanceNote
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
