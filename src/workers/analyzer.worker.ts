/// <reference lib="webworker" />
/**
 * Web Worker for audio analysis
 * Handles message passing and coordinates track/album analysis
 */

import type { AlbumAnalysis, TrackAnalysis } from '../core/types.js';
import { bytesToMB } from '../core/format.js';
import { analyzeTrack, type DecodedTrackData } from './trackAnalyzer.js';
import { computeAlbumStats } from './albumAnalyzer.js';
import { computeSpectrogram, downsampleSpectrogram } from '../analysis/spectrogram.js';
import { renderSpectrogram, isOffscreenCanvasSupported } from './spectrogramRenderer.js';
import { dspPool } from '../utils/bufferPool.js';

type AnalyzeRequest = {
  type: 'analyze';
  albumName: string;
  tracks: DecodedTrackData[];
  generateSpectrograms?: boolean;
  spectrogramConfig?: { width: number; height: number };
};

type ProgressMsg =
  | { type: 'progress'; current: number; total: number; filename: string; stage?: string; stageProgress?: number }
  | { type: 'result'; album: AlbumAnalysis }
  | { type: 'error'; message: string }
  | { type: 'spectrogram'; trackNumber: number; bitmap: ImageBitmap };

const STAGES = ['Loudness', 'Dynamics', 'Stereo', 'Spectral', 'Musical', 'Streaming'] as const;

console.log('[WORKER] Worker script loaded');

self.onmessage = async (ev: MessageEvent<AnalyzeRequest>) => {
  console.log('[WORKER] Message received:', ev.data.type);
  if (ev.data.type !== 'analyze') return;

  const { albumName, tracks: decodedTracks, generateSpectrograms, spectrogramConfig } = ev.data;
  const spectrogramEnabled = generateSpectrograms && isOffscreenCanvasSupported();
  const spectrogramSize = spectrogramConfig ?? { width: 400, height: 100 };
  console.log('[WORKER] Starting analysis of', decodedTracks.length, 'tracks', spectrogramEnabled ? '(with spectrograms)' : '');

  try {
    const tracks: TrackAnalysis[] = [];
    let totalSeconds = 0;
    let totalSizeMB = 0;

    const sendProgress = (trackNum: number, filename: string, stage?: string, stageIdx?: number) => {
      (self as any).postMessage({
        type: 'progress',
        current: trackNum,
        total: decodedTracks.length,
        filename,
        stage,
        stageProgress: stageIdx !== undefined ? Math.round(((stageIdx + 1) / STAGES.length) * 100) : undefined
      } satisfies ProgressMsg);
    };

    for (let i = 0; i < decodedTracks.length; i++) {
      const decoded = decodedTracks[i];

      sendProgress(i + 1, decoded.filename, 'Preparing', 0);

      const durationSeconds = decoded.channelData[0].length / decoded.sampleRate;

      const track = analyzeTrack(decoded, i + 1, (progress) => {
        sendProgress(i + 1, decoded.filename, progress.stage, progress.stageIdx);
      });

      tracks.push(track);
      totalSeconds += durationSeconds;
      totalSizeMB += bytesToMB(decoded.filesize);

      // Generate and send spectrogram if enabled
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
          const targetFrames = spectrogramSize.width * 2; // 2 frames per pixel max
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
            { type: 'spectrogram', trackNumber: i + 1, bitmap } satisfies ProgressMsg,
            [bitmap]
          );
        } catch (specErr) {
          console.warn('[WORKER] Spectrogram generation failed for track', i + 1, specErr);
        }
      }
    }

    const album = computeAlbumStats(albumName, tracks, totalSeconds, totalSizeMB);

    // Clear buffer pool after analysis complete
    dspPool.clear();

    (self as any).postMessage({ type: 'result', album } satisfies ProgressMsg);
  } catch (e: any) {
    console.error('WORKER PROCESSING ERROR:', e);
    (self as any).postMessage({ type: 'error', message: String(e?.message ?? e) } satisfies ProgressMsg);
  }
};
