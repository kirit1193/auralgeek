/**
 * ITU-R BS.1770-4 True Peak Measurement
 *
 * This module provides a fallback true peak detector using 4x polyphase FIR
 * interpolation as specified in ITU-R BS.1770-4 Annex 2.
 *
 * The primary true peak measurement uses ebur128-wasm which also implements
 * 4x oversampling (fixed, not configurable). This fallback is used when
 * ebur128-wasm returns invalid values or for verification.
 *
 * Provenance:
 * - ebur128-wasm: Uses 4x oversampling with FIR interpolation
 *   Source: https://github.com/streamonkey/ebur128_wasm
 *   Based on libebur128 which implements ITU-R BS.1770-4
 *
 * - This fallback: ITU-R BS.1770-4 Annex 2 compliant
 *   48-tap FIR filter split into 4 phases (12 taps each)
 *   Coefficients from ITU-R BS.1770-4 specification
 */

/**
 * ITU-R BS.1770-4 Annex 2 polyphase filter coefficients
 * 48-tap filter split into 4 phases for 4x oversampling
 * These are the exact coefficients from the ITU specification
 */
const PHASE_COEFFS = [
  // Phase 0: Original samples (pass-through with unity gain)
  new Float32Array([
     0.0017089843750,  0.0109863281250, -0.0196533203125,  0.0332031250000,
    -0.0594482421875,  0.1373291015625,  0.9721679687500, -0.1022949218750,
     0.0476074218750, -0.0266113281250,  0.0148925781250, -0.0083007812500
  ]),
  // Phase 1: 1/4 sample interpolation
  new Float32Array([
    -0.0291748046875,  0.0292968750000, -0.0517578125000,  0.0891113281250,
    -0.1665039062500,  0.4650878906250,  0.7797851562500, -0.2003173828125,
     0.1015625000000, -0.0582275390625,  0.0330810546875, -0.0189208984375
  ]),
  // Phase 2: 1/2 sample interpolation
  new Float32Array([
    -0.0189208984375,  0.0330810546875, -0.0582275390625,  0.1015625000000,
    -0.2003173828125,  0.7797851562500,  0.4650878906250, -0.1665039062500,
     0.0891113281250, -0.0517578125000,  0.0292968750000, -0.0291748046875
  ]),
  // Phase 3: 3/4 sample interpolation
  new Float32Array([
    -0.0083007812500,  0.0148925781250, -0.0266113281250,  0.0476074218750,
    -0.1022949218750,  0.9721679687500,  0.1373291015625, -0.0594482421875,
     0.0332031250000, -0.0196533203125,  0.0109863281250,  0.0017089843750
  ])
];

const FILTER_TAPS = 12;

/**
 * Compute true peak using ITU-R BS.1770-4 4x polyphase FIR interpolation
 *
 * @param samples - Input audio samples (mono channel)
 * @returns Maximum absolute value across all interpolated samples (linear)
 */
export function computeTruePeakMono(samples: Float32Array): number {
  const n = samples.length;
  if (n < FILTER_TAPS) {
    // For very short signals, just return sample peak
    let peak = 0;
    for (let i = 0; i < n; i++) {
      const abs = Math.abs(samples[i]);
      if (abs > peak) peak = abs;
    }
    return peak;
  }

  let maxPeak = 0;

  // Process each sample position
  for (let i = FILTER_TAPS - 1; i < n; i++) {
    // For each of the 4 phases (4x oversampling)
    for (let phase = 0; phase < 4; phase++) {
      const coeffs = PHASE_COEFFS[phase];
      let interpolated = 0;

      // Convolve with phase filter
      for (let tap = 0; tap < FILTER_TAPS; tap++) {
        interpolated += samples[i - tap] * coeffs[tap];
      }

      const abs = Math.abs(interpolated);
      if (abs > maxPeak) {
        maxPeak = abs;
      }
    }
  }

  return maxPeak;
}

/**
 * Compute true peak for stereo or multi-channel audio
 *
 * @param channels - Array of channel data
 * @returns Maximum true peak across all channels (linear)
 */
export function computeTruePeakStereo(channels: Float32Array[]): number {
  let maxPeak = 0;

  for (const channel of channels) {
    const channelPeak = computeTruePeakMono(channel);
    if (channelPeak > maxPeak) {
      maxPeak = channelPeak;
    }
  }

  return maxPeak;
}

/**
 * Result of true peak verification
 */
export interface TruePeakResult {
  /** True peak value in linear scale */
  truePeak: number;
  /** Source of the measurement */
  source: 'ebur128' | 'fallback';
  /** Warning message if fallback was used */
  warning?: string;
}

/**
 * Verify true peak measurement, using fallback if ebur128 returns invalid value
 *
 * This function provides a safety net for true peak measurement:
 * - If ebur128 returns a valid value, it's used as-is
 * - If ebur128 returns invalid (NaN, Infinity, or ≤0), fallback is used
 *
 * @param ebur128Result - True peak from ebur128-wasm (linear scale)
 * @param channels - Audio channel data for fallback computation
 * @returns Verified true peak result with source indication
 */
export function verifyTruePeak(
  ebur128Result: number,
  channels: Float32Array[]
): TruePeakResult {
  // Check if ebur128 result is valid
  if (isFinite(ebur128Result) && ebur128Result > 0) {
    return {
      truePeak: ebur128Result,
      source: 'ebur128'
    };
  }

  // Fallback to our implementation
  const fallbackPeak = computeTruePeakStereo(channels);

  return {
    truePeak: fallbackPeak,
    source: 'fallback',
    warning: `ebur128 returned invalid value (${ebur128Result}), using ITU-R BS.1770-4 fallback`
  };
}

/**
 * Compute sample peak (no oversampling) for comparison
 *
 * @param channels - Audio channel data
 * @returns Maximum absolute sample value (linear)
 */
export function computeSamplePeak(channels: Float32Array[]): number {
  let peak = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      const abs = Math.abs(ch[i]);
      if (abs > peak) peak = abs;
    }
  }
  return peak;
}
