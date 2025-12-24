import { dbFromLinear, clamp } from "../core/format";

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

  // === NEW: Dynamic envelope characterization (1.1B) ===
  attackSpeedIndex: number; // median positive slope of RMS envelope (dB/ms)
  releaseTailMs: number; // median decay time from peak to -10dB
}

// Detect transients using energy derivative threshold
function detectTransients(mono: Float32Array, sampleRate: number): number[] {
  const windowMs = 10; // 10ms analysis window
  const windowSize = Math.floor(sampleRate * windowMs / 1000);
  const hopSize = Math.floor(windowSize / 2);
  const transientTimes: number[] = [];

  // Compute short-term energy envelope
  const energies: number[] = [];
  for (let i = 0; i + windowSize < mono.length; i += hopSize) {
    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      sum += mono[i + j] * mono[i + j];
    }
    energies.push(sum / windowSize);
  }

  // Find energy derivative peaks (transient attacks)
  const derivatives: number[] = [];
  for (let i = 1; i < energies.length; i++) {
    derivatives.push(Math.max(0, energies[i] - energies[i - 1]));
  }

  // Compute adaptive threshold (mean + 2*std of derivatives)
  if (derivatives.length === 0) return [];
  const meanDeriv = derivatives.reduce((a, b) => a + b, 0) / derivatives.length;
  const variance = derivatives.reduce((a, b) => a + (b - meanDeriv) ** 2, 0) / derivatives.length;
  const stdDeriv = Math.sqrt(variance);
  const threshold = meanDeriv + 2 * stdDeriv;

  // Detect peaks above threshold with minimum gap (50ms)
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

// Compute microdynamic contrast (median of short-window crest factors)
function computeMicrodynamicContrast(mono: Float32Array, sampleRate: number): number {
  const windowMs = 100; // 100ms windows
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

  // Return median crest factor
  crestFactors.sort((a, b) => a - b);
  return crestFactors[Math.floor(crestFactors.length / 2)];
}

// === NEW: Compute attack speed index (1.1B) ===
// Median positive slope of RMS envelope (dB/ms)
function computeAttackSpeedIndex(mono: Float32Array, sampleRate: number): number {
  const windowMs = 10; // 10ms windows for high resolution
  const windowSize = Math.floor(sampleRate * windowMs / 1000);
  const hopSize = Math.floor(windowSize / 2);

  // Compute RMS envelope in dB
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

  // Compute positive slopes (attacks)
  const posSlopes: number[] = [];
  const hopMs = hopSize / sampleRate * 1000;

  for (let i = 1; i < rmsEnvelope.length; i++) {
    const slope = (rmsEnvelope[i] - rmsEnvelope[i - 1]) / hopMs; // dB/ms
    if (slope > 0.1) { // Only significant positive slopes
      posSlopes.push(slope);
    }
  }

  if (posSlopes.length === 0) return 0;

  // Return median positive slope
  posSlopes.sort((a, b) => a - b);
  return posSlopes[Math.floor(posSlopes.length / 2)];
}

// === NEW: Compute release tail index (1.1B) ===
// Median decay time from peak to -10dB
function computeReleaseTailMs(mono: Float32Array, sampleRate: number): number {
  const windowMs = 10;
  const windowSize = Math.floor(sampleRate * windowMs / 1000);
  const hopSize = Math.floor(windowSize / 2);

  // Compute RMS envelope in dB
  const rmsEnvelope: number[] = [];
  for (let i = 0; i + windowSize < mono.length; i += hopSize) {
    let sumSq = 0;
    for (let j = 0; j < windowSize; j++) {
      sumSq += mono[i + j] * mono[i + j];
    }
    const rmsLinear = Math.sqrt(sumSq / windowSize);
    rmsEnvelope.push(rmsLinear > 0.0001 ? dbFromLinear(rmsLinear) : -100);
  }

  // Find peaks and measure decay times
  const decayTimes: number[] = [];
  const hopMs = hopSize / sampleRate * 1000;

  for (let i = 1; i < rmsEnvelope.length - 1; i++) {
    // Check if this is a local peak
    if (rmsEnvelope[i] > rmsEnvelope[i - 1] && rmsEnvelope[i] > rmsEnvelope[i + 1] && rmsEnvelope[i] > -40) {
      const peakLevel = rmsEnvelope[i];
      const targetLevel = peakLevel - 10; // -10dB from peak

      // Find how long until we reach -10dB
      for (let j = i + 1; j < rmsEnvelope.length; j++) {
        if (rmsEnvelope[j] <= targetLevel) {
          const decayMs = (j - i) * hopMs;
          if (decayMs > 0 && decayMs < 2000) { // Reasonable decay time
            decayTimes.push(decayMs);
          }
          break;
        }
      }
    }
  }

  if (decayTimes.length === 0) return 0;

  // Return median decay time
  decayTimes.sort((a, b) => a - b);
  return decayTimes[Math.floor(decayTimes.length / 2)];
}

