import type { TrackAnalysis } from "../core/types";

export function evaluateDistribution(track: TrackAnalysis): { ready: boolean; issues: string[]; warnings: string[] } {
  const issues: string[] = [];
  const warnings: string[] = [];
  let ready = true;

  const p = track.parameters;
  const l = track.loudness;
  const d = track.dynamics;

  if (p.sampleRate !== undefined && p.sampleRate < 44100) {
    issues.push(`Sample rate ${p.sampleRate} Hz below 44.1 kHz.`);
    ready = false;
  }
  if (p.bitDepth !== undefined && p.bitDepth < 16) {
    issues.push(`Bit depth ${p.bitDepth}-bit below 16-bit.`);
    ready = false;
  }
  if (p.channels !== undefined && p.channels < 2) {
    warnings.push("Mono file: consider stereo for streaming.");
  }

  if (l.truePeakDBTP !== null && l.truePeakDBTP > -1.0) {
    issues.push(`True peak ${l.truePeakDBTP.toFixed(1)} dBTP exceeds -1.0 dBTP.`);
    ready = false;
  }

  if (l.integratedLUFS !== null && l.integratedLUFS > -9) {
    warnings.push(`Very loud (${l.integratedLUFS.toFixed(1)} LUFS): may cause listener fatigue.`);
  }

  if (d.hasClipping) {
    issues.push("Clipping detected.");
    ready = false;
  }

  if (d.dcOffset !== null && Math.abs(d.dcOffset) > 0.001) {
    warnings.push(`DC offset detected (${d.dcOffset.toFixed(6)}).`);
  }

  return { ready, issues, warnings };
}
