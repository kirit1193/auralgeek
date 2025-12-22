export type TimingCharacter = "robotic" | "tight" | "natural" | "loose" | "unknown";

export interface AudioParameters {
  filename: string;
  filesizeMB: number;
  durationSeconds: number;
  durationFormatted: string;
  format?: string;
  sampleRate?: number;
  decodedSampleRate?: number; // What AudioContext decoded to
  channels?: number;
  bitDepth?: number;
  effectiveBitDepth?: number; // Estimated from noise floor
  overallBitrate?: number;
  isTrueStereo?: boolean; // vs dual mono
}

// EBU R128 / ITU BS.1770 Loudness Suite
export interface LoudnessMetrics {
  // Integrated (gated per ITU BS.1770)
  integratedLUFS: number | null;
  integratedUngatedLUFS: number | null;

  // True Peak (oversampled)
  truePeakDBTP: number | null;
  samplePeakDBFS: number | null;
  truePeakOversampling: number; // 4x or 8x
  ispMarginDB: number | null; // True Peak - Sample Peak

  // Momentary (400ms window) & Short-term (3s window)
  maxMomentaryLUFS: number | null;
  maxShortTermLUFS: number | null;

  // Short-term distribution percentiles
  shortTermP10: number | null;
  shortTermP50: number | null;
  shortTermP90: number | null;
  shortTermP95: number | null;

  // Loudness Range (EBU Tech 3342)
  loudnessRangeLU: number | null;

  // Loudness timeline (downsampled for UI)
  shortTermTimeline: number[] | null; // LUFS values at ~10Hz

  // Flagged segments
  loudestSegmentTime: number | null; // seconds
  quietestSegmentTime: number | null;
  abruptChanges: { time: number; deltaLU: number }[] | null;
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

  // PLR/PSR (Peak-to-Loudness ratios - correlate with "punch")
  plrDB: number | null; // True Peak - Integrated Loudness
  psrDB: number | null; // True Peak - Max Short-term Loudness

  // Microdynamics
  transientDensity: number | null; // events per minute
  microdynamicContrast: number | null; // median short-window crest

  // Clipping taxonomy
  clippedSampleCount: number | null;
  clipEventCount: number | null; // contiguous segments
  clipDensityPerMinute: number | null;
  worstClipTimestamps: number[] | null; // top N clip events (seconds)
}

export interface SpectralAnalysis {
  spectralCentroidHz: number | null;
  spectralRolloffHz: number | null;
  highFreqEnergy8k16kDB: number | null;
  sibilanceEnergy4k10kDB: number | null;
  subBassEnergy20_80DB: number | null;

  // Spectral balance & tilt
  spectralTiltDBPerOctave: number | null; // slope of long-term spectrum
  bassToMidRatioDB: number | null;
  midToHighRatioDB: number | null;

  // Perceptual indices
  harshnessIndex: number | null; // 2-5kHz energy prominence
  sibilanceIndex: number | null; // 5-10kHz peaks

  // Tonal vs noisy character
  spectralFlatness: number | null; // 0=tonal, 1=noise-like
  harmonicToNoiseRatio: number | null; // dB estimate

  // Crest-by-band (spectral dynamics)
  crestByBand: {
    sub: number | null;    // 20-80 Hz
    bass: number | null;   // 80-250 Hz
    lowMid: number | null; // 250-500 Hz
    mid: number | null;    // 500-2k Hz
    presence: number | null; // 2-6k Hz
    brilliance: number | null; // 6-20k Hz
  } | null;
}

export interface StereoAnalysis {
  stereoWidthPct: number | null;
  midEnergyDB: number | null;
  sideEnergyDB: number | null;
  correlation: number | null;
  subBassMonoCompatible: boolean | null;
  balanceDB: number | null;

  // Time-resolved correlation
  correlationMean: number | null;
  correlationWorst1Pct: number | null;
  worstCorrelationTimestamps: number[] | null;

  // Band-limited stereo width (side energy %)
  lowBandWidthPct: number | null;    // 20-150 Hz
  presenceBandWidthPct: number | null; // 2-6 kHz
  airBandWidthPct: number | null;     // 10-20 kHz

  // Mono downmix impact
  monoLoudnessDiffDB: number | null; // stereo vs mono loudness
  worstCancellationTimestamps: number[] | null;

  // Phase anomalies (especially low end)
  lowEndPhaseIssues: boolean | null;
}

export interface AIArtifactAnalysis {
  shimmerDetected: boolean;
  shimmerScore: number | null;
  roboticTiming: boolean;
  timingScore: number | null;
  overallAIScore: number | null; // lower is better
}

// Musical features with confidence (probabilistic, not single "truth")
export interface MusicalFeatures {
  // Tempo detection with candidates
  bpmCandidates: { bpm: number; confidence: number }[] | null; // top 3
  bpmPrimary: number | null;
  bpmConfidence: number | null; // 0-100
  halfDoubleAmbiguity: boolean; // could be half/double time
  beatStabilityScore: number | null; // variance of inter-beat interval

  // Key detection with candidates
  keyCandidates: { key: string; confidence: number }[] | null; // top 3
  keyPrimary: string | null;
  keyConfidence: number | null; // 0-100
  tonalnessScore: number | null; // how strongly fits any key model
}

// Platform normalization simulation
export interface PlatformNormalization {
  platform: string;
  referenceLUFS: number;
  gainChangeDB: number;
  projectedTruePeakDBTP: number;
  riskFlags: string[]; // "may clip", "attenuated by X dB"
  limiterCeilingSuggestion: number | null;
}

export interface StreamingSimulation {
  spotify: PlatformNormalization | null;
  appleMusic: PlatformNormalization | null;
  youtube: PlatformNormalization | null;
  tidal: PlatformNormalization | null;
  recommendation: string | null; // "competitive vs dynamic" strategy
}

export interface TrackAnalysis {
  trackNumber: number;
  parameters: AudioParameters;
  loudness: LoudnessMetrics;
  dynamics: DynamicsMetrics;
  spectral: SpectralAnalysis;
  stereo: StereoAnalysis;
  aiArtifacts: AIArtifactAnalysis;
  musicalFeatures: MusicalFeatures;
  streamingSimulation: StreamingSimulation;
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
