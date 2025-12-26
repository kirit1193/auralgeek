/**
 * Spectrogram Renderer using OffscreenCanvas
 * Renders SpectrogramData to ImageBitmap for zero-copy transfer to main thread
 */

import type { SpectrogramData } from '../core/types.js';

export interface SpectrogramRenderConfig {
  width: number;
  height: number;
  logFreqScale?: boolean;  // Use logarithmic frequency scale (default: true)
}

// Viridis color map (256 entries) - perceptually uniform, colorblind-friendly
const VIRIDIS_COLORS: [number, number, number][] = [];

// Generate Viridis-inspired color map
function initViridisColormap(): void {
  if (VIRIDIS_COLORS.length > 0) return;

  // Simplified Viridis approximation
  // Dark purple -> Blue -> Teal -> Green -> Yellow
  for (let i = 0; i < 256; i++) {
    const t = i / 255;

    let r: number, g: number, b: number;

    if (t < 0.25) {
      // Dark purple to blue
      const s = t / 0.25;
      r = Math.round(68 + s * (-10));
      g = Math.round(1 + s * 40);
      b = Math.round(84 + s * 40);
    } else if (t < 0.5) {
      // Blue to teal
      const s = (t - 0.25) / 0.25;
      r = Math.round(58 - s * 25);
      g = Math.round(41 + s * 80);
      b = Math.round(124 - s * 20);
    } else if (t < 0.75) {
      // Teal to green
      const s = (t - 0.5) / 0.25;
      r = Math.round(33 + s * 90);
      g = Math.round(121 + s * 70);
      b = Math.round(104 - s * 60);
    } else {
      // Green to yellow
      const s = (t - 0.75) / 0.25;
      r = Math.round(123 + s * 130);
      g = Math.round(191 + s * 60);
      b = Math.round(44 - s * 30);
    }

    VIRIDIS_COLORS.push([
      Math.max(0, Math.min(255, r)),
      Math.max(0, Math.min(255, g)),
      Math.max(0, Math.min(255, b))
    ]);
  }
}

/**
 * Map dB value to color index (0-255)
 */
function dbToColorIndex(db: number, minDB: number, maxDB: number): number {
  const normalized = (db - minDB) / (maxDB - minDB);
  return Math.max(0, Math.min(255, Math.round(normalized * 255)));
}

/**
 * Convert linear frequency bin to y-coordinate with optional log scale
 */
function freqBinToY(
  bin: number,
  freqBins: number,
  height: number,
  logScale: boolean,
  freqResolution: number
): number {
  if (!logScale) {
    // Linear: low frequencies at bottom
    return height - 1 - Math.floor((bin / freqBins) * height);
  }

  // Logarithmic scale
  const freq = bin * freqResolution;
  const minFreq = freqResolution;  // Skip DC
  const maxFreq = freqBins * freqResolution;

  if (freq <= minFreq) return height - 1;

  const logMin = Math.log10(minFreq);
  const logMax = Math.log10(maxFreq);
  const logFreq = Math.log10(freq);

  const normalized = (logFreq - logMin) / (logMax - logMin);
  return height - 1 - Math.floor(normalized * (height - 1));
}

/**
 * Render spectrogram to ImageBitmap
 * Uses OffscreenCanvas for worker-thread rendering
 */
export function renderSpectrogram(
  spectrogram: SpectrogramData,
  config: SpectrogramRenderConfig
): ImageBitmap {
  initViridisColormap();

  const { width, height, logFreqScale = true } = config;
  const { magnitudes, timeFrames, freqBins, minDB, maxDB, freqResolution } = spectrogram;

  // Create OffscreenCanvas
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;

  // Create ImageData for pixel manipulation
  const imageData = ctx.createImageData(width, height);
  const pixels = imageData.data;

  // Fill with background color (darkest Viridis)
  const bgColor = VIRIDIS_COLORS[0];
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = bgColor[0];
    pixels[i + 1] = bgColor[1];
    pixels[i + 2] = bgColor[2];
    pixels[i + 3] = 255;
  }

  if (timeFrames === 0 || freqBins === 0) {
    ctx.putImageData(imageData, 0, 0);
    return canvas.transferToImageBitmap();
  }

  // Build y-coordinate lookup for log scale efficiency
  const yLookup = new Int32Array(freqBins);
  for (let bin = 0; bin < freqBins; bin++) {
    yLookup[bin] = freqBinToY(bin, freqBins, height, logFreqScale, freqResolution);
  }

  // Map spectrogram data to pixels
  const xScale = width / timeFrames;

  for (let t = 0; t < timeFrames; t++) {
    const x0 = Math.floor(t * xScale);
    const x1 = Math.floor((t + 1) * xScale);
    const frameData = magnitudes[t];

    for (let f = 0; f < freqBins; f++) {
      const colorIdx = dbToColorIndex(frameData[f], minDB, maxDB);
      const color = VIRIDIS_COLORS[colorIdx];
      const y = yLookup[f];

      // Fill pixels for this time-frequency cell
      for (let x = x0; x < x1 && x < width; x++) {
        const pixelIdx = (y * width + x) * 4;
        pixels[pixelIdx] = color[0];
        pixels[pixelIdx + 1] = color[1];
        pixels[pixelIdx + 2] = color[2];
        pixels[pixelIdx + 3] = 255;
      }
    }
  }

  // Handle log scale: fill gaps by interpolation
  if (logFreqScale) {
    for (let x = 0; x < width; x++) {
      let lastFilledY = -1;
      let lastColor: [number, number, number] | null = null;

      for (let y = height - 1; y >= 0; y--) {
        const pixelIdx = (y * width + x) * 4;
        const r = pixels[pixelIdx];
        const g = pixels[pixelIdx + 1];
        const b = pixels[pixelIdx + 2];

        // Check if this pixel was explicitly set (not background)
        const isSet = r !== bgColor[0] || g !== bgColor[1] || b !== bgColor[2];

        if (isSet) {
          // Fill gap from lastFilledY to y
          if (lastFilledY >= 0 && lastColor && lastFilledY - y > 1) {
            for (let fy = y + 1; fy < lastFilledY; fy++) {
              const fillIdx = (fy * width + x) * 4;
              // Use the lower frequency color (more accurate for log scale)
              pixels[fillIdx] = lastColor[0];
              pixels[fillIdx + 1] = lastColor[1];
              pixels[fillIdx + 2] = lastColor[2];
              pixels[fillIdx + 3] = 255;
            }
          }
          lastFilledY = y;
          lastColor = [r, g, b];
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.transferToImageBitmap();
}

/**
 * Check if OffscreenCanvas is available in this environment
 */
export function isOffscreenCanvasSupported(): boolean {
  return typeof OffscreenCanvas !== 'undefined';
}
