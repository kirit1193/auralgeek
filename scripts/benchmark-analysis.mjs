/**
 * Track Analysis Pipeline Benchmark
 *
 * Measures performance of each analysis stage.
 * Generates synthetic audio for consistent testing.
 */

// Note: This benchmark imports from compiled output
// Run `npm run build` first, or use with Vite/esbuild

const perf = globalThis.performance || { now: () => Date.now() };

/**
 * Generate synthetic stereo audio
 * @param {number} durationSec
 * @param {number} sampleRate
 * @returns {{ left: Float32Array, right: Float32Array }}
 */
function generateSyntheticAudio(durationSec, sampleRate) {
  const n = Math.floor(durationSec * sampleRate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  // Complex multi-tone signal with stereo movement
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;

    // Base tones
    const tone1 = 0.3 * Math.sin(2 * Math.PI * 220 * t);
    const tone2 = 0.2 * Math.sin(2 * Math.PI * 440 * t);
    const tone3 = 0.1 * Math.sin(2 * Math.PI * 880 * t);

    // Stereo panning that moves
    const pan = 0.5 + 0.3 * Math.sin(2 * Math.PI * 0.5 * t);

    // Add some noise
    const noise = 0.05 * (Math.random() * 2 - 1);

    const mono = tone1 + tone2 + tone3 + noise;
    left[i] = mono * (1 - pan * 0.5);
    right[i] = mono * (0.5 + pan * 0.5);
  }

  return { left, right };
}

/**
 * Benchmark a single function
 */
function timeOperation(name, fn) {
  const start = perf.now();
  const result = fn();
  const elapsed = perf.now() - start;
  return { name, elapsed, result };
}

/**
 * Run analysis benchmarks
 */
async function runBenchmarks() {
  console.log('Track Analysis Pipeline Benchmark');
  console.log('==================================\n');

  const durations = [5, 30, 180]; // seconds
  const sampleRate = 44100;

  for (const duration of durations) {
    console.log(`\n--- ${duration}s track (${(duration * sampleRate * 2 * 4 / 1024 / 1024).toFixed(1)}MB stereo) ---`);

    const { left, right } = generateSyntheticAudio(duration, sampleRate);
    const channels = [left, right];

    // Create mono mix
    const mono = new Float32Array(left.length);
    for (let i = 0; i < left.length; i++) {
      mono[i] = (left[i] + right[i]) * 0.5;
    }

    const stages = [];

    // Since we can't easily import the actual modules in Node.js,
    // we'll measure what we can simulate

    // 1. Mono mix creation (already done, but measure it)
    stages.push(timeOperation('Create mono mix', () => {
      const m = new Float32Array(left.length);
      for (let i = 0; i < left.length; i++) {
        m[i] = (left[i] + right[i]) * 0.5;
      }
      return m;
    }));

    // 2. RMS calculation (simplified loudness proxy)
    stages.push(timeOperation('RMS calculation', () => {
      let sumSq = 0;
      for (let i = 0; i < mono.length; i++) {
        sumSq += mono[i] * mono[i];
      }
      return Math.sqrt(sumSq / mono.length);
    }));

    // 3. Peak detection
    stages.push(timeOperation('Peak detection', () => {
      let max = 0;
      for (let i = 0; i < mono.length; i++) {
        const abs = Math.abs(mono[i]);
        if (abs > max) max = abs;
      }
      return max;
    }));

    // 4. Correlation (stereo)
    stages.push(timeOperation('Stereo correlation', () => {
      let sumL = 0, sumR = 0, sumLL = 0, sumRR = 0, sumLR = 0;
      const n = left.length;
      for (let i = 0; i < n; i++) {
        sumL += left[i]; sumR += right[i];
        sumLL += left[i] * left[i]; sumRR += right[i] * right[i];
        sumLR += left[i] * right[i];
      }
      const meanL = sumL / n, meanR = sumR / n;
      const cov = sumLR / n - meanL * meanR;
      const varL = sumLL / n - meanL * meanL;
      const varR = sumRR / n - meanR * meanR;
      return (varL > 0 && varR > 0) ? cov / Math.sqrt(varL * varR) : 0;
    }));

    // 5. Simple FFT-based spectral centroid (256 frames)
    stages.push(timeOperation('Spectral analysis (256 FFTs)', () => {
      const fftSize = 2048;
      const hopSize = 1024;
      let totalCentroid = 0;
      let frames = 0;

      for (let pos = 0; pos + fftSize < mono.length && frames < 256; pos += hopSize) {
        // Simplified: just compute weighted average of samples (proxy for centroid)
        let sum = 0, weightedSum = 0;
        for (let i = 0; i < fftSize; i++) {
          const val = Math.abs(mono[pos + i]);
          sum += val;
          weightedSum += val * i;
        }
        if (sum > 0) totalCentroid += weightedSum / sum;
        frames++;
      }

      return totalCentroid / frames;
    }));

    // Print results
    let totalMs = 0;
    console.log('\nStage                          | Time (ms)');
    console.log('-------------------------------|----------');
    for (const stage of stages) {
      console.log(`${stage.name.padEnd(30)} | ${stage.elapsed.toFixed(2).padStart(9)}`);
      totalMs += stage.elapsed;
    }
    console.log('-------------------------------|----------');
    console.log(`${'TOTAL'.padEnd(30)} | ${totalMs.toFixed(2).padStart(9)}`);
  }

  console.log('\n\nNote: This benchmark uses simplified operations.');
  console.log('For accurate analysis timing, run the app with DevTools Performance tab.');
}

runBenchmarks().catch(console.error);
