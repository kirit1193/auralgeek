/**
 * Streaming platform normalization simulation
 * Computes gain changes for Spotify, Apple Music, YouTube, Tidal
 */

import type { StreamingSimulation, PlatformNormalization } from '../../core/types.js';

interface PlatformTarget {
  name: string;
  lufs: number;
  tpLimit: number;
}

const PLATFORM_TARGETS: PlatformTarget[] = [
  { name: "Spotify", lufs: -14, tpLimit: -1 },
  { name: "Apple Music", lufs: -16, tpLimit: -1 },
  { name: "YouTube", lufs: -14, tpLimit: -1 },
  { name: "Tidal", lufs: -14, tpLimit: -1 }
];

export function computeStreamingSimulation(
  integratedLUFS: number,
  truePeakDBTP: number
): StreamingSimulation {
  const platforms: Record<string, PlatformNormalization> = {};

  for (const target of PLATFORM_TARGETS) {
    const gainChange = target.lufs - integratedLUFS;
    const projectedTP = truePeakDBTP + gainChange;
    const riskFlags: string[] = [];

    if (gainChange < -1) {
      riskFlags.push(`Attenuated by ${Math.abs(gainChange).toFixed(1)} dB`);
    }
    if (projectedTP > target.tpLimit) {
      riskFlags.push(`May clip post-normalization (TP ${projectedTP.toFixed(1)} dBTP > ${target.tpLimit} dBTP)`);
    }
    if (projectedTP > 0) {
      riskFlags.push("Likely to clip or distort");
    }

    let limiterCeilingSuggestion: number | null = null;
    if (projectedTP > target.tpLimit) {
      limiterCeilingSuggestion = target.tpLimit - gainChange;
    }

    platforms[target.name] = {
      platform: target.name,
      referenceLUFS: target.lufs,
      gainChangeDB: gainChange,
      projectedTruePeakDBTP: projectedTP,
      riskFlags,
      limiterCeilingSuggestion
    };
  }

  let recommendation: string;

  if (integratedLUFS > -10) {
    recommendation = "Very competitive loudness. May sacrifice dynamics for loudness. Consider backing off for more dynamic range.";
  } else if (integratedLUFS > -14) {
    recommendation = "Competitive loudness. Good for EDM/Pop. Will be attenuated on most platforms.";
  } else if (integratedLUFS > -18) {
    recommendation = "Balanced loudness. Preserves dynamics while remaining competitive.";
  } else {
    recommendation = "Dynamic master. Good for acoustic/classical genres. May sound quieter in playlists.";
  }

  return {
    spotify: platforms["Spotify"] ?? null,
    appleMusic: platforms["Apple Music"] ?? null,
    youtube: platforms["YouTube"] ?? null,
    tidal: platforms["Tidal"] ?? null,
    recommendation
  };
}
