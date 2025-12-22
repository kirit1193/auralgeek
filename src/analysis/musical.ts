import type { MusicalFeatures, StreamingSimulation, PlatformNormalization } from "../core/types";

// Key names for chromagram bins
const KEY_NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"
];

// Major and minor key profiles (Krumhansl-Kessler profiles)
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

interface BPMCandidate {
  bpm: number;
  confidence: number;
}

interface KeyCandidate {
  key: string;
  confidence: number;
}

// Detect BPM using onset detection and autocorrelation
export function detectBPM(mono: Float32Array, sampleRate: number): {
  candidates: BPMCandidate[];
  primary: number;
  confidence: number;
  halfDoubleAmbiguity: boolean;
  stabilityScore: number;
} {
  // Compute onset strength envelope
  const hopSize = Math.floor(sampleRate / 100); // 10ms hops
  const windowSize = Math.floor(sampleRate * 0.023); // ~23ms window
  const envelope = computeOnsetEnvelope(mono, windowSize, hopSize);

  if (envelope.length < 100) {
    return {
      candidates: [{ bpm: 120, confidence: 0 }],
      primary: 120,
      confidence: 0,
      halfDoubleAmbiguity: false,
      stabilityScore: 0
    };
  }

  // Compute autocorrelation of onset envelope
  const minLag = Math.floor(60 / 200 * (sampleRate / hopSize)); // 200 BPM max
  const maxLag = Math.floor(60 / 40 * (sampleRate / hopSize));  // 40 BPM min
  const autocorr = computeAutocorrelation(envelope, minLag, maxLag);

  // Find peaks in autocorrelation (BPM candidates)
  const peaks = findPeaks(autocorr, minLag);

  // Convert lag to BPM and score
  const candidates: BPMCandidate[] = [];
  const effectiveSampleRate = sampleRate / hopSize;

  for (const peak of peaks.slice(0, 5)) {
    const bpm = (60 * effectiveSampleRate) / (peak.lag + minLag);
    if (bpm >= 40 && bpm <= 200) {
      candidates.push({ bpm: Math.round(bpm), confidence: Math.round(peak.strength * 100) });
    }
  }

  // Normalize confidences
  const maxConf = Math.max(...candidates.map(c => c.confidence), 1);
  candidates.forEach(c => c.confidence = Math.round((c.confidence / maxConf) * 100));

  // Sort by confidence
  candidates.sort((a, b) => b.confidence - a.confidence);

  // Detect half/double time ambiguity
  const primary = candidates[0]?.bpm ?? 120;
  const halfDoubleAmbiguity = candidates.some(c =>
    Math.abs(c.bpm - primary * 2) < 5 || Math.abs(c.bpm - primary / 2) < 3
  );

  // Compute beat stability (using inter-onset interval variance)
  const stabilityScore = computeBeatStability(envelope, primary, effectiveSampleRate);

  return {
    candidates: candidates.slice(0, 3),
    primary,
    confidence: candidates[0]?.confidence ?? 0,
    halfDoubleAmbiguity,
    stabilityScore
  };
}

function computeOnsetEnvelope(mono: Float32Array, windowSize: number, hopSize: number): Float32Array {
  const numFrames = Math.floor((mono.length - windowSize) / hopSize);
  const envelope = new Float32Array(numFrames);

  let prevEnergy = 0;
  for (let i = 0; i < numFrames; i++) {
    const start = i * hopSize;
    let energy = 0;
    for (let j = 0; j < windowSize; j++) {
      energy += mono[start + j] * mono[start + j];
    }
    energy = Math.sqrt(energy / windowSize);

    // Onset strength is the positive energy derivative (spectral flux-like)
    envelope[i] = Math.max(0, energy - prevEnergy);
    prevEnergy = energy;
  }

  // Normalize
  const maxEnv = Math.max(...envelope);
  if (maxEnv > 0) {
    for (let i = 0; i < envelope.length; i++) {
      envelope[i] /= maxEnv;
    }
  }

  return envelope;
}

function computeAutocorrelation(signal: Float32Array, minLag: number, maxLag: number): Float32Array {
  const len = maxLag - minLag + 1;
  const result = new Float32Array(len);

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < signal.length - lag; i++) {
      sum += signal[i] * signal[i + lag];
    }
    result[lag - minLag] = sum / (signal.length - lag);
  }

  return result;
}

function findPeaks(signal: Float32Array, offset: number): { lag: number; strength: number }[] {
  const peaks: { lag: number; strength: number }[] = [];

  for (let i = 1; i < signal.length - 1; i++) {
    if (signal[i] > signal[i - 1] && signal[i] > signal[i + 1]) {
      peaks.push({ lag: i, strength: signal[i] });
    }
  }

  return peaks.sort((a, b) => b.strength - a.strength);
}

