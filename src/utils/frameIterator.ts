/**
 * Frame Iterator Utility
 *
 * Centralizes windowed frame iteration logic used across DSP analysis modules.
 * Provides consistent frame extraction with optional Hann windowing.
 */

import { dspPool, getHannWindow } from './bufferPool.js';

export interface FrameIteratorConfig {
  /** Frame size (FFT size) */
  frameSize: number;
  /** Hop size between frames. Defaults to frameSize/2 (50% overlap) */
  hopSize?: number;
  /** Maximum number of frames to process. Defaults to unlimited */
  maxFrames?: number;
  /** Apply Hann window to each frame. Defaults to true */
  applyWindow?: boolean;
}

export interface FrameResult {
  /** Windowed frame data (from pool - do not modify or store) */
  frame: Float32Array;
  /** Frame index (0-based) */
  index: number;
  /** Sample position in original signal */
  position: number;
}

/**
 * Process frames of a signal with a processor function.
 * Handles buffer pooling automatically.
 *
 * @param samples Input signal
 * @param config Frame iteration configuration
 * @param processor Function to process each frame, receives windowed frame
 * @returns Array of processor results
 */
export function processFrames<T>(
  samples: Float32Array,
  config: FrameIteratorConfig,
  processor: (frame: Float32Array, index: number, position: number) => T
): T[] {
  const { frameSize, maxFrames, applyWindow = true } = config;
  const hopSize = config.hopSize ?? Math.floor(frameSize / 2);
  const totalSamples = samples.length;

  if (totalSamples < frameSize) {
    return [];
  }

  const results: T[] = [];
  const window = applyWindow ? getHannWindow(frameSize) : null;

  // Acquire a reusable buffer for windowed frames
  const frameBuffer = dspPool.acquire(frameSize);

  // Calculate number of frames
  const numPossibleFrames = Math.floor((totalSamples - frameSize) / hopSize) + 1;
  const numFrames = maxFrames ? Math.min(maxFrames, numPossibleFrames) : numPossibleFrames;

  // If maxFrames specified and less than possible, space frames evenly
  const effectiveHop = maxFrames && maxFrames < numPossibleFrames
    ? Math.floor((totalSamples - frameSize) / maxFrames)
    : hopSize;

  for (let i = 0; i < numFrames; i++) {
    const position = i * effectiveHop;
    if (position + frameSize > totalSamples) break;

    // Copy and optionally window the frame
    if (window) {
      for (let j = 0; j < frameSize; j++) {
        frameBuffer[j] = samples[position + j] * window[j];
      }
    } else {
      for (let j = 0; j < frameSize; j++) {
        frameBuffer[j] = samples[position + j];
      }
    }

    results.push(processor(frameBuffer, i, position));
  }

  // Release buffer back to pool
  dspPool.release(frameBuffer);

  return results;
}

/**
 * Generator-based frame iterator for streaming processing.
 * Caller is responsible for not storing frame references.
 *
 * @param samples Input signal
 * @param config Frame iteration configuration
 * @yields Frame results with windowed data
 */
export function* iterateFrames(
  samples: Float32Array,
  config: FrameIteratorConfig
): Generator<FrameResult, void, unknown> {
  const { frameSize, maxFrames, applyWindow = true } = config;
  const hopSize = config.hopSize ?? Math.floor(frameSize / 2);
  const totalSamples = samples.length;

  if (totalSamples < frameSize) {
    return;
  }

  const window = applyWindow ? getHannWindow(frameSize) : null;
  const frameBuffer = dspPool.acquire(frameSize);

  try {
    const numPossibleFrames = Math.floor((totalSamples - frameSize) / hopSize) + 1;
    const numFrames = maxFrames ? Math.min(maxFrames, numPossibleFrames) : numPossibleFrames;
    const effectiveHop = maxFrames && maxFrames < numPossibleFrames
      ? Math.floor((totalSamples - frameSize) / maxFrames)
      : hopSize;

    for (let i = 0; i < numFrames; i++) {
      const position = i * effectiveHop;
      if (position + frameSize > totalSamples) break;

      if (window) {
        for (let j = 0; j < frameSize; j++) {
          frameBuffer[j] = samples[position + j] * window[j];
        }
      } else {
        for (let j = 0; j < frameSize; j++) {
          frameBuffer[j] = samples[position + j];
        }
      }

      yield { frame: frameBuffer, index: i, position };
    }
  } finally {
    dspPool.release(frameBuffer);
  }
}

/**
 * Count total frames that would be generated for given config.
 * Useful for pre-allocating result arrays.
 */
export function countFrames(
  sampleCount: number,
  config: FrameIteratorConfig
): number {
  const { frameSize, maxFrames } = config;
  const hopSize = config.hopSize ?? Math.floor(frameSize / 2);

  if (sampleCount < frameSize) return 0;

  const numPossibleFrames = Math.floor((sampleCount - frameSize) / hopSize) + 1;
  return maxFrames ? Math.min(maxFrames, numPossibleFrames) : numPossibleFrames;
}