// Enhanced clipping detection with taxonomy
interface ClippingAnalysis {
  hasClipping: boolean;
  clippedSampleCount: number;
  clipEventCount: number;
  clipDensityPerMinute: number;
  worstClipTimestamps: number[];
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
        // End of clip event
        inClip = false;
        const duration = i - clipStart;
        clipEvents.push({ start: clipStart / sampleRate, duration: duration / sampleRate });
      }
    }

    // Handle clip at end of file
    if (inClip) {
      const duration = channel.length - clipStart;
      clipEvents.push({ start: clipStart / sampleRate, duration: duration / sampleRate });
    }
  }

  // Calculate clip density (events per minute)
  const durationMin = channels[0].length / sampleRate / 60;
  const clipDensityPerMinute = durationMin > 0 ? clipEventCount / durationMin : 0;

  // Get worst (longest) clip timestamps
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

  // Collect absolute samples for percentile-based dynamic range
  const absValues: number[] = [];
  const sampleStep = Math.max(1, Math.floor(n / 10000)); // Sample up to 10k points for efficiency

  // Create mono mix for transient analysis
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

  // Silence detection (threshold: -60dB = 0.001)
  const silenceThreshold = 0.001;
  let silenceStartSamples = 0;
  let silenceEndSamples = 0;

  // Check start silence
  for (let i = 0; i < n; i++) {
    let maxAbs = 0;
    for (let ch = 0; ch < channels.length; ch++) maxAbs = Math.max(maxAbs, Math.abs(channels[ch][i]));
    if (maxAbs > silenceThreshold) break;
    silenceStartSamples++;
  }

  // Check end silence
  for (let i = n - 1; i >= 0; i--) {
    let maxAbs = 0;
    for (let ch = 0; ch < channels.length; ch++) maxAbs = Math.max(maxAbs, Math.abs(channels[ch][i]));
    if (maxAbs > silenceThreshold) break;
    silenceEndSamples++;
  }

  // Enhanced clipping analysis
  const clippingAnalysis = analyzeClipping(channels, sampleRate);

  // Transient detection
  const transientTimes = detectTransients(mono, sampleRate);
  const durationMin = n / sampleRate / 60;
  const transientDensity = durationMin > 0 ? transientTimes.length / durationMin : 0;

  // Microdynamic contrast
  const microdynamicContrast = computeMicrodynamicContrast(mono, sampleRate);

  // === NEW: Dynamic envelope characterization (1.1B) ===
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
    // NEW fields
    attackSpeedIndex,
    releaseTailMs
  };
}

export interface StereoOut {
  midEnergyDB: number | null;
  sideEnergyDB: number | null;
  stereoWidthPct: number | null;
  correlation: number | null;
  subBassMonoCompatible: boolean | null;
  balanceDB: number | null;

  // Time-resolved correlation
  correlationMean: number | null;
  correlationWorst1Pct: number | null;
  worstCorrelationTimestamps: number[];

  // Band-limited stereo width
  lowBandWidthPct: number | null;
  presenceBandWidthPct: number | null;
  airBandWidthPct: number | null;

  // Mono downmix impact
  monoLoudnessDiffDB: number | null;
  worstCancellationTimestamps: number[];

  // Phase anomalies
  lowEndPhaseIssues: boolean | null;

  // === NEW: Energy-aware correlation (1.3A) ===
  correlationEnergyWeighted: number | null;

  // === NEW: Stereo asymmetry (1.3B) ===
  spectralAsymmetryHz: number | null; // positive = right brighter
  spectralAsymmetryNote: string | null;
}

// Compute time-resolved correlation
function computeTimeResolvedCorrelation(
  L: Float32Array,
  R: Float32Array,
  sampleRate: number
): {
  mean: number;
  worst1Pct: number;
  worstTimestamps: number[];
} {
  const windowMs = 200; // 200ms windows
  const windowSize = Math.floor(sampleRate * windowMs / 1000);
  const hopSize = Math.floor(windowSize / 2);
  const correlations: { value: number; time: number }[] = [];

  for (let pos = 0; pos + windowSize < L.length; pos += hopSize) {
    let sumL = 0, sumR = 0, sumLL = 0, sumRR = 0, sumLR = 0;
    for (let i = pos; i < pos + windowSize; i++) {
      sumL += L[i]; sumR += R[i];
      sumLL += L[i] * L[i]; sumRR += R[i] * R[i];
      sumLR += L[i] * R[i];
    }
    const n = windowSize;
    const meanL = sumL / n, meanR = sumR / n;
    const cov = sumLR / n - meanL * meanR;
    const varL = sumLL / n - meanL * meanL;
    const varR = sumRR / n - meanR * meanR;
    const corr = (varL > 0 && varR > 0) ? cov / Math.sqrt(varL * varR) : 0;
    correlations.push({ value: corr, time: pos / sampleRate });
  }

  if (correlations.length === 0) return { mean: 0, worst1Pct: 0, worstTimestamps: [] };

  // Compute mean
  const mean = correlations.reduce((a, b) => a + b.value, 0) / correlations.length;

  // Find worst 1% (lowest correlation values)
  const sorted = [...correlations].sort((a, b) => a.value - b.value);
  const worstIdx = Math.max(1, Math.floor(sorted.length * 0.01));
  const worst1Pct = sorted[worstIdx - 1].value;
  const worstTimestamps = sorted.slice(0, 5).map(c => c.time);

  return { mean, worst1Pct, worstTimestamps };
}

