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
  | { type: "progress"; current: number; total: number; filename: string; stage?: string; stageProgress?: number }
  | { type: "result"; album: AlbumAnalysis }
  | { type: "error"; message: string };

// Analysis stages for modular progress
const STAGES = ["Loudness", "Dynamics", "Stereo", "Spectral", "Musical", "Streaming"] as const;
type AnalysisStage = typeof STAGES[number];

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

    // Helper to send progress updates
    const sendProgress = (trackNum: number, filename: string, stage?: string, stageIdx?: number) => {
      (self as any).postMessage({
        type: "progress",
        current: trackNum,
        total: decodedTracks.length,
        filename,
        stage,
        stageProgress: stageIdx !== undefined ? Math.round(((stageIdx + 1) / STAGES.length) * 100) : undefined
      } satisfies ProgressMsg);
    };

    for (let i = 0; i < decodedTracks.length; i++) {
      const decoded = decodedTracks[i];

      sendProgress(i + 1, decoded.filename, "Preparing", 0);

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

      // Compute all metrics with stage progress
      sendProgress(i + 1, decoded.filename, "Loudness", 0);
      const loud = computeLoudness(decoded.sampleRate, decoded.channelData);

      sendProgress(i + 1, decoded.filename, "Dynamics", 1);
      const dyn = computeDynamics(decoded.channelData, decoded.sampleRate);

      sendProgress(i + 1, decoded.filename, "Stereo", 2);
      const st = computeStereo(decoded.channelData, decoded.sampleRate);

      sendProgress(i + 1, decoded.filename, "Spectral", 3);
      const bands = computeBandEnergiesMono(mono, decoded.sampleRate);

      sendProgress(i + 1, decoded.filename, "Musical", 4);
      const musical = computeMusicalFeatures(mono, decoded.sampleRate);

      sendProgress(i + 1, decoded.filename, "Streaming", 5);
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
          abruptChanges: loud.abruptChanges,
          // NEW: Macro-dynamics (1.1A)
          loudnessSlopeDBPerMin: loud.loudnessSlopeDBPerMin,
          loudnessVolatilityLU: loud.loudnessVolatilityLU,
          // NEW: Peak clustering (1.2A)
          peakClusteringType: loud.peakClusteringType,
          peakClusterCount: loud.peakClusterCount,
          // NEW: TP-to-loudness at peak (1.2B)
          tpToLoudnessAtPeak: loud.tpToLoudnessAtPeak
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
          worstClipTimestamps: dyn.worstClipTimestamps,
          // NEW: Attack/release indices (1.1B)
          attackSpeedIndex: dyn.attackSpeedIndex,
          releaseTailMs: dyn.releaseTailMs
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
          crestByBand: bands.crestByBand,
          // NEW: A-weighted metrics (1.4A)
          harshnessIndexWeighted: bands.harshnessIndexWeighted,
          sibilanceIndexWeighted: bands.sibilanceIndexWeighted,
          spectralTiltWeightedDBPerOctave: bands.spectralTiltWeightedDBPerOctave,
          // NEW: Spectral balance (1.4B)
          spectralBalanceStatus: bands.spectralBalanceStatus,
          spectralBalanceNote: bands.spectralBalanceNote
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
          lowEndPhaseIssues: st.lowEndPhaseIssues,
          // NEW: Energy-aware correlation (1.3A)
          correlationEnergyWeighted: st.correlationEnergyWeighted,
          // NEW: Stereo asymmetry (1.3B)
          spectralAsymmetryHz: st.spectralAsymmetryHz,
          spectralAsymmetryNote: st.spectralAsymmetryNote
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

    // Helper to compute stats
    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const stdDev = (arr: number[]) => {
      if (arr.length < 2) return 0;
      const mean = avg(arr);
      const variance = arr.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / arr.length;
      return Math.sqrt(variance);
    };

    // Gather all metrics
    const lufsValues = tracks.map(t => t.loudness.integratedLUFS).filter((x): x is number => x !== null);
    const tpValues = tracks.map(t => t.loudness.truePeakDBTP).filter((x): x is number => x !== null);
    const aiValues = tracks.map(t => t.aiArtifacts.overallAIScore).filter((x): x is number => x !== null);
    const lraValues = tracks.map(t => t.loudness.loudnessRangeLU).filter((x): x is number => x !== null);
    const drValues = tracks.map(t => t.dynamics.dynamicRangeDB).filter((x): x is number => x !== null);
    const crestValues = tracks.map(t => t.dynamics.crestFactorDB).filter((x): x is number => x !== null);
    const widthValues = tracks.map(t => t.stereo.stereoWidthPct).filter((x): x is number => x !== null);
    const corrValues = tracks.map(t => t.stereo.correlationMean).filter((x): x is number => x !== null);
    const tiltValues = tracks.map(t => t.spectral.spectralTiltDBPerOctave).filter((x): x is number => x !== null);
    const harshValues = tracks.map(t => t.spectral.harshnessIndex).filter((x): x is number => x !== null);

    // Calculate summary stats
    const avgLUFS = avg(lufsValues);
    const minLUFS = lufsValues.length ? Math.min(...lufsValues) : undefined;
    const maxLUFS = lufsValues.length ? Math.max(...lufsValues) : undefined;
    const maxTP = tpValues.length ? Math.max(...tpValues) : -3;
    const avgTP = avg(tpValues);
    const avgAI = avg(aiValues);
    const lufsConsistency = stdDev(lufsValues);

    // Count tracks with issues
    const tracksAboveNeg1dBTP = tracks.filter(t => (t.loudness.truePeakDBTP ?? -10) > -1).length;
    const tracksWithClipping = tracks.filter(t => t.dynamics.hasClipping).length;
    const tracksWithPhaseIssues = tracks.filter(t => t.stereo.lowEndPhaseIssues).length;
    const tracksWithArtifacts = tracks.filter(t => (t.aiArtifacts.overallAIScore ?? 0) > 30).length;
    const tracksWithIssues = tracks.filter(t => t.issues.length > 0).length;
    const tracksWithWarnings = tracks.filter(t => t.warnings.length > 0).length;
    const totalIssues = tracks.reduce((sum, t) => sum + t.issues.length, 0);
    const totalWarnings = tracks.reduce((sum, t) => sum + t.warnings.length, 0);

    const scores = tracks.map(scoreTrack);
    const overallScore = scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : 0;

    const distributionReady = tracks.every(t => t.distributionReady);

    // === NEW: Album-Level Intelligence (3.1-3.3) ===

    // 3.1 Album loudness cohesion
    const albumLoudnessSpread = lufsValues.length >= 2 ? (maxLUFS! - minLUFS!) : 0;
    let sequenceConsistencyScore = 100;
    let sequenceConsistencyNote: string | undefined;
    if (lufsValues.length >= 2) {
      let maxJump = 0;
      let worstJumpIdx = 0;
      for (let i = 1; i < lufsValues.length; i++) {
        const jump = Math.abs(lufsValues[i] - lufsValues[i - 1]);
        if (jump > maxJump) {
          maxJump = jump;
          worstJumpIdx = i;
        }
      }
      // Penalize based on max jump (3 LU is noticeable, 6 LU is large)
      sequenceConsistencyScore = Math.max(0, Math.round(100 - maxJump * 10));
      if (maxJump > 3) {
        sequenceConsistencyNote = `Large loudness jump between tracks ${worstJumpIdx} and ${worstJumpIdx + 1} (${maxJump.toFixed(1)} LU)`;
      }
    }

    // 3.2 Album spectral fingerprint
    const spectralFingerprint = {
      avgTilt: tiltValues.length ? avg(tiltValues) : 0,
      avgHarshness: harshValues.length ? avg(harshValues) : 0,
      avgWidth: widthValues.length ? avg(widthValues) : 0
    };

    // Find spectral deviating tracks
    const spectralDeviatingTracks: number[] = [];
    let spectralNote: string | undefined;
    if (tracks.length >= 3) {
      const avgTilt = spectralFingerprint.avgTilt;
      const avgHarsh = spectralFingerprint.avgHarshness;
      const avgWidth = spectralFingerprint.avgWidth;

      for (const t of tracks) {
        const tilt = t.spectral.spectralTiltDBPerOctave ?? avgTilt;
        const harsh = t.spectral.harshnessIndex ?? avgHarsh;
        const width = t.stereo.stereoWidthPct ?? avgWidth;

        const tiltDev = Math.abs(tilt - avgTilt);
        const harshDev = Math.abs(harsh - avgHarsh);
        const widthDev = Math.abs(width - avgWidth);

        // Flag if significantly different from album average
        if (tiltDev > 2 || harshDev > 15 || widthDev > 25) {
          spectralDeviatingTracks.push(t.trackNumber);
        }
      }

      if (spectralDeviatingTracks.length > 0 && spectralDeviatingTracks.length <= 3) {
        spectralNote = `Track${spectralDeviatingTracks.length > 1 ? 's' : ''} ${spectralDeviatingTracks.join(', ')} deviate${spectralDeviatingTracks.length === 1 ? 's' : ''} significantly from album average`;
      }
    }

    const spectralConsistencyScore = Math.max(0, Math.round(100 - spectralDeviatingTracks.length * 15));

    // 3.3 Outlier detection
    const outlierTracks: { trackNumber: number; reason: string }[] = [];
    if (tracks.length >= 3) {
      const medianLUFS = lufsValues.length ? lufsValues.sort((a, b) => a - b)[Math.floor(lufsValues.length / 2)] : avgLUFS;
      const medianTilt = tiltValues.length ? tiltValues.sort((a, b) => a - b)[Math.floor(tiltValues.length / 2)] : 0;

      for (const t of tracks) {
        const lufs = t.loudness.integratedLUFS ?? medianLUFS;
        const tilt = t.spectral.spectralTiltDBPerOctave ?? medianTilt;
        const reasons: string[] = [];

        if (Math.abs(lufs - medianLUFS) > 4) {
          reasons.push(lufs > medianLUFS ? 'louder' : 'quieter');
        }
        if (Math.abs(tilt - medianTilt) > 3) {
          reasons.push(tilt > medianTilt ? 'brighter' : 'darker');
        }

        if (reasons.length > 0) {
          outlierTracks.push({
            trackNumber: t.trackNumber,
            reason: `Significantly ${reasons.join(' and ')} than album median`
          });
        }
      }
    }

    // Distribution ready note
    let distributionReadyNote: string | undefined;
    if (distributionReady) {
      if (avgLUFS > -14) {
        distributionReadyNote = "Distribution Ready (with normalization)";
      } else {
        distributionReadyNote = "Distribution Ready";
      }
    } else {
      distributionReadyNote = "Address issues before distribution";
    }

    // Score breakdown
    const scoreBreakdown = {
      loudness: Math.round(avg(tracks.map(t => {
        const lufs = t.loudness.integratedLUFS ?? -14;
        if (lufs > -9 || lufs < -20) return 6;
        if (lufs > -11 || lufs < -18) return 8;
        return 10;
      }))),
      dynamics: Math.round(avg(tracks.map(t => t.dynamics.hasClipping ? 5 : 10))),
      translation: Math.round(avg(tracks.map(t => {
        const corr = t.stereo.correlationMean ?? 0.8;
        if (corr < 0) return 4;
        if (corr < 0.5) return 7;
        return 10;
      }))),
      spectral: Math.round(avg(tracks.map(t => {
        const harsh = t.spectral.harshnessIndex ?? 20;
        if (harsh > 35) return 6;
        if (harsh > 28) return 8;
        return 10;
      }))),
      streaming: Math.round(avg(tracks.map(t => {
        const tp = t.streamingSimulation.spotify?.projectedTruePeakDBTP ?? -3;
        if (tp > 0) return 5;
        if (tp > -1) return 7;
        return 10;
      })))
    };

    const album: AlbumAnalysis = {
      albumName,
      analysisDateISO: new Date().toISOString(),
      totalTracks: tracks.length,
      totalDuration: formatDuration(totalSeconds),
      totalSizeMB: Number(totalSizeMB.toFixed(1)),
      overallScore,
      distributionReady,
      summary: {
        // Loudness
        avgLUFS: Number(avgLUFS.toFixed(1)),
        minLUFS: minLUFS !== undefined ? Number(minLUFS.toFixed(1)) : undefined,
        maxLUFS: maxLUFS !== undefined ? Number(maxLUFS.toFixed(1)) : undefined,
        lufsRange: lufsValues.length >= 2 ? `${minLUFS!.toFixed(1)} to ${maxLUFS!.toFixed(1)} LUFS` : undefined,
        lufsConsistency: Number(lufsConsistency.toFixed(2)),
        avgLRA: lraValues.length ? Number(avg(lraValues).toFixed(1)) : undefined,

        // Peaks
        maxTruePeak: Number(maxTP.toFixed(1)),
        avgTruePeak: tpValues.length ? Number(avgTP.toFixed(1)) : undefined,
        tracksAboveNeg1dBTP,

        // Dynamics
        avgDynamicRange: drValues.length ? Number(avg(drValues).toFixed(1)) : undefined,
        avgCrestFactor: crestValues.length ? Number(avg(crestValues).toFixed(1)) : undefined,
        tracksWithClipping,

        // Stereo
        avgStereoWidth: widthValues.length ? Number(avg(widthValues).toFixed(0)) : undefined,
        avgCorrelation: corrValues.length ? Number(avg(corrValues).toFixed(2)) : undefined,
        tracksWithPhaseIssues,

        // Spectral
        avgSpectralTilt: tiltValues.length ? Number(avg(tiltValues).toFixed(1)) : undefined,
        avgHarshness: harshValues.length ? Number(avg(harshValues).toFixed(0)) : undefined,

        // AI/Artifacts
        avgAIScore: Number(avgAI.toFixed(1)),
        tracksWithArtifacts,

        // Quality breakdown
        tracksWithIssues,
        tracksWithWarnings,
        totalIssues,
        totalWarnings,

        // Album-level intelligence (3.1-3.3)
        albumLoudnessSpread: lufsValues.length >= 2 ? Number((maxLUFS! - minLUFS!).toFixed(1)) : undefined,
        sequenceConsistencyScore,
        sequenceConsistencyNote: sequenceConsistencyScore < 85 ? 'Large loudness jumps between adjacent tracks' : undefined,
        spectralConsistencyScore,
        spectralDeviatingTracks: spectralDeviatingTracks.length > 0 ? spectralDeviatingTracks : undefined,
        spectralFingerprint,
        spectralNote,
        outlierTracks: outlierTracks.length > 0 ? outlierTracks : undefined
      },
      distributionReadyNote,
      scoreBreakdown,
      metadata: {
        analysisVersion: '2.0.0',
        algorithmFlags: {
          truePeakOversamplingFactor: 4,
          aWeightingEnabled: true,
          energyWeightedCorrelation: true
        },
        sampleRate: tracks[0]?.parameters.decodedSampleRate ?? tracks[0]?.parameters.sampleRate ?? 44100,
        browserInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'Worker'
      },
      tracks
    };

    (self as any).postMessage({ type: "result", album } satisfies ProgressMsg);
  } catch (e: any) {
    console.error("WORKER PROCESSING ERROR:", e);
    (self as any).postMessage({ type: "error", message: String(e?.message ?? e) } satisfies ProgressMsg);
  }
};
