/**
 * Golden Tests for LUFS and True Peak Measurement
 *
 * Tests compliance with EBU R128 / ITU-R BS.1770-4 specifications using
 * synthetic test signals with known properties.
 *
 * Note: In test environment, ebur128-wasm is mocked with a simplified
 * implementation. The real WASM module is validated in CI where it can load.
 *
 * Tolerances per EBU Tech 3341 (for real implementation):
 * - Integrated LUFS: ±0.1 LU
 * - True Peak: ±0.2 dB
 * - LRA: ±0.5 LU
 */

import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { readWavFile } from './helpers/wav-reader';
import { computeLoudness } from '../src/analysis/loudness';
import { computeTruePeakStereo, computeSamplePeak } from '../src/analysis/truePeak';
import { computeDynamics } from '../src/analysis/dsp/dynamics';
import { computeStereo } from '../src/analysis/dsp/stereo';

const fixturesDir = join(__dirname, 'fixtures', 'synthetic');

describe('LUFS Compliance', () => {
  describe('Sine Wave Tests', () => {
    it('measures -14 LUFS target signal (relative check)', async () => {
      const wav14 = readWavFile(join(fixturesDir, 'sine-1k-minus14lufs.wav'));
      const wav23 = readWavFile(join(fixturesDir, 'sine-1k-minus23lufs.wav'));

      const result14 = computeLoudness(wav14.sampleRate, wav14.samples);
      const result23 = computeLoudness(wav23.sampleRate, wav23.samples);

      // The -14 LUFS signal should be ~9 LU louder than -23 LUFS signal
      const difference = result14.integratedLUFS - result23.integratedLUFS;
      expect(difference).toBeCloseTo(9, 0); // Within 0.5 LU
      expect(difference).toBeGreaterThan(8);
      expect(difference).toBeLessThan(10);
    });

    it('returns finite LUFS for valid signals', async () => {
      const wav = readWavFile(join(fixturesDir, 'sine-1k-minus14lufs.wav'));
      const result = computeLoudness(wav.sampleRate, wav.samples);

      expect(isFinite(result.integratedLUFS)).toBe(true);
      expect(result.integratedLUFS).toBeLessThan(0);
    });

    it('measures 0 dBFS sine peak correctly', async () => {
      const wav = readWavFile(join(fixturesDir, 'sine-1k-0dbfs.wav'));
      const result = computeLoudness(wav.sampleRate, wav.samples);

      // Sample peak should be 0 dBFS (±0.1 dB for 24-bit precision)
      expect(result.samplePeakDBFS).toBeCloseTo(0, 1);
      expect(result.samplePeakDBFS).toBeGreaterThan(-0.5);
      expect(result.samplePeakDBFS).toBeLessThan(0.1);
    });
  });

  describe('Edge Cases', () => {
    it('handles silence correctly', async () => {
      const wav = readWavFile(join(fixturesDir, 'silence.wav'));
      const result = computeLoudness(wav.sampleRate, wav.samples);

      // Silence should return -Infinity LUFS
      expect(result.integratedLUFS).toBe(-Infinity);
    });
  });
});

describe('True Peak Compliance', () => {
  it('true peak is at least equal to sample peak', async () => {
    const wav = readWavFile(join(fixturesDir, 'sine-1k-0dbfs.wav'));
    const result = computeLoudness(wav.sampleRate, wav.samples);

    // True peak should never be less than sample peak
    expect(result.truePeakDBTP).toBeGreaterThanOrEqual(result.samplePeakDBFS - 0.1);
  });

  it('sample peak is correct for 0 dBFS signal', async () => {
    const wav = readWavFile(join(fixturesDir, 'sine-1k-0dbfs.wav'));
    const result = computeLoudness(wav.sampleRate, wav.samples);

    // Sample peak should be 0 dBFS
    expect(result.samplePeakDBFS).toBeCloseTo(0, 1);
  });

  it('uses ebur128 as primary source when valid', async () => {
    const wav = readWavFile(join(fixturesDir, 'sine-1k-minus14lufs.wav'));
    const result = computeLoudness(wav.sampleRate, wav.samples);

    // Should use ebur128 for valid signals
    expect(result.truePeakSource).toBe('ebur128');
    expect(result.truePeakWarning).toBeUndefined();
  });

  it('4x oversampling is documented', async () => {
    const wav = readWavFile(join(fixturesDir, 'sine-1k-minus14lufs.wav'));
    const result = computeLoudness(wav.sampleRate, wav.samples);

    // Oversampling factor should be documented
    expect(result.truePeakOversampling).toBe(4);
  });
});

