/// <reference lib="webworker" />
import type { AlbumAnalysis, TrackAnalysis } from "../core/types";
import { computeLoudness } from "../analysis/loudness";
import { computeDynamics, computeStereo, computeBandEnergiesMono } from "../analysis/dsp";
import { computeMusicalFeatures, computeStreamingSimulation } from "../analysis/musical";
import { bytesToMB, formatDuration, clamp } from "../core/format";
import { evaluateDistribution } from "../analysis/rules";

// Pre-decoded track data from main thread
interface DecodedTrackData {
  filename: string;
  filesize: number;
  sampleRate: number;
  channels: number;
  channelData: Float32Array[];
}

type AnalyzeRequest = {
  type: "analyze";
  albumName: string;
  tracks: DecodedTrackData[];
};

type ProgressMsg =
  | { type: "progress"; current: number; total: number; filename: string }
  | { type: "result"; album: AlbumAnalysis }
  | { type: "error"; message: string };

function scoreTrack(t: TrackAnalysis): number {
  let score = 10;

  score -= t.issues.length * 1.5;
  score -= t.warnings.length * 0.3;

  if (t.aiArtifacts.overallAIScore !== null && t.aiArtifacts.overallAIScore > 50) score -= 1.0;

  // Additional scoring based on new metrics
  if (t.dynamics.hasClipping) score -= 0.5;
  if (t.stereo.lowEndPhaseIssues) score -= 0.3;
  if (t.loudness.ispMarginDB !== null && t.loudness.ispMarginDB > 1) score -= 0.2;

  return clamp(score, 0, 10);
}

function detectAIArtifacts(track: TrackAnalysis): TrackAnalysis["aiArtifacts"] {
  const hf = track.spectral.highFreqEnergy8k16kDB;
  const shimmer = hf !== null && hf > -25;
  const shimmerScore = shimmer ? Math.min(100, (hf + 25) * 10) : 0;

  const overall = shimmer ? shimmerScore : 0;

  return {
    shimmerDetected: shimmer,
    shimmerScore,
    roboticTiming: false,
    timingScore: null,
    overallAIScore: overall
  };
}

// Detect if track is true stereo vs dual mono
function detectTrueStereo(L: Float32Array, R: Float32Array): boolean {
  // Compare L and R channels - if they're identical, it's dual mono
  const sampleCount = Math.min(10000, L.length);
  const step = Math.floor(L.length / sampleCount);

  let diffSum = 0;
  for (let i = 0; i < L.length; i += step) {
    diffSum += Math.abs(L[i] - R[i]);
  }

  const avgDiff = diffSum / sampleCount;
  return avgDiff > 0.0001; // True stereo if channels differ
}

// Estimate effective bit depth from noise floor
function estimateEffectiveBitDepth(mono: Float32Array): number {
  // Find quietest sections to estimate noise floor
  const windowSize = 4096;
  let minEnergy = Infinity;

  for (let i = 0; i < mono.length - windowSize; i += windowSize) {
    let energy = 0;
    for (let j = 0; j < windowSize; j++) {
      energy += mono[i + j] * mono[i + j];
    }
    if (energy < minEnergy && energy > 0) {
      minEnergy = energy;
    }
  }

  const noiseFloorDB = minEnergy > 0 ? 10 * Math.log10(minEnergy / windowSize) : -120;

  // Approximate bit depth from noise floor
  // 16-bit ≈ -96 dB, 24-bit ≈ -144 dB
  const effectiveBits = Math.min(24, Math.max(8, Math.round((-noiseFloorDB - 6) / 6)));
  return effectiveBits;
}

console.log("[WORKER] Worker script loaded");

