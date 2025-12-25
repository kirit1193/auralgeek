/**
 * Album analysis module
 * Computes album-level statistics and intelligence
 */

import type { AlbumAnalysis, AlbumSummary, TrackAnalysis } from '../core/types.js';
import { formatDuration } from '../core/format.js';
import { scoreTrack } from './trackAnalyzer.js';

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = avg(arr);
  const variance = arr.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

export function computeAlbumStats(
  albumName: string,
  tracks: TrackAnalysis[],
  totalSeconds: number,
  totalSizeMB: number
): AlbumAnalysis {
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

  // Album-Level Intelligence (3.1-3.3)

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
    const sortedLufs = [...lufsValues].sort((a, b) => a - b);
    const sortedTilt = [...tiltValues].sort((a, b) => a - b);
    const medianLUFS = sortedLufs.length ? sortedLufs[Math.floor(sortedLufs.length / 2)] : avgLUFS;
    const medianTilt = sortedTilt.length ? sortedTilt[Math.floor(sortedTilt.length / 2)] : 0;

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

  const summary: AlbumSummary = {
    avgLUFS: Number(avgLUFS.toFixed(1)),
    minLUFS: minLUFS !== undefined ? Number(minLUFS.toFixed(1)) : undefined,
    maxLUFS: maxLUFS !== undefined ? Number(maxLUFS.toFixed(1)) : undefined,
    lufsRange: lufsValues.length >= 2 ? `${minLUFS!.toFixed(1)} to ${maxLUFS!.toFixed(1)} LUFS` : undefined,
    lufsConsistency: Number(lufsConsistency.toFixed(2)),
    avgLRA: lraValues.length ? Number(avg(lraValues).toFixed(1)) : undefined,
    maxTruePeak: Number(maxTP.toFixed(1)),
    avgTruePeak: tpValues.length ? Number(avgTP.toFixed(1)) : undefined,
    tracksAboveNeg1dBTP,
    avgDynamicRange: drValues.length ? Number(avg(drValues).toFixed(1)) : undefined,
    avgCrestFactor: crestValues.length ? Number(avg(crestValues).toFixed(1)) : undefined,
    tracksWithClipping,
    avgStereoWidth: widthValues.length ? Number(avg(widthValues).toFixed(0)) : undefined,
    avgCorrelation: corrValues.length ? Number(avg(corrValues).toFixed(2)) : undefined,
    tracksWithPhaseIssues,
    avgSpectralTilt: tiltValues.length ? Number(avg(tiltValues).toFixed(1)) : undefined,
    avgHarshness: harshValues.length ? Number(avg(harshValues).toFixed(0)) : undefined,
    avgAIScore: Number(avgAI.toFixed(1)),
    tracksWithArtifacts,
    tracksWithIssues,
    tracksWithWarnings,
    totalIssues,
    totalWarnings,
    albumLoudnessSpread: lufsValues.length >= 2 ? Number(albumLoudnessSpread.toFixed(1)) : undefined,
    sequenceConsistencyScore,
    sequenceConsistencyNote: sequenceConsistencyScore < 85 ? 'Large loudness jumps between adjacent tracks' : undefined,
    spectralConsistencyScore,
    spectralDeviatingTracks: spectralDeviatingTracks.length > 0 ? spectralDeviatingTracks : undefined,
    spectralFingerprint,
    spectralNote,
    outlierTracks: outlierTracks.length > 0 ? outlierTracks : undefined
  };

  return {
    albumName,
    analysisDateISO: new Date().toISOString(),
    totalTracks: tracks.length,
    totalDuration: formatDuration(totalSeconds),
    totalSizeMB: Number(totalSizeMB.toFixed(1)),
    overallScore,
    distributionReady,
    summary,
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
}
