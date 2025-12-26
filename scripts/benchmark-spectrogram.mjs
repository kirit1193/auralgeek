/**
 * Spectrogram Computation Benchmark
 *
 * Measures spectrogram data generation performance.
 * Note: Canvas rendering benchmarks require browser environment.
 */

const perf = globalThis.performance || { now: () => Date.now() };

// Inline JS FFT (same as fft.ts)
function fftJS(real, imag) {
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

// Hann window cache
const windowCache = new Map();
function getHannWindow(size) {
  if (!windowCache.has(size)) {
    const w = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
    }
    windowCache.set(size, w);
  }
  return windowCache.get(size);
}

/**
 * Compute spectrogram data (magnitude in dB)
 */
function computeSpectrogram(samples, sampleRate, fftSize = 2048, hopSize = 512) {
  const freqBins = fftSize / 2;
  const timeFrames = Math.floor((samples.length - fftSize) / hopSize) + 1;

  if (timeFrames <= 0) return null;

  const data = new Float32Array(timeFrames * freqBins);
  const hannWindow = getHannWindow(fftSize);
  const minDB = -90;

  const real = new Float32Array(fftSize);
  const imag = new Float32Array(fftSize);

  for (let frame = 0; frame < timeFrames; frame++) {
    const offset = frame * hopSize;

    // Apply window and copy to FFT buffers
    for (let i = 0; i < fftSize; i++) {
      real[i] = (samples[offset + i] || 0) * hannWindow[i];
      imag[i] = 0;
    }

    fftJS(real, imag);

    // Compute magnitude in dB
    const frameOffset = frame * freqBins;
    for (let k = 0; k < freqBins; k++) {
      const mag = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]);
      const db = mag > 0 ? 20 * Math.log10(mag / fftSize) : minDB;
      data[frameOffset + k] = Math.max(minDB, db);
    }
  }

  return { data, timeFrames, freqBins, sampleRate, fftSize };
}

/**
 * Viridis colormap lookup (simplified)
 */
function viridisColor(t) {
  // Simplified viridis approximation
  const r = Math.max(0, Math.min(1, 0.267 + t * (0.329 + t * (-0.892 + t * 1.296))));
  const g = Math.max(0, Math.min(1, 0.004 + t * (1.263 + t * (-0.852 + t * 0.090))));
  const b = Math.max(0, Math.min(1, 0.329 + t * (0.536 + t * (-1.682 + t * 0.817))));
  return [(r * 255) | 0, (g * 255) | 0, (b * 255) | 0];
}

/**
 * Simulate 2D Canvas rendering (create RGBA data)
 */
function renderToRGBA(spectrogram, width, height) {
  const { data, timeFrames, freqBins } = spectrogram;
  const rgba = new Uint8ClampedArray(width * height * 4);

  const minDB = -90, maxDB = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Map to spectrogram coordinates
      const frameIdx = Math.floor(x * timeFrames / width);
      const binIdx = Math.floor((height - 1 - y) * freqBins / height);

      const db = data[frameIdx * freqBins + binIdx];
      const t = Math.max(0, Math.min(1, (db - minDB) / (maxDB - minDB)));

      const [r, g, b] = viridisColor(t);
      const idx = (y * width + x) * 4;
      rgba[idx] = r;
      rgba[idx + 1] = g;
      rgba[idx + 2] = b;
      rgba[idx + 3] = 255;
    }
  }

  return rgba;
}

function generateTestAudio(durationSec, sampleRate) {
  const n = Math.floor(durationSec * sampleRate);
  const samples = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    // Sweep from 100Hz to 10kHz
    const freq = 100 * Math.pow(100, t / durationSec);
    samples[i] = 0.5 * Math.sin(2 * Math.PI * freq * t);
  }

  return samples;
}

async function runBenchmarks() {
  console.log('Spectrogram Computation Benchmark');
  console.log('==================================\n');

  const durations = [5, 30, 180];
  const sampleRate = 44100;
  const resolutions = [
    { width: 400, height: 80, name: 'Thumbnail' },
    { width: 800, height: 200, name: 'Standard' },
    { width: 1600, height: 400, name: 'High-res' }
  ];

  for (const duration of durations) {
    console.log(`\n--- ${duration}s audio ---`);

    const samples = generateTestAudio(duration, sampleRate);

    // Benchmark spectrogram computation
    const computeStart = perf.now();
    const spectrogram = computeSpectrogram(samples, sampleRate);
    const computeTime = perf.now() - computeStart;

    console.log(`Spectrogram computation: ${computeTime.toFixed(2)}ms`);
    console.log(`  Frames: ${spectrogram.timeFrames}, Bins: ${spectrogram.freqBins}`);

    // Benchmark rendering at different resolutions
    console.log('\nRendering (RGBA generation):');
    for (const res of resolutions) {
      const renderStart = perf.now();
      const rgba = renderToRGBA(spectrogram, res.width, res.height);
      const renderTime = perf.now() - renderStart;
      console.log(`  ${res.name.padEnd(12)} (${res.width}x${res.height}): ${renderTime.toFixed(2)}ms`);
    }
  }

  console.log('\n\nNote: Actual Canvas/WebGL rendering requires browser environment.');
  console.log('This benchmark measures data computation and RGBA generation only.');
}

runBenchmarks().catch(console.error);
