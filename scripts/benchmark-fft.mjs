/**
 * FFT Performance Benchmark
 *
 * Measures FFT performance for various sizes.
 * Compares JS implementation (kissfft-wasm will fail in Node.js).
 */

// Node.js polyfill for performance if needed
const perf = globalThis.performance || { now: () => Date.now() };

// Inline JS FFT implementation (same as fft.ts)
function fftJS(real, imag) {
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

function generateTestSignal(size) {
  const real = new Float32Array(size);
  const imag = new Float32Array(size);

  // Multi-tone test signal
  for (let i = 0; i < size; i++) {
    real[i] = Math.sin(2 * Math.PI * 440 * i / 44100)
            + 0.5 * Math.sin(2 * Math.PI * 880 * i / 44100)
            + 0.25 * Math.sin(2 * Math.PI * 1320 * i / 44100);
  }

  return { real, imag };
}

function benchmark(name, fn, iterations) {
  // Warm-up
  for (let i = 0; i < 10; i++) fn();

  const start = perf.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const elapsed = perf.now() - start;

  return {
    name,
    totalMs: elapsed.toFixed(2),
    avgMs: (elapsed / iterations).toFixed(4),
    opsPerSec: Math.round(iterations / (elapsed / 1000))
  };
}

async function runBenchmarks() {
  console.log('FFT Performance Benchmark');
  console.log('=========================\n');
  console.log('Implementation: Cooley-Tukey (JS)\n');

  const sizes = [256, 512, 1024, 2048, 4096, 8192];
  const results = [];

  for (const size of sizes) {
    const iterations = Math.max(100, Math.floor(50000 / size));
    const { real, imag } = generateTestSignal(size);

    const result = benchmark(`FFT-${size}`, () => {
      const r = real.slice();
      const i = imag.slice();
      fftJS(r, i);
    }, iterations);

    results.push({ size, ...result });
    console.log(`FFT ${size.toString().padStart(5)}: ${result.avgMs.padStart(8)}ms avg | ${result.opsPerSec.toString().padStart(7)} ops/sec`);
  }

  console.log('\n--- Summary ---');
  console.log('Size    | Avg (ms) | Ops/sec');
  console.log('--------|----------|--------');
  for (const r of results) {
    console.log(`${r.size.toString().padStart(7)} | ${r.avgMs.padStart(8)} | ${r.opsPerSec.toString().padStart(7)}`);
  }
}

runBenchmarks().catch(console.error);
