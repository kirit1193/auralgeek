/**
 * Dynamics analysis module
 * Computes peak, RMS, crest factor, clipping, transients, and envelope characteristics
 */

import { dbFromLinear } from '../../core/format.js';

export interface DynamicsOut {
  peakDBFS: number;
  rmsDBFS: number;
  crestFactorDB: number;
  dynamicRangeDB: number;
  dcOffset: number;
  hasClipping: boolean;
  silenceAtStartMs: number;
  silenceAtEndMs: number;

  // Enhanced clipping taxonomy
  clippedSampleCount: number;
  clipEventCount: number;
  clipDensityPerMinute: number;
  worstClipTimestamps: number[];

  // Microdynamics
  transientDensity: number; // events per minute
  microdynamicContrast: number; // median of short-window crest factors

  // Dynamic envelope characterization (1.1B)
  attackSpeedIndex: number; // median positive slope of RMS envelope (dB/ms)
  releaseTailMs: number; // median decay time from peak to -10dB

  // === NEW: Dynamic Range Preservation Score ===
  dynamicPreservationScore: number;
  dynamicPreservationNote: string;

  // === NEW: Transient Spacing Analysis ===
  transientSpacingCV: number;
  transientTimingCharacter: "robotic" | "tight" | "natural" | "loose";

  // === NEW: Compression Detection ===
  compressionEstimate: {
    estimatedRatio: number | null;
    estimatedThresholdDB: number | null;
    compressionCharacter: "light" | "moderate" | "heavy" | "brickwall" | null;
    confidence: "low" | "medium" | "high";
  };

  // === NEW: Transient Sharpness ===
  transientSharpness: {
    attackSteepnessScore: number;
    spacingUniformityScore: number;
    avgAttackMs: number | null;
    avgDecayMs: number | null;
  };
}

interface ClippingAnalysis {
  hasClipping: boolean;
  clippedSampleCount: number;
  clipEventCount: number;
  clipDensityPerMinute: number;
  worstClipTimestamps: number[];
}

function detectTransients(mono: Float32Array, sampleRate: number): number[] {
  const windowMs = 10;
  const windowSize = Math.floor(sampleRate * windowMs / 1000);
  const hopSize = Math.floor(windowSize / 2);
  const transientTimes: number[] = [];

  const energies: number[] = [];
  for (let i = 0; i + windowSize < mono.length; i += hopSize) {
    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      sum += mono[i + j] * mono[i + j];
    }
    energies.push(sum / windowSize);
  }

  const derivatives: number[] = [];
  for (let i = 1; i < energies.length; i++) {
    derivatives.push(Math.max(0, energies[i] - energies[i - 1]));
  }

  if (derivatives.length === 0) return [];
  const meanDeriv = derivatives.reduce((a, b) => a + b, 0) / derivatives.length;
  const variance = derivatives.reduce((a, b) => a + (b - meanDeriv) ** 2, 0) / derivatives.length;
  const stdDeriv = Math.sqrt(variance);
  const threshold = meanDeriv + 2 * stdDeriv;

  const minGapSamples = Math.floor(sampleRate * 0.05 / hopSize);
  let lastTransientIdx = -minGapSamples;

  for (let i = 0; i < derivatives.length; i++) {
    if (derivatives[i] > threshold && i - lastTransientIdx >= minGapSamples) {
      const timeSec = (i * hopSize) / sampleRate;
      transientTimes.push(timeSec);
      lastTransientIdx = i;
    }
  }

  return transientTimes;
}

function computeMicrodynamicContrast(mono: Float32Array, sampleRate: number): number {
  const windowMs = 100;
  const windowSize = Math.floor(sampleRate * windowMs / 1000);
  const hopSize = Math.floor(windowSize / 2);
  const crestFactors: number[] = [];

  for (let i = 0; i + windowSize < mono.length; i += hopSize) {
    let peak = 0;
    let sumSq = 0;
    for (let j = 0; j < windowSize; j++) {
      const abs = Math.abs(mono[i + j]);
      if (abs > peak) peak = abs;
      sumSq += mono[i + j] * mono[i + j];
    }
    const rms = Math.sqrt(sumSq / windowSize);
    if (rms > 0.0001 && peak > 0) {
      const crestDB = dbFromLinear(peak) - dbFromLinear(rms);
      if (isFinite(crestDB) && crestDB > 0) {
        crestFactors.push(crestDB);
      }
    }
  }

  if (crestFactors.length === 0) return 0;
  crestFactors.sort((a, b) => a - b);
  return crestFactors[Math.floor(crestFactors.length / 2)];
}

