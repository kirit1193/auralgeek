/**
 * Digital filter implementations
 * Shared by dsp.ts for spectral and stereo analysis
 *
 * All filters support optional pre-allocated output buffers to reduce GC pressure.
 */

/**
 * One-pole lowpass filter
 * @param input - Input signal
 * @param fc - Cutoff frequency in Hz
 * @param fs - Sample rate in Hz
 * @param output - Optional pre-allocated output buffer
 */
export function onePoleLP(
  input: Float32Array,
  fc: number,
  fs: number,
  output?: Float32Array
): Float32Array {
  const out = output ?? new Float32Array(input.length);
  const x = Math.exp(-2 * Math.PI * fc / fs);
  let y = 0;
  for (let i = 0; i < input.length; i++) {
    y = (1 - x) * input[i] + x * y;
    out[i] = y;
  }
  return out;
}

/**
 * One-pole highpass filter (derived from lowpass)
 * @param input - Input signal
 * @param fc - Cutoff frequency in Hz
 * @param fs - Sample rate in Hz
 * @param output - Optional pre-allocated output buffer
 * @param lpBuffer - Optional pre-allocated buffer for intermediate LP result
 */
export function onePoleHP(
  input: Float32Array,
  fc: number,
  fs: number,
  output?: Float32Array,
  lpBuffer?: Float32Array
): Float32Array {
  const lp = onePoleLP(input, fc, fs, lpBuffer);
  const out = output ?? new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) out[i] = input[i] - lp[i];
  return out;
}

/**
 * Simple bandpass filter (cascaded HP + LP)
 * @param input - Input signal
 * @param lowFreq - Low cutoff frequency in Hz
 * @param highFreq - High cutoff frequency in Hz
 * @param fs - Sample rate in Hz
 * @param output - Optional pre-allocated output buffer
 * @param tempBuffer - Optional pre-allocated buffer for intermediate result
 */
export function bandpassFilter(
  input: Float32Array,
  lowFreq: number,
  highFreq: number,
  fs: number,
  output?: Float32Array,
  tempBuffer?: Float32Array
): Float32Array {
  const hp = onePoleHP(input, lowFreq, fs, tempBuffer);
  return onePoleLP(hp, highFreq, fs, output);
}
