import {
  ebur128_integrated_mono,
  ebur128_integrated_stereo,
  ebur128_true_peak_mono,
  ebur128_true_peak_stereo
} from "ebur128-wasm";

import { dbFromLinear } from "../core/format";

export interface LoudnessResult {
  integratedLUFS: number;
  truePeakDBTP: number;
}

export function computeLoudness(sampleRate: number, channels: Float32Array[]): LoudnessResult {
  if (channels.length === 1) {
    const I = ebur128_integrated_mono(sampleRate, channels[0]);
    const tpLin = ebur128_true_peak_mono(sampleRate, channels[0]);
    return { integratedLUFS: I, truePeakDBTP: dbFromLinear(tpLin) };
  }

  const left = channels[0];
  const right = channels[1];

  const I = ebur128_integrated_stereo(sampleRate, left, right);

  const tpArr = ebur128_true_peak_stereo(sampleRate, left, right);
  const tpMax = Math.max(Number(tpArr[0] ?? 0), Number(tpArr[1] ?? 0));

  return { integratedLUFS: I, truePeakDBTP: dbFromLinear(tpMax) };
}