function computeAttackSpeedIndex(mono: Float32Array, sampleRate: number): number {
  const windowMs = 10;
  const windowSize = Math.floor(sampleRate * windowMs / 1000);
  const hopSize = Math.floor(windowSize / 2);

  const rmsEnvelope: number[] = [];
  for (let i = 0; i + windowSize < mono.length; i += hopSize) {
    let sumSq = 0;
    for (let j = 0; j < windowSize; j++) {
      sumSq += mono[i + j] * mono[i + j];
    }
    const rmsLinear = Math.sqrt(sumSq / windowSize);
    const rmsDB = rmsLinear > 0.0001 ? dbFromLinear(rmsLinear) : -100;
    rmsEnvelope.push(rmsDB);
  }

  const posSlopes: number[] = [];
  const hopMs = hopSize / sampleRate * 1000;

  for (let i = 1; i < rmsEnvelope.length; i++) {
    const slope = (rmsEnvelope[i] - rmsEnvelope[i - 1]) / hopMs;
    if (slope > 0.1) {
      posSlopes.push(slope);
    }
  }

  if (posSlopes.length === 0) return 0;
  posSlopes.sort((a, b) => a - b);
  return posSlopes[Math.floor(posSlopes.length / 2)];
}

function computeReleaseTailMs(mono: Float32Array, sampleRate: number): number {
  const windowMs = 10;
  const windowSize = Math.floor(sampleRate * windowMs / 1000);
  const hopSize = Math.floor(windowSize / 2);

  const rmsEnvelope: number[] = [];
  for (let i = 0; i + windowSize < mono.length; i += hopSize) {
    let sumSq = 0;
    for (let j = 0; j < windowSize; j++) {
      sumSq += mono[i + j] * mono[i + j];
    }
    const rmsLinear = Math.sqrt(sumSq / windowSize);
    rmsEnvelope.push(rmsLinear > 0.0001 ? dbFromLinear(rmsLinear) : -100);
  }

  const decayTimes: number[] = [];
  const hopMs = hopSize / sampleRate * 1000;

  for (let i = 1; i < rmsEnvelope.length - 1; i++) {
    if (rmsEnvelope[i] > rmsEnvelope[i - 1] && rmsEnvelope[i] > rmsEnvelope[i + 1] && rmsEnvelope[i] > -40) {
      const peakLevel = rmsEnvelope[i];
      const targetLevel = peakLevel - 10;

      for (let j = i + 1; j < rmsEnvelope.length; j++) {
        if (rmsEnvelope[j] <= targetLevel) {
          const decayMs = (j - i) * hopMs;
          if (decayMs > 0 && decayMs < 2000) {
            decayTimes.push(decayMs);
          }
          break;
        }
      }
    }
  }

  if (decayTimes.length === 0) return 0;
  decayTimes.sort((a, b) => a - b);
  return decayTimes[Math.floor(decayTimes.length / 2)];
}

function analyzeClipping(channels: Float32Array[], sampleRate: number): ClippingAnalysis {
  const clipThreshold = 0.9999;
  let clippedSampleCount = 0;
  let clipEventCount = 0;
  const clipEvents: { start: number; duration: number }[] = [];

  for (let ch = 0; ch < channels.length; ch++) {
    const channel = channels[ch];
    let inClip = false;
    let clipStart = 0;

    for (let i = 0; i < channel.length; i++) {
      const isClipped = Math.abs(channel[i]) >= clipThreshold;

      if (isClipped) {
        clippedSampleCount++;
        if (!inClip) {
          inClip = true;
          clipStart = i;
          clipEventCount++;
        }
      } else if (inClip) {
        inClip = false;
        const duration = i - clipStart;
        clipEvents.push({ start: clipStart / sampleRate, duration: duration / sampleRate });
      }
    }

    if (inClip) {
      const duration = channel.length - clipStart;
      clipEvents.push({ start: clipStart / sampleRate, duration: duration / sampleRate });
    }
  }

  const durationMin = channels[0].length / sampleRate / 60;
  const clipDensityPerMinute = durationMin > 0 ? clipEventCount / durationMin : 0;

  const sortedEvents = clipEvents.sort((a, b) => b.duration - a.duration);
  const worstClipTimestamps = sortedEvents.slice(0, 5).map(e => e.start);

  return {
    hasClipping: clippedSampleCount > 0,
    clippedSampleCount,
    clipEventCount,
    clipDensityPerMinute,
    worstClipTimestamps
  };
}