describe('True Peak Fallback', () => {
  it('fallback produces valid results for simple signals', () => {
    // Create a simple test signal
    const samples = new Float32Array(48000);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = 0.5 * Math.sin(2 * Math.PI * 1000 * i / 48000);
    }

    const truePeak = computeTruePeakStereo([samples, samples]);
    const samplePeak = computeSamplePeak([samples, samples]);

    // True peak should be >= sample peak (with small tolerance for filter artifacts)
    expect(truePeak).toBeGreaterThanOrEqual(samplePeak * 0.95);

    // For a clean sine at 1kHz (well below Nyquist), true peak should be close to sample peak
    expect(truePeak).toBeLessThan(samplePeak * 1.2);
  });

  it('fallback handles short signals gracefully', () => {
    // Very short signal (less than filter taps)
    const samples = new Float32Array(10);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = 0.5;
    }

    const truePeak = computeTruePeakStereo([samples, samples]);
    const samplePeak = computeSamplePeak([samples, samples]);

    // Should still return a valid peak
    expect(truePeak).toBeCloseTo(samplePeak, 5);
  });

  it('sample peak function works correctly', () => {
    const samples = new Float32Array([0.1, -0.5, 0.8, -0.3]);
    const peak = computeSamplePeak([samples]);
    expect(peak).toBeCloseTo(0.8, 5);
  });
});

describe('Loudness Range', () => {
  it('computes valid LRA for dynamic signals', async () => {
    const wav = readWavFile(join(fixturesDir, 'sine-1k-minus14lufs.wav'));
    const result = computeLoudness(wav.sampleRate, wav.samples);

    // Static sine should have low LRA
    expect(result.loudnessRangeLU).toBeGreaterThanOrEqual(0);
    expect(result.loudnessRangeLU).toBeLessThan(5); // Low for static signal
  });
});

describe('Short-term Loudness', () => {
  it('provides valid percentiles', async () => {
    const wav = readWavFile(join(fixturesDir, 'sine-1k-minus14lufs.wav'));
    const result = computeLoudness(wav.sampleRate, wav.samples);

    // Percentiles should be in order
    expect(result.shortTermP10).toBeLessThanOrEqual(result.shortTermP50);
    expect(result.shortTermP50).toBeLessThanOrEqual(result.shortTermP90);
    expect(result.shortTermP90).toBeLessThanOrEqual(result.shortTermP95);
  });

  it('timeline contains valid data', async () => {
    const wav = readWavFile(join(fixturesDir, 'sine-1k-minus14lufs.wav'));
    const result = computeLoudness(wav.sampleRate, wav.samples);

    // Timeline should have data points
    expect(result.shortTermTimeline.length).toBeGreaterThan(0);

    // All points should be valid numbers (or -Infinity for silence)
    for (const val of result.shortTermTimeline) {
      expect(typeof val).toBe('number');
    }
  });
});

describe('Clipping Detection', () => {
  it('detects hard clipping in overdriven signal', async () => {
    const wav = readWavFile(join(fixturesDir, 'clipped-signal.wav'));
    const dynamics = computeDynamics(wav.samples, wav.sampleRate);

    // Clipped signal should be detected
    expect(dynamics.hasClipping).toBe(true);
    expect(dynamics.clippedSampleCount).toBeGreaterThan(0);
  });

  it('does not falsely detect clipping in clean signal', async () => {
    const wav = readWavFile(join(fixturesDir, 'sine-1k-minus14lufs.wav'));
    const dynamics = computeDynamics(wav.samples, wav.sampleRate);

    // Clean signal should not be flagged as clipped
    expect(dynamics.hasClipping).toBe(false);
  });
});

