/**
 * Spectrogram computation module
 * Generates time-frequency magnitude data for visualization
 */

import { fft } from '../utils/fft.js';
import { dspPool } from '../utils/bufferPool.js';
import type { SpectrogramData } from '../core/types.js';

export interface SpectrogramConfig {
  fftSize?: number;      // default: 2048
  hopRatio?: number;     // default: 0.5 (50% overlap)
  maxFreq?: number;      // default: 20000 Hz
  minDB?: number;        // default: -90
  maxDB?: number;        // default: 0
}

const DEFAULT_CONFIG: Required<SpectrogramConfig> = {
  fftSize: 2048,
  hopRatio: 0.5,
  maxFreq: 20000,
  minDB: -90,
  maxDB: 0
};

/**
 * Compute spectrogram from mono audio signal
 * @param mono - Mono audio samples
 * @param sampleRate - Sample rate in Hz
 * @param config - Optional configuration
 * @returns SpectrogramData for visualization
 */
export function computeSpectrogram(
  mono: Float32Array,
  sampleRate: number,
  config?: SpectrogramConfig
): SpectrogramData {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const { fftSize, hopRatio, maxFreq, minDB, maxDB } = cfg;

  const hopSize = Math.floor(fftSize * hopRatio);
  const freqResolution = sampleRate / fftSize;
  const timeResolution = hopSize / sampleRate;

  // Limit frequency bins to maxFreq
  const maxBin = Math.min(fftSize / 2, Math.ceil(maxFreq / freqResolution));
  const freqBins = maxBin;

  // Calculate number of time frames
  const numFrames = Math.floor((mono.length - fftSize) / hopSize) + 1;
  if (numFrames <= 0) {
    // Audio too short for even one frame
    return {
      magnitudes: [],
      timeFrames: 0,
      freqBins: 0,
      timeResolution,
      freqResolution,
      sampleRate,
      fftSize,
      minDB,
      maxDB
    };
  }

  // Acquire reusable FFT buffers
  const real = dspPool.acquire(fftSize);
  const imag = dspPool.acquire(fftSize);

  // Pre-compute Hann window
  const window = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++) {
    window[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / fftSize);
  }

  const magnitudes: Float32Array[] = [];

  for (let frame = 0; frame < numFrames; frame++) {
    const start = frame * hopSize;

    // Apply window and copy to FFT buffer
    for (let i = 0; i < fftSize; i++) {
      real[i] = mono[start + i] * window[i];
      imag[i] = 0;
    }

    // Perform FFT
    fft(real, imag);

    // Compute magnitude spectrum in dB
    const frameMagnitudes = new Float32Array(freqBins);
    for (let k = 0; k < freqBins; k++) {
      const mag = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]);
      // Convert to dB, clamped to range
      const db = mag > 0 ? 20 * Math.log10(mag / fftSize) : minDB;
      frameMagnitudes[k] = Math.max(minDB, Math.min(maxDB, db));
    }

    magnitudes.push(frameMagnitudes);
  }

  // Release FFT buffers
  dspPool.release(real);
  dspPool.release(imag);

  return {
    magnitudes,
    timeFrames: numFrames,
    freqBins,
    timeResolution,
    freqResolution,
    sampleRate,
    fftSize,
    minDB,
    maxDB
  };
}

/**
 * Downsample spectrogram for efficient visualization
 * Reduces time frames to target count while preserving spectral detail
 */
export function downsampleSpectrogram(
  spectrogram: SpectrogramData,
  targetTimeFrames: number
): SpectrogramData {
  if (spectrogram.timeFrames <= targetTimeFrames) {
    return spectrogram;
  }

  const ratio = spectrogram.timeFrames / targetTimeFrames;
  const newMagnitudes: Float32Array[] = [];

  for (let t = 0; t < targetTimeFrames; t++) {
    const startFrame = Math.floor(t * ratio);
    const endFrame = Math.floor((t + 1) * ratio);
    const numFrames = endFrame - startFrame;

    const averaged = new Float32Array(spectrogram.freqBins);

    // Average across frames for this time bin
    for (let f = 0; f < spectrogram.freqBins; f++) {
      let sum = 0;
      for (let frame = startFrame; frame < endFrame; frame++) {
        sum += spectrogram.magnitudes[frame][f];
      }
      averaged[f] = sum / numFrames;
    }

    newMagnitudes.push(averaged);
  }

  return {
    ...spectrogram,
    magnitudes: newMagnitudes,
    timeFrames: targetTimeFrames,
    timeResolution: spectrogram.timeResolution * ratio
  };
}
