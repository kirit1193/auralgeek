/**
 * Harmonic Distortion Analysis
 * Estimates THD (Total Harmonic Distortion) and characterizes distortion type
 */

import { fft } from '../../utils/fft.js';

export interface HarmonicDistortion {
  thdPercent: number | null;
  dominantHarmonics: number[];
  distortionCharacter: "clean" | "warm" | "gritty" | "clipped" | null;
  fundamentalHz: number | null;
}

/**
 * Find the fundamental frequency (strongest peak in 50-2000 Hz range)
 */
function findFundamental(
  magnitudes: Float32Array,
  sampleRate: number,
  fftSize: number
): { binIndex: number; frequency: number; magnitude: number } | null {
  const freqPerBin = sampleRate / fftSize;
  const minBin = Math.ceil(50 / freqPerBin);
  const maxBin = Math.floor(2000 / freqPerBin);

  let maxMag = 0;
  let maxBinIdx = -1;

  for (let i = minBin; i <= maxBin && i < magnitudes.length; i++) {
    if (magnitudes[i] > maxMag) {
      maxMag = magnitudes[i];
      maxBinIdx = i;
    }
  }

  if (maxBinIdx < 0 || maxMag < 0.001) {
    return null;
  }

  return {
    binIndex: maxBinIdx,
    frequency: maxBinIdx * freqPerBin,
    magnitude: maxMag
  };
}

/**
 * Measure energy at harmonic frequencies (2f, 3f, 4f, 5f)
 * Uses parabolic interpolation for more accurate peak detection
 */
function measureHarmonicEnergies(
  magnitudes: Float32Array,
  fundamentalBin: number,
  numHarmonics: number = 5
): number[] {
  const harmonicMags: number[] = [];

  for (let h = 2; h <= numHarmonics; h++) {
    const targetBin = Math.round(fundamentalBin * h);
    if (targetBin >= magnitudes.length - 1) {
      harmonicMags.push(0);
      continue;
    }

    // Find peak near expected harmonic location (within ±2 bins)
    let peakMag = 0;
    for (let i = Math.max(0, targetBin - 2); i <= Math.min(magnitudes.length - 1, targetBin + 2); i++) {
      if (magnitudes[i] > peakMag) {
        peakMag = magnitudes[i];
      }
    }
    harmonicMags.push(peakMag);
  }

  return harmonicMags;
}

/**
 * Compute THD (Total Harmonic Distortion)
 * THD = sqrt(sum(harmonic_powers)) / fundamental_power * 100
 */
export function computeTHD(
  mono: Float32Array,
  sampleRate: number
): HarmonicDistortion {
  // Use a reasonable FFT size (4096 for good frequency resolution)
  const fftSize = 4096;
  const numAnalysisFrames = Math.floor(mono.length / fftSize);

  if (numAnalysisFrames < 1) {
    return {
      thdPercent: null,
      dominantHarmonics: [],
      distortionCharacter: null,
      fundamentalHz: null
    };
  }

  // Analyze multiple frames and average
  let totalTHD = 0;
  let validFrames = 0;
  let avgFundamental = 0;
  const harmonicCounts = new Array(5).fill(0);

  for (let frame = 0; frame < Math.min(numAnalysisFrames, 10); frame++) {
    const start = frame * fftSize;
    const real = new Float32Array(fftSize);
    const imag = new Float32Array(fftSize);

    // Apply Hann window
    for (let i = 0; i < fftSize; i++) {
      const window = 0.5 * (1 - Math.cos(2 * Math.PI * i / (fftSize - 1)));
      real[i] = mono[start + i] * window;
    }

    fft(real, imag);

    // Compute magnitudes
    const magnitudes = new Float32Array(fftSize / 2);
    for (let i = 0; i < fftSize / 2; i++) {
      magnitudes[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
    }

    const fundamental = findFundamental(magnitudes, sampleRate, fftSize);
    if (!fundamental) continue;

    const harmonicMags = measureHarmonicEnergies(magnitudes, fundamental.binIndex);

    // Calculate THD for this frame
    let harmonicPowerSum = 0;
    for (let i = 0; i < harmonicMags.length; i++) {
      harmonicPowerSum += harmonicMags[i] * harmonicMags[i];
      if (harmonicMags[i] > fundamental.magnitude * 0.01) {
        harmonicCounts[i]++;
      }
    }

    const frameTHD = Math.sqrt(harmonicPowerSum) / fundamental.magnitude * 100;
    if (isFinite(frameTHD)) {
      totalTHD += frameTHD;
      avgFundamental += fundamental.frequency;
      validFrames++;
    }
  }

  if (validFrames === 0) {
    return {
      thdPercent: null,
      dominantHarmonics: [],
      distortionCharacter: null,
      fundamentalHz: null
    };
  }

  const thdPercent = totalTHD / validFrames;
  const fundamentalHz = avgFundamental / validFrames;

  // Determine which harmonics are dominant (present in >50% of frames)
  const dominantHarmonics: number[] = [];
  for (let i = 0; i < harmonicCounts.length; i++) {
    if (harmonicCounts[i] > validFrames * 0.5) {
      dominantHarmonics.push(i + 2); // Harmonic number (2nd, 3rd, etc.)
    }
  }

  // Characterize distortion type
  let distortionCharacter: HarmonicDistortion['distortionCharacter'];
  if (thdPercent < 0.5) {
    distortionCharacter = "clean";
  } else if (thdPercent < 2) {
    // Low THD with mainly even harmonics = warm
    const hasEvenHarmonics = dominantHarmonics.includes(2) || dominantHarmonics.includes(4);
    distortionCharacter = hasEvenHarmonics ? "warm" : "clean";
  } else if (thdPercent < 10) {
    // Moderate THD with odd harmonics = gritty
    const hasOddHarmonics = dominantHarmonics.includes(3) || dominantHarmonics.includes(5);
    distortionCharacter = hasOddHarmonics ? "gritty" : "warm";
  } else {
    // High THD = likely clipping
    distortionCharacter = "clipped";
  }

  return {
    thdPercent: Math.round(thdPercent * 100) / 100,
    dominantHarmonics,
    distortionCharacter,
    fundamentalHz: Math.round(fundamentalHz)
  };
}
