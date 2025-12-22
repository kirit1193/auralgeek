export type TimingCharacter = "robotic" | "tight" | "natural" | "loose" | "unknown";

export interface AudioParameters {
  filename: string;
  filesizeMB: number;
  durationSeconds: number;
  durationFormatted: string;
  format?: string;
  sampleRate?: number;
  channels?: number;
  bitDepth?: number;
  overallBitrate?: number;
}

export interface LoudnessMetrics {
  integratedLUFS: number | null;
  truePeakDBTP: number | null;
  loudnessRangeLU: number | null;
}

export interface DynamicsMetrics {
  peakDBFS: number | null;
  rmsDBFS: number | null;
  crestFactorDB: number | null;
  dynamicRangeDB: number | null;
  dcOffset: number | null;
  hasClipping: boolean;
  silenceAtStartMs: number | null;
  silenceAtEndMs: number | null;
}

export interface SpectralAnalysis {
  spectralCentroidHz: number | null;
  spectralRolloffHz: number | null;
  highFreqEnergy8k16kDB: number | null;
  sibilanceEnergy4k10kDB: number | null;
  subBassEnergy20_80DB: number | null;
}

export interface StereoAnalysis {
  stereoWidthPct: number | null;
  midEnergyDB: number | null;
  sideEnergyDB: number | null;
  correlation: number | null;
  subBassMonoCompatible: boolean | null;
  balanceDB: number | null;
}

export interface AIArtifactAnalysis {
  shimmerDetected: boolean;
  shimmerScore: number | null;
  roboticTiming: boolean;
  timingScore: number | null;
  overallAIScore: number | null; // lower is better
}

export interface TrackAnalysis {
  trackNumber: number;
  parameters: AudioParameters;
  loudness: LoudnessMetrics;
  dynamics: DynamicsMetrics;
  spectral: SpectralAnalysis;
  stereo: StereoAnalysis;
  aiArtifacts: AIArtifactAnalysis;
  distributionReady: boolean;
  issues: string[];
  warnings: string[];
}

export interface AlbumSummary {
  avgLUFS?: number;
  maxTruePeak?: number;
  avgAIScore?: number;
  lufsRange?: string;
}

export interface AlbumAnalysis {
  albumName: string;
  analysisDateISO: string;
  totalTracks: number;
  totalDuration: string;
  totalSizeMB: number;
  overallScore: number; // 0..10
  distributionReady: boolean;
  summary: AlbumSummary;
  tracks: TrackAnalysis[];
}