// Compute band-limited stereo width
function computeBandWidth(
  L: Float32Array,
  R: Float32Array,
  sampleRate: number,
  lowFreq: number,
  highFreq: number
): number {
  const filteredL = onePoleLP(onePoleHP(L, lowFreq, sampleRate), highFreq, sampleRate);
  const filteredR = onePoleLP(onePoleHP(R, lowFreq, sampleRate), highFreq, sampleRate);

  let midSq = 0, sideSq = 0;
  for (let i = 0; i < filteredL.length; i++) {
    const mid = 0.5 * (filteredL[i] + filteredR[i]);
    const side = 0.5 * (filteredL[i] - filteredR[i]);
    midSq += mid * mid;
    sideSq += side * side;
  }

  const midRms = Math.sqrt(midSq / filteredL.length);
  const sideRms = Math.sqrt(sideSq / filteredL.length);

  return midRms > 0 ? clamp((sideRms / midRms) * 100, 0, 300) : 0;
}

// === NEW: Energy-aware correlation (1.3A) ===
// Correlation weighted by energy (ignores quiet sections below threshold)
function computeEnergyWeightedCorrelation(
  L: Float32Array,
  R: Float32Array,
  sampleRate: number
): number {
  const windowMs = 200;
  const windowSize = Math.floor(sampleRate * windowMs / 1000);
  const hopSize = Math.floor(windowSize / 2);
  const loudnessThresholdLinear = 0.01; // ~-40 dB threshold

  let weightedCorrSum = 0;
  let totalWeight = 0;

  for (let pos = 0; pos + windowSize < L.length; pos += hopSize) {
    let sumL = 0, sumR = 0, sumLL = 0, sumRR = 0, sumLR = 0;
    let energy = 0;

    for (let i = pos; i < pos + windowSize; i++) {
      sumL += L[i]; sumR += R[i];
      sumLL += L[i] * L[i]; sumRR += R[i] * R[i];
      sumLR += L[i] * R[i];
      energy += L[i] * L[i] + R[i] * R[i];
    }

    const n = windowSize;
    const rmsEnergy = Math.sqrt(energy / (n * 2));

    // Skip quiet windows
    if (rmsEnergy < loudnessThresholdLinear) continue;

    const meanL = sumL / n, meanR = sumR / n;
    const cov = sumLR / n - meanL * meanR;
    const varL = sumLL / n - meanL * meanL;
    const varR = sumRR / n - meanR * meanR;
    const corr = (varL > 0 && varR > 0) ? cov / Math.sqrt(varL * varR) : 0;

    // Weight by energy
    const weight = rmsEnergy;
    weightedCorrSum += corr * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedCorrSum / totalWeight : 0;
}

// === NEW: Stereo asymmetry (1.3B) ===
// Compute spectral centroid difference between L and R channels
function computeSpectralAsymmetry(
  L: Float32Array,
  R: Float32Array,
  sampleRate: number
): { asymmetryHz: number; note: string | null } {
  const fftSize = 4096;
  const numFrames = 20;
  const n = L.length;

  if (n < fftSize) return { asymmetryHz: 0, note: null };

  const freqResolution = sampleRate / fftSize;
  let totalCentroidL = 0;
  let totalCentroidR = 0;
  let validFrames = 0;

  const frameSpacing = Math.floor((n - fftSize) / numFrames);

  for (let frame = 0; frame < numFrames; frame++) {
    const start = frame * frameSpacing;
    if (start + fftSize > n) break;

    // Compute centroid for L channel
    const centroidL = computeChannelCentroid(L, start, fftSize, sampleRate);
    const centroidR = computeChannelCentroid(R, start, fftSize, sampleRate);

    if (centroidL > 0 && centroidR > 0) {
      totalCentroidL += centroidL;
      totalCentroidR += centroidR;
      validFrames++;
    }
  }

  if (validFrames === 0) return { asymmetryHz: 0, note: null };

  const avgCentroidL = totalCentroidL / validFrames;
  const avgCentroidR = totalCentroidR / validFrames;
  const asymmetryHz = avgCentroidR - avgCentroidL; // positive = right brighter

  // Generate note if significant asymmetry (>200Hz difference)
  let note: string | null = null;
  if (Math.abs(asymmetryHz) > 200) {
    if (asymmetryHz > 0) {
      note = "Right channel brighter than left — may cause headphone fatigue";
    } else {
      note = "Left channel brighter than right — may cause headphone fatigue";
    }
  }

  return { asymmetryHz, note };
}

// Helper: compute spectral centroid for a single channel segment
function computeChannelCentroid(channel: Float32Array, start: number, fftSize: number, sampleRate: number): number {
  const real = new Float32Array(fftSize);
  const imag = new Float32Array(fftSize);
  const freqResolution = sampleRate / fftSize;

  for (let i = 0; i < fftSize; i++) {
    const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / fftSize);
    real[i] = channel[start + i] * window;
    imag[i] = 0;
  }

  fft(real, imag);

  let totalEnergy = 0;
  let weightedSum = 0;

  for (let k = 1; k < fftSize / 2; k++) {
    const mag = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]);
    const freq = k * freqResolution;
    totalEnergy += mag;
    weightedSum += mag * freq;
  }

  return totalEnergy > 0 ? weightedSum / totalEnergy : 0;
}

