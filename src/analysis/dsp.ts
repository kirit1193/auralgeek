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
}

export function computeDynamics(channels: Float32Array[], sampleRate: number = 48000): DynamicsOut {
  const n = channels[0].length;
  let sum = 0;
  let sumSq = 0;
  let peak = 0;
  let clipped = false;

  // Collect absolute samples for percentile-based dynamic range
  const absValues: number[] = [];
  const sampleStep = Math.max(1, Math.floor(n / 10000)); // Sample up to 10k points for efficiency

  for (let i = 0; i < n; i++) {
    let x = 0;
    for (let ch = 0; ch < channels.length; ch++) x += channels[ch][i] ?? 0;
    x /= channels.length;

    sum += x;
    sumSq += x * x;

    const ax = Math.abs(x);
    if (ax > peak) peak = ax;
    if (ax >= 0.9999) clipped = true;

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

  return {
    peakDBFS: peakDB,
    rmsDBFS: rmsDB,
    crestFactorDB: crest,
    dynamicRangeDB: Math.max(0, dynamicRangeDB),
    dcOffset: dc,
    hasClipping: clipped,
    silenceAtStartMs: Math.round((silenceStartSamples / sampleRate) * 1000),
    silenceAtEndMs: Math.round((silenceEndSamples / sampleRate) * 1000)
  };
}

export interface StereoOut {
  midEnergyDB: number | null;
  sideEnergyDB: number | null;
  stereoWidthPct: number | null;
  correlation: number | null;
  subBassMonoCompatible: boolean | null;
  balanceDB: number | null; // Positive = right heavy, negative = left heavy
}

export function computeStereo(channels: Float32Array[], sampleRate: number): StereoOut {
  if (channels.length < 2) return { midEnergyDB: null, sideEnergyDB: null, stereoWidthPct: null, correlation: null, subBassMonoCompatible: null, balanceDB: null };

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

  // L/R Balance: positive = right heavy, negative = left heavy
  const rmsL = Math.sqrt(sumLL / n);
  const rmsR = Math.sqrt(sumRR / n);
  const balanceDB = (rmsL > 0 && rmsR > 0) ? dbFromLinear(rmsR) - dbFromLinear(rmsL) : 0;

  return { midEnergyDB: midDB, sideEnergyDB: sideDB, stereoWidthPct: width, correlation: corr, subBassMonoCompatible, balanceDB };
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

function computeSpectralFeatures(mono: Float32Array, fs: number): { centroid: number; rolloff: number } {
  const fftSize = 2048; // Power of 2 for FFT
  const numFramesToAnalyze = 20; // Sample 20 frames across the track
  const totalSamples = mono.length;

  if (totalSamples < fftSize) {
    return { centroid: 0, rolloff: 0 };
  }

  let totalCentroid = 0;
  let totalRolloff = 0;
  let validFrames = 0;

  const freqBins = fftSize / 2;
  const freqResolution = fs / fftSize;

  // Sample frames evenly across the entire track
  const frameSpacing = Math.floor((totalSamples - fftSize) / numFramesToAnalyze);

  for (let frame = 0; frame < numFramesToAnalyze; frame++) {
    const start = frame * frameSpacing;
    if (start + fftSize > totalSamples) break;

    // Prepare FFT buffers with Hann window
    const real = new Float32Array(fftSize);
    const imag = new Float32Array(fftSize);

    for (let i = 0; i < fftSize; i++) {
      const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / fftSize);
      real[i] = mono[start + i] * window;
      imag[i] = 0;
    }

    // Apply FFT
    fft(real, imag);

    // Compute magnitude spectrum
    let totalEnergy = 0;
    const magnitudes = new Float32Array(freqBins);

    for (let k = 0; k < freqBins; k++) {
      magnitudes[k] = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]);
      totalEnergy += magnitudes[k];
    }

    if (totalEnergy > 0) {
      // Spectral centroid (brightness)
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
