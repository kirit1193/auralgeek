/**
 * Tempo/BPM detection module
 * Uses onset detection and autocorrelation for BPM analysis
 */

export interface BPMCandidate {
  bpm: number;
  confidence: number;
}

export interface BPMResult {
  candidates: BPMCandidate[];
  primary: number;
  confidence: number;
  halfDoubleAmbiguity: boolean;
  stabilityScore: number;
}

export interface TempoDriftResult {
  driftIndex: number;
  note: string | null;
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
    envelope[i] = Math.max(0, energy - prevEnergy);
    prevEnergy = energy;
  }

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

function findPeaks(signal: Float32Array): { lag: number; strength: number }[] {
  const peaks: { lag: number; strength: number }[] = [];

  for (let i = 1; i < signal.length - 1; i++) {
    if (signal[i] > signal[i - 1] && signal[i] > signal[i + 1]) {
      peaks.push({ lag: i, strength: signal[i] });
    }
  }

  return peaks.sort((a, b) => b.strength - a.strength);
}

function computeBeatStability(envelope: Float32Array, bpm: number, effectiveSampleRate: number): number {
  const expectedInterval = (60 * effectiveSampleRate) / bpm;

  const peaks: number[] = [];
  for (let i = 1; i < envelope.length - 1; i++) {
    if (envelope[i] > 0.3 && envelope[i] > envelope[i - 1] && envelope[i] > envelope[i + 1]) {
      peaks.push(i);
    }
  }

  if (peaks.length < 3) return 0;

  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i - 1]);
  }

  const variance = intervals.reduce((sum, int) => {
    const dev = Math.abs(int - expectedInterval) / expectedInterval;
    return sum + dev * dev;
  }, 0) / intervals.length;

  return Math.max(0, Math.min(100, Math.round(100 * (1 - Math.sqrt(variance)))));
}

export function detectBPM(mono: Float32Array, sampleRate: number): BPMResult {
  const hopSize = Math.floor(sampleRate / 100);
  const windowSize = Math.floor(sampleRate * 0.023);
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

  const minLag = Math.floor(60 / 200 * (sampleRate / hopSize));
  const maxLag = Math.floor(60 / 40 * (sampleRate / hopSize));
  const autocorr = computeAutocorrelation(envelope, minLag, maxLag);

  const peaks = findPeaks(autocorr);

  const candidates: BPMCandidate[] = [];
  const effectiveSampleRate = sampleRate / hopSize;

  for (const peak of peaks.slice(0, 5)) {
    const bpm = (60 * effectiveSampleRate) / (peak.lag + minLag);
    if (bpm >= 40 && bpm <= 200) {
      candidates.push({ bpm: Math.round(bpm), confidence: Math.round(peak.strength * 100) });
    }
  }

  const maxConf = Math.max(...candidates.map(c => c.confidence), 1);
  candidates.forEach(c => c.confidence = Math.round((c.confidence / maxConf) * 100));

  candidates.sort((a, b) => b.confidence - a.confidence);

  const primary = candidates[0]?.bpm ?? 120;
  const halfDoubleAmbiguity = candidates.some(c =>
    Math.abs(c.bpm - primary * 2) < 5 || Math.abs(c.bpm - primary / 2) < 3
  );

  const stabilityScore = computeBeatStability(envelope, primary, effectiveSampleRate);

  return {
    candidates: candidates.slice(0, 3),
    primary,
    confidence: candidates[0]?.confidence ?? 0,
    halfDoubleAmbiguity,
    stabilityScore
  };
}

export function computeTempoDriftIndex(mono: Float32Array, sampleRate: number, bpm: number): TempoDriftResult {
  const hopSize = Math.floor(sampleRate / 100);
  const windowSize = Math.floor(sampleRate * 0.023);
  const envelope = computeOnsetEnvelope(mono, windowSize, hopSize);

  const peaks: number[] = [];
  for (let i = 1; i < envelope.length - 1; i++) {
    if (envelope[i] > 0.2 && envelope[i] > envelope[i - 1] && envelope[i] > envelope[i + 1]) {
      peaks.push(i);
    }
  }

  if (peaks.length < 4) {
    return { driftIndex: 0, note: null };
  }

  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i - 1]);
  }

  const effectiveSampleRate = sampleRate / hopSize;
  const expectedInterval = (60 * effectiveSampleRate) / bpm;

  const relevantIntervals = intervals.filter(
    int => int > expectedInterval * 0.5 && int < expectedInterval * 2
  );

  if (relevantIntervals.length < 3) {
    return { driftIndex: 0, note: null };
  }

  const mean = relevantIntervals.reduce((a, b) => a + b, 0) / relevantIntervals.length;
  const variance = relevantIntervals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / relevantIntervals.length;
  const stdDev = Math.sqrt(variance);

  const driftIndex = (stdDev / expectedInterval) * 100;

  let note: string | null = null;
  if (driftIndex > 15) {
    note = "Tempo fluctuates significantly — likely live performance or tempo changes";
  } else if (driftIndex > 5) {
    note = "Tempo varies slightly — likely live or humanized";
  }

  return { driftIndex, note };
}
