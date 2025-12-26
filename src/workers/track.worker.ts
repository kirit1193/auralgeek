/// <reference lib="webworker" />
/**
 * Single-Track Analysis Worker
 *
 * Handles analysis of a single track for use with the worker pool.
 * Separate from analyzer.worker.ts to enable parallel processing.
 */

import type { TrackAnalysis } from '../core/types.js';
import { analyzeTrack, type DecodedTrackData } from './trackAnalyzer.js';
import { computeSpectrogram, downsampleSpectrogram } from '../analysis/spectrogram.js';
import { renderSpectrogram, isOffscreenCanvasSupported } from './spectrogramRenderer.js';
import { dspPool, clearWindowCache } from '../utils/bufferPool.js';

interface AnalyzeTrackRequest {
  type: 'analyze-track';
  track: DecodedTrackData;
  trackNumber: number;
  generateSpectrogram?: boolean;
  spectrogramConfig?: { width: number; height: number };
}

type WorkerMessage =
  | { type: 'progress'; stage: string; stageProgress: number }
  | { type: 'result'; track: TrackAnalysis }
  | { type: 'spectrogram'; bitmap: ImageBitmap }
  | { type: 'error'; message: string };

const STAGES = ['Loudness', 'Dynamics', 'Stereo', 'Spectral', 'Musical', 'Streaming'] as const;

self.onmessage = async (ev: MessageEvent<AnalyzeTrackRequest>) => {
  if (ev.data.type !== 'analyze-track') return;

  const { track: decoded, trackNumber, generateSpectrogram, spectrogramConfig } = ev.data;
  const spectrogramEnabled = generateSpectrogram && isOffscreenCanvasSupported();
  const spectrogramSize = spectrogramConfig ?? { width: 400, height: 80 };

  try {
    // Analyze track with progress reporting
    const track = analyzeTrack(decoded, trackNumber, (progress) => {
      (self as any).postMessage({
        type: 'progress',
        stage: progress.stage,
        stageProgress: progress.stageIdx !== undefined
          ? Math.round(((progress.stageIdx + 1) / STAGES.length) * 100)
          : 0
      } satisfies WorkerMessage);
    });

    // Generate spectrogram if enabled
    if (spectrogramEnabled) {
      try {
        // Create mono mix for spectrogram
        const n = decoded.channelData[0].length;
        const mono = new Float32Array(n);
        for (let s = 0; s < n; s++) {
          let x = 0;
          for (let ch = 0; ch < decoded.channelData.length; ch++) {
            x += decoded.channelData[ch][s] ?? 0;
          }
          mono[s] = x / decoded.channelData.length;
        }

        // Compute spectrogram
        let specData = computeSpectrogram(mono, decoded.sampleRate);

        // Downsample if needed for efficient rendering
        const targetFrames = spectrogramSize.width * 2;
        if (specData.timeFrames > targetFrames) {
          specData = downsampleSpectrogram(specData, targetFrames);
        }

        // Render to ImageBitmap
        const bitmap = renderSpectrogram(specData, {
          width: spectrogramSize.width,
          height: spectrogramSize.height,
          logFreqScale: true
        });

        // Send with transferable
        (self as any).postMessage(
          { type: 'spectrogram', bitmap } satisfies WorkerMessage,
          [bitmap]
        );
      } catch (specErr) {
        console.warn('[TrackWorker] Spectrogram generation failed:', specErr);
      }
    }

    // Clear buffers after analysis
    dspPool.clear();
    clearWindowCache();

    // Send result
    (self as any).postMessage({ type: 'result', track } satisfies WorkerMessage);

  } catch (e: any) {
    console.error('[TrackWorker] Error:', e);
    (self as any).postMessage({
      type: 'error',
      message: String(e?.message ?? e)
    } satisfies WorkerMessage);
  }
};