// === NEW: Dynamic Range Preservation Score ===
function computeDynamicPreservationScore(
  crestFactorDB: number,
  dynamicRangeDB: number,
  hasClipping: boolean,
  microdynamicContrast: number
): { score: number; note: string } {
  let score = 100;

  // Penalize low crest factor (< 6 dB = heavily limited)
  if (crestFactorDB < 6) {
    score -= (6 - crestFactorDB) * 8;
  } else if (crestFactorDB < 10) {
    score -= (10 - crestFactorDB) * 3;
  }

  // Penalize low dynamic range (< 6 dB = flat)
  if (dynamicRangeDB < 6) {
    score -= (6 - dynamicRangeDB) * 6;
  } else if (dynamicRangeDB < 10) {
    score -= (10 - dynamicRangeDB) * 2;
  }

  // Penalize low microdynamic contrast
  if (microdynamicContrast < 4) {
    score -= (4 - microdynamicContrast) * 5;
  }

  // Heavy penalty for clipping
  if (hasClipping) {
    score -= 15;
  }

  score = Math.max(0, Math.min(100, score));

  let note: string;
  if (score >= 85) {
    note = "Excellent dynamic preservation";
  } else if (score >= 70) {
    note = "Good dynamics, moderate processing";
  } else if (score >= 50) {
    note = "Compressed, reduced dynamics";
  } else {
    note = "Heavily compressed/limited";
  }

  return { score, note };
}

// === NEW: Transient Spacing Analysis ===
function computeTransientSpacingMetrics(transientTimes: number[]): {
  cv: number;
  character: "robotic" | "tight" | "natural" | "loose";
} {
  if (transientTimes.length < 3) {
    return { cv: 0, character: "natural" };
  }

  // Compute inter-onset intervals
  const intervals: number[] = [];
  for (let i = 1; i < transientTimes.length; i++) {
    intervals.push(transientTimes[i] - transientTimes[i - 1]);
  }

  // Compute mean and standard deviation
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  if (mean <= 0) return { cv: 0, character: "natural" };

  const variance = intervals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean;

  // Classify timing character
  let character: "robotic" | "tight" | "natural" | "loose";
  if (cv < 0.08) {
    character = "robotic";
  } else if (cv < 0.18) {
    character = "tight";
  } else if (cv < 0.40) {
    character = "natural";
  } else {
    character = "loose";
  }

  return { cv, character };
}

// === NEW: Compression Detection ===
function estimateCompression(
  dynamicRangeDB: number,
  crestFactorDB: number,
  clipDensityPerMinute: number,
  attackSpeedIndex: number
): {
  estimatedRatio: number | null;
  estimatedThresholdDB: number | null;
  compressionCharacter: "light" | "moderate" | "heavy" | "brickwall" | null;
  confidence: "low" | "medium" | "high";
} {
  // Heuristic-based compression detection
  // Low crest + low DR = compression signature

  let character: "light" | "moderate" | "heavy" | "brickwall" | null = null;
  let estimatedRatio: number | null = null;
  let estimatedThresholdDB: number | null = null;
  let confidence: "low" | "medium" | "high" = "low";

  // Brickwall detection: very low crest, high clip density
  if (crestFactorDB < 5 && dynamicRangeDB < 5) {
    character = "brickwall";
    estimatedRatio = 20; // Effectively limiting
    estimatedThresholdDB = -1; // Near 0 dBFS
    confidence = clipDensityPerMinute > 10 ? "high" : "medium";
  }
  // Heavy compression
  else if (crestFactorDB < 7 && dynamicRangeDB < 8) {
    character = "heavy";
    estimatedRatio = Math.round(20 / Math.max(crestFactorDB, 1));
    estimatedThresholdDB = -6;
    confidence = "medium";
  }
  // Moderate compression
  else if (crestFactorDB < 10 && dynamicRangeDB < 12) {
    character = "moderate";
    estimatedRatio = Math.round(15 / Math.max(crestFactorDB, 1));
    estimatedThresholdDB = -12;
    confidence = crestFactorDB < 8 ? "medium" : "low";
  }
  // Light or no compression
  else if (crestFactorDB < 14) {
    character = "light";
    estimatedRatio = 2;
    estimatedThresholdDB = -18;
    confidence = "low";
  }
  // No detectable compression
  else {
    character = null;
    confidence = "low";
  }

  return {
    estimatedRatio,
    estimatedThresholdDB,
    compressionCharacter: character,
    confidence
  };
}

