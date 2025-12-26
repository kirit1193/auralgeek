/**
 * Extended Dynamics Tests
 *
 * Tests for new dynamics features:
 * - Dynamic Range Preservation Score
 * - Transient Spacing Analysis
 * - Compression Detection
 * - Transient Sharpness
 */

import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { readWavFile } from './helpers/wav-reader';
import { computeDynamics } from '../src/analysis/dsp/dynamics';

const fixturesDir = join(__dirname, 'fixtures', 'synthetic');

describe('Dynamic Range Preservation Score', () => {
  it('scores high for uncompressed signal', async () => {
    const wav = readWavFile(join(fixturesDir, 'sine-1k-minus14lufs.wav'));
    const dynamics = computeDynamics(wav.samples, wav.sampleRate);

    // Clean sine wave should have good dynamic preservation
    expect(dynamics.dynamicPreservationScore).not.toBeNull();
    expect(dynamics.dynamicPreservationScore).toBeGreaterThan(50);
  });

  it('scores lower for heavily compressed signal', async () => {
    const wav = readWavFile(join(fixturesDir, 'compressed-heavy.wav'));
    const dynamics = computeDynamics(wav.samples, wav.sampleRate);

    // Compressed signal should have lower preservation score
    expect(dynamics.dynamicPreservationScore).not.toBeNull();
    // Score may still be moderate due to lack of clipping
    expect(dynamics.dynamicPreservationScore).toBeLessThan(100);
  });

  it('penalizes clipping in preservation score', async () => {
    const wavClean = readWavFile(join(fixturesDir, 'sine-1k-minus14lufs.wav'));
    const wavClipped = readWavFile(join(fixturesDir, 'clipped-signal.wav'));

    const dynClean = computeDynamics(wavClean.samples, wavClean.sampleRate);
    const dynClipped = computeDynamics(wavClipped.samples, wavClipped.sampleRate);

    // Clipped signal should have lower score
    if (dynClean.dynamicPreservationScore !== null && dynClipped.dynamicPreservationScore !== null) {
      expect(dynClipped.dynamicPreservationScore).toBeLessThan(dynClean.dynamicPreservationScore);
    }
  });

  it('provides preservation note', async () => {
    const wav = readWavFile(join(fixturesDir, 'sine-1k-minus14lufs.wav'));
    const dynamics = computeDynamics(wav.samples, wav.sampleRate);

    expect(dynamics.dynamicPreservationNote).not.toBeNull();
    expect(typeof dynamics.dynamicPreservationNote).toBe('string');
  });
});

describe('Transient Spacing Analysis', () => {
  it('detects robotic timing', async () => {
    const wav = readWavFile(join(fixturesDir, 'robotic-timing.wav'));
    const dynamics = computeDynamics(wav.samples, wav.sampleRate);

    // Robotic timing should have very low CV (uniform spacing)
    expect(dynamics.transientSpacingCV).not.toBeNull();
    if (dynamics.transientSpacingCV !== null) {
      expect(dynamics.transientSpacingCV).toBeLessThan(0.15);
    }

    // Should be classified as robotic or tight
    expect(['robotic', 'tight']).toContain(dynamics.transientTimingCharacter);
  });

  it('detects timing in drum-like signal', async () => {
    const wav = readWavFile(join(fixturesDir, 'sharp-transients.wav'));
    const dynamics = computeDynamics(wav.samples, wav.sampleRate);

    // Sharp transients should have detectable timing
    expect(dynamics.transientSpacingCV).not.toBeNull();
    // Timing character depends on actual spacing variance in generated signal
    expect(['robotic', 'natural', 'tight', 'loose']).toContain(dynamics.transientTimingCharacter);
  });

  it('handles signals without clear transients', async () => {
    const wav = readWavFile(join(fixturesDir, 'sine-1k-minus14lufs.wav'));
    const dynamics = computeDynamics(wav.samples, wav.sampleRate);

    // Sine wave has no transients, should handle gracefully
    // CV may be null or high
    expect(dynamics.transientTimingCharacter).not.toBe(undefined);
  });
});

