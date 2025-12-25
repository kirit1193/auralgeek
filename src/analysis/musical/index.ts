/**
 * Musical analysis module barrel export
 */

import type { MusicalFeatures } from '../../core/types.js';
import { detectBPM, computeTempoDriftIndex } from './tempo.js';
import { detectKey, computeKeyStability } from './tonality.js';

export { detectBPM, computeTempoDriftIndex, type BPMCandidate, type BPMResult, type TempoDriftResult } from './tempo.js';
export { detectKey, computeKeyStability, computeChromagram, type KeyCandidate, type KeyResult, type KeyStabilityResult } from './tonality.js';
export { computeStreamingSimulation } from './streaming.js';

export function computeMusicalFeatures(mono: Float32Array, sampleRate: number): MusicalFeatures {
  const bpmResult = detectBPM(mono, sampleRate);
  const keyResult = detectKey(mono, sampleRate);

  const tempoDrift = computeTempoDriftIndex(mono, sampleRate, bpmResult.primary);
  const keyStability = computeKeyStability(mono, sampleRate, keyResult.primary);

  return {
    bpmCandidates: bpmResult.candidates,
    bpmPrimary: bpmResult.primary,
    bpmConfidence: bpmResult.confidence,
    halfDoubleAmbiguity: bpmResult.halfDoubleAmbiguity,
    beatStabilityScore: bpmResult.stabilityScore,
    keyCandidates: keyResult.candidates,
    keyPrimary: keyResult.primary,
    keyConfidence: keyResult.confidence,
    tonalnessScore: keyResult.tonalnessScore,
    tempoDriftIndex: tempoDrift.driftIndex,
    tempoDriftNote: tempoDrift.note,
    keyStabilityPct: keyStability.stabilityPct,
    keyStabilityNote: keyStability.note
  };
}