// === NEW: Transient Sharpness Analysis ===
function computeTransientSharpnessAnalysis(
  mono: Float32Array,
  sampleRate: number,
  transientTimes: number[]
): {
  attackSteepnessScore: number;
  spacingUniformityScore: number;
  avgAttackMs: number | null;
  avgDecayMs: number | null;
} {
  if (transientTimes.length < 2) {
    return {
      attackSteepnessScore: 50,
      spacingUniformityScore: 100,
      avgAttackMs: null,
      avgDecayMs: null
    };
  }

  const attackSlopes: number[] = [];
  const decayTimes: number[] = [];
  const windowMs = 20;
  const windowSize = Math.floor(sampleRate * windowMs / 1000);

  for (const transientTime of transientTimes) {
    const sampleIdx = Math.floor(transientTime * sampleRate);
    if (sampleIdx + windowSize >= mono.length || sampleIdx < windowSize) continue;

    // Measure attack slope (dB/ms)
    const preWindow = Math.floor(windowSize / 4);
    let preRms = 0;
    let postRms = 0;

    for (let i = 0; i < preWindow; i++) {
      preRms += mono[sampleIdx - preWindow + i] * mono[sampleIdx - preWindow + i];
      postRms += mono[sampleIdx + i] * mono[sampleIdx + i];
    }
    preRms = Math.sqrt(preRms / preWindow);
    postRms = Math.sqrt(postRms / preWindow);

    if (preRms > 0.0001 && postRms > 0.0001) {
      const dbDiff = dbFromLinear(postRms) - dbFromLinear(preRms);
      const timeMs = (preWindow / sampleRate) * 1000;
      const slope = dbDiff / timeMs;
      if (slope > 0.1) {
        attackSlopes.push(slope);
      }
    }

    // Measure decay time
    const peakIdx = sampleIdx;
    let peakVal = 0;
    for (let i = 0; i < windowSize && peakIdx + i < mono.length; i++) {
      peakVal = Math.max(peakVal, Math.abs(mono[peakIdx + i]));
    }

    if (peakVal > 0.01) {
      const targetVal = peakVal * 0.316; // -10dB
      for (let i = windowSize; i < windowSize * 10 && peakIdx + i < mono.length; i++) {
        if (Math.abs(mono[peakIdx + i]) <= targetVal) {
          const decayMs = (i / sampleRate) * 1000;
          if (decayMs > 1 && decayMs < 500) {
            decayTimes.push(decayMs);
          }
          break;
        }
      }
    }
  }

  // Compute attack steepness score (0-100)
  let avgAttackMs: number | null = null;
  let attackSteepnessScore = 50;
  if (attackSlopes.length > 0) {
    attackSlopes.sort((a, b) => a - b);
    const medianSlope = attackSlopes[Math.floor(attackSlopes.length / 2)];
    // Normalize: 0.5 dB/ms = score 50, 2.0 dB/ms = score 100, 0.1 dB/ms = score 10
    attackSteepnessScore = Math.min(100, Math.max(0, medianSlope * 50));
    avgAttackMs = 10 / Math.max(medianSlope, 0.1); // Approximate attack time
  }

  // Compute decay average
  let avgDecayMs: number | null = null;
  if (decayTimes.length > 0) {
    decayTimes.sort((a, b) => a - b);
    avgDecayMs = decayTimes[Math.floor(decayTimes.length / 2)];
  }

  // Spacing uniformity from CV
  const spacing = computeTransientSpacingMetrics(transientTimes);
  // CV of 0 = 100% uniform, CV of 0.5 = 0% uniform
  const spacingUniformityScore = Math.max(0, Math.min(100, (1 - spacing.cv * 2) * 100));

  return {
    attackSteepnessScore: Math.round(attackSteepnessScore),
    spacingUniformityScore: Math.round(spacingUniformityScore),
    avgAttackMs: avgAttackMs !== null ? Math.round(avgAttackMs * 10) / 10 : null,
    avgDecayMs: avgDecayMs !== null ? Math.round(avgDecayMs) : null
  };
}

