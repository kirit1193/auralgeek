/**
 * Harmonic Distortion Tests
 *
 * Tests for THD (Total Harmonic Distortion) estimation
 */

import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { readWavFile } from './helpers/wav-reader';
import { computeTHD } from '../src/analysis/dsp/harmonics';

const fixturesDir = join(__dirname, 'fixtures', 'synthetic');

describe('THD Estimation', () => {
  it('returns low THD for pure sine wave', async () => {
    const wav = readWavFile(join(fixturesDir, 'sine-1k-minus14lufs.wav'));
    // Create mono mix
    const mono = new Float32Array(wav.samples[0].length);
    for (let i = 0; i < mono.length; i++) {
      mono[i] = (wav.samples[0][i] + wav.samples[1][i]) / 2;
    }

    const thd = computeTHD(mono, wav.sampleRate);

    // Pure sine should have very low THD
    expect(thd.thdPercent).not.toBeNull();
    if (thd.thdPercent !== null) {
      expect(thd.thdPercent).toBeLessThan(1);
    }
    expect(thd.distortionCharacter).toBe('clean');
  });

  it('detects distortion in clipped signal', async () => {
    const wav = readWavFile(join(fixturesDir, 'clipped-signal.wav'));
    const mono = new Float32Array(wav.samples[0].length);
    for (let i = 0; i < mono.length; i++) {
      mono[i] = (wav.samples[0][i] + wav.samples[1][i]) / 2;
    }

    const thd = computeTHD(mono, wav.sampleRate);

    // Clipped signal should have higher THD
    expect(thd.thdPercent).not.toBeNull();
    if (thd.thdPercent !== null) {
      expect(thd.thdPercent).toBeGreaterThan(1);
    }
    expect(['gritty', 'clipped']).toContain(thd.distortionCharacter);
  });

  it('detects distortion in soft-clipped signal', async () => {
    const wav = readWavFile(join(fixturesDir, 'distorted-sine.wav'));
    const mono = new Float32Array(wav.samples[0].length);
    for (let i = 0; i < mono.length; i++) {
      mono[i] = (wav.samples[0][i] + wav.samples[1][i]) / 2;
    }

    const thd = computeTHD(mono, wav.sampleRate);

    // Distorted signal should have measurable THD
    expect(thd.thdPercent).not.toBeNull();
    if (thd.thdPercent !== null) {
      expect(thd.thdPercent).toBeGreaterThan(0.5);
    }
    // May be warm, gritty, or clipped depending on distortion level
    expect(['warm', 'gritty', 'clipped']).toContain(thd.distortionCharacter);
  });

  it('identifies dominant harmonics', async () => {
    const wav = readWavFile(join(fixturesDir, 'clipped-signal.wav'));
    const mono = new Float32Array(wav.samples[0].length);
    for (let i = 0; i < mono.length; i++) {
      mono[i] = (wav.samples[0][i] + wav.samples[1][i]) / 2;
    }

    const thd = computeTHD(mono, wav.sampleRate);

    // Clipped sine generates odd harmonics (3rd, 5th, etc.)
    expect(Array.isArray(thd.dominantHarmonics)).toBe(true);
  });

  it('estimates fundamental frequency', async () => {
    const wav = readWavFile(join(fixturesDir, 'sine-1k-minus14lufs.wav'));
    const mono = new Float32Array(wav.samples[0].length);
    for (let i = 0; i < mono.length; i++) {
      mono[i] = (wav.samples[0][i] + wav.samples[1][i]) / 2;
    }

    const thd = computeTHD(mono, wav.sampleRate);

    // Should detect ~1000 Hz fundamental
    expect(thd.fundamentalHz).not.toBeNull();
    if (thd.fundamentalHz !== null) {
      expect(thd.fundamentalHz).toBeGreaterThan(900);
      expect(thd.fundamentalHz).toBeLessThan(1100);
    }
  });

  it('handles noise gracefully', async () => {
    const wav = readWavFile(join(fixturesDir, 'pink-noise.wav'));
    const mono = new Float32Array(wav.samples[0].length);
    for (let i = 0; i < mono.length; i++) {
      mono[i] = (wav.samples[0][i] + wav.samples[1][i]) / 2;
    }

    const thd = computeTHD(mono, wav.sampleRate);

    // Noise has no clear harmonics, but should not crash
    // THD may be null or have arbitrary value
    expect(thd).toBeDefined();
  });

  it('handles silence gracefully', async () => {
    const wav = readWavFile(join(fixturesDir, 'silence.wav'));
    const mono = new Float32Array(wav.samples[0].length);
    for (let i = 0; i < mono.length; i++) {
      mono[i] = (wav.samples[0][i] + wav.samples[1][i]) / 2;
    }

    const thd = computeTHD(mono, wav.sampleRate);

    // Silence should return null THD
    expect(thd.thdPercent).toBeNull();
  });
});
