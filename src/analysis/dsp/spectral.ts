/**
 * Spectral analysis module
 * Computes spectral balance, tilt, harshness, sibilance, and perceptual metrics
 */

import { dbFromLinear } from '../../core/format.js';
import { fft } from '../../utils/fft.js';
import { onePoleLP, onePoleHP, bandpassFilter } from '../../utils/filters.js';

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

  // Perceptual weighting (1.4A)
  harshnessIndexWeighted: number;
  sibilanceIndexWeighted: number;
  spectralTiltWeightedDBPerOctave: number;

  // Spectral balance targets (1.4B)
  spectralBalanceStatus: "bright" | "balanced" | "dark";
  spectralBalanceNote: string | null;
}

function rmsDB(x: Float32Array): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  return dbFromLinear(Math.sqrt(s / x.length));
}

function bandRmsDB(input: Float32Array, lowFreq: number, highFreq: number, fs: number): number {
  const filtered = bandpassFilter(input, lowFreq, highFreq, fs);
  return rmsDB(filtered);
}

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

function aWeighting(freq: number): number {
  if (freq < 20) return -80;
  const f2 = freq * freq;
  const f4 = f2 * f2;

  const num = 12194 * 12194 * f4;
  const den = (f2 + 20.6 * 20.6) * Math.sqrt((f2 + 107.7 * 107.7) * (f2 + 737.9 * 737.9)) * (f2 + 12194 * 12194);

  if (den === 0) return -80;
  const ra = num / den;
  return 20 * Math.log10(ra) + 2.0;
}

function computeSpectralBalanceStatus(
  tilt: number,
  harshness: number,
  centroid: number
): { status: "bright" | "balanced" | "dark"; note: string | null } {
  let brightnessScore = 0;

  if (tilt > 0) brightnessScore += 2;
  else if (tilt > -2) brightnessScore += 1;
  else if (tilt < -5) brightnessScore -= 1;
  else if (tilt < -7) brightnessScore -= 2;

  if (harshness > 35) brightnessScore += 1;
  else if (harshness < 15) brightnessScore -= 1;

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

function computeSpectralTilt(magnitudes: Float32Array, freqResolution: number): number {
  const minBin = Math.max(1, Math.floor(100 / freqResolution));
  const maxBin = Math.min(magnitudes.length - 1, Math.floor(10000 / freqResolution));

  if (maxBin <= minBin) return 0;

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

  return (count * sumXY - sumX * sumY) / (count * sumXX - sumX * sumX);
}

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

  return geometricMean / arithmeticMean;
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

function computeHarshnessIndex(magnitudes: Float32Array, freqResolution: number): number {
  const harsh = energyInBand(magnitudes, 2000, 5000, freqResolution);
  const total = energyInBand(magnitudes, 100, 10000, freqResolution);
  return total > 0 ? (harsh / total) * 100 : 0;
}

function computeSibilanceIndex(magnitudes: Float32Array, freqResolution: number): number {
  const sibilant = energyInBand(magnitudes, 5000, 10000, freqResolution);
  const total = energyInBand(magnitudes, 100, 15000, freqResolution);
  return total > 0 ? (sibilant / total) * 100 : 0;
}

function computeSpectralFeatures(mono: Float32Array, fs: number): {
  centroid: number;
  rolloff: number;
  tilt: number;
  flatness: number;
  harshness: number;
  sibilance: number;
  harshnessWeighted: number;
  sibilanceWeighted: number;
  tiltWeighted: number;
  balanceStatus: "bright" | "balanced" | "dark";
  balanceNote: string | null;
} {
  const fftSize = 4096;
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

  for (let k = 0; k < freqBins; k++) {
    avgMagnitudes[k] /= validFrames || 1;
  }

  const tilt = computeSpectralTilt(avgMagnitudes, freqResolution);
  const flatness = computeSpectralFlatness(avgMagnitudes);
  const harshness = computeHarshnessIndex(avgMagnitudes, freqResolution);
  const sibilance = computeSibilanceIndex(avgMagnitudes, freqResolution);

  const harshnessWeighted = computeWeightedHarshness(avgMagnitudes, freqResolution);
  const sibilanceWeighted = computeWeightedSibilance(avgMagnitudes, freqResolution);
  const tiltWeighted = computeWeightedSpectralTilt(avgMagnitudes, freqResolution);

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

export function computeBandEnergiesMono(mono: Float32Array, fs: number): SpectralOut {
  const hf = onePoleLP(onePoleHP(mono, 8000, fs), 16000, fs);
  const sib = onePoleLP(onePoleHP(mono, 4000, fs), 10000, fs);
  const sub = onePoleLP(onePoleHP(mono, 20, fs), 80, fs);

  const bassEnergy = bandRmsDB(mono, 80, 250, fs);
  const midEnergy = bandRmsDB(mono, 250, 2000, fs);
  const highEnergy = bandRmsDB(mono, 2000, 8000, fs);

  const spectralFeatures = computeSpectralFeatures(mono, fs);

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
    harmonicToNoiseRatio: 0,
    crestByBand,
    harshnessIndexWeighted: spectralFeatures.harshnessWeighted,
    sibilanceIndexWeighted: spectralFeatures.sibilanceWeighted,
    spectralTiltWeightedDBPerOctave: spectralFeatures.tiltWeighted,
    spectralBalanceStatus: spectralFeatures.balanceStatus,
    spectralBalanceNote: spectralFeatures.balanceNote
  };
}