// Detect mono downmix impact (phase cancellation)
function computeMonoDownmixImpact(
  L: Float32Array,
  R: Float32Array,
  sampleRate: number
): {
  loudnessDiffDB: number;
  worstCancellationTimestamps: number[];
} {
  // Compute stereo RMS
  let stereoSum = 0;
  for (let i = 0; i < L.length; i++) {
    stereoSum += L[i] * L[i] + R[i] * R[i];
  }
  const stereoRms = Math.sqrt(stereoSum / (L.length * 2));

  // Compute mono RMS (L+R summed)
  let monoSum = 0;
  for (let i = 0; i < L.length; i++) {
    const mono = (L[i] + R[i]) * 0.5;
    monoSum += mono * mono;
  }
  const monoRms = Math.sqrt(monoSum / L.length);

  const loudnessDiffDB = dbFromLinear(monoRms) - dbFromLinear(stereoRms);

  // Find worst cancellation segments (windowed analysis)
  const windowMs = 500;
  const windowSize = Math.floor(sampleRate * windowMs / 1000);
  const hopSize = Math.floor(windowSize / 2);
  const cancellations: { time: number; diff: number }[] = [];

  for (let pos = 0; pos + windowSize < L.length; pos += hopSize) {
    let stereoWin = 0, monoWin = 0;
    for (let i = pos; i < pos + windowSize; i++) {
      stereoWin += L[i] * L[i] + R[i] * R[i];
      const mono = (L[i] + R[i]) * 0.5;
      monoWin += mono * mono;
    }
    const stereoRmsWin = Math.sqrt(stereoWin / (windowSize * 2));
    const monoRmsWin = Math.sqrt(monoWin / windowSize);
    const diff = dbFromLinear(monoRmsWin) - dbFromLinear(stereoRmsWin);
    if (isFinite(diff)) {
      cancellations.push({ time: pos / sampleRate, diff });
    }
  }

  // Find worst cancellation timestamps (most negative diff)
  cancellations.sort((a, b) => a.diff - b.diff);
  const worstCancellationTimestamps = cancellations.slice(0, 5).map(c => c.time);

  return { loudnessDiffDB, worstCancellationTimestamps };
}

export function computeStereo(channels: Float32Array[], sampleRate: number): StereoOut {
  if (channels.length < 2) {
    return {
      midEnergyDB: null, sideEnergyDB: null, stereoWidthPct: null, correlation: null,
      subBassMonoCompatible: null, balanceDB: null, correlationMean: null,
      correlationWorst1Pct: null, worstCorrelationTimestamps: [],
      lowBandWidthPct: null, presenceBandWidthPct: null, airBandWidthPct: null,
      monoLoudnessDiffDB: null, worstCancellationTimestamps: [], lowEndPhaseIssues: null,
      correlationEnergyWeighted: null, spectralAsymmetryHz: null, spectralAsymmetryNote: null
    };
  }

  const L = channels[0];
  const R = channels[1];
  const n = Math.min(L.length, R.length);

  let midSq = 0;
  let sideSq = 0;

  let sumL = 0, sumR = 0, sumLL = 0, sumRR = 0, sumLR = 0;

  for (let i = 0; i < n; i++) {
    const l = L[i];
    const r = R[i];

    const mid = 0.5 * (l + r);
    const side = 0.5 * (l - r);

    midSq += mid * mid;
    sideSq += side * side;

    sumL += l; sumR += r;
    sumLL += l * l; sumRR += r * r;
    sumLR += l * r;
  }

  const midRms = Math.sqrt(midSq / n);
  const sideRms = Math.sqrt(sideSq / n);

  const midDB = dbFromLinear(midRms);
  const sideDB = dbFromLinear(sideRms);

  const width = sideRms > 0 && midRms > 0 ? clamp((sideRms / midRms) * 100, 0, 300) : 0;

  const meanL = sumL / n;
  const meanR = sumR / n;
  const cov = sumLR / n - meanL * meanR;
  const varL = sumLL / n - meanL * meanL;
  const varR = sumRR / n - meanR * meanR;
  const corr = (varL > 0 && varR > 0) ? cov / Math.sqrt(varL * varR) : 0;

  // Sub-bass mono compatibility check (correlation in 20-120Hz band)
  const subBassL = onePoleLP(onePoleHP(L, 20, sampleRate), 120, sampleRate);
  const subBassR = onePoleLP(onePoleHP(R, 20, sampleRate), 120, sampleRate);
  const subBassCorr = computeCorrelation(subBassL, subBassR);
  const subBassMonoCompatible = subBassCorr > 0.8;

  // L/R Balance: positive = right heavy, negative = left heavy
  const rmsL = Math.sqrt(sumLL / n);
  const rmsR = Math.sqrt(sumRR / n);
  const balanceDB = (rmsL > 0 && rmsR > 0) ? dbFromLinear(rmsR) - dbFromLinear(rmsL) : 0;

  // Time-resolved correlation
  const timeCorr = computeTimeResolvedCorrelation(L, R, sampleRate);

  // Band-limited stereo width
  const lowBandWidthPct = computeBandWidth(L, R, sampleRate, 20, 150);
  const presenceBandWidthPct = computeBandWidth(L, R, sampleRate, 2000, 6000);
  const airBandWidthPct = computeBandWidth(L, R, sampleRate, 10000, 20000);

  // Mono downmix impact
  const monoImpact = computeMonoDownmixImpact(L, R, sampleRate);

  // Low-end phase issues (correlation < 0.5 in sub-bass region)
  const lowEndPhaseIssues = subBassCorr < 0.5;

  // === NEW: Energy-aware correlation (1.3A) ===
  const correlationEnergyWeighted = computeEnergyWeightedCorrelation(L, R, sampleRate);

  // === NEW: Stereo asymmetry (1.3B) ===
  const asymmetry = computeSpectralAsymmetry(L, R, sampleRate);

  return {
    midEnergyDB: midDB,
    sideEnergyDB: sideDB,
    stereoWidthPct: width,
    correlation: corr,
    subBassMonoCompatible,
    balanceDB,
    correlationMean: timeCorr.mean,
    correlationWorst1Pct: timeCorr.worst1Pct,
    worstCorrelationTimestamps: timeCorr.worstTimestamps,
    lowBandWidthPct,
    presenceBandWidthPct,
    airBandWidthPct,
    monoLoudnessDiffDB: monoImpact.loudnessDiffDB,
    worstCancellationTimestamps: monoImpact.worstCancellationTimestamps,
    lowEndPhaseIssues,
    // NEW fields
    correlationEnergyWeighted,
    spectralAsymmetryHz: asymmetry.asymmetryHz,
    spectralAsymmetryNote: asymmetry.note
  };
}

