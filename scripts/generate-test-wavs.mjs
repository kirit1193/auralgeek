/**
 * Generate synthetic WAV files for loudness testing
 *
 * Creates test signals with precisely known LUFS and True Peak values
 * for validating the loudness analysis implementation.
 *
 * Run with: node scripts/generate-test-wavs.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '..', 'tests', 'fixtures', 'synthetic');

// Ensure directory exists
mkdirSync(fixturesDir, { recursive: true });

/**
 * Write a WAV file with the given samples
 */
function writeWavFile(filePath, sampleRate, samples) {
  const numChannels = samples.length;
  const numSamples = samples[0].length;
  const bitsPerSample = 24; // 24-bit for better precision
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;

  // Total file size: 44 bytes header + data
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);           // Chunk size
  buffer.writeUInt16LE(1, 20);            // Audio format (PCM)
  buffer.writeUInt16LE(numChannels, 22);  // Channels
  buffer.writeUInt32LE(sampleRate, 24);   // Sample rate
  buffer.writeUInt32LE(byteRate, 28);     // Byte rate
  buffer.writeUInt16LE(blockAlign, 32);   // Block align
  buffer.writeUInt16LE(bitsPerSample, 34);// Bits per sample

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write samples (interleaved)
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      // Convert float to 24-bit signed integer
      const sample = Math.max(-1, Math.min(1, samples[ch][i]));
      const intSample = Math.round(sample * 8388607); // 2^23 - 1
      // Write 24-bit little-endian
      buffer.writeUInt8(intSample & 0xFF, offset);
      buffer.writeUInt8((intSample >> 8) & 0xFF, offset + 1);
      buffer.writeUInt8((intSample >> 16) & 0xFF, offset + 2);
      offset += bytesPerSample;
    }
  }

  writeFileSync(filePath, buffer);
  console.log(`Created: ${filePath}`);
}

/**
 * Generate a sine wave at given frequency and amplitude
 */
function generateSine(sampleRate, duration, frequency, amplitude) {
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    samples[i] = amplitude * Math.sin(2 * Math.PI * frequency * i / sampleRate);
  }

  return samples;
}

/**
 * Generate silence
 */
function generateSilence(sampleRate, duration) {
  return new Float32Array(Math.floor(sampleRate * duration));
}

/**
 * Calculate RMS amplitude for target LUFS (approximate for sine wave)
 * For a 1kHz sine wave, LUFS ≈ 20 * log10(amplitude) + 3.01 (RMS) - 0.691 (K-weighting offset)
 * Simplified: LUFS ≈ 20 * log10(amplitude * 0.7071) - 0.691
 */
function lufsToAmplitude(targetLUFS) {
  // For a sine wave: LUFS ≈ 20*log10(A/sqrt(2)) - 0.691
  // So: A = sqrt(2) * 10^((LUFS + 0.691) / 20)
  return Math.sqrt(2) * Math.pow(10, (targetLUFS + 0.691) / 20);
}

/**
 * Generate pink noise using Voss-McCartney algorithm
 */
function generatePinkNoise(sampleRate, duration, amplitude) {
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples);

  const numOctaves = 16;
  const values = new Float32Array(numOctaves);
  let sum = 0;

  for (let i = 0; i < numSamples; i++) {
    // Update octave values based on bit changes
    let j = i;
    let k = 0;
    while ((j & 1) === 0 && k < numOctaves) {
      sum -= values[k];
      values[k] = Math.random() * 2 - 1;
      sum += values[k];
      j >>= 1;
      k++;
    }

    samples[i] = (sum / numOctaves) * amplitude;
  }

  // Normalize to target amplitude
  let max = 0;
  for (let i = 0; i < numSamples; i++) {
    if (Math.abs(samples[i]) > max) max = Math.abs(samples[i]);
  }
  if (max > 0) {
    const scale = amplitude / max;
    for (let i = 0; i < numSamples; i++) {
      samples[i] *= scale;
    }
  }

  return samples;
}

/**
 * Generate inter-sample peak test signal
 * Creates 0 dBFS samples that will cause >0 dBTP when interpolated
 */
function generateISPTest(sampleRate, duration) {
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples);

  // Create alternating +1, -1 pattern which causes ISP
  // The pattern 1, -1, 1, -1 creates inter-sample peaks around 1.2x
  for (let i = 0; i < numSamples; i++) {
    // Alternate between +1 and -1 at Nyquist frequency
    samples[i] = (i % 2 === 0) ? 1.0 : -1.0;
  }

  return samples;
}

/**
 * Generate a clipped signal - a loud sine wave that clips at ±1.0
 * The pre-clip signal amplitude is higher, creating flat tops/bottoms
 */
