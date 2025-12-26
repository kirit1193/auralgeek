/**
 * Worker Pool for Parallel Track Analysis
 *
 * Distributes track analysis across multiple web workers for improved performance.
 * Automatically sizes pool based on hardware capabilities.
 */

import type { TrackAnalysis } from '../core/types.js';

export interface TrackJob {
  filename: string;
  filesize: number;
  sampleRate: number;
  channels: number;
  channelData: Float32Array[];
  trackNumber: number;
}

export interface TrackResult {
  trackNumber: number;
  analysis: TrackAnalysis;
  spectrogram?: ImageBitmap;
}

export interface PoolProgress {
  type: 'track-progress';
  trackNumber: number;
  filename: string;
  stage: string;
  stageProgress: number;
  completedTracks: number;
  totalTracks: number;
}

export interface WorkerPoolConfig {
  poolSize?: number;
  generateSpectrograms?: boolean;
  spectrogramConfig?: { width: number; height: number };
  onProgress?: (progress: PoolProgress) => void;
}

interface WorkerState {
  worker: Worker;
  busy: boolean;
  ready: boolean;
  currentTrack: number | null;
}

/**
 * Determine optimal pool size based on hardware
 */
function getOptimalPoolSize(): number {
  const cores = navigator.hardwareConcurrency ?? 4;
  // Use deviceMemory if available (GB), otherwise assume 4GB
  const memoryGB = (navigator as any).deviceMemory ?? 4;

  // Each worker needs ~200-400MB for a typical track analysis
  const memoryLimit = Math.floor(memoryGB / 0.4);

  // Don't exceed core count or memory limit, min 2, max 8
  return Math.min(8, Math.max(2, Math.min(cores, memoryLimit)));
}

/**
 * Create a worker pool for parallel track analysis
 */
