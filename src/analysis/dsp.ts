import { dbFromLinear, clamp } from "../core/format";

export interface DynamicsOut {
  peakDBFS: number;
  rmsDBFS: number;
  crestFactorDB: number;
  dcOffset: number;
  hasClipping: boolean;
}

export function computeDynamics(channels: Float32Array[]): DynamicsOut {
  const n = channels[0].length;
  let sum = 0;
  let sumSq = 0;
  let peak = 0;
  let clipped = false;

  for (let i = 0; i < n; i++) {
    let x = 0;
    for (let ch = 0; ch < channels.length; ch++) x += channels[ch][i] ?? 0;
    x /= channels.length;

    sum += x;
    sumSq += x * x;

    const ax = Math.abs(x);
    if (ax > peak) peak = ax;
    if (ax >= 0.999) clipped = true;
  }

  const dc = sum / n;
  const rms = Math.sqrt(sumSq / n);
  const peakDB = dbFromLinear(peak);
  const rmsDB = dbFromLinear(rms);
  const crest = peakDB - rmsDB;

  return {
    peakDBFS: peakDB,
    rmsDBFS: rmsDB,
    crestFactorDB: crest,
    dcOffset: dc,
    hasClipping: clipped
  };
}

export interface StereoOut {
  midEnergyDB: number | null;
  sideEnergyDB: number | null;
  stereoWidthPct: number | null;
  correlation: number | null;
  subBassMonoCompatible: boolean | null;
}

export function computeStereo(channels: Float32Array[], sampleRate: number): StereoOut {
  if (channels.length < 2) return { midEnergyDB: null, sideEnergyDB: null, stereoWidthPct: null, correlation: null, subBassMonoCompatible: null };

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
  const subBassMonoCompatible = subBassCorr > 0.8; // High correlation = mono compatible

  return { midEnergyDB: midDB, sideEnergyDB: sideDB, stereoWidthPct: width, correlation: corr, subBassMonoCompatible };
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

export interface SpectralOut {
  highFreqEnergy8k16kDB: number;
  sibilanceEnergy4k10kDB: number;
  subBassEnergy20_80DB: number;
  spectralCentroidHz: number;
  spectralRolloffHz: number;
}

export function computeBandEnergiesMono(mono: Float32Array, fs: number): SpectralOut {
  const hf = onePoleLP(onePoleHP(mono, 8000, fs), 16000, fs);
  const sib = onePoleLP(onePoleHP(mono, 4000, fs), 10000, fs);
  const sub = onePoleLP(onePoleHP(mono, 20, fs), 80, fs);

  // Compute spectral features using FFT
  const { centroid, rolloff } = computeSpectralFeatures(mono, fs);

  return {
    highFreqEnergy8k16kDB: rmsDB(hf),
    sibilanceEnergy4k10kDB: rmsDB(sib),
    subBassEnergy20_80DB: rmsDB(sub),
    spectralCentroidHz: centroid,
    spectralRolloffHz: rolloff
  };
}

function computeSpectralFeatures(mono: Float32Array, fs: number): { centroid: number; rolloff: number } {
  // Use a reasonable FFT size - analyze middle section of audio
  const fftSize = 4096;
  const hopSize = fftSize / 2;
  const numFrames = Math.floor((mono.length - fftSize) / hopSize);

  if (numFrames < 1) {
    return { centroid: 0, rolloff: 0 };
  }

  let totalCentroid = 0;
  let totalRolloff = 0;
  let validFrames = 0;

  // Simple DFT-based magnitude spectrum (no external FFT library needed)
  const freqBins = fftSize / 2;
  const freqResolution = fs / fftSize;

  for (let frame = 0; frame < Math.min(numFrames, 100); frame++) { // Limit to 100 frames for performance
    const start = frame * hopSize;
    const segment = mono.slice(start, start + fftSize);

    // Apply Hann window
    const windowed = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      windowed[i] = segment[i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / fftSize));
    }

    // Compute magnitude spectrum using DFT (simplified for key bins)
    const magnitudes = new Float32Array(freqBins);
    let totalEnergy = 0;

    for (let k = 0; k < freqBins; k++) {
      let real = 0, imag = 0;
      for (let n = 0; n < fftSize; n++) {
        const angle = -2 * Math.PI * k * n / fftSize;
        real += windowed[n] * Math.cos(angle);
        imag += windowed[n] * Math.sin(angle);
      }
      magnitudes[k] = Math.sqrt(real * real + imag * imag);
      totalEnergy += magnitudes[k];
    }

    if (totalEnergy > 0) {
      // Spectral centroid
      let weightedSum = 0;
      for (let k = 0; k < freqBins; k++) {
        weightedSum += k * freqResolution * magnitudes[k];
      }
      totalCentroid += weightedSum / totalEnergy;

      // Spectral rolloff (85% of energy)
      let cumEnergy = 0;
      const threshold = 0.85 * totalEnergy;
      for (let k = 0; k < freqBins; k++) {
        cumEnergy += magnitudes[k];
        if (cumEnergy >= threshold) {
          totalRolloff += k * freqResolution;
          break;
        }
      }

      validFrames++;
    }
  }

  return {
    centroid: validFrames > 0 ? totalCentroid / validFrames : 0,
    rolloff: validFrames > 0 ? totalRolloff / validFrames : 0
  };
}
