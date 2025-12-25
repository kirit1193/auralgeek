/**
 * Loudness Analysis Module
 *
 * Implements ITU-R BS.1770-4 / EBU R128 loudness measurement including:
 * - Integrated loudness (LUFS) with gating
 * - True peak measurement (dBTP) with 4x oversampling
 * - Loudness Range (LRA) per EBU Tech 3342
 * - Short-term and momentary loudness
 *
 * True Peak Measurement Provenance:
 * - Primary: ebur128-wasm (https://github.com/streamonkey/ebur128_wasm)
 *   Uses fixed 4x oversampling with FIR interpolation per ITU-R BS.1770-4
 *   Based on libebur128 reference implementation
 *
 * - Fallback: truePeak.ts (ITU-R BS.1770-4 Annex 2)
 *   48-tap polyphase FIR filter split into 4 phases (12 taps each)
 *   Used when ebur128-wasm returns invalid values
 */
import {
  ebur128_integrated_mono,
  ebur128_integrated_stereo,
  ebur128_true_peak_mono,
  ebur128_true_peak_stereo
} from "ebur128-wasm";

import { dbFromLinear } from "../core/format";
import { verifyTruePeak, computeSamplePeak } from "./truePeak";

export interface LoudnessResult {
  integratedLUFS: number;
  integratedUngatedLUFS: number;
  truePeakDBTP: number;
  samplePeakDBFS: number;
  truePeakOversampling: number;
  truePeakSource: 'ebur128' | 'fallback';
  truePeakWarning?: string;
  ispMarginDB: number;
  maxMomentaryLUFS: number;
  maxShortTermLUFS: number;
  shortTermP10: number;
  shortTermP50: number;
  shortTermP90: number;
  shortTermP95: number;
  loudnessRangeLU: number;
  shortTermTimeline: number[];
  loudestSegmentTime: number;
  quietestSegmentTime: number;
  abruptChanges: { time: number; deltaLU: number }[];

  // === NEW: Macro-dynamics (1.1A) ===
  loudnessSlopeDBPerMin: number;
  loudnessVolatilityLU: number;

  // === NEW: Peak clustering (1.2A) ===
  peakClusteringType: "sporadic" | "persistent" | "mixed";
  peakClusterCount: number;

  // === NEW: TP-to-loudness at loudest section (1.2B) ===
  tpToLoudnessAtPeak: number;
}

// ITU BS.1770 K-weighting pre-filter coefficients (48kHz)
// Stage 1: High shelf (+4dB @ 1681Hz)
// Stage 2: High pass (38Hz rolloff)
function createKWeightingCoeffs(sampleRate: number): { stage1: BiquadCoeffs; stage2: BiquadCoeffs } {
  // Pre-calculated for common sample rates, fallback to 48kHz coefficients
  if (sampleRate === 48000) {
    return {
      stage1: { b0: 1.53512485958697, b1: -2.69169618940638, b2: 1.19839281085285, a1: -1.69065929318241, a2: 0.73248077421585 },
      stage2: { b0: 1.0, b1: -2.0, b2: 1.0, a1: -1.99004745483398, a2: 0.99007225036621 }
    };
  } else if (sampleRate === 44100) {
    return {
      stage1: { b0: 1.53512485958697, b1: -2.69169618940638, b2: 1.19839281085285, a1: -1.69065929318241, a2: 0.73248077421585 },
      stage2: { b0: 1.0, b1: -2.0, b2: 1.0, a1: -1.98912696790837, a2: 0.98913691860121 }
    };
  }
  // Default to 48kHz
  return {
    stage1: { b0: 1.53512485958697, b1: -2.69169618940638, b2: 1.19839281085285, a1: -1.69065929318241, a2: 0.73248077421585 },
    stage2: { b0: 1.0, b1: -2.0, b2: 1.0, a1: -1.99004745483398, a2: 0.99007225036621 }
  };
}

