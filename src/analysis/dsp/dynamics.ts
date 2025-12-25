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

  return {
    peakDBFS: peakDB,
    rmsDBFS: rmsDB,
    crestFactorDB: crest,
    dynamicRangeDB: Math.max(0, dynamicRangeDB),
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
    releaseTailMs
  };
}
