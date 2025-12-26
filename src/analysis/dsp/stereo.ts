/**
 * Stereo analysis module
 * Computes stereo width, correlation, phase issues, and mono compatibility
 */

import { dbFromLinear, clamp } from '../../core/format.js';
import { fft } from '../../utils/fft.js';
import { onePoleLP, onePoleHP } from '../../utils/filters.js';
import { dspPool, getHannWindow } from '../../utils/bufferPool.js';

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

  // Energy-aware correlation (1.3A)
  correlationEnergyWeighted: number | null;

  // Stereo asymmetry (1.3B)
  spectralAsymmetryHz: number | null;
  spectralAsymmetryNote: string | null;
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

function computeTimeResolvedCorrelation(
  L: Float32Array,
  R: Float32Array,
  sampleRate: number
): {
  mean: number;
  worst1Pct: number;
  worstTimestamps: number[];
} {
  const windowMs = 200;
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

  const mean = correlations.reduce((a, b) => a + b.value, 0) / correlations.length;

  const sorted = [...correlations].sort((a, b) => a.value - b.value);
  const worstIdx = Math.max(1, Math.floor(sorted.length * 0.01));
  const worst1Pct = sorted[worstIdx - 1].value;
  const worstTimestamps = sorted.slice(0, 5).map(c => c.time);

  return { mean, worst1Pct, worstTimestamps };
}

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

function computeEnergyWeightedCorrelation(
  L: Float32Array,
  R: Float32Array,
  sampleRate: number
): number {
  const windowMs = 200;
  const windowSize = Math.floor(sampleRate * windowMs / 1000);
  const hopSize = Math.floor(windowSize / 2);
  const loudnessThresholdLinear = 0.01;

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

    if (rmsEnergy < loudnessThresholdLinear) continue;

    const meanL = sumL / n, meanR = sumR / n;
    const cov = sumLR / n - meanL * meanR;
    const varL = sumLL / n - meanL * meanL;
    const varR = sumRR / n - meanR * meanR;
    const corr = (varL > 0 && varR > 0) ? cov / Math.sqrt(varL * varR) : 0;

    const weight = rmsEnergy;
    weightedCorrSum += corr * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedCorrSum / totalWeight : 0;
}

function computeChannelCentroid(
  channel: Float32Array,
  start: number,
  fftSize: number,
  sampleRate: number,
  real: Float32Array,
  imag: Float32Array,
  hannWindow: Float32Array
): number {
  const freqResolution = sampleRate / fftSize;

  for (let i = 0; i < fftSize; i++) {
    real[i] = channel[start + i] * hannWindow[i];
    imag[i] = 0;
  }

  fft(real, imag);

  // Power-based centroid: weight frequencies by power (mag²)
  // Matches spectral.ts for consistency
  let totalPower = 0;
  let weightedPowerSum = 0;

  for (let k = 1; k < fftSize / 2; k++) {
    const power = real[k] * real[k] + imag[k] * imag[k];
    const freq = k * freqResolution;
    totalPower += power;
    weightedPowerSum += power * freq;
  }

  return totalPower > 0 ? weightedPowerSum / totalPower : 0;
}

function computeSpectralAsymmetry(
  L: Float32Array,
  R: Float32Array,
  sampleRate: number
): { asymmetryHz: number; note: string | null } {
  const fftSize = 4096;
  const numFrames = 20;
  const n = L.length;

  if (n < fftSize) return { asymmetryHz: 0, note: null };

  let totalCentroidL = 0;
  let totalCentroidR = 0;
  let validFrames = 0;

  const frameSpacing = Math.floor((n - fftSize) / numFrames);

  // Acquire reusable FFT buffers from pool
  const real = dspPool.acquire(fftSize);
  const imag = dspPool.acquire(fftSize);
  const hannWindow = getHannWindow(fftSize);

  for (let frame = 0; frame < numFrames; frame++) {
    const start = frame * frameSpacing;
    if (start + fftSize > n) break;

    const centroidL = computeChannelCentroid(L, start, fftSize, sampleRate, real, imag, hannWindow);
    const centroidR = computeChannelCentroid(R, start, fftSize, sampleRate, real, imag, hannWindow);

    if (centroidL > 0 && centroidR > 0) {
      totalCentroidL += centroidL;
      totalCentroidR += centroidR;
      validFrames++;
    }
  }

  // Release FFT buffers back to pool
  dspPool.release(real);
  dspPool.release(imag);

  if (validFrames === 0) return { asymmetryHz: 0, note: null };

  const avgCentroidL = totalCentroidL / validFrames;
  const avgCentroidR = totalCentroidR / validFrames;
  const asymmetryHz = avgCentroidR - avgCentroidL;

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

function computeMonoDownmixImpact(
  L: Float32Array,
  R: Float32Array,
  sampleRate: number
): {
  loudnessDiffDB: number;
  worstCancellationTimestamps: number[];
} {
  let stereoSum = 0;
  for (let i = 0; i < L.length; i++) {
    stereoSum += L[i] * L[i] + R[i] * R[i];
  }
  const stereoRms = Math.sqrt(stereoSum / (L.length * 2));

  let monoSum = 0;
  for (let i = 0; i < L.length; i++) {
    const mono = (L[i] + R[i]) * 0.5;
    monoSum += mono * mono;
  }
  const monoRms = Math.sqrt(monoSum / L.length);

  const loudnessDiffDB = dbFromLinear(monoRms) - dbFromLinear(stereoRms);

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

  const subBassL = onePoleLP(onePoleHP(L, 20, sampleRate), 120, sampleRate);
  const subBassR = onePoleLP(onePoleHP(R, 20, sampleRate), 120, sampleRate);
  const subBassCorr = computeCorrelation(subBassL, subBassR);
  const subBassMonoCompatible = subBassCorr > 0.8;

  const rmsL = Math.sqrt(sumLL / n);
  const rmsR = Math.sqrt(sumRR / n);
  const balanceDB = (rmsL > 0 && rmsR > 0) ? dbFromLinear(rmsR) - dbFromLinear(rmsL) : 0;

  const timeCorr = computeTimeResolvedCorrelation(L, R, sampleRate);

  const lowBandWidthPct = computeBandWidth(L, R, sampleRate, 20, 150);
  const presenceBandWidthPct = computeBandWidth(L, R, sampleRate, 2000, 6000);
  const airBandWidthPct = computeBandWidth(L, R, sampleRate, 10000, 20000);

  const monoImpact = computeMonoDownmixImpact(L, R, sampleRate);

  const lowEndPhaseIssues = subBassCorr < 0.5;

  const correlationEnergyWeighted = computeEnergyWeightedCorrelation(L, R, sampleRate);

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
    correlationEnergyWeighted,
    spectralAsymmetryHz: asymmetry.asymmetryHz,
    spectralAsymmetryNote: asymmetry.note
  };
}
