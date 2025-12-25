/// <reference lib="webworker" />
/**
 * Web Worker for audio analysis
 * Handles message passing and coordinates track/album analysis
 */

import type { AlbumAnalysis, TrackAnalysis } from '../core/types.js';
import { bytesToMB } from '../core/format.js';
import { analyzeTrack, type DecodedTrackData } from './trackAnalyzer.js';
import { computeAlbumStats } from './albumAnalyzer.js';

type AnalyzeRequest = {
  type: 'analyze';
  albumName: string;
  tracks: DecodedTrackData[];
};

type ProgressMsg =
  | { type: 'progress'; current: number; total: number; filename: string; stage?: string; stageProgress?: number }
  | { type: 'result'; album: AlbumAnalysis }
  | { type: 'error'; message: string };

const STAGES = ['Loudness', 'Dynamics', 'Stereo', 'Spectral', 'Musical', 'Streaming'] as const;

console.log('[WORKER] Worker script loaded');

self.onmessage = async (ev: MessageEvent<AnalyzeRequest>) => {
  console.log('[WORKER] Message received:', ev.data.type);
  if (ev.data.type !== 'analyze') return;

  const { albumName, tracks: decodedTracks } = ev.data;
  console.log('[WORKER] Starting analysis of', decodedTracks.length, 'tracks');

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
    }

    const album = computeAlbumStats(albumName, tracks, totalSeconds, totalSizeMB);

    (self as any).postMessage({ type: 'result', album } satisfies ProgressMsg);
  } catch (e: any) {
    console.error('WORKER PROCESSING ERROR:', e);
    (self as any).postMessage({ type: 'error', message: String(e?.message ?? e) } satisfies ProgressMsg);
  }
};
