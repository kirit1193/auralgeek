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

// Fallback peak detection when ebur128 returns invalid values
function findPeakLinear(channels: Float32Array[]): number {
  let peak = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      const abs = Math.abs(ch[i]);
      if (abs > peak) peak = abs;
    }
  }
  return peak;
}

export function computeLoudness(sampleRate: number, channels: Float32Array[]): LoudnessResult {
  let tpLinear: number;
  let integratedLUFS: number;

  if (channels.length === 1) {
    integratedLUFS = ebur128_integrated_mono(sampleRate, channels[0]);
    tpLinear = ebur128_true_peak_mono(sampleRate, channels[0]);
  } else {
    const left = channels[0];
    const right = channels[1];
    integratedLUFS = ebur128_integrated_stereo(sampleRate, left, right);
    const tpArr = ebur128_true_peak_stereo(sampleRate, left, right);
    tpLinear = Math.max(Number(tpArr[0] ?? 0), Number(tpArr[1] ?? 0));
  }

  // Fallback if ebur128 returns invalid true peak (0 or non-finite)
  if (!isFinite(tpLinear) || tpLinear <= 0) {
    tpLinear = findPeakLinear(channels);
  }

  return { integratedLUFS, truePeakDBTP: dbFromLinear(tpLinear) };
}