function computeCorrelation(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  let sumA = 0, sumB = 0, sumAA = 0, sumBB = 0, sumAB = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i]; sumB += b[i];
    sumAA += a[i] * a[i]; sumBB += b[i] * b[i];
    sumAB += a[i] * b[i];
  }
  const meanA = sumA / n, meanB = sumB / n;
  const cov = sumAB / n - meanA * meanB;
  const varA = sumAA / n - meanA * meanA;
  const varB = sumBB / n - meanB * meanB;
  return (varA > 0 && varB > 0) ? cov / Math.sqrt(varA * varB) : 0;
}

function onePoleLP(input: Float32Array, fc: number, fs: number): Float32Array {
  const out = new Float32Array(input.length);
  const x = Math.exp(-2 * Math.PI * fc / fs);
  let y = 0;
  for (let i = 0; i < input.length; i++) {
    y = (1 - x) * input[i] + x * y;
    out[i] = y;
  }
  return out;
}

function onePoleHP(input: Float32Array, fc: number, fs: number): Float32Array {
  const lp = onePoleLP(input, fc, fs);
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) out[i] = input[i] - lp[i];
  return out;
}

function rmsDB(x: Float32Array): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  return dbFromLinear(Math.sqrt(s / x.length));
}

// Band filter with better frequency response
function bandpassFilter(input: Float32Array, lowFreq: number, highFreq: number, fs: number): Float32Array {
  return onePoleLP(onePoleHP(input, lowFreq, fs), highFreq, fs);
}

// Compute band RMS energy in dB
function bandRmsDB(input: Float32Array, lowFreq: number, highFreq: number, fs: number): number {
  const filtered = bandpassFilter(input, lowFreq, highFreq, fs);
  return rmsDB(filtered);
}

// Compute crest factor for a frequency band
function bandCrestDB(input: Float32Array, lowFreq: number, highFreq: number, fs: number): number {
  const filtered = bandpassFilter(input, lowFreq, highFreq, fs);
  let peak = 0, sumSq = 0;
  for (let i = 0; i < filtered.length; i++) {
    const abs = Math.abs(filtered[i]);
    if (abs > peak) peak = abs;
    sumSq += filtered[i] * filtered[i];
  }
  const rms = Math.sqrt(sumSq / filtered.length);
  if (rms < 0.0001 || peak < 0.0001) return 0;
  return dbFromLinear(peak) - dbFromLinear(rms);
}

export interface SpectralOut {
  highFreqEnergy8k16kDB: number;
  sibilanceEnergy4k10kDB: number;
  subBassEnergy20_80DB: number;
  spectralCentroidHz: number;
  spectralRolloffHz: number;

  // Spectral balance & tilt
  spectralTiltDBPerOctave: number;
  bassToMidRatioDB: number;
  midToHighRatioDB: number;

  // Perceptual indices
  harshnessIndex: number;
  sibilanceIndex: number;

  // Tonal vs noisy
  spectralFlatness: number;
  harmonicToNoiseRatio: number;

  // Crest by band
  crestByBand: {
    sub: number;
    bass: number;
    lowMid: number;
    mid: number;
    presence: number;
    brilliance: number;
  };