self.onmessage = async (ev: MessageEvent<AnalyzeRequest>) => {
  console.log("[WORKER] Message received:", ev.data.type);
  if (ev.data.type !== "analyze") return;

  const { albumName, tracks: decodedTracks } = ev.data;
  console.log("[WORKER] Starting analysis of", decodedTracks.length, "tracks");

  try {
    const tracks: TrackAnalysis[] = [];
    let totalSeconds = 0;
    let totalSizeMB = 0;

    for (let i = 0; i < decodedTracks.length; i++) {
      const decoded = decodedTracks[i];

      (self as any).postMessage({
        type: "progress",
        current: i + 1,
        total: decodedTracks.length,
        filename: decoded.filename
      } satisfies ProgressMsg);

      const durationSeconds = decoded.channelData[0].length / decoded.sampleRate;

      // Create mono mix
      const n = decoded.channelData[0].length;
      const mono = new Float32Array(n);
      for (let s = 0; s < n; s++) {
        let x = 0;
        for (let ch = 0; ch < decoded.channelData.length; ch++) {
          x += decoded.channelData[ch][s] ?? 0;
        }
        mono[s] = x / decoded.channelData.length;
      }

      // Detect true stereo vs dual mono
      const isTrueStereo = decoded.channelData.length >= 2
        ? detectTrueStereo(decoded.channelData[0], decoded.channelData[1])
        : false;

      // Estimate effective bit depth
      const effectiveBitDepth = estimateEffectiveBitDepth(mono);

      const params = {
        filename: decoded.filename,
        filesizeMB: bytesToMB(decoded.filesize),
        durationSeconds,
        durationFormatted: formatDuration(durationSeconds),
        format: undefined,
        sampleRate: decoded.sampleRate,
        decodedSampleRate: decoded.sampleRate,
        channels: decoded.channels,
        bitDepth: undefined,
        effectiveBitDepth,
        overallBitrate: undefined,
        isTrueStereo
      };

      // Compute all metrics
      const loud = computeLoudness(decoded.sampleRate, decoded.channelData);
      const dyn = computeDynamics(decoded.channelData, decoded.sampleRate);
      const st = computeStereo(decoded.channelData, decoded.sampleRate);
      const bands = computeBandEnergiesMono(mono, decoded.sampleRate);
      const musical = computeMusicalFeatures(mono, decoded.sampleRate);
      const streaming = computeStreamingSimulation(loud.integratedLUFS, loud.truePeakDBTP);

      // Compute PLR/PSR (require loudness values)
      const plrDB = loud.truePeakDBTP - loud.integratedLUFS;
      const psrDB = loud.truePeakDBTP - loud.maxShortTermLUFS;

      const track: TrackAnalysis = {
        trackNumber: i + 1,
        parameters: params,
        loudness: {
          integratedLUFS: loud.integratedLUFS,
          integratedUngatedLUFS: loud.integratedUngatedLUFS,
          truePeakDBTP: loud.truePeakDBTP,
          samplePeakDBFS: loud.samplePeakDBFS,
          truePeakOversampling: loud.truePeakOversampling,
          ispMarginDB: loud.ispMarginDB,
          maxMomentaryLUFS: loud.maxMomentaryLUFS,
          maxShortTermLUFS: loud.maxShortTermLUFS,
          shortTermP10: loud.shortTermP10,
          shortTermP50: loud.shortTermP50,
          shortTermP90: loud.shortTermP90,
          shortTermP95: loud.shortTermP95,
          loudnessRangeLU: loud.loudnessRangeLU,
          shortTermTimeline: loud.shortTermTimeline,
          loudestSegmentTime: loud.loudestSegmentTime,
          quietestSegmentTime: loud.quietestSegmentTime,
          abruptChanges: loud.abruptChanges
        },
        dynamics: {
          peakDBFS: dyn.peakDBFS,
          rmsDBFS: dyn.rmsDBFS,
          crestFactorDB: dyn.crestFactorDB,
          dynamicRangeDB: dyn.dynamicRangeDB,
          dcOffset: dyn.dcOffset,
          hasClipping: dyn.hasClipping,
          silenceAtStartMs: dyn.silenceAtStartMs,
          silenceAtEndMs: dyn.silenceAtEndMs,
          plrDB,
          psrDB,
          transientDensity: dyn.transientDensity,
          microdynamicContrast: dyn.microdynamicContrast,
          clippedSampleCount: dyn.clippedSampleCount,
          clipEventCount: dyn.clipEventCount,
          clipDensityPerMinute: dyn.clipDensityPerMinute,
          worstClipTimestamps: dyn.worstClipTimestamps
        },
        spectral: {
          spectralCentroidHz: bands.spectralCentroidHz,
          spectralRolloffHz: bands.spectralRolloffHz,
          highFreqEnergy8k16kDB: bands.highFreqEnergy8k16kDB,
          sibilanceEnergy4k10kDB: bands.sibilanceEnergy4k10kDB,
          subBassEnergy20_80DB: bands.subBassEnergy20_80DB,
          spectralTiltDBPerOctave: bands.spectralTiltDBPerOctave,
          bassToMidRatioDB: bands.bassToMidRatioDB,
          midToHighRatioDB: bands.midToHighRatioDB,
          harshnessIndex: bands.harshnessIndex,
          sibilanceIndex: bands.sibilanceIndex,
          spectralFlatness: bands.spectralFlatness,
          harmonicToNoiseRatio: bands.harmonicToNoiseRatio,
          crestByBand: bands.crestByBand
        },
        stereo: {
          stereoWidthPct: st.stereoWidthPct,
          midEnergyDB: st.midEnergyDB,
          sideEnergyDB: st.sideEnergyDB,
          correlation: st.correlation,
          subBassMonoCompatible: st.subBassMonoCompatible,
          balanceDB: st.balanceDB,
          correlationMean: st.correlationMean,
          correlationWorst1Pct: st.correlationWorst1Pct,
          worstCorrelationTimestamps: st.worstCorrelationTimestamps,
          lowBandWidthPct: st.lowBandWidthPct,
          presenceBandWidthPct: st.presenceBandWidthPct,
          airBandWidthPct: st.airBandWidthPct,
          monoLoudnessDiffDB: st.monoLoudnessDiffDB,
          worstCancellationTimestamps: st.worstCancellationTimestamps,
          lowEndPhaseIssues: st.lowEndPhaseIssues
        },
        aiArtifacts: {
          shimmerDetected: false,
          shimmerScore: null,
          roboticTiming: false,
          timingScore: null,
          overallAIScore: null
        },
        musicalFeatures: musical,
        streamingSimulation: streaming,
        distributionReady: true,
        issues: [],
        warnings: []
      };

      track.aiArtifacts = detectAIArtifacts(track);

      const evalRes = evaluateDistribution(track);
      track.distributionReady = evalRes.ready;
      track.issues = evalRes.issues;
      track.warnings = evalRes.warnings;

      tracks.push(track);
      totalSeconds += durationSeconds;
      totalSizeMB += params.filesizeMB;
    }

    const lufsValues = tracks.map(t => t.loudness.integratedLUFS).filter((x): x is number => x !== null);
    const tpValues = tracks.map(t => t.loudness.truePeakDBTP).filter((x): x is number => x !== null);
    const aiValues = tracks.map(t => t.aiArtifacts.overallAIScore).filter((x): x is number => x !== null);

    const avgLUFS = lufsValues.length ? (lufsValues.reduce((a, b) => a + b, 0) / lufsValues.length) : -14;
    const maxTP = tpValues.length ? Math.max(...tpValues) : -3;
    const avgAI = aiValues.length ? (aiValues.reduce((a, b) => a + b, 0) / aiValues.length) : 0;

    const scores = tracks.map(scoreTrack);
    const overallScore = scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : 0;

    const distributionReady = tracks.every(t => t.distributionReady);

    const album: AlbumAnalysis = {
      albumName,
      analysisDateISO: new Date().toISOString(),
      totalTracks: tracks.length,
      totalDuration: formatDuration(totalSeconds),
      totalSizeMB: Number(totalSizeMB.toFixed(1)),
      overallScore,
      distributionReady,
      summary: {
        avgLUFS: Number(avgLUFS.toFixed(1)),
        maxTruePeak: Number(maxTP.toFixed(1)),
        avgAIScore: Number(avgAI.toFixed(1)),
        lufsRange: lufsValues.length ? `${Math.min(...lufsValues).toFixed(1)} to ${Math.max(...lufsValues).toFixed(1)} LUFS` : undefined
      },
      tracks
    };

    (self as any).postMessage({ type: "result", album } satisfies ProgressMsg);
  } catch (e: any) {
    console.error("WORKER PROCESSING ERROR:", e);
    (self as any).postMessage({ type: "error", message: String(e?.message ?? e) } satisfies ProgressMsg);
  }
};