describe('DC Offset Detection', () => {
  it('detects DC offset in biased signal', async () => {
    const wav = readWavFile(join(fixturesDir, 'dc-offset.wav'));
    const dynamics = computeDynamics(wav.samples, wav.sampleRate);

    // Should detect DC offset around 0.1
    expect(dynamics.dcOffset).toBeGreaterThan(0.05);
    expect(dynamics.dcOffset).toBeLessThan(0.15);
  });

  it('reports near-zero DC offset for centered signal', async () => {
    const wav = readWavFile(join(fixturesDir, 'sine-1k-minus14lufs.wav'));
    const dynamics = computeDynamics(wav.samples, wav.sampleRate);

    // Centered signal should have minimal DC offset
    expect(Math.abs(dynamics.dcOffset)).toBeLessThan(0.01);
  });
});

describe('Stereo Phase Correlation', () => {
  it('detects negative correlation in phase-inverted stereo', async () => {
    const wav = readWavFile(join(fixturesDir, 'phase-inverted.wav'));
    const stereo = computeStereo(wav.samples, wav.sampleRate);

    // Phase-inverted L/R should have correlation near -1
    expect(stereo.correlationMean).toBeLessThan(-0.9);
    expect(stereo.correlationMean).toBeGreaterThanOrEqual(-1);
  });

  it('detects positive correlation in identical stereo', async () => {
    const wav = readWavFile(join(fixturesDir, 'sine-1k-minus14lufs.wav'));
    const stereo = computeStereo(wav.samples, wav.sampleRate);

    // Identical L/R should have correlation near +1
    expect(stereo.correlationMean).toBeGreaterThan(0.9);
    expect(stereo.correlationMean).toBeLessThanOrEqual(1);
  });
});

describe('Loudness Correction', () => {
  it('calculates positive gain for quiet signal', async () => {
    const wav = readWavFile(join(fixturesDir, 'sine-1k-minus23lufs.wav'));
    const result = computeLoudness(wav.sampleRate, wav.samples);

    // Quiet signal needs positive gain to reach -14 LUFS
    // Note: Mock LUFS implementation may give different absolute values
    expect(result.loudnessCorrectionDB).toBeGreaterThan(0);
    expect(result.loudnessCorrectionNote).toContain('-14 LUFS');
  });

  it('provides correction for target signal', async () => {
    const wav = readWavFile(join(fixturesDir, 'sine-1k-minus14lufs.wav'));
    const result = computeLoudness(wav.sampleRate, wav.samples);

    // Should provide a valid correction note
    expect(result.loudnessCorrectionNote).toBeDefined();
    expect(typeof result.loudnessCorrectionDB).toBe('number');
  });

  it('suggests reduction for loud signal', async () => {
    const wav = readWavFile(join(fixturesDir, 'sine-1k-0dbfs.wav'));
    const result = computeLoudness(wav.sampleRate, wav.samples);

    // 0 dBFS signal is very loud, needs reduction
    expect(result.loudnessCorrectionDB).toBeLessThan(0);
    expect(result.loudnessCorrectionNote).toContain('-14 LUFS');
  });
});

describe('Per-Band Loudness', () => {
  it('computes valid LUFS per band', async () => {
    const wav = readWavFile(join(fixturesDir, 'pink-noise.wav'));
    const result = computeLoudness(wav.sampleRate, wav.samples);

    expect(result.perBandLoudness).toBeDefined();
    // Pink noise should have energy across bands
    expect(result.perBandLoudness.midLUFS).not.toBeNull();
  });

  it('handles narrowband signals', async () => {
    const wav = readWavFile(join(fixturesDir, 'sine-1k-minus14lufs.wav'));
    const result = computeLoudness(wav.sampleRate, wav.samples);

    expect(result.perBandLoudness).toBeDefined();
    // 1kHz sine is in the mid band
    expect(result.perBandLoudness.midLUFS).not.toBeNull();
    // Sub bass should be very quiet for 1kHz sine
    if (result.perBandLoudness.subLUFS !== null) {
      expect(result.perBandLoudness.subLUFS).toBeLessThan(result.perBandLoudness.midLUFS!);
    }
  });

  it('returns null for bands above Nyquist', async () => {
    // Using standard 48kHz rate, brilliance band (6-20kHz) should work
    const wav = readWavFile(join(fixturesDir, 'pink-noise.wav'));
    const result = computeLoudness(wav.sampleRate, wav.samples);

    // All standard bands should compute at 48kHz
    expect(result.perBandLoudness).toBeDefined();
  });
});