export function computeDynamics(channels: Float32Array[], sampleRate: number = 48000): DynamicsOut {
  const n = channels[0].length;
  let sum = 0;
  let sumSq = 0;
  let peak = 0;

  const absValues: number[] = [];
  const sampleStep = Math.max(1, Math.floor(n / 10000));

  const mono = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    let x = 0;
    for (let ch = 0; ch < channels.length; ch++) x += channels[ch][i] ?? 0;
    x /= channels.length;
    mono[i] = x;

    sum += x;
    sumSq += x * x;

    const ax = Math.abs(x);
    if (ax > peak) peak = ax;

    if (i % sampleStep === 0 && ax > 0.0001) {
      absValues.push(ax);
    }
  }

  const dc = sum / n;
  const rms = Math.sqrt(sumSq / n);
  const peakDB = dbFromLinear(peak);
  const rmsDB = dbFromLinear(rms);
  const crest = peakDB - rmsDB;

  absValues.sort((a, b) => a - b);
  const p10 = absValues[Math.floor(absValues.length * 0.10)] || 0.0001;
  const p95 = absValues[Math.floor(absValues.length * 0.95)] || peak;
  const dynamicRangeDB = dbFromLinear(p95) - dbFromLinear(p10);

  const silenceThreshold = 0.001;
  let silenceStartSamples = 0;
  let silenceEndSamples = 0;

  for (let i = 0; i < n; i++) {
    let maxAbs = 0;
    for (let ch = 0; ch < channels.length; ch++) maxAbs = Math.max(maxAbs, Math.abs(channels[ch][i]));
    if (maxAbs > silenceThreshold) break;
    silenceStartSamples++;
  }

  for (let i = n - 1; i >= 0; i--) {
    let maxAbs = 0;
    for (let ch = 0; ch < channels.length; ch++) maxAbs = Math.max(maxAbs, Math.abs(channels[ch][i]));
    if (maxAbs > silenceThreshold) break;
    silenceEndSamples++;
  }

  const clippingAnalysis = analyzeClipping(channels, sampleRate);

  const transientTimes = detectTransients(mono, sampleRate);
  const durationMin = n / sampleRate / 60;
  const transientDensity = durationMin > 0 ? transientTimes.length / durationMin : 0;

  const microdynamicContrast = computeMicrodynamicContrast(mono, sampleRate);

  const attackSpeedIndex = computeAttackSpeedIndex(mono, sampleRate);
  const releaseTailMs = computeReleaseTailMs(mono, sampleRate);

  // === NEW: Compute additional metrics ===
  const dynamicRangeDBClamped = Math.max(0, dynamicRangeDB);
  const preservation = computeDynamicPreservationScore(
    crest,
    dynamicRangeDBClamped,
    clippingAnalysis.hasClipping,
    microdynamicContrast
  );

  const spacing = computeTransientSpacingMetrics(transientTimes);

  const compression = estimateCompression(
    dynamicRangeDBClamped,
    crest,
    clippingAnalysis.clipDensityPerMinute,
    attackSpeedIndex
  );

  const sharpness = computeTransientSharpnessAnalysis(mono, sampleRate, transientTimes);

  return {
    peakDBFS: peakDB,
    rmsDBFS: rmsDB,
    crestFactorDB: crest,
    dynamicRangeDB: dynamicRangeDBClamped,
    dcOffset: dc,
    hasClipping: clippingAnalysis.hasClipping,
    silenceAtStartMs: Math.round((silenceStartSamples / sampleRate) * 1000),
    silenceAtEndMs: Math.round((silenceEndSamples / sampleRate) * 1000),
    clippedSampleCount: clippingAnalysis.clippedSampleCount,
    clipEventCount: clippingAnalysis.clipEventCount,
    clipDensityPerMinute: clippingAnalysis.clipDensityPerMinute,
    worstClipTimestamps: clippingAnalysis.worstClipTimestamps,
    transientDensity,
    microdynamicContrast,
    attackSpeedIndex,
    releaseTailMs,
    // === NEW metrics ===
    dynamicPreservationScore: preservation.score,
    dynamicPreservationNote: preservation.note,
    transientSpacingCV: spacing.cv,
    transientTimingCharacter: spacing.character,
    compressionEstimate: compression,
    transientSharpness: sharpness
  };
}
