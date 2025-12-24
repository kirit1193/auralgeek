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

  // === NEW: Source & Quality Intelligence (1.6) ===
  // Noise floor estimation (median low-level spectral energy)
  noiseFloorDB?: number;
  // Codec suspicion score (combines low effective bit depth, spectral rolloff, pre-echo)
  codecSuspicionScore?: number; // 0-100
  codecSuspicionNote?: string; // e.g., "May indicate lossy or heavily processed source"
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

  // === NEW: Macro-dynamics (1.1A) ===
  // Loudness slope: positive = gets louder, negative = fades
  loudnessSlopeDBPerMin: number | null;
  // Loudness volatility: std-dev of short-term LUFS (distinguishes dynamic vs unstable)
  loudnessVolatilityLU: number | null;

  // === NEW: Peak clustering (1.2A) ===
  // Whether true peak events are sporadic (transients) or persistent (limiter ceiling abuse)
  peakClusteringType: "sporadic" | "persistent" | "mixed" | null;
  peakClusterCount: number | null; // Number of distinct peak clusters

  // === NEW: TP-to-loudness at loudest section (1.2B) ===
  tpToLoudnessAtPeak: number | null; // TP - short-term loudness at loudest section
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

  // === NEW: Dynamic envelope characterization (1.1B) ===
  // Attack speed: median positive slope of RMS envelope (dB/ms)
  attackSpeedIndex: number | null;
  // Release tail: median decay time from peak to -10dB (ms)
  releaseTailMs: number | null;
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

  // === NEW: Perceptual weighting (1.4A) ===
  // A-weighted versions of harshness and sibilance (more perceptually accurate)
  harshnessIndexWeighted: number | null;
  sibilanceIndexWeighted: number | null;
  spectralTiltWeightedDBPerOctave: number | null;

  // === NEW: Spectral balance targets (1.4B) ===
  // "Within typical range" indicators (percentile-based references)
  spectralBalanceStatus: "bright" | "balanced" | "dark" | null;
  spectralBalanceNote: string | null; // e.g., "Outside common range for modern pop"
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

  // === NEW: Energy-aware correlation (1.3A) ===
  // Correlation weighted by energy (ignores quiet sections)
  correlationEnergyWeighted: number | null;

  // === NEW: Stereo asymmetry metric (1.3B) ===
  // L/R spectral imbalance - difference in spectral centroid per channel
  spectralAsymmetryHz: number | null; // positive = right brighter, negative = left brighter
  spectralAsymmetryNote: string | null; // e.g., "Right channel brighter than left"
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

  // === NEW: Tempo drift index (1.5) ===
  // Std-dev of beat intervals (higher = less stable)
  tempoDriftIndex: number | null;
  tempoDriftNote: string | null; // e.g., "Tempo fluctuates slightly — likely live or humanized"

  // === NEW: Key stability index (1.5) ===
  // % of windows agreeing with primary key
  keyStabilityPct: number | null;
  keyStabilityNote: string | null; // e.g., "Key center stable throughout"
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

// === NEW: Enhanced issue/warning with severity (2.1) ===
export interface AnalysisIssue {
  message: string;
  severity: number; // 0-1 (0 = minor, 1 = critical)
  confidence: number; // 0-1 (how certain we are this is an issue)
  category: "format" | "loudness" | "dynamics" | "stereo" | "spectral" | "streaming";
  // Causal chaining (2.2) - optional linked causes/effects
  causedBy?: string;
  leadsTo?: string;
  // Recommendation tier (2.3)
  recommendationTier?: "safe" | "contextual" | "aggressive";
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
  // === NEW: Enhanced issues with severity (2.1) ===
  enhancedIssues?: AnalysisIssue[];
  enhancedWarnings?: AnalysisIssue[];
  // One-line summary of primary concern (4.4C)
  primaryConcern?: string;
}

export interface AlbumSummary {
  // Loudness
  avgLUFS?: number;
  minLUFS?: number;
  maxLUFS?: number;
  lufsRange?: string;
  lufsConsistency?: number; // standard deviation
  avgLRA?: number;

  // Peaks
  maxTruePeak?: number;
  avgTruePeak?: number;
  tracksAboveNeg1dBTP?: number;

  // Dynamics
  avgDynamicRange?: number;
  avgCrestFactor?: number;
  tracksWithClipping?: number;

  // Stereo
  avgStereoWidth?: number;
  avgCorrelation?: number;
  tracksWithPhaseIssues?: number;

  // Spectral
  avgSpectralTilt?: number;
  avgHarshness?: number;

  // AI/Artifacts
  avgAIScore?: number;
  tracksWithArtifacts?: number;

  // Quality breakdown
  tracksWithIssues?: number;
  tracksWithWarnings?: number;
  totalIssues?: number;
  totalWarnings?: number;

  // === NEW: Album-Level Intelligence (3.1-3.3) ===

  // Album loudness cohesion (3.1)
  albumLoudnessSpread?: number; // max integrated - min integrated
  sequenceConsistencyScore?: number; // 0-100, penalizes large jumps between adjacent tracks
  sequenceConsistencyNote?: string; // e.g., "Large loudness jump between tracks 3 and 4"

  // Album spectral fingerprint (3.2)
  spectralConsistencyScore?: number; // 0-100
  spectralDeviatingTracks?: number[]; // track numbers that deviate significantly
  spectralFingerprint?: {
    avgTilt: number;
    avgHarshness: number;
    avgWidth: number;
  };
  spectralNote?: string; // e.g., "Track 6 deviates significantly (brighter, wider)"

  // Outlier detection (3.3)
  outlierTracks?: {
    trackNumber: number;
    reason: string; // e.g., "significantly louder and brighter than album median"
  }[];
}

// === NEW: Reproducibility metadata (5.2) ===
export interface AnalysisMetadata {
  analysisVersion: string;
  algorithmFlags: {
    truePeakOversamplingFactor: number;
    aWeightingEnabled: boolean;
    energyWeightedCorrelation: boolean;
  };
  browserInfo?: string;
  sampleRate: number;
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

  // === NEW: Distribution ready nuance (4.3A) ===
  distributionReadyNote?: string; // e.g., "Distribution Ready (with normalization)"

  // === NEW: Score breakdown (4.3B) ===
  scoreBreakdown?: {
    loudness: number;
    dynamics: number;
    translation: number; // stereo/mono compatibility
    spectral: number;
    streaming: number;
  };

  // === NEW: Reproducibility metadata (5.2) ===
  metadata?: AnalysisMetadata;
}