  // === NEW: Perceptual weighting (1.4A) ===
  harshnessIndexWeighted: number;
  sibilanceIndexWeighted: number;
  spectralTiltWeightedDBPerOctave: number;

  // === NEW: Spectral balance targets (1.4B) ===
  spectralBalanceStatus: "bright" | "balanced" | "dark";
  spectralBalanceNote: string | null;
}

// === NEW: A-weighting curve (1.4A) ===
// Returns A-weighting factor in dB at given frequency
function aWeighting(freq: number): number {
  if (freq < 20) return -80;
  const f2 = freq * freq;
  const f4 = f2 * f2;

  // A-weighting formula from IEC 61672-1
  const num = 12194 * 12194 * f4;
  const den = (f2 + 20.6 * 20.6) * Math.sqrt((f2 + 107.7 * 107.7) * (f2 + 737.9 * 737.9)) * (f2 + 12194 * 12194);

  if (den === 0) return -80;
  const ra = num / den;
  return 20 * Math.log10(ra) + 2.0; // +2.0 for normalization at 1kHz
}

// Compute spectral balance status (1.4B)
function computeSpectralBalanceStatus(
  tilt: number,
  harshness: number,
  centroid: number
): { status: "bright" | "balanced" | "dark"; note: string | null } {
  let brightnessScore = 0;

  // Tilt contribution (ideal: -2 to -4 dB/oct)
  if (tilt > 0) brightnessScore += 2;
  else if (tilt > -2) brightnessScore += 1;
  else if (tilt < -5) brightnessScore -= 1;
  else if (tilt < -7) brightnessScore -= 2;

  // Harshness contribution (ideal: <25%)
  if (harshness > 35) brightnessScore += 1;
  else if (harshness < 15) brightnessScore -= 1;

  // Centroid contribution (typical: 1500-3500 Hz)
  if (centroid > 4000) brightnessScore += 1;
  else if (centroid < 1200) brightnessScore -= 1;

  let status: "bright" | "balanced" | "dark";
  let note: string | null = null;

  if (brightnessScore >= 2) {
    status = "bright";
    note = "Brighter than typical — may fatigue on extended listening";
  } else if (brightnessScore <= -2) {
    status = "dark";
    note = "Darker than typical — may lack presence or clarity";
  } else {
    status = "balanced";
  }

  return { status, note };
}

// Compute A-weighted harshness (1.4A)
function computeWeightedHarshness(magnitudes: Float32Array, freqResolution: number): number {
  let weightedHarsh = 0;
  let weightedTotal = 0;

  for (let k = 1; k < magnitudes.length; k++) {
    const freq = k * freqResolution;
    const weight = Math.pow(10, aWeighting(freq) / 20);
    const weightedMag = magnitudes[k] * weight;

    if (freq >= 2000 && freq <= 5000) {
      weightedHarsh += weightedMag * weightedMag;
    }
    if (freq >= 100 && freq <= 10000) {
      weightedTotal += weightedMag * weightedMag;
    }
  }

  return weightedTotal > 0 ? (weightedHarsh / weightedTotal) * 100 : 0;
}

// Compute A-weighted sibilance (1.4A)
function computeWeightedSibilance(magnitudes: Float32Array, freqResolution: number): number {
  let weightedSib = 0;
  let weightedTotal = 0;

  for (let k = 1; k < magnitudes.length; k++) {
    const freq = k * freqResolution;
    const weight = Math.pow(10, aWeighting(freq) / 20);
    const weightedMag = magnitudes[k] * weight;

    if (freq >= 5000 && freq <= 10000) {
      weightedSib += weightedMag * weightedMag;
    }
    if (freq >= 100 && freq <= 15000) {
      weightedTotal += weightedMag * weightedMag;
    }
  }

  return weightedTotal > 0 ? (weightedSib / weightedTotal) * 100 : 0;
}

// Compute A-weighted spectral tilt (1.4A)
function computeWeightedSpectralTilt(magnitudes: Float32Array, freqResolution: number): number {
  const minBin = Math.max(1, Math.floor(100 / freqResolution));
  const maxBin = Math.min(magnitudes.length - 1, Math.floor(10000 / freqResolution));

  if (maxBin <= minBin) return 0;

  let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0;
  let count = 0;

  for (let k = minBin; k <= maxBin; k++) {
    const freq = k * freqResolution;
    if (freq < 100 || magnitudes[k] <= 0) continue;

    const weight = Math.pow(10, aWeighting(freq) / 20);
    const logFreq = Math.log2(freq);
    const magDB = 20 * Math.log10(magnitudes[k] * weight + 1e-10);

    sumX += logFreq;
    sumY += magDB;
    sumXX += logFreq * logFreq;
    sumXY += logFreq * magDB;
    count++;
  }

  if (count < 2) return 0;

  return (count * sumXY - sumX * sumY) / (count * sumXX - sumX * sumX);
}

