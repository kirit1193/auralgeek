/**
 * Mock implementation of ebur128-wasm for testing
 *
 * This provides simplified LUFS and True Peak calculations that are
 * sufficient for testing purposes. For production, the real ebur128-wasm
 * WASM module is used.
 */

// K-weighting filter coefficients for 48kHz
const K_WEIGHT_48K = {
  stage1: { b0: 1.53512485958697, b1: -2.69169618940638, b2: 1.19839281085285, a1: -1.69065929318241, a2: 0.73248077421585 },
  stage2: { b0: 1.0, b1: -2.0, b2: 1.0, a1: -1.99004745483398, a2: 0.99007225036621 }
};

function applyBiquad(input: Float32Array, b0: number, b1: number, b2: number, a1: number, a2: number): Float32Array {
  const output = new Float32Array(input.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;

  for (let i = 0; i < input.length; i++) {
    const x = input[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    output[i] = y;
    x2 = x1; x1 = x;
    y2 = y1; y1 = y;
  }
  return output;
}

function applyKWeighting(samples: Float32Array): Float32Array {
  const { stage1, stage2 } = K_WEIGHT_48K;
  const stage1Out = applyBiquad(samples, stage1.b0, stage1.b1, stage1.b2, stage1.a1, stage1.a2);
  return applyBiquad(stage1Out, stage2.b0, stage2.b1, stage2.b2, stage2.a1, stage2.a2);
}

function computeIntegrated(sampleRate: number, ...channels: Float32Array[]): number {
  // Apply K-weighting
  const kWeighted = channels.map(ch => applyKWeighting(ch));

  // Compute mean square
  let sumMs = 0;
  const numSamples = kWeighted[0].length;

  for (const ch of kWeighted) {
    let chSum = 0;
    for (let i = 0; i < numSamples; i++) {
      chSum += ch[i] * ch[i];
    }
    sumMs += chSum / numSamples;
  }

  // Apply gating (simplified - just use absolute threshold)
  if (sumMs <= 0) return -Infinity;

  // Convert to LUFS
  return -0.691 + 10 * Math.log10(sumMs);
}

function computeTruePeak(samples: Float32Array): number {
  // Simplified 4x oversampling using linear interpolation
  // Real implementation uses polyphase FIR, but this is sufficient for testing
  let maxPeak = 0;

  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > maxPeak) maxPeak = abs;

    // Check inter-sample peak (simplified)
    if (i < samples.length - 1) {
      const next = samples[i + 1];
      // Linear interpolation for 4 phases
      for (let phase = 1; phase < 4; phase++) {
        const t = phase / 4;
        const interpolated = samples[i] * (1 - t) + next * t;
        const absInterp = Math.abs(interpolated);
        if (absInterp > maxPeak) maxPeak = absInterp;
      }
    }
  }

  return maxPeak;
}

export function ebur128_integrated_mono(sampleRate: number, samples: Float32Array): number {
  return computeIntegrated(sampleRate, samples);
}

export function ebur128_integrated_stereo(sampleRate: number, left: Float32Array, right: Float32Array): number {
  return computeIntegrated(sampleRate, left, right);
}

export function ebur128_true_peak_mono(sampleRate: number, samples: Float32Array): number {
  return computeTruePeak(samples);
}

export function ebur128_true_peak_stereo(sampleRate: number, left: Float32Array, right: Float32Array): number[] {
  return [computeTruePeak(left), computeTruePeak(right)];
}