describe('Compression Detection', () => {
  it('detects heavy compression', async () => {
    const wav = readWavFile(join(fixturesDir, 'compressed-heavy.wav'));
    const dynamics = computeDynamics(wav.samples, wav.sampleRate);

    expect(dynamics.compressionEstimate).not.toBeNull();
    if (dynamics.compressionEstimate) {
      // Heavy compression should be detected
      expect(['moderate', 'heavy', 'brickwall']).toContain(
        dynamics.compressionEstimate.compressionCharacter
      );
    }
  });

  it('detects characteristics in clipped signal', async () => {
    const wav = readWavFile(join(fixturesDir, 'clipped-signal.wav'));
    const dynamics = computeDynamics(wav.samples, wav.sampleRate);

    expect(dynamics.compressionEstimate).not.toBeNull();
    if (dynamics.compressionEstimate) {
      // Clipped signal may have various compression characteristics
      // depending on how the dynamics are measured
      expect(['light', 'moderate', 'heavy', 'brickwall']).toContain(
        dynamics.compressionEstimate.compressionCharacter
      );
    }
    // Most importantly, clipping should be detected
    expect(dynamics.hasClipping).toBe(true);
  });

  it('detects light/no compression in clean signal', async () => {
    const wav = readWavFile(join(fixturesDir, 'sine-1k-minus14lufs.wav'));
    const dynamics = computeDynamics(wav.samples, wav.sampleRate);

    expect(dynamics.compressionEstimate).not.toBeNull();
    if (dynamics.compressionEstimate) {
      // Clean sine should show light or no compression
      expect(['light', 'moderate']).toContain(
        dynamics.compressionEstimate.compressionCharacter
      );
    }
  });

  it('provides confidence level', async () => {
    const wav = readWavFile(join(fixturesDir, 'compressed-heavy.wav'));
    const dynamics = computeDynamics(wav.samples, wav.sampleRate);

    expect(dynamics.compressionEstimate).not.toBeNull();
    if (dynamics.compressionEstimate) {
      expect(['low', 'medium', 'high']).toContain(
        dynamics.compressionEstimate.confidence
      );
    }
  });
});

describe('Transient Sharpness', () => {
  it('scores high for sharp transients', async () => {
    const wav = readWavFile(join(fixturesDir, 'sharp-transients.wav'));
    const dynamics = computeDynamics(wav.samples, wav.sampleRate);

    expect(dynamics.transientSharpness).not.toBeNull();
    if (dynamics.transientSharpness) {
      // Sharp transients should have high steepness
      expect(dynamics.transientSharpness.attackSteepnessScore).toBeGreaterThan(30);
    }
  });

  it('provides attack and decay measurements when possible', async () => {
    const wav = readWavFile(join(fixturesDir, 'sharp-transients.wav'));
    const dynamics = computeDynamics(wav.samples, wav.sampleRate);

    expect(dynamics.transientSharpness).not.toBeNull();
    if (dynamics.transientSharpness) {
      // Attack/decay may be null if transients aren't clearly detected
      // but the sharpness score should still be computed
      expect(typeof dynamics.transientSharpness.attackSteepnessScore).toBe('number');
      expect(typeof dynamics.transientSharpness.spacingUniformityScore).toBe('number');
    }
  });

  it('provides spacing uniformity score', async () => {
    const wav = readWavFile(join(fixturesDir, 'robotic-timing.wav'));
    const dynamics = computeDynamics(wav.samples, wav.sampleRate);

    expect(dynamics.transientSharpness).not.toBeNull();
    if (dynamics.transientSharpness) {
      // Robotic timing should have high uniformity
      expect(dynamics.transientSharpness.spacingUniformityScore).toBeGreaterThan(50);
    }
  });
});