// Cooley-Tukey FFT (radix-2, in-place)
function fft(real: Float32Array, imag: Float32Array): void {
  const n = real.length;
  if (n <= 1) return;

  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
    let k = n >> 1;
    while (k <= j) { j -= k; k >>= 1; }
    j += k;
  }

  // Cooley-Tukey iterative FFT
  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1;
    const angle = -2 * Math.PI / len;
    const wReal = Math.cos(angle);
    const wImag = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let uReal = 1, uImag = 0;
      for (let k = 0; k < halfLen; k++) {
        const evenIdx = i + k;
        const oddIdx = i + k + halfLen;

        const tReal = uReal * real[oddIdx] - uImag * imag[oddIdx];
        const tImag = uReal * imag[oddIdx] + uImag * real[oddIdx];

        real[oddIdx] = real[evenIdx] - tReal;
        imag[oddIdx] = imag[evenIdx] - tImag;
        real[evenIdx] += tReal;
        imag[evenIdx] += tImag;

        const newUReal = uReal * wReal - uImag * wImag;
        uImag = uReal * wImag + uImag * wReal;
        uReal = newUReal;
      }
    }
  }
}

// Compute spectral tilt (dB/octave slope of long-term spectrum)
function computeSpectralTilt(magnitudes: Float32Array, freqResolution: number, fs: number): number {
  // Use bins from 100Hz to 10kHz for tilt calculation
  const minBin = Math.max(1, Math.floor(100 / freqResolution));
  const maxBin = Math.min(magnitudes.length - 1, Math.floor(10000 / freqResolution));

  if (maxBin <= minBin) return 0;

  // Linear regression on log-frequency vs dB magnitude
  let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0;
  let count = 0;

  for (let k = minBin; k <= maxBin; k++) {
    const freq = k * freqResolution;
    if (freq < 100 || magnitudes[k] <= 0) continue;

    const logFreq = Math.log2(freq);
    const magDB = 20 * Math.log10(magnitudes[k] + 1e-10);

    sumX += logFreq;
    sumY += magDB;
    sumXX += logFreq * logFreq;
    sumXY += logFreq * magDB;
    count++;
  }

  if (count < 2) return 0;

  const slope = (count * sumXY - sumX * sumY) / (count * sumXX - sumX * sumX);
  return slope; // dB per octave
}

// Compute spectral flatness (Wiener entropy)
function computeSpectralFlatness(magnitudes: Float32Array): number {
  let sumLog = 0;
  let sum = 0;
  let count = 0;

  for (let k = 1; k < magnitudes.length; k++) {
    if (magnitudes[k] > 0) {
      sumLog += Math.log(magnitudes[k]);
      sum += magnitudes[k];
      count++;
    }
  }

  if (count === 0 || sum === 0) return 0;

  const geometricMean = Math.exp(sumLog / count);
  const arithmeticMean = sum / count;

  return geometricMean / arithmeticMean; // 0 = tonal, 1 = noise
}

// Compute harshness index (2-5kHz energy prominence)
function computeHarshnessIndex(magnitudes: Float32Array, freqResolution: number): number {
  const harsh = energyInBand(magnitudes, 2000, 5000, freqResolution);
  const total = energyInBand(magnitudes, 100, 10000, freqResolution);
  return total > 0 ? (harsh / total) * 100 : 0;
}

// Compute sibilance index (5-10kHz peaks)
function computeSibilanceIndex(magnitudes: Float32Array, freqResolution: number): number {
  const sibilant = energyInBand(magnitudes, 5000, 10000, freqResolution);
  const total = energyInBand(magnitudes, 100, 15000, freqResolution);
  return total > 0 ? (sibilant / total) * 100 : 0;
}

function energyInBand(magnitudes: Float32Array, lowFreq: number, highFreq: number, freqResolution: number): number {
  const lowBin = Math.floor(lowFreq / freqResolution);
  const highBin = Math.min(magnitudes.length - 1, Math.floor(highFreq / freqResolution));
  let energy = 0;
  for (let k = lowBin; k <= highBin; k++) {
    energy += magnitudes[k] * magnitudes[k];
  }
  return energy;
}

export function computeBandEnergiesMono(mono: Float32Array, fs: number): SpectralOut {
  const hf = onePoleLP(onePoleHP(mono, 8000, fs), 16000, fs);
  const sib = onePoleLP(onePoleHP(mono, 4000, fs), 10000, fs);
  const sub = onePoleLP(onePoleHP(mono, 20, fs), 80, fs);

  // Band energies for ratio calculations
  const bassEnergy = bandRmsDB(mono, 80, 250, fs);
  const midEnergy = bandRmsDB(mono, 250, 2000, fs);
  const highEnergy = bandRmsDB(mono, 2000, 8000, fs);

  // Compute spectral features using FFT
  const spectralFeatures = computeSpectralFeatures(mono, fs);

  // Crest by band
  const crestByBand = {
    sub: bandCrestDB(mono, 20, 80, fs),
    bass: bandCrestDB(mono, 80, 250, fs),
    lowMid: bandCrestDB(mono, 250, 500, fs),
    mid: bandCrestDB(mono, 500, 2000, fs),
    presence: bandCrestDB(mono, 2000, 6000, fs),
    brilliance: bandCrestDB(mono, 6000, 20000, fs)
  };

  return {
    highFreqEnergy8k16kDB: rmsDB(hf),
    sibilanceEnergy4k10kDB: rmsDB(sib),
    subBassEnergy20_80DB: rmsDB(sub),
    spectralCentroidHz: spectralFeatures.centroid,
    spectralRolloffHz: spectralFeatures.rolloff,
    spectralTiltDBPerOctave: spectralFeatures.tilt,
    bassToMidRatioDB: bassEnergy - midEnergy,
    midToHighRatioDB: midEnergy - highEnergy,
    harshnessIndex: spectralFeatures.harshness,
    sibilanceIndex: spectralFeatures.sibilance,
    spectralFlatness: spectralFeatures.flatness,
    harmonicToNoiseRatio: 0, // Placeholder - complex to compute accurately
    crestByBand,
    // NEW: A-weighted metrics (1.4A)
    harshnessIndexWeighted: spectralFeatures.harshnessWeighted,
    sibilanceIndexWeighted: spectralFeatures.sibilanceWeighted,
    spectralTiltWeightedDBPerOctave: spectralFeatures.tiltWeighted,
    // NEW: Spectral balance status (1.4B)
    spectralBalanceStatus: spectralFeatures.balanceStatus,
    spectralBalanceNote: spectralFeatures.balanceNote
  };
}