function computeBeatStability(envelope: Float32Array, bpm: number, effectiveSampleRate: number): number {
  // Expected beat interval in frames
  const expectedInterval = (60 * effectiveSampleRate) / bpm;

  // Find onset peaks
  const peaks: number[] = [];
  for (let i = 1; i < envelope.length - 1; i++) {
    if (envelope[i] > 0.3 && envelope[i] > envelope[i - 1] && envelope[i] > envelope[i + 1]) {
      peaks.push(i);
    }
  }

  if (peaks.length < 3) return 0;

  // Compute inter-onset intervals
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i - 1]);
  }

  // Compute variance relative to expected interval
  const variance = intervals.reduce((sum, int) => {
    const dev = Math.abs(int - expectedInterval) / expectedInterval;
    return sum + dev * dev;
  }, 0) / intervals.length;

  // Convert to 0-100 score (lower variance = higher stability)
  return Math.max(0, Math.min(100, Math.round(100 * (1 - Math.sqrt(variance)))));
}

// Detect musical key using chromagram analysis
export function detectKey(mono: Float32Array, sampleRate: number): {
  candidates: KeyCandidate[];
  primary: string;
  confidence: number;
  tonalnessScore: number;
} {
  // Compute chromagram
  const chromagram = computeChromagram(mono, sampleRate);

  // Correlate with key profiles
  const keyScores: { key: string; score: number }[] = [];

  for (let i = 0; i < 12; i++) {
    // Rotate chromagram to test each root note
    const rotated = rotateArray(chromagram, i);

    // Test major key
    const majorCorr = pearsonCorrelation(rotated, MAJOR_PROFILE);
    keyScores.push({ key: `${KEY_NAMES[i]} Major`, score: majorCorr });

    // Test minor key
    const minorCorr = pearsonCorrelation(rotated, MINOR_PROFILE);
    keyScores.push({ key: `${KEY_NAMES[i]} Minor`, score: minorCorr });
  }

  // Sort by score
  keyScores.sort((a, b) => b.score - a.score);

  // Convert scores to confidence (0-100)
  const maxScore = keyScores[0].score;
  const minScore = keyScores[keyScores.length - 1].score;
  const range = maxScore - minScore;

  const candidates: KeyCandidate[] = keyScores.slice(0, 3).map(k => ({
    key: k.key,
    confidence: Math.round(((k.score - minScore) / (range || 1)) * 100)
  }));

  // Tonalness: how well the audio fits ANY key profile
  const tonalnessScore = Math.max(0, Math.min(100, Math.round((maxScore + 1) * 50)));

  return {
    candidates,
    primary: candidates[0]?.key ?? "Unknown",
    confidence: candidates[0]?.confidence ?? 0,
    tonalnessScore
  };
}

function computeChromagram(mono: Float32Array, sampleRate: number): number[] {
  const chromagram = new Array(12).fill(0);
  const fftSize = 4096;
  const hopSize = Math.floor(fftSize / 2);
  const freqResolution = sampleRate / fftSize;

  let frameCount = 0;

  for (let pos = 0; pos + fftSize < mono.length; pos += hopSize) {
    // Compute magnitude spectrum
    const magnitudes = computeFFTMagnitudes(mono.slice(pos, pos + fftSize), fftSize);

    // Map to chroma bins
    for (let bin = 1; bin < fftSize / 2; bin++) {
      const freq = bin * freqResolution;
      if (freq < 65 || freq > 5000) continue; // Focus on musical range

      const pitchClass = frequencyToPitchClass(freq);
      chromagram[pitchClass] += magnitudes[bin] * magnitudes[bin];
    }
    frameCount++;
  }

  // Normalize
  const sum = chromagram.reduce((a, b) => a + b, 0);
  if (sum > 0) {
    for (let i = 0; i < 12; i++) {
      chromagram[i] /= sum;
    }
  }

  return chromagram;
}

function computeFFTMagnitudes(samples: Float32Array, fftSize: number): Float32Array {
  const real = new Float32Array(fftSize);
  const imag = new Float32Array(fftSize);

  // Apply Hann window
  for (let i = 0; i < fftSize; i++) {
    const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / fftSize);
    real[i] = (samples[i] ?? 0) * window;
    imag[i] = 0;
  }

  // Simple DFT for small segments (could use FFT for larger)
  fft(real, imag);

  const magnitudes = new Float32Array(fftSize / 2);
  for (let i = 0; i < fftSize / 2; i++) {
    magnitudes[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
  }

  return magnitudes;
}

