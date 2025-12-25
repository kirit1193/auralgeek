/**
 * Cooley-Tukey FFT (radix-2, in-place)
 * Shared FFT implementation used by both dsp.ts and musical.ts
 */
export function fft(real: Float32Array, imag: Float32Array): void {
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
 * Compute magnitude spectrum from time-domain signal
 * Uses zero-padding to next power of 2 for efficient FFT
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
