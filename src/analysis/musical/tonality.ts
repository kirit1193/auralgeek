/**
 * Tonality/Key detection module
 * Uses chromagram analysis and Krumhansl-Kessler profiles
 */

import { fft } from '../../utils/fft.js';
import { pearsonCorrelation, rotateArray } from '../../utils/math.js';

export interface KeyCandidate {
  key: string;
  confidence: number;
}

export interface KeyResult {
  candidates: KeyCandidate[];
  primary: string;
  confidence: number;
  tonalnessScore: number;
}

export interface KeyStabilityResult {
  stabilityPct: number;
  note: string | null;
}

const KEY_NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"
];

const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function frequencyToPitchClass(freq: number): number {
  const midiNote = 12 * Math.log2(freq / 440) + 69;
  return Math.round(midiNote) % 12;
}

function computeFFTMagnitudes(samples: Float32Array, fftSize: number): Float32Array {
  const real = new Float32Array(fftSize);
  const imag = new Float32Array(fftSize);

  for (let i = 0; i < fftSize; i++) {
    const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / fftSize);
    real[i] = (samples[i] ?? 0) * window;
    imag[i] = 0;
  }

  fft(real, imag);

  const magnitudes = new Float32Array(fftSize / 2);
  for (let i = 0; i < fftSize / 2; i++) {
    magnitudes[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
  }

  return magnitudes;
}

export function computeChromagram(mono: Float32Array, sampleRate: number): number[] {
  const chromagram = new Array(12).fill(0);
  const fftSize = 4096;
  const hopSize = Math.floor(fftSize / 2);
  const freqResolution = sampleRate / fftSize;

  for (let pos = 0; pos + fftSize < mono.length; pos += hopSize) {
    const magnitudes = computeFFTMagnitudes(mono.slice(pos, pos + fftSize), fftSize);

    for (let bin = 1; bin < fftSize / 2; bin++) {
      const freq = bin * freqResolution;
      if (freq < 65 || freq > 5000) continue;

      const pitchClass = frequencyToPitchClass(freq);
      chromagram[pitchClass] += magnitudes[bin] * magnitudes[bin];
    }
  }

  const sum = chromagram.reduce((a, b) => a + b, 0);
  if (sum > 0) {
    for (let i = 0; i < 12; i++) {
      chromagram[i] /= sum;
    }
  }

  return chromagram;
}

export function detectKey(mono: Float32Array, sampleRate: number): KeyResult {
  const chromagram = computeChromagram(mono, sampleRate);

  const keyScores: { key: string; score: number }[] = [];

  for (let i = 0; i < 12; i++) {
    const rotated = rotateArray(chromagram, i);

    const majorCorr = pearsonCorrelation(rotated, MAJOR_PROFILE);
    keyScores.push({ key: `${KEY_NAMES[i]} Major`, score: majorCorr });

    const minorCorr = pearsonCorrelation(rotated, MINOR_PROFILE);
    keyScores.push({ key: `${KEY_NAMES[i]} Minor`, score: minorCorr });
  }

  keyScores.sort((a, b) => b.score - a.score);

  const maxScore = keyScores[0].score;
  const minScore = keyScores[keyScores.length - 1].score;
  const range = maxScore - minScore;

  const candidates: KeyCandidate[] = keyScores.slice(0, 3).map(k => ({
    key: k.key,
    confidence: Math.round(((k.score - minScore) / (range || 1)) * 100)
  }));

  const tonalnessScore = Math.max(0, Math.min(100, Math.round((maxScore + 1) * 50)));

  return {
    candidates,
    primary: candidates[0]?.key ?? "Unknown",
    confidence: candidates[0]?.confidence ?? 0,
    tonalnessScore
  };
}

export function computeKeyStability(mono: Float32Array, sampleRate: number, primaryKey: string): KeyStabilityResult {
  const windowSize = Math.floor(sampleRate * 2);
  const hopSize = Math.floor(sampleRate);
  const numWindows = Math.floor((mono.length - windowSize) / hopSize);

  if (numWindows < 2) {
    return { stabilityPct: 100, note: "Key center stable" };
  }

  let agreeingWindows = 0;

  for (let w = 0; w < numWindows; w++) {
    const start = w * hopSize;
    const windowMono = mono.slice(start, start + windowSize);

    const chromagram = computeChromagram(windowMono, sampleRate);

    let bestKey = "";
    let bestScore = -Infinity;

    for (let i = 0; i < 12; i++) {
      const rotated = rotateArray(chromagram, i);
      const majorCorr = pearsonCorrelation(rotated, MAJOR_PROFILE);
      const minorCorr = pearsonCorrelation(rotated, MINOR_PROFILE);

      if (majorCorr > bestScore) {
        bestScore = majorCorr;
        bestKey = `${KEY_NAMES[i]} Major`;
      }
      if (minorCorr > bestScore) {
        bestScore = minorCorr;
        bestKey = `${KEY_NAMES[i]} Minor`;
      }
    }

    if (bestKey === primaryKey) {
      agreeingWindows++;
    }
  }

  const stabilityPct = Math.round((agreeingWindows / numWindows) * 100);

  let note: string | null = null;
  if (stabilityPct >= 80) {
    note = "Key center stable throughout";
  } else if (stabilityPct >= 50) {
    note = "Some key variations — may contain modulations";
  } else {
    note = "Frequent key changes or ambiguous tonality";
  }

  return { stabilityPct, note };
}