export function createWorkerPool(config?: WorkerPoolConfig): {
  analyze: (jobs: TrackJob[]) => AsyncGenerator<TrackResult, void, unknown>;
  terminate: () => void;
} {
  const poolSize = config?.poolSize ?? getOptimalPoolSize();
  const generateSpectrograms = config?.generateSpectrograms ?? false;
  const spectrogramConfig = config?.spectrogramConfig ?? { width: 400, height: 80 };

  console.log(`[WorkerPool] Creating pool with ${poolSize} workers`);

  // Create workers and send warm-up messages
  const workers: WorkerState[] = [];
  const warmupPromises: Promise<void>[] = [];

  for (let i = 0; i < poolSize; i++) {
    const worker = new Worker(
      new URL('./track.worker.ts', import.meta.url),
      { type: 'module' }
    );
    const state: WorkerState = { worker, busy: false, ready: false, currentTrack: null };
    workers.push(state);

    // Set up warm-up promise
    const warmupPromise = new Promise<void>((resolve) => {
      const handler = (ev: MessageEvent) => {
        if (ev.data.type === 'ready') {
          state.ready = true;
          worker.removeEventListener('message', handler);
          console.log(`[WorkerPool] Worker ${i} ready (FFT: ${ev.data.wasmFFT}, EBU R128: ${ev.data.wasmEbuR128})`);
          resolve();
        }
      };
      worker.addEventListener('message', handler);
    });
    warmupPromises.push(warmupPromise);

    // Send warm-up message
    worker.postMessage({ type: 'warm-up' });
  }

  let terminated = false;
  let completedTracks = 0;

  async function* analyze(jobs: TrackJob[]): AsyncGenerator<TrackResult, void, unknown> {
    if (terminated) {
      throw new Error('Worker pool has been terminated');
    }

    // Wait for all workers to be ready before starting analysis
    await Promise.all(warmupPromises);

    const totalTracks = jobs.length;
    completedTracks = 0;

    // Queue of pending jobs
    const pendingJobs = [...jobs];
    const results = new Map<number, TrackResult>();
    const pendingPromises = new Map<number, {
      resolve: (result: TrackResult) => void;
      reject: (error: Error) => void;
    }>();

    // Find an available worker (must be ready and not busy)
    const getAvailableWorker = (): WorkerState | null => {
      return workers.find(w => w.ready && !w.busy) ?? null;
    };

    // Assign a job to a worker
    const assignJob = (workerState: WorkerState, job: TrackJob): Promise<TrackResult> => {
      return new Promise((resolve, reject) => {
        workerState.busy = true;
        workerState.currentTrack = job.trackNumber;
        pendingPromises.set(job.trackNumber, { resolve, reject });

        const messageHandler = (ev: MessageEvent) => {
          const msg = ev.data;

          if (msg.type === 'progress') {
            config?.onProgress?.({
              type: 'track-progress',
              trackNumber: job.trackNumber,
              filename: job.filename,
              stage: msg.stage ?? 'Processing',
              stageProgress: msg.stageProgress ?? 0,
              completedTracks,
              totalTracks
            });
          } else if (msg.type === 'result') {
            workerState.worker.removeEventListener('message', messageHandler);
            workerState.busy = false;
            workerState.currentTrack = null;
            completedTracks++;

            const result: TrackResult = {
              trackNumber: job.trackNumber,
              analysis: msg.track
            };
            resolve(result);
            pendingPromises.delete(job.trackNumber);
          } else if (msg.type === 'spectrogram') {
            // Handle spectrogram separately - it comes before or after result
            const pending = pendingPromises.get(job.trackNumber);
            if (pending) {
              results.set(job.trackNumber, {
                ...(results.get(job.trackNumber) ?? { trackNumber: job.trackNumber, analysis: null as any }),
                spectrogram: msg.bitmap
              });
            }
          } else if (msg.type === 'error') {
            workerState.worker.removeEventListener('message', messageHandler);
            workerState.busy = false;
            workerState.currentTrack = null;
            reject(new Error(msg.message));
            pendingPromises.delete(job.trackNumber);
          }
        };

        workerState.worker.addEventListener('message', messageHandler);

        // Build transferables list
        const transferables: Transferable[] = [];
        for (const ch of job.channelData) {
          transferables.push(ch.buffer);
        }

        workerState.worker.postMessage({
          type: 'analyze-track',
          track: {
            filename: job.filename,
            filesize: job.filesize,
            sampleRate: job.sampleRate,
            channels: job.channels,
            channelData: job.channelData
          },
          trackNumber: job.trackNumber,
          generateSpectrogram: generateSpectrograms,
          spectrogramConfig
        }, transferables);
      });
    };

    // Start initial batch of jobs
    const inFlight: Promise<TrackResult>[] = [];

    while (pendingJobs.length > 0 || inFlight.length > 0) {
      // Assign jobs to available workers
      while (pendingJobs.length > 0) {
        const worker = getAvailableWorker();
        if (!worker) break;

        const job = pendingJobs.shift()!;
        const promise = assignJob(worker, job);
        inFlight.push(promise);
      }

      // Wait for next completion
      if (inFlight.length > 0) {
        const result = await Promise.race(inFlight);

        // Remove completed promise from in-flight
        const idx = inFlight.findIndex(p =>
          p.then(() => false).catch(() => false) // Check if it's the same promise
        );

        // Actually we need a different approach - use Promise.race with index tracking
        // For simplicity, just filter out the completed one
        const newInFlight: Promise<TrackResult>[] = [];
        for (const p of inFlight) {
          // This is a bit hacky but works: check if promise is already settled
          let settled = false;
          await p.then(r => {
            if (r.trackNumber === result.trackNumber) settled = true;
          }).catch(() => { settled = true; });

          if (!settled) {
            newInFlight.push(p);
          }
        }
        inFlight.length = 0;
        inFlight.push(...newInFlight);

        // Yield the result with any spectrogram data
        const spectrogram = results.get(result.trackNumber)?.spectrogram;
        if (spectrogram) {
          result.spectrogram = spectrogram;
        }

        yield result;
      }
    }
  }

  function terminate() {
    terminated = true;
    for (const { worker } of workers) {
      worker.terminate();
    }
    workers.length = 0;
  }

  return { analyze, terminate };
}

/**
 * Helper to check if SharedArrayBuffer is available
 * (requires crossOriginIsolated context)
 */
export function isSharedArrayBufferAvailable(): boolean {
  return typeof SharedArrayBuffer !== 'undefined' && crossOriginIsolated;
}