function generateClippedSignal(sampleRate, duration, frequency, overdrive) {
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    // Generate overdriven sine wave
    const raw = overdrive * Math.sin(2 * Math.PI * frequency * i / sampleRate);
    // Hard clip at ±1.0
    samples[i] = Math.max(-1, Math.min(1, raw));
  }

  return samples;
}

/**
 * Generate a signal with DC offset
 */
function generateDCOffset(sampleRate, duration, frequency, amplitude, dcOffset) {
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const sine = amplitude * Math.sin(2 * Math.PI * frequency * i / sampleRate);
    // Add DC offset and clip if needed
    samples[i] = Math.max(-1, Math.min(1, sine + dcOffset));
  }

  return samples;
}

/**
 * Generate phase-inverted stereo signal (L and R out of phase)
 * This creates a signal with very low or negative correlation
 */
function generatePhaseInverted(sampleRate, duration, frequency, amplitude) {
  const numSamples = Math.floor(sampleRate * duration);
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const sine = amplitude * Math.sin(2 * Math.PI * frequency * i / sampleRate);
    left[i] = sine;
    right[i] = -sine; // Inverted phase
  }

  return { left, right };
}

// ========================================
// Generate test files
// ========================================

console.log('Generating synthetic test WAV files...\n');

const sampleRate = 48000;
const duration = 5; // 5 seconds for each test

// 1. 1kHz sine at -14 LUFS (streaming target)
const amp14 = lufsToAmplitude(-14);
const sine14 = generateSine(sampleRate, duration, 1000, amp14);
writeWavFile(
  join(fixturesDir, 'sine-1k-minus14lufs.wav'),
  sampleRate,
  [sine14, sine14] // Stereo
);

// 2. 1kHz sine at -23 LUFS (broadcast standard)
const amp23 = lufsToAmplitude(-23);
const sine23 = generateSine(sampleRate, duration, 1000, amp23);
writeWavFile(
  join(fixturesDir, 'sine-1k-minus23lufs.wav'),
  sampleRate,
  [sine23, sine23]
);

// 3. 1kHz sine at 0 dBFS (clipping edge)
const sine0dbfs = generateSine(sampleRate, duration, 1000, 1.0);
writeWavFile(
  join(fixturesDir, 'sine-1k-0dbfs.wav'),
  sampleRate,
  [sine0dbfs, sine0dbfs]
);

// 4. Silence
const silence = generateSilence(sampleRate, duration);
writeWavFile(
  join(fixturesDir, 'silence.wav'),
  sampleRate,
  [silence, silence]
);

// 5. Inter-sample peak test
const ispSignal = generateISPTest(sampleRate, 1); // 1 second
writeWavFile(
  join(fixturesDir, 'isp-test.wav'),
  sampleRate,
  [ispSignal, ispSignal]
);

// 6. Pink noise at -23 LUFS (approximate)
const pinkNoise = generatePinkNoise(sampleRate, duration, 0.15);
writeWavFile(
  join(fixturesDir, 'pink-noise.wav'),
  sampleRate,
  [pinkNoise, pinkNoise]
);

// 7. Clipped signal (hard clipping at ±1.0)
const clippedSignal = generateClippedSignal(sampleRate, duration, 1000, 1.5); // 1.5x overdrive
writeWavFile(
  join(fixturesDir, 'clipped-signal.wav'),
  sampleRate,
  [clippedSignal, clippedSignal]
);

// 8. DC offset signal
const dcOffsetSignal = generateDCOffset(sampleRate, duration, 1000, 0.3, 0.1); // 0.1 DC offset
writeWavFile(
  join(fixturesDir, 'dc-offset.wav'),
  sampleRate,
  [dcOffsetSignal, dcOffsetSignal]
);

// 9. Phase-inverted stereo (L and R out of phase)
const phaseInverted = generatePhaseInverted(sampleRate, duration, 1000, 0.5);
writeWavFile(
  join(fixturesDir, 'phase-inverted.wav'),
  sampleRate,
  [phaseInverted.left, phaseInverted.right]
);

// 10. Heavily compressed signal (low crest factor)
function generateCompressedSignal(sampleRate, duration, frequency, ratio) {
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples);
  const threshold = 0.3;

  for (let i = 0; i < numSamples; i++) {
    let raw = 0.8 * Math.sin(2 * Math.PI * frequency * i / sampleRate);
    // Add some harmonics for realism
    raw += 0.2 * Math.sin(4 * Math.PI * frequency * i / sampleRate);
    raw += 0.1 * Math.sin(6 * Math.PI * frequency * i / sampleRate);

    // Apply soft-knee compression
    const absVal = Math.abs(raw);
    if (absVal > threshold) {
      const excess = absVal - threshold;
      const compressed = threshold + excess / ratio;
      raw = raw > 0 ? compressed : -compressed;
    }
    samples[i] = raw;
  }

  // Normalize
  let max = 0;
  for (let i = 0; i < numSamples; i++) {
    if (Math.abs(samples[i]) > max) max = Math.abs(samples[i]);
  }
  for (let i = 0; i < numSamples; i++) {
    samples[i] = (samples[i] / max) * 0.95;
  }

  return samples;
}

