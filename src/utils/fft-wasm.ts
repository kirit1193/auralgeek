/**
 * WASM FFT Wrapper with JS Fallback
 *
 * Attempts to use WASM-accelerated FFT (kissfft-wasm) when available,
 * falls back to pure JavaScript Cooley-Tukey implementation.
 *
 * The WASM version can be 2-4x faster for large FFT sizes (4096+).
 */

// Type for kissfft-wasm module (will be lazy loaded)
interface KissFFTModule {
  fft: (input: Float32Array) => Float32Array;
  rfft: (input: Float32Array) => Float32Array;
}

// Module state
let wasmModule: KissFFTModule | null = null;
let wasmInitPromise: Promise<boolean> | null = null;
let wasmAvailable = false;

/**
 * Attempt to initialize the WASM FFT module.
 * Returns true if WASM is available, false if falling back to JS.
 * Safe to call multiple times - will only initialize once.
 */
export async function initWasmFFT(): Promise<boolean> {
  if (wasmInitPromise) {
    return wasmInitPromise;
  }

  wasmInitPromise = (async () => {
    try {
      // Dynamic import to avoid bundler issues when WASM isn't available
      // @ts-ignore - kissfft-wasm is an optional dependency
      const kissfft = await import('kissfft-wasm');
      wasmModule = kissfft;
      wasmAvailable = true;
      return true;
    } catch {
      // WASM not available, will use JS fallback
      wasmAvailable = false;
      return false;
    }
  })();

  return wasmInitPromise;
}

/**
 * Check if WASM FFT is currently available
 */
export function isWasmAvailable(): boolean {
  return wasmAvailable;
}

/**
 * JavaScript Cooley-Tukey FFT implementation (in-place, radix-2)
 * Used as fallback when WASM is not available
 */
function fftJS(real: Float32Array, imag: Float32Array): void {
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

/**
 * Perform FFT using WASM if available, JS fallback otherwise.
 * In-place transform modifies real and imag arrays.
 *
 * @param real Real part of input (length must be power of 2)
 * @param imag Imaginary part of input (same length as real)
 */
export function fft(real: Float32Array, imag: Float32Array): void {
  if (wasmAvailable && wasmModule) {
    // Pack into interleaved complex format: [re0, im0, re1, im1, ...]
    const n = real.length;
    const interleaved = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      interleaved[i * 2] = real[i];
      interleaved[i * 2 + 1] = imag[i];
    }

    // Perform WASM FFT
    const result = wasmModule.fft(interleaved);

    // Unpack back to separate real/imag arrays
    for (let i = 0; i < n; i++) {
      real[i] = result[i * 2];
      imag[i] = result[i * 2 + 1];
    }
  } else {
    // Use JS fallback
    fftJS(real, imag);
  }
}

/**
 * Perform real-valued FFT (input is real, output is complex).
 * More efficient than full complex FFT for real signals.
 *
 * @param input Real-valued input signal (length must be power of 2)
 * @returns Interleaved complex output [re0, im0, re1, im1, ...] (length = input.length)
 */
export function rfft(input: Float32Array): Float32Array {
  if (wasmAvailable && wasmModule) {
    return wasmModule.rfft(input);
  }

  // JS fallback: use full complex FFT with zero imaginary part
  const n = input.length;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  real.set(input);

  fftJS(real, imag);

  // Return interleaved format (only first half + Nyquist for real input)
  const outputLen = n; // n/2 + 1 complex numbers interleaved
  const output = new Float32Array(outputLen);
  for (let i = 0; i < n / 2; i++) {
    output[i * 2] = real[i];
    output[i * 2 + 1] = imag[i];
  }

  return output;
}

/**
 * Compute magnitude spectrum from time-domain signal
 * Uses WASM if available
 */
export function computeMagnitudeSpectrum(signal: Float32Array): Float32Array {
  // Find next power of 2
  let fftSize = 1;
  while (fftSize < signal.length) fftSize <<= 1;

  const real = new Float32Array(fftSize);
  const imag = new Float32Array(fftSize);

  // Copy signal with zero-padding
  for (let i = 0; i < signal.length; i++) {
    real[i] = signal[i];
  }

  fft(real, imag);

  // Compute magnitude (only need first half due to symmetry)
  const halfSize = fftSize >> 1;
  const magnitudes = new Float32Array(halfSize);
  for (let i = 0; i < halfSize; i++) {
    magnitudes[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
  }

  return magnitudes;
}