interface BiquadCoeffs {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

function applyBiquad(input: Float32Array, coeffs: BiquadCoeffs): Float32Array {
  const output = new Float32Array(input.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const { b0, b1, b2, a1, a2 } = coeffs;

  for (let i = 0; i < input.length; i++) {
    const x = input[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    output[i] = y;
    x2 = x1; x1 = x;
    y2 = y1; y1 = y;
  }
  return output;
}

function applyKWeighting(channels: Float32Array[], sampleRate: number): Float32Array[] {
  const coeffs = createKWeightingCoeffs(sampleRate);
  return channels.map(ch => {
    const stage1Out = applyBiquad(ch, coeffs.stage1);
    return applyBiquad(stage1Out, coeffs.stage2);
  });
}

// Compute loudness in LUFS from mean square values
function msToLUFS(meanSquare: number): number {
  if (meanSquare <= 0) return -Infinity;
  return -0.691 + 10 * Math.log10(meanSquare);
}

// Compute momentary loudness (400ms windows) and short-term loudness (3s windows)
function computeWindowedLoudness(
  kWeightedChannels: Float32Array[],
  sampleRate: number
): {
  momentaryValues: number[];
  shortTermValues: number[];
  momentaryTimes: number[];
  shortTermTimes: number[];
} {
  const hopSize = Math.floor(sampleRate / 10); // 100ms hop (10Hz update rate)
  const momentaryWindow = Math.floor(sampleRate * 0.4); // 400ms
  const shortTermWindow = Math.floor(sampleRate * 3); // 3s
  const numSamples = kWeightedChannels[0].length;

  const momentaryValues: number[] = [];
  const shortTermValues: number[] = [];
  const momentaryTimes: number[] = [];
  const shortTermTimes: number[] = [];

  // Channel weights for surround (simplified for stereo: both = 1.0)
  const channelWeights = kWeightedChannels.map(() => 1.0);

  for (let pos = 0; pos < numSamples - hopSize; pos += hopSize) {
    const time = pos / sampleRate;

    // Momentary loudness (400ms)
    if (pos + momentaryWindow <= numSamples) {
      let sumMs = 0;
      for (let ch = 0; ch < kWeightedChannels.length; ch++) {
        let chSum = 0;
        for (let i = pos; i < pos + momentaryWindow; i++) {
          chSum += kWeightedChannels[ch][i] * kWeightedChannels[ch][i];
        }
        sumMs += channelWeights[ch] * (chSum / momentaryWindow);
      }
      momentaryValues.push(msToLUFS(sumMs));
      momentaryTimes.push(time);
    }

    // Short-term loudness (3s)
    if (pos + shortTermWindow <= numSamples) {
      let sumMs = 0;
      for (let ch = 0; ch < kWeightedChannels.length; ch++) {
        let chSum = 0;
        for (let i = pos; i < pos + shortTermWindow; i++) {
          chSum += kWeightedChannels[ch][i] * kWeightedChannels[ch][i];
        }
        sumMs += channelWeights[ch] * (chSum / shortTermWindow);
      }
      shortTermValues.push(msToLUFS(sumMs));
      shortTermTimes.push(time);
    }
  }

  return { momentaryValues, shortTermValues, momentaryTimes, shortTermTimes };
}

// Compute integrated loudness with optional gating (ITU BS.1770-4)
function computeIntegratedLoudness(
  kWeightedChannels: Float32Array[],
  sampleRate: number,
  gated: boolean
): number {
  const blockSize = Math.floor(sampleRate * 0.4); // 400ms blocks
  const hopSize = Math.floor(blockSize * 0.75); // 75% overlap
  const numSamples = kWeightedChannels[0].length;
  const channelWeights = kWeightedChannels.map(() => 1.0);

  // Step 1: Calculate loudness of each block
  const blockLoudness: number[] = [];
  for (let pos = 0; pos + blockSize <= numSamples; pos += hopSize) {
    let sumMs = 0;
    for (let ch = 0; ch < kWeightedChannels.length; ch++) {
      let chSum = 0;
      for (let i = pos; i < pos + blockSize; i++) {
        chSum += kWeightedChannels[ch][i] * kWeightedChannels[ch][i];
      }
      sumMs += channelWeights[ch] * (chSum / blockSize);
    }
    blockLoudness.push(sumMs);
  }

  if (!gated) {
    // Ungated: simple average of all blocks
    const avgMs = blockLoudness.reduce((a, b) => a + b, 0) / blockLoudness.length;
    return msToLUFS(avgMs);
  }

  // Step 2: Absolute threshold gating (-70 LUFS)
  const absoluteThreshold = Math.pow(10, (-70 + 0.691) / 10);
  const passAbsolute = blockLoudness.filter(ms => ms >= absoluteThreshold);

  if (passAbsolute.length === 0) return -Infinity;

  // Step 3: Relative threshold gating (-10 LU below ungated average)
  const avgAbsolute = passAbsolute.reduce((a, b) => a + b, 0) / passAbsolute.length;
  const relativeThreshold = avgAbsolute * Math.pow(10, -10 / 10); // -10 LU

  const passRelative = passAbsolute.filter(ms => ms >= relativeThreshold);
  if (passRelative.length === 0) return -Infinity;

  const avgGated = passRelative.reduce((a, b) => a + b, 0) / passRelative.length;
  return msToLUFS(avgGated);
}

// Compute LRA (Loudness Range) per EBU Tech 3342
function computeLRA(shortTermValues: number[]): number {
  // Filter out -Infinity values
  const validValues = shortTermValues.filter(v => isFinite(v) && v > -70);
  if (validValues.length < 2) return 0;

  // Absolute gate at -70 LUFS
  const absoluteGated = validValues.filter(v => v >= -70);
  if (absoluteGated.length < 2) return 0;

  // Relative gate: -20 LU below ungated average
  const ungatedAvg = absoluteGated.reduce((a, b) => a + b, 0) / absoluteGated.length;
  const relativeThreshold = ungatedAvg - 20;
  const relativeGated = absoluteGated.filter(v => v >= relativeThreshold);
  if (relativeGated.length < 2) return 0;

  // Sort and compute 10th and 95th percentiles
  const sorted = [...relativeGated].sort((a, b) => a - b);
  const p10 = sorted[Math.floor(sorted.length * 0.10)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];

  return Math.max(0, p95 - p10);
}

// Note: Sample peak computation moved to truePeak.ts (computeSamplePeak)

// Detect abrupt loudness changes (>6 LU within 2 seconds)
function findAbruptChanges(
  shortTermValues: number[],
  shortTermTimes: number[]
): { time: number; deltaLU: number }[] {
  const changes: { time: number; deltaLU: number }[] = [];
  const windowSize = 20; // ~2 seconds at 10Hz

  for (let i = windowSize; i < shortTermValues.length; i++) {
    const current = shortTermValues[i];
    const previous = shortTermValues[i - windowSize];
    if (isFinite(current) && isFinite(previous)) {
      const delta = Math.abs(current - previous);
      if (delta > 6) {
        changes.push({ time: shortTermTimes[i], deltaLU: delta });
      }
    }
  }

  // Limit to top 5 most severe
  return changes.sort((a, b) => b.deltaLU - a.deltaLU).slice(0, 5);
}

// Compute percentiles from an array
function percentile(arr: number[], p: number): number {
  const sorted = arr.filter(v => isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return -Infinity;
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)];
}

// === NEW: Compute loudness slope (1.1A) ===
// Linear regression on short-term loudness over time
function computeLoudnessSlope(
  shortTermValues: number[],
  shortTermTimes: number[]
): number {
  // Filter valid values
  const validPairs: { time: number; value: number }[] = [];
  for (let i = 0; i < shortTermValues.length; i++) {
    if (isFinite(shortTermValues[i]) && shortTermValues[i] > -70) {
      validPairs.push({ time: shortTermTimes[i], value: shortTermValues[i] });
    }
  }

  if (validPairs.length < 2) return 0;

  // Linear regression
  const n = validPairs.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (const pair of validPairs) {
    sumX += pair.time;
    sumY += pair.value;
    sumXY += pair.time * pair.value;
    sumXX += pair.time * pair.time;
  }

  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return 0;

  const slope = (n * sumXY - sumX * sumY) / denom; // dB per second
  return slope * 60; // Convert to dB per minute
}

// === NEW: Compute loudness volatility (1.1A) ===
// Std-dev of short-term LUFS after gating
function computeLoudnessVolatility(shortTermValues: number[]): number {
  const validValues = shortTermValues.filter(v => isFinite(v) && v > -70);
  if (validValues.length < 2) return 0;

  const mean = validValues.reduce((a, b) => a + b, 0) / validValues.length;
  const variance = validValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / validValues.length;
  return Math.sqrt(variance);
}

// === NEW: Analyze peak clustering (1.2A) ===
// Determines if peaks are sporadic (transients) or persistent (limiter abuse)
function analyzePeakClustering(
  channels: Float32Array[],
  sampleRate: number,
  threshold: number = 0.95 // Linear threshold for "high" samples
): { type: "sporadic" | "persistent" | "mixed"; clusterCount: number } {
  const windowMs = 50; // 50ms window for clustering
  const windowSize = Math.floor(sampleRate * windowMs / 1000);
  const hopSize = Math.floor(windowSize / 2);
  const n = channels[0].length;

  let highPeakWindows = 0;
  let totalWindows = 0;
  let clusterCount = 0;
  let inCluster = false;

  for (let pos = 0; pos + windowSize < n; pos += hopSize) {
    let maxPeak = 0;
    for (const ch of channels) {
      for (let i = pos; i < pos + windowSize; i++) {
        const abs = Math.abs(ch[i]);
        if (abs > maxPeak) maxPeak = abs;
      }
    }

    totalWindows++;
    if (maxPeak >= threshold) {
      highPeakWindows++;
      if (!inCluster) {
        clusterCount++;
        inCluster = true;
      }
    } else {
      inCluster = false;
    }
  }

  if (totalWindows === 0) return { type: "sporadic", clusterCount: 0 };

  const highPeakRatio = highPeakWindows / totalWindows;

  // Classify based on ratio and cluster count
  if (highPeakRatio > 0.3) {
    return { type: "persistent", clusterCount };
  } else if (highPeakRatio < 0.05 && clusterCount < 10) {
    return { type: "sporadic", clusterCount };
  } else {
    return { type: "mixed", clusterCount };
  }
}

export function computeLoudness(sampleRate: number, channels: Float32Array[]): LoudnessResult {
  // Use ebur128-wasm for integrated loudness and true peak (gold standard)
  // ebur128-wasm uses fixed 4x oversampling per ITU-R BS.1770-4
  let integratedLUFS: number;
  let ebur128TruePeak: number;

  if (channels.length === 1) {
    integratedLUFS = ebur128_integrated_mono(sampleRate, channels[0]);
    ebur128TruePeak = ebur128_true_peak_mono(sampleRate, channels[0]);
  } else {
    const left = channels[0];
    const right = channels[1];
    integratedLUFS = ebur128_integrated_stereo(sampleRate, left, right);
    const tpArr = ebur128_true_peak_stereo(sampleRate, left, right) as unknown as number[];
    ebur128TruePeak = Math.max(Number(tpArr[0] ?? 0), Number(tpArr[1] ?? 0));
  }

  // Sample peak (non-oversampled)
  const samplePeakLinear = computeSamplePeak(channels);
  const samplePeakDBFS = dbFromLinear(samplePeakLinear);

  // Verify true peak with fallback to ITU-R BS.1770-4 implementation
  const tpResult = verifyTruePeak(ebur128TruePeak, channels);
  const truePeakDBTP = dbFromLinear(tpResult.truePeak);

  // ISP margin (inter-sample peak headroom)
  const ispMarginDB = truePeakDBTP - samplePeakDBFS;

  // Apply K-weighting for manual loudness calculations
  const kWeightedChannels = applyKWeighting(channels, sampleRate);

  // Compute ungated integrated loudness
  const integratedUngatedLUFS = computeIntegratedLoudness(kWeightedChannels, sampleRate, false);

  // Compute momentary and short-term loudness
  const { momentaryValues, shortTermValues, momentaryTimes, shortTermTimes } =
    computeWindowedLoudness(kWeightedChannels, sampleRate);

  // Max momentary and short-term
  const maxMomentaryLUFS = momentaryValues.length > 0
    ? Math.max(...momentaryValues.filter(v => isFinite(v)))
    : integratedLUFS;
  const maxShortTermLUFS = shortTermValues.length > 0
    ? Math.max(...shortTermValues.filter(v => isFinite(v)))
    : integratedLUFS;

  // Short-term percentiles
  const shortTermP10 = percentile(shortTermValues, 0.10);
  const shortTermP50 = percentile(shortTermValues, 0.50);
  const shortTermP90 = percentile(shortTermValues, 0.90);
  const shortTermP95 = percentile(shortTermValues, 0.95);

  // LRA (Loudness Range)
  const loudnessRangeLU = computeLRA(shortTermValues);

  // Downsample timeline for UI (target ~10Hz, max 500 points)
  const maxPoints = 500;
  const step = Math.max(1, Math.floor(shortTermValues.length / maxPoints));
  const shortTermTimeline: number[] = [];
  for (let i = 0; i < shortTermValues.length; i += step) {
    shortTermTimeline.push(shortTermValues[i]);
  }

  // Find loudest and quietest segments
  let loudestIdx = 0, quietestIdx = 0;
  let loudestVal = -Infinity, quietestVal = Infinity;
  for (let i = 0; i < shortTermValues.length; i++) {
    if (isFinite(shortTermValues[i])) {
      if (shortTermValues[i] > loudestVal) {
        loudestVal = shortTermValues[i];
        loudestIdx = i;
      }
      if (shortTermValues[i] < quietestVal) {
        quietestVal = shortTermValues[i];
        quietestIdx = i;
      }
    }
  }
  const loudestSegmentTime = shortTermTimes[loudestIdx] ?? 0;
  const quietestSegmentTime = shortTermTimes[quietestIdx] ?? 0;

  // Detect abrupt changes
  const abruptChanges = findAbruptChanges(shortTermValues, shortTermTimes);

  // === NEW: Compute macro-dynamics (1.1A) ===
  const loudnessSlopeDBPerMin = computeLoudnessSlope(shortTermValues, shortTermTimes);
  const loudnessVolatilityLU = computeLoudnessVolatility(shortTermValues);

  // === NEW: Peak clustering (1.2A) ===
  const peakClustering = analyzePeakClustering(channels, sampleRate);

  // === NEW: TP-to-loudness at loudest section (1.2B) ===
  // Find the short-term loudness at the loudest segment
  const loudestSectionLUFS = shortTermValues[loudestIdx] ?? integratedLUFS;
  const tpToLoudnessAtPeak = truePeakDBTP - loudestSectionLUFS;

  return {
    integratedLUFS,
    integratedUngatedLUFS,
    truePeakDBTP,
    samplePeakDBFS,
    truePeakOversampling: 4, // Both ebur128-wasm and fallback use 4x oversampling per ITU-R BS.1770-4
    truePeakSource: tpResult.source,
    truePeakWarning: tpResult.warning,
    ispMarginDB,
    maxMomentaryLUFS,
    maxShortTermLUFS,
    shortTermP10,
    shortTermP50,
    shortTermP90,
    shortTermP95,
    loudnessRangeLU,
    shortTermTimeline,
    loudestSegmentTime,
    quietestSegmentTime,
    abruptChanges,
    loudnessSlopeDBPerMin,
    loudnessVolatilityLU,
    peakClusteringType: peakClustering.type,
    peakClusterCount: peakClustering.clusterCount,
    tpToLoudnessAtPeak
  };
}