function computeSpectralFeatures(mono: Float32Array, fs: number): {
  centroid: number;
  rolloff: number;
  tilt: number;
  flatness: number;
  harshness: number;
  sibilance: number;
  // NEW: A-weighted metrics (1.4A)
  harshnessWeighted: number;
  sibilanceWeighted: number;
  tiltWeighted: number;
  // NEW: Balance status (1.4B)
  balanceStatus: "bright" | "balanced" | "dark";
  balanceNote: string | null;
} {
  const fftSize = 4096; // Larger for better frequency resolution
  const numFramesToAnalyze = 30;
  const totalSamples = mono.length;

  if (totalSamples < fftSize) {
    return {
      centroid: 0, rolloff: 0, tilt: 0, flatness: 0, harshness: 0, sibilance: 0,
      harshnessWeighted: 0, sibilanceWeighted: 0, tiltWeighted: 0,
      balanceStatus: "balanced", balanceNote: null
    };
  }

  const freqBins = fftSize / 2;
  const freqResolution = fs / fftSize;

  // Accumulate average magnitude spectrum
  const avgMagnitudes = new Float32Array(freqBins);
  let totalCentroid = 0;
  let totalRolloff = 0;
  let validFrames = 0;

  const frameSpacing = Math.floor((totalSamples - fftSize) / numFramesToAnalyze);

  for (let frame = 0; frame < numFramesToAnalyze; frame++) {
    const start = frame * frameSpacing;
    if (start + fftSize > totalSamples) break;

    const real = new Float32Array(fftSize);
    const imag = new Float32Array(fftSize);

    for (let i = 0; i < fftSize; i++) {
      const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / fftSize);
      real[i] = mono[start + i] * window;
      imag[i] = 0;
    }

    fft(real, imag);

    let totalEnergy = 0;
    for (let k = 0; k < freqBins; k++) {
      const mag = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]);
      avgMagnitudes[k] += mag;
      totalEnergy += mag;
    }

    if (totalEnergy > 0) {
      let weightedSum = 0;
      for (let k = 0; k < freqBins; k++) {
        const mag = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]);
        weightedSum += k * freqResolution * mag;
      }
      totalCentroid += weightedSum / totalEnergy;

      let cumEnergy = 0;
      const threshold = 0.85 * totalEnergy;
      for (let k = 0; k < freqBins; k++) {
        cumEnergy += Math.sqrt(real[k] * real[k] + imag[k] * imag[k]);
        if (cumEnergy >= threshold) {
          totalRolloff += k * freqResolution;
          break;
        }
      }

      validFrames++;
    }
  }

  // Average magnitudes
  for (let k = 0; k < freqBins; k++) {
    avgMagnitudes[k] /= validFrames || 1;
  }

  // Compute spectral metrics from average spectrum
  const tilt = computeSpectralTilt(avgMagnitudes, freqResolution, fs);
  const flatness = computeSpectralFlatness(avgMagnitudes);
  const harshness = computeHarshnessIndex(avgMagnitudes, freqResolution);
  const sibilance = computeSibilanceIndex(avgMagnitudes, freqResolution);

  // NEW: A-weighted metrics (1.4A)
  const harshnessWeighted = computeWeightedHarshness(avgMagnitudes, freqResolution);
  const sibilanceWeighted = computeWeightedSibilance(avgMagnitudes, freqResolution);
  const tiltWeighted = computeWeightedSpectralTilt(avgMagnitudes, freqResolution);

  // NEW: Spectral balance status (1.4B)
  const centroid = validFrames > 0 ? totalCentroid / validFrames : 0;
  const balance = computeSpectralBalanceStatus(tilt, harshness, centroid);

  return {
    centroid,
    rolloff: validFrames > 0 ? totalRolloff / validFrames : 0,
    tilt,
    flatness,
    harshness,
    sibilance,
    harshnessWeighted,
    sibilanceWeighted,
    tiltWeighted,
    balanceStatus: balance.status,
    balanceNote: balance.note
  };
}