// In-place FFT (Cooley-Tukey)
function fft(real: Float32Array, imag: Float32Array): void {
  const n = real.length;
  if (n <= 1) return;

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

function frequencyToPitchClass(freq: number): number {
  // A4 = 440Hz, MIDI note 69
  const midiNote = 12 * Math.log2(freq / 440) + 69;
  return Math.round(midiNote) % 12;
}

function rotateArray(arr: number[], n: number): number[] {
  const result = new Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    result[i] = arr[(i + n) % arr.length];
  }
  return result;
}

function pearsonCorrelation(a: number[], b: number[]): number {
  const n = a.length;
  let sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0;

  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
    sumAB += a[i] * b[i];
    sumA2 += a[i] * a[i];
    sumB2 += b[i] * b[i];
  }

  const num = n * sumAB - sumA * sumB;
  const den = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));

  return den !== 0 ? num / den : 0;
}

// Compute musical features
export function computeMusicalFeatures(mono: Float32Array, sampleRate: number): MusicalFeatures {
  const bpmResult = detectBPM(mono, sampleRate);
  const keyResult = detectKey(mono, sampleRate);

  return {
    bpmCandidates: bpmResult.candidates,
    bpmPrimary: bpmResult.primary,
    bpmConfidence: bpmResult.confidence,
    halfDoubleAmbiguity: bpmResult.halfDoubleAmbiguity,
    beatStabilityScore: bpmResult.stabilityScore,
    keyCandidates: keyResult.candidates,
    keyPrimary: keyResult.primary,
    keyConfidence: keyResult.confidence,
    tonalnessScore: keyResult.tonalnessScore
  };
}

// Platform normalization targets (widely cited, not "official")
const PLATFORM_TARGETS: { name: string; lufs: number; tpLimit: number }[] = [
  { name: "Spotify", lufs: -14, tpLimit: -1 },
  { name: "Apple Music", lufs: -16, tpLimit: -1 },
  { name: "YouTube", lufs: -14, tpLimit: -1 },
  { name: "Tidal", lufs: -14, tpLimit: -1 }
];

// Compute streaming platform normalization simulation
export function computeStreamingSimulation(
  integratedLUFS: number,
  truePeakDBTP: number
): StreamingSimulation {
  const platforms: Record<string, PlatformNormalization> = {};
  const recommendations: string[] = [];

  for (const target of PLATFORM_TARGETS) {
    const gainChange = target.lufs - integratedLUFS;
    const projectedTP = truePeakDBTP + gainChange;
    const riskFlags: string[] = [];

    // Determine risks
    if (gainChange < -1) {
      riskFlags.push(`Attenuated by ${Math.abs(gainChange).toFixed(1)} dB`);
    }
    if (projectedTP > target.tpLimit) {
      riskFlags.push(`May clip post-normalization (TP ${projectedTP.toFixed(1)} dBTP > ${target.tpLimit} dBTP)`);
    }
    if (projectedTP > 0) {
      riskFlags.push("Likely to clip or distort");
    }

    // Suggest limiter ceiling
    let limiterCeilingSuggestion: number | null = null;
    if (projectedTP > target.tpLimit) {
      // Suggest ceiling that would result in compliant TP after normalization
      limiterCeilingSuggestion = target.tpLimit - gainChange;
    }

    const platformKey = target.name.toLowerCase().replace(" ", "") as keyof StreamingSimulation;

    platforms[target.name] = {
      platform: target.name,
      referenceLUFS: target.lufs,
      gainChangeDB: gainChange,
      projectedTruePeakDBTP: projectedTP,
      riskFlags,
      limiterCeilingSuggestion
    };
  }

  // Generate overall recommendation
  let recommendation: string;
  const spotifyGain = PLATFORM_TARGETS[0].lufs - integratedLUFS;

  if (integratedLUFS > -10) {
    recommendation = "Very competitive loudness. May sacrifice dynamics for loudness. Consider backing off for more dynamic range.";
  } else if (integratedLUFS > -14) {
    recommendation = "Competitive loudness. Good for EDM/Pop. Will be attenuated on most platforms.";
  } else if (integratedLUFS > -18) {
    recommendation = "Balanced loudness. Preserves dynamics while remaining competitive.";
  } else {
    recommendation = "Dynamic master. Good for acoustic/classical genres. May sound quieter in playlists.";
  }

  return {
    spotify: platforms["Spotify"] ?? null,
    appleMusic: platforms["Apple Music"] ?? null,
    youtube: platforms["YouTube"] ?? null,
    tidal: platforms["Tidal"] ?? null,
    recommendation
  };
}