const compressedSignal = generateCompressedSignal(sampleRate, duration, 440, 8); // 8:1 ratio
writeWavFile(
  join(fixturesDir, 'compressed-heavy.wav'),
  sampleRate,
  [compressedSignal, compressedSignal]
);

// 11. Distorted sine (for THD testing)
function generateDistortedSine(sampleRate, duration, frequency, distortion) {
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    let raw = Math.sin(2 * Math.PI * frequency * i / sampleRate);
    // Apply soft clipping distortion (tanh)
    raw = Math.tanh(raw * distortion) / Math.tanh(distortion);
    samples[i] = raw * 0.8;
  }

  return samples;
}

const distortedSine = generateDistortedSine(sampleRate, duration, 440, 3); // Moderate distortion
writeWavFile(
  join(fixturesDir, 'distorted-sine.wav'),
  sampleRate,
  [distortedSine, distortedSine]
);

// 12. Sharp transients (drum-like impulses)
function generateSharpTransients(sampleRate, duration, bpm) {
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples);
  const samplesPerBeat = Math.floor((60 / bpm) * sampleRate);
  const attackSamples = Math.floor(sampleRate * 0.002); // 2ms attack
  const decaySamples = Math.floor(sampleRate * 0.1);    // 100ms decay

  for (let beat = 0; beat < duration * bpm / 60; beat++) {
    const startSample = beat * samplesPerBeat;

    // Sharp attack
    for (let i = 0; i < attackSamples && startSample + i < numSamples; i++) {
      samples[startSample + i] = i / attackSamples * 0.9;
    }

    // Exponential decay
    for (let i = 0; i < decaySamples && startSample + attackSamples + i < numSamples; i++) {
      const envelope = Math.exp(-i / (decaySamples / 5)) * 0.9;
      const noise = (Math.random() * 2 - 1) * envelope;
      samples[startSample + attackSamples + i] = noise;
    }
  }

  return samples;
}

const sharpTransients = generateSharpTransients(sampleRate, duration, 120);
writeWavFile(
  join(fixturesDir, 'sharp-transients.wav'),
  sampleRate,
  [sharpTransients, sharpTransients]
);

// 13. Robotic timing (perfectly uniform transients - for AI detection)
function generateRoboticTransients(sampleRate, duration, bpm) {
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples);
  const samplesPerBeat = Math.floor((60 / bpm) * sampleRate);
  const clickDuration = Math.floor(sampleRate * 0.005); // 5ms click

  for (let beat = 0; beat < duration * bpm / 60; beat++) {
    const startSample = beat * samplesPerBeat;

    // Perfect rectangular click
    for (let i = 0; i < clickDuration && startSample + i < numSamples; i++) {
      samples[startSample + i] = 0.8;
    }
  }

  return samples;
}

const roboticTransients = generateRoboticTransients(sampleRate, duration, 120);
writeWavFile(
  join(fixturesDir, 'robotic-timing.wav'),
  sampleRate,
  [roboticTransients, roboticTransients]
);

console.log('\nDone! Test files created in tests/fixtures/synthetic/');
console.log('\nExpected values (approximate):');
console.log('  sine-1k-minus14lufs.wav: -14 LUFS');
console.log('  sine-1k-minus23lufs.wav: -23 LUFS');
console.log('  sine-1k-0dbfs.wav: ~-3 LUFS, 0 dBFS sample peak');
console.log('  silence.wav: -Infinity LUFS');
console.log('  isp-test.wav: Inter-sample peak > 0 dBTP');
console.log('  pink-noise.wav: Variable LUFS (pink noise spectrum)');
console.log('  clipped-signal.wav: Hard clipping, hasClipping=true');
console.log('  dc-offset.wav: DC offset ~0.1');
console.log('  phase-inverted.wav: Stereo correlation = -1 (out of phase)');
console.log('  compressed-heavy.wav: Heavy compression, low crest factor');
console.log('  distorted-sine.wav: THD > 0 (harmonic distortion)');
console.log('  sharp-transients.wav: Sharp attacks, natural timing');
console.log('  robotic-timing.wav: Perfect timing, robotic character');
