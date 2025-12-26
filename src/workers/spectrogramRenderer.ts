/**
 * Spectrogram Renderer using OffscreenCanvas
 * Supports both WebGL (GPU-accelerated) and 2D Canvas rendering paths.
 * Renders SpectrogramData to ImageBitmap for zero-copy transfer to main thread.
 */

import type { SpectrogramData } from '../core/types.js';

export interface SpectrogramRenderConfig {
  width: number;
  height: number;
  logFreqScale?: boolean;  // Use logarithmic frequency scale (default: true)
  preferWebGL?: boolean;   // Try WebGL first (default: true)
}

// WebGL shader sources
const VERTEX_SHADER_SOURCE = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

const FRAGMENT_SHADER_SOURCE = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_spectrogram;
  uniform sampler2D u_colormap;
  uniform float u_minDB;
  uniform float u_maxDB;
  uniform float u_logScale;

  void main() {
    // Get dB value from spectrogram texture (stored in red channel)
    float db = texture2D(u_spectrogram, v_texCoord).r;

    // Normalize to 0-1 range for colormap lookup
    float normalized = clamp((db - u_minDB) / (u_maxDB - u_minDB), 0.0, 1.0);

    // Look up color from colormap (1D texture, use x coordinate)
    vec4 color = texture2D(u_colormap, vec2(normalized, 0.5));

    gl_FragColor = color;
  }
`;

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
 * Uses 2D Canvas by default; WebGL available but disabled due to compatibility issues.
 */
export function renderSpectrogram(
  spectrogram: SpectrogramData,
  config: SpectrogramRenderConfig
): ImageBitmap {
  // WebGL disabled by default - float texture support varies across browsers/workers
  const { preferWebGL = false } = config;

  // Try WebGL first if preferred
  if (preferWebGL) {
    const webglResult = renderSpectrogramWebGL(spectrogram, config);
    if (webglResult) {
      return webglResult;
    }
    // Fall through to 2D Canvas if WebGL failed
  }

  // 2D Canvas fallback
  return renderSpectrogram2D(spectrogram, config);
}

/**
 * Render spectrogram using 2D Canvas (fallback path)
 */
function renderSpectrogram2D(
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

/**
 * Check if WebGL is available in workers
 */
export function isWebGLSupported(): boolean {
  if (typeof OffscreenCanvas === 'undefined') return false;
  try {
    const testCanvas = new OffscreenCanvas(1, 1);
    const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
    return gl !== null;
  } catch {
    return false;
  }
}

// Cached WebGL colormap texture data
let colormapTextureData: Uint8Array | null = null;

function getColormapTextureData(): Uint8Array {
  if (colormapTextureData) return colormapTextureData;

  initViridisColormap();
  colormapTextureData = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const color = VIRIDIS_COLORS[i];
    colormapTextureData[i * 4] = color[0];
    colormapTextureData[i * 4 + 1] = color[1];
    colormapTextureData[i * 4 + 2] = color[2];
    colormapTextureData[i * 4 + 3] = 255;
  }
  return colormapTextureData;
}

function compileShader(gl: WebGLRenderingContext, source: string, type: number): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/**
 * Render spectrogram using WebGL for GPU acceleration
 */
function renderSpectrogramWebGL(
  spectrogram: SpectrogramData,
  config: SpectrogramRenderConfig
): ImageBitmap | null {
  const { width, height, logFreqScale = true } = config;
  const { magnitudes, timeFrames, freqBins, minDB, maxDB, freqResolution } = spectrogram;

  if (timeFrames === 0 || freqBins === 0) {
    return null; // Fall back to 2D
  }

  try {
    const canvas = new OffscreenCanvas(width, height);
    const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null
      || canvas.getContext('webgl') as WebGLRenderingContext | null;

    if (!gl) return null;

    // Compile shaders
    const vertexShader = compileShader(gl, VERTEX_SHADER_SOURCE, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(gl, FRAGMENT_SHADER_SOURCE, gl.FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) return null;

    // Create program
    const program = gl.createProgram();
    if (!program) return null;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return null;
    }

    gl.useProgram(program);

    // Set up geometry (full-screen quad)
    const positions = new Float32Array([
      -1, -1,  1, -1,  -1, 1,
      -1, 1,   1, -1,   1, 1
    ]);
    const texCoords = new Float32Array([
      0, 1,  1, 1,  0, 0,
      0, 0,  1, 1,  1, 0
    ]);

    // Position buffer
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // TexCoord buffer
    const texBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
    const texLoc = gl.getAttribLocation(program, 'a_texCoord');
    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

    // Prepare spectrogram texture data
    // We need to handle log frequency scale by pre-computing the y-mapping
    const specData = new Float32Array(width * height);

    // Map spectrogram data to texture with optional log scale
    const xScale = timeFrames / width;

    for (let y = 0; y < height; y++) {
      // Map y to frequency bin
      let freqNorm: number;
      if (logFreqScale) {
        // Invert log scale: y=0 is top (high freq), y=height-1 is bottom (low freq)
        const yNorm = 1 - y / (height - 1);
        const minFreq = freqResolution;
        const maxFreq = freqBins * freqResolution;
        const logMin = Math.log10(minFreq);
        const logMax = Math.log10(maxFreq);
        const logFreq = logMin + yNorm * (logMax - logMin);
        const freq = Math.pow(10, logFreq);
        freqNorm = freq / (freqBins * freqResolution);
      } else {
        freqNorm = 1 - y / (height - 1);
      }

      const freqBin = Math.min(freqBins - 1, Math.max(0, Math.floor(freqNorm * freqBins)));

      for (let x = 0; x < width; x++) {
        const timeFrame = Math.min(timeFrames - 1, Math.floor(x * xScale));
        const db = magnitudes[timeFrame][freqBin];
        specData[y * width + x] = db;
      }
    }

    // Create spectrogram texture
    const specTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, specTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, width, height, 0,
      gl.LUMINANCE, gl.FLOAT, specData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Create colormap texture
    const colormapTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, colormapTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, getColormapTextureData());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Set uniforms
    gl.uniform1i(gl.getUniformLocation(program, 'u_spectrogram'), 0);
    gl.uniform1i(gl.getUniformLocation(program, 'u_colormap'), 1);
    gl.uniform1f(gl.getUniformLocation(program, 'u_minDB'), minDB);
    gl.uniform1f(gl.getUniformLocation(program, 'u_maxDB'), maxDB);
    gl.uniform1f(gl.getUniformLocation(program, 'u_logScale'), logFreqScale ? 1.0 : 0.0);

    // Render
    gl.viewport(0, 0, width, height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Clean up
    gl.deleteTexture(specTexture);
    gl.deleteTexture(colormapTexture);
    gl.deleteBuffer(posBuffer);
    gl.deleteBuffer(texBuffer);
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    return canvas.transferToImageBitmap();
  } catch (e) {
    console.warn('WebGL spectrogram rendering failed:', e);
    return null;
  }
}
