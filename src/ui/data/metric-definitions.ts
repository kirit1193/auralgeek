/**
 * Metric Definitions
 * Comprehensive documentation for all analysis metrics
 */

export type MetricCategory =
  | 'loudness'
  | 'peaks'
  | 'dynamics'
  | 'stereo'
  | 'spectral'
  | 'musical'
  | 'streaming'
  | 'artifacts'
  | 'album';

export interface MetricDefinition {
  id: string;
  name: string;
  category: MetricCategory;
  unit?: string;

  // Practical view (default)
  description: string;
  goodRange?: string;
  action?: string;

  // Geek mode (expanded)
  formula?: string;
  standard?: string;
  technicalNotes?: string;

  modes: ('simple' | 'advanced' | 'album')[];
}

export const CATEGORY_INFO: Record<MetricCategory, { icon: string; title: string }> = {
  loudness: { icon: '◐', title: 'Loudness' },
  peaks: { icon: '▲', title: 'Peaks' },
  dynamics: { icon: '◧', title: 'Dynamics' },
  stereo: { icon: '◑', title: 'Stereo' },
  spectral: { icon: '◔', title: 'Spectral' },
  musical: { icon: '♪', title: 'Musical' },
  streaming: { icon: '☁', title: 'Streaming' },
  artifacts: { icon: '⚡', title: 'Artifacts' },
  album: { icon: '⟷', title: 'Album' },
};

export const METRIC_DEFINITIONS: MetricDefinition[] = [
  // ============================================
  // LOUDNESS METRICS
  // ============================================
  {
    id: 'integrated-lufs',
    name: 'Integrated LUFS',
    category: 'loudness',
    unit: 'LUFS',
    description: 'The overall perceived loudness of your track. Streaming services like Spotify and Apple Music use this to automatically adjust volume so all songs play at similar levels. If your track is louder than the platform target, it gets turned down.',
    goodRange: '-14 LUFS (Spotify/YouTube) to -16 LUFS (Apple Music)',
    action: 'Adjust your final limiter output to hit your target loudness. Louder isn\'t better—platforms will turn it down anyway.',
    formula: 'Mean square of K-weighted samples, with absolute gate at -70 LUFS and relative gate at -10 LU below ungated level. Result converted to LUFS: -0.691 + 10 × log₁₀(mean square)',
    standard: 'ITU-R BS.1770-4 (loudness), EBU R128 (gating)',
    technicalNotes: 'K-weighting applies a shelving filter (+4 dB above 1.5 kHz) and high-pass (−∞ below 100 Hz) to approximate human loudness perception. Gating excludes silence and quiet passages from the measurement.',
    modes: ['simple', 'advanced', 'album'],
  },
  {
    id: 'short-term-lufs',
    name: 'Short-term LUFS',
    category: 'loudness',
    unit: 'LUFS',
    description: 'Loudness averaged over 3-second windows, showing how the perceived volume changes throughout the track. Useful for identifying sections that are significantly louder or quieter than the rest.',
    goodRange: 'Peak short-term within 6 LU of integrated',
    action: 'If some sections are much louder, use gentle compression or automation to even things out.',
    formula: 'Ungated K-weighted loudness calculated over sliding 3-second window, updated every 100ms',
    standard: 'EBU R128 / ITU-R BS.1770-4',
    technicalNotes: 'No gating applied to short-term measurements. The 3s window provides a balance between responsiveness and stability for real-time metering.',
    modes: ['advanced'],
  },
  {
    id: 'momentary-lufs',
    name: 'Momentary LUFS',
    category: 'loudness',
    unit: 'LUFS',
    description: 'The most responsive loudness reading, measuring over 400ms windows. Captures brief loud moments like drum hits or vocal peaks that might not show up in longer measurements.',
    goodRange: 'Momentary peaks within 8 LU of integrated',
    action: 'Very high momentary peaks relative to integrated loudness may indicate uncontrolled transients.',
    formula: 'Ungated K-weighted loudness over 400ms sliding window with 75% overlap',
    standard: 'EBU R128 / ITU-R BS.1770-4',
    technicalNotes: 'Primary meter for real-time monitoring. The 400ms window roughly corresponds to the ear\'s temporal integration for loudness perception.',
    modes: ['advanced'],
  },
  {
    id: 'lra',
    name: 'Loudness Range (LRA)',
    category: 'loudness',
    unit: 'LU',
    description: 'How much the loudness varies between the quiet and loud parts of your track. Higher values mean more dynamic contrast (like quiet verses and loud choruses). Lower values mean more consistent loudness throughout.',
    goodRange: '5-10 LU (pop/rock/electronic), 10-20 LU (classical/jazz)',
    action: 'To increase LRA, use less compression and limiting. To decrease, apply more dynamic processing.',
    formula: 'Difference between 95th and 10th percentile of short-term loudness distribution, after applying relative gate',
    standard: 'EBU Tech 3342',
    technicalNotes: 'Statistical measure excluding the top 5% (transient peaks) and bottom 10% (silence/very quiet passages). More reliable than simple max-min difference.',
    modes: ['simple', 'advanced', 'album'],
  },
  {
    id: 'lufs-range',
    name: 'LUFS Range',
    category: 'loudness',
    unit: 'LU',
    description: 'The loudness difference between the loudest and quietest tracks on your album. A smaller range means listeners won\'t need to adjust volume between songs.',
    goodRange: 'Under 3 LU for cohesive listening',
    action: 'Adjust the gain of outlier tracks so they sit closer to the album average.',
    formula: 'max(integrated LUFS) − min(integrated LUFS) across all tracks',
    technicalNotes: 'Does not account for intentional quiet tracks (interludes, intros). Consider artistic intent when evaluating.',
    modes: ['album'],
  },
  {
    id: 'lufs-consistency',
    name: 'LUFS Consistency',
    category: 'loudness',
    unit: 'LU σ',
    description: 'A measure of how consistently loud your album tracks are relative to each other. Lower values mean more uniform loudness across the album.',
    goodRange: 'Under 1.5 LU',
    action: 'Fine-tune individual track output gains to reduce variance while respecting the musical intent of quieter/louder tracks.',
    formula: 'Standard deviation: σ = √(Σ(xᵢ - μ)² / n) where xᵢ is each track\'s integrated LUFS',
    technicalNotes: 'A statistical measure. One track 4 LU off from the mean will significantly raise this value even if others are consistent.',
    modes: ['album'],
  },

  // ============================================
  // PEAKS METRICS
  // ============================================
  {
    id: 'true-peak',
    name: 'True Peak',
    category: 'peaks',
    unit: 'dBTP',
    description: 'The actual maximum level your audio reaches, including peaks that occur between digital samples. This is critical because when streaming services convert your audio to MP3/AAC, peaks above -1 dBTP can cause audible distortion and clipping.',
    goodRange: '-1 dBTP or lower',
    action: 'Use a true peak limiter (not just a regular limiter) set to -1 dBTP. Most modern limiters have this option.',
    formula: 'Peak detection on 4× oversampled signal using band-limited interpolation per ITU-R BS.1770-4 Annex 2',
    standard: 'ITU-R BS.1770-4',
    technicalNotes: 'Inter-sample peaks (ISPs) occur when consecutive samples imply a reconstructed waveform exceeding 0 dBFS. 4× oversampling catches ~99.9% of ISPs. Some limiters use 8× for additional safety margin.',
    modes: ['simple', 'advanced', 'album'],
  },
  {
    id: 'sample-peak',
    name: 'Sample Peak',
    category: 'peaks',
    unit: 'dBFS',
    description: 'The highest sample value in your audio file. Unlike True Peak, this doesn\'t catch peaks that occur between samples, so it can miss potential clipping issues.',
    goodRange: 'Below -0.3 dBFS',
    action: 'Prefer True Peak measurement for modern workflows. Sample peak is mainly useful for legacy compatibility.',
    formula: 'max(|sample|) converted to dB: 20 × log₁₀(peak)',
    technicalNotes: 'Legacy measurement from pre-oversampling era. Can underestimate actual peak by up to 3 dB in worst-case scenarios with certain waveform shapes.',
    modes: ['advanced'],
  },
  {
    id: 'peak-headroom',
    name: 'Peak Headroom',
    category: 'peaks',
    unit: 'dB',
    description: 'The safety margin between your loudest peak and digital maximum (0 dBFS). More headroom means less risk of distortion when your audio is converted to streaming formats.',
    goodRange: '1+ dB (ideally 1.5-2 dB)',
    action: 'If headroom is below 1 dB, reduce your limiter ceiling or final output gain.',
    formula: '0 − True Peak (dBTP)',
    technicalNotes: 'Lossy codecs (AAC, MP3, Opus) can add up to 0.5 dB during encoding. The -1 dBTP recommendation provides margin for this.',
    modes: ['advanced'],
  },
  {
    id: 'avg-true-peak',
    name: 'Avg True Peak (Album)',
    category: 'peaks',
    unit: 'dBTP',
    description: 'The average true peak level across all tracks on your album. Helps identify if your mastering approach is consistently hitting safe peak levels.',
    goodRange: '-2 to -1 dBTP',
    action: 'If the average is above -1 dBTP, several tracks likely need their peaks reduced.',
    formula: 'Arithmetic mean of all track true peak values',
    technicalNotes: 'A single hot track can skew this upward. Check individual track peaks if album average is borderline.',
    modes: ['album'],
  },
  {
    id: 'tracks-above-neg1',
    name: 'Tracks Above -1 dBTP',
    category: 'peaks',
    unit: 'count',
    description: 'The number of tracks exceeding the -1 dBTP streaming safety ceiling. Any tracks above this threshold risk clipping when converted to streaming formats.',
    goodRange: '0 tracks',
    action: 'Re-limit flagged tracks with a true peak limiter set to -1 dBTP or lower.',
    formula: 'Count where track true peak > -1.0 dBTP',
    technicalNotes: 'Some distributors (e.g., Apple Digital Masters) require -1 dBTP. Others may accept up to -0.1 dBTP but this leaves no safety margin.',
    modes: ['album'],
  },

  // ============================================
  // DYNAMICS METRICS
  // ============================================
  {
    id: 'dynamic-range',
    name: 'Dynamic Range',
    category: 'dynamics',
    unit: 'dB',
    description: 'How much contrast exists between the loud and quiet parts of your music. Higher values mean the music "breathes" more—quiet parts are actually quiet, loud parts have impact. Over-compressed music has low dynamic range and can sound flat or fatiguing.',
    goodRange: '8-12 dB (modern pop/rock), 12-20 dB (acoustic/classical)',
    action: 'To increase dynamic range, reduce limiting and compression. To decrease, apply more.',
    formula: 'Derived from statistical analysis of peak-to-RMS ratios across time segments, weighted by perceptual loudness',
    technicalNotes: 'Not the same as crest factor. This metric attempts to capture perceived dynamics rather than pure signal measurements.',
    modes: ['simple', 'advanced', 'album'],
  },
  {
    id: 'crest-factor',
    name: 'Crest Factor',
    category: 'dynamics',
    unit: 'dB',
    description: 'The ratio between peak level and average (RMS) level. Higher crest factor means more "punch"—the transients (drums, attacks) stand out from the sustained sounds. Low crest factor often sounds squashed.',
    goodRange: '10-16 dB (most genres), 6-10 dB (heavily limited EDM)',
    action: 'Reduce limiting to preserve transients, or use transient shaping tools after limiting.',
    formula: 'CF = 20 × log₁₀(peak / RMS) where RMS = √(mean(x²))',
    technicalNotes: 'Measured RMS typically uses 300ms windows. A pure sine wave has CF of 3 dB; white noise ~12 dB. Music with intact transients typically ranges 12-18 dB.',
    modes: ['advanced', 'album'],
  },
  {
    id: 'plr',
    name: 'Peak-to-Loudness Ratio (PLR)',
    category: 'dynamics',
    unit: 'dB',
    description: 'A modern alternative to crest factor that compares true peak to perceived loudness (LUFS) rather than RMS. Better reflects how dynamic the music actually sounds to listeners.',
    goodRange: '10-16 dB',
    action: 'Similar to crest factor—adjust limiting and compression to modify.',
    formula: 'PLR = True Peak (dBTP) − Integrated LUFS',
    standard: 'AES Technical Document AESTD1004',
    technicalNotes: 'PLR correlates better with perceived dynamics than crest factor because LUFS accounts for frequency-dependent loudness perception.',
    modes: ['advanced'],
  },
  {
    id: 'rms-level',
    name: 'RMS Level',
    category: 'dynamics',
    unit: 'dBFS',
    description: 'The average power level of your audio signal. Before LUFS became the standard, RMS was the primary way to measure loudness. It\'s still useful for understanding your signal\'s overall energy.',
    goodRange: '-18 to -12 dBFS (varies by genre)',
    action: 'Use overall gain and compression to adjust RMS level.',
    formula: 'RMS = 20 × log₁₀(√(Σxᵢ² / n))',
    technicalNotes: 'Typically calculated with 300-500ms integration windows. Unlike LUFS, RMS doesn\'t apply frequency weighting, so bass-heavy material will show higher RMS than it sounds.',
    modes: ['advanced'],
  },
  {
    id: 'clipping-detected',
    name: 'Clipping Detected',
    category: 'dynamics',
    unit: 'boolean',
    description: 'Whether digital clipping (distortion from signal exceeding maximum level) was found. Clipping creates harsh distortion that\'s usually undesirable unless intentionally used as an effect.',
    goodRange: 'No clipping',
    action: 'Reduce gain before your limiter, or check for clipping earlier in your signal chain. Re-export the audio.',
    formula: 'Detection of 3+ consecutive samples at ±1.0 (0 dBFS) or within 0.0001 of full scale',
    technicalNotes: 'Consecutive clipped samples indicate hard clipping. Single samples at 0 dBFS may be legitimate peaks. Detection threshold accounts for floating-point precision.',
    modes: ['simple', 'advanced', 'album'],
  },

  // ============================================
  // STEREO METRICS
  // ============================================
  {
    id: 'stereo-width',
    name: 'Stereo Width',
    category: 'stereo',
    unit: '%',
    description: 'How wide or narrow the stereo image sounds. 0% would be pure mono (everything in the center), 100% is full stereo spread, and above 100% indicates out-of-phase content that may cause problems on mono playback systems.',
    goodRange: '40-80%',
    action: 'Use stereo widening/narrowing plugins or mid-side processing to adjust. Be cautious going above 80%.',
    formula: 'Based on correlation and M/S ratio: width ≈ 100 × (1 − correlation) × (side_level / mid_level)',
    technicalNotes: 'Very wide mixes (>90%) often suffer from mono compatibility issues. Low-end content should generally remain centered (narrow) for phase coherence.',
    modes: ['simple', 'advanced', 'album'],
  },
  {
    id: 'correlation',
    name: 'Stereo Correlation',
    category: 'stereo',
    unit: '',
    description: 'How similar the left and right channels are. +1 means identical (mono), 0 means completely unrelated, and negative values indicate phase problems. If this goes negative during playback, those sections may sound hollow or disappear on mono systems (phones, some Bluetooth speakers).',
    goodRange: '0.3 to 1.0 (never sustained negative)',
    action: 'Check for inverted polarity on channels or tracks. Use a correlation meter during mixing.',
    formula: 'Pearson correlation: r = Σ(L×R) / √(Σ(L²) × Σ(R²))',
    technicalNotes: 'Measured over short windows (50-300ms) and averaged. Transient decorrelated content (reverb tails, wide synths) will briefly drop correlation—this is normal. Sustained values below 0.3 indicate problems.',
    modes: ['advanced', 'album'],
  },
  {
    id: 'mid-side-ratio',
    name: 'Mid/Side Ratio',
    category: 'stereo',
    unit: 'dB',
    description: 'The balance between center (mid) and stereo (side) content. Positive values mean more center-focused, negative means more stereo spread. Most well-balanced mixes have slightly more mid than side.',
    goodRange: '+3 to -3 dB',
    action: 'Use M/S EQ or processing to rebalance. Boosting side increases width; boosting mid increases focus.',
    formula: 'M/S ratio = 20 × log₁₀(RMS_mid / RMS_side) where Mid = (L+R)/2, Side = (L−R)/2',
    technicalNotes: 'M/S encoding is mathematically lossless and reversible. Many mastering EQs offer M/S mode for independent mid and side processing.',
    modes: ['advanced'],
  },
  {
    id: 'phase-issues',
    name: 'Phase Issues',
    category: 'stereo',
    unit: 'boolean',
    description: 'Detection of problematic phase relationships that could cause your bass to disappear or your mix to sound hollow on mono systems (phone speakers, club systems summed to mono, etc.).',
    goodRange: 'No issues detected',
    action: 'Check low-frequency content for phase alignment. Bass should typically be mono. Use a phase correlation meter when mixing.',
    formula: 'Flagged when: correlation < 0.2 sustained for >500ms, OR correlation negative with significant sub-200Hz energy',
    technicalNotes: 'Phase cancellation is frequency-dependent. Low frequencies have long wavelengths and are most susceptible to phase issues. Many clubs sum bass to mono.',
    modes: ['simple', 'advanced', 'album'],
  },
  {
    id: 'dc-offset',
    name: 'DC Offset',
    category: 'stereo',
    unit: '%',
    description: 'A constant voltage bias in the signal that shouldn\'t be there. DC offset wastes headroom (your peaks are shifted away from center) and can cause clicks when editing. Most audio should have essentially zero DC offset.',
    goodRange: 'Below 0.1%',
    action: 'Apply a high-pass filter at 10-20 Hz, or use a dedicated DC offset removal tool.',
    formula: 'DC = 100 × |mean(samples)| / max_sample_value',
    technicalNotes: 'Can be introduced by faulty equipment, poor A/D conversion, or certain plugin processing. Even small DC offset compounds through processing chain.',
    modes: ['advanced'],
  },

  // ============================================
  // SPECTRAL METRICS
  // ============================================
  {
    id: 'spectral-tilt',
    name: 'Spectral Tilt',
    category: 'spectral',
    unit: 'dB/oct',
    description: 'The overall brightness or darkness of your mix. Negative values mean the high frequencies roll off relative to lows (warmer/darker sound), while positive values mean brighter/harsher. Most professionally mastered music has a slight natural rolloff.',
    goodRange: '-2 to -4 dB/octave',
    action: 'Use a tilt EQ or broad shelf EQ to adjust. Brightening adds energy but can cause fatigue; darkening adds warmth but may lack clarity.',
    formula: 'Linear regression slope of log(energy) vs log(frequency) across 20Hz-20kHz, typically using 1/3-octave bands',
    technicalNotes: 'Natural acoustic sources and recordings tend toward -3 to -4.5 dB/oct. Modern pop/EDM often targets -1 to -3 dB/oct. Classical recordings may be -4 to -6 dB/oct.',
    modes: ['simple', 'advanced', 'album'],
  },
  {
    id: 'spectral-centroid',
    name: 'Spectral Centroid',
    category: 'spectral',
    unit: 'Hz',
    description: 'The "center of gravity" of all frequencies in your mix. Higher centroid means brighter overall timbre, lower means darker. Useful for comparing the tonal character between tracks or references.',
    goodRange: '1.5-4 kHz (varies by genre)',
    action: 'Adjust with broad EQ moves. Centroid follows the dominant frequency content.',
    formula: 'Centroid = Σ(f × |X(f)|) / Σ|X(f)| where X(f) is magnitude spectrum',
    technicalNotes: 'First-order spectral moment. Correlates strongly with perceived brightness. Electronic music typically 2-4 kHz; acoustic jazz/classical 1-2 kHz.',
    modes: ['advanced'],
  },
  {
    id: 'harshness',
    name: 'Harshness',
    category: 'spectral',
    unit: '%',
    description: 'How prominent the ear\'s most sensitive frequency range (2-5 kHz) is in your mix. High harshness can cause listener fatigue—that feeling of wanting to turn down the volume after extended listening.',
    goodRange: 'Below 25%',
    action: 'Use a de-esser, dynamic EQ, or gentle static cut in the 2-5 kHz range. Check for harsh synths, overdriven guitars, or sibilant vocals.',
    formula: 'Ratio of energy in 2-5 kHz band to total energy, with perceptual weighting based on equal-loudness contours',
    technicalNotes: 'Human hearing sensitivity peaks around 3-4 kHz (ear canal resonance). This range carries speech intelligibility but causes fatigue when excessive. Fletcher-Munson curves show why.',
    modes: ['simple', 'advanced', 'album'],
  },
  {
    id: 'low-frequency-energy',
    name: 'Low Frequency Energy',
    category: 'spectral',
    unit: '%',
    description: 'The proportion of your mix\'s total energy that sits in the bass frequencies (below 200 Hz). Too much causes muddy sound and translation problems; too little sounds thin.',
    goodRange: '15-30%',
    action: 'Use high-pass filtering to reduce mud, or low shelf boost to add weight. Consider multiband compression on the low end.',
    formula: 'Energy ratio = Σ|X(f)|² for f<200Hz / Σ|X(f)|² for all f',
    technicalNotes: 'Room acoustics heavily influence low-frequency perception during mixing. Always check on multiple systems. Electronic genres often run 25-35%; acoustic genres 15-25%.',
    modes: ['advanced'],
  },
  {
    id: 'high-frequency-energy',
    name: 'High Frequency Energy',
    category: 'spectral',
    unit: '%',
    description: 'The proportion of energy above 8 kHz—the "air" and brilliance range. This affects perceived clarity and detail, but too much can sound brittle or harsh.',
    goodRange: '5-15%',
    action: 'Use high shelf EQ or "air" bands around 10-16 kHz. Exciter plugins can add harmonics in this range.',
    formula: 'Energy ratio = Σ|X(f)|² for f>8kHz / Σ|X(f)|² for all f',
    technicalNotes: 'Lossy codecs (MP3, AAC) typically filter above 16-18 kHz. Human hearing sensitivity drops significantly above 12 kHz, increasingly with age.',
    modes: ['advanced'],
  },
  {
    id: 'spectral-flatness',
    name: 'Spectral Flatness',
    category: 'spectral',
    unit: '',
    description: 'Whether the audio sounds more like defined notes/tones (0) or noise/texture (1). Tonal music with clear pitches has low flatness; white noise or heavily distorted content has high flatness.',
    goodRange: '0.05-0.3 (tonal music)',
    action: 'This is informational—reflects the character of your music rather than a mixing issue.',
    formula: 'Spectral flatness = geometric_mean(|X(f)|) / arithmetic_mean(|X(f)|)',
    technicalNotes: 'Also called Wiener entropy. Used in speech/music discrimination and audio fingerprinting. Pure tone = 0, white noise = 1.',
    modes: ['advanced'],
  },
  {
    id: 'spectral-rolloff',
    name: 'Spectral Rolloff',
    category: 'spectral',
    unit: 'Hz',
    description: 'The frequency below which 85% of the spectral energy is contained. A lower rolloff means the high frequencies contribute less energy—either darker content or natural high-frequency rolloff.',
    goodRange: '6-12 kHz',
    action: 'If rolloff seems low, you may be missing air/presence. If very high, check for excessive brightness or noise.',
    formula: 'Minimum f where Σ|X(k)|² for k≤f ≥ 0.85 × Σ|X(k)|² for all k',
    technicalNotes: 'The 85% threshold is conventional. Some implementations use 90% or 95%. Useful for detecting dull recordings or noise contamination.',
    modes: ['advanced'],
  },

  // ============================================
  // MUSICAL METRICS
  // ============================================
  {
    id: 'tempo',
    name: 'Tempo (BPM)',
    category: 'musical',
    unit: 'BPM',
    description: 'The detected speed of your track in beats per minute. Useful for DJs, sync licensing, and organizing your music library. Note that detection isn\'t perfect—some songs may show double or half the actual tempo.',
    goodRange: 'Depends on genre (60-180 BPM typical)',
    action: 'This is informational. If tempo seems wrong, it may be detecting half-time or double-time.',
    formula: 'Onset detection using spectral flux, followed by autocorrelation of onset strength envelope to find periodicity',
    technicalNotes: 'Algorithm finds periodic patterns in onset strength. Ambiguity between 120 and 60 BPM (or similar ratios) is common. Some implementations use machine learning for disambiguation.',
    modes: ['simple', 'advanced'],
  },
  {
    id: 'tempo-confidence',
    name: 'Tempo Confidence',
    category: 'musical',
    unit: '%',
    description: 'How confident the algorithm is about the detected tempo. Low confidence may indicate tempo changes, rubato (flexible timing), complex rhythms, or ambient/drone music without clear beats.',
    goodRange: '70%+',
    action: 'Low confidence isn\'t a problem—it just means the tempo is ambiguous or variable.',
    formula: 'Ratio of primary autocorrelation peak to secondary peaks, normalized',
    technicalNotes: 'Confidence drops with polyrhythms, tempo modulation, non-4/4 time signatures, and sparse percussion. Ambient/drone music typically shows <50% confidence.',
    modes: ['advanced'],
  },
  {
    id: 'key',
    name: 'Musical Key',
    category: 'musical',
    unit: '',
    description: 'The detected key signature of your track (e.g., "C Major" or "A minor"). Useful for harmonic mixing (DJing), finding compatible samples, or organizing your library.',
    goodRange: 'N/A',
    action: 'This is informational. If key seems wrong, the track may be modal, atonal, or modulate between keys.',
    formula: 'Chroma feature extraction via constant-Q transform, then correlation with Krumhansl-Kessler key profiles for all 24 major/minor keys',
    technicalNotes: 'Krumhansl-Kessler profiles derived from psychological experiments on tonal hierarchy. Relative major/minor keys often score similarly (C major vs A minor). Modes may misidentify.',
    modes: ['simple', 'advanced'],
  },
  {
    id: 'key-confidence',
    name: 'Key Confidence',
    category: 'musical',
    unit: '%',
    description: 'How confident the algorithm is about the detected key. Low confidence may indicate modal music, key changes throughout the song, or atonal/ambient content.',
    goodRange: '60%+',
    action: 'Low confidence isn\'t a problem—some music is intentionally ambiguous or doesn\'t follow traditional tonality.',
    formula: 'Correlation coefficient of best-matching key profile vs. runner-up, scaled to percentage',
    technicalNotes: 'Pop music typically 70-90% confidence. Jazz with extensions and alterations: 40-70%. Atonal/12-tone music: <30%.',
    modes: ['advanced'],
  },
  {
    id: 'beats-detected',
    name: 'Beats Detected',
    category: 'musical',
    unit: 'count',
    description: 'The total number of individual beats detected in your track. Combined with duration, this gives the tempo. Useful for verifying tempo detection or understanding rhythmic density.',
    goodRange: 'N/A (depends on tempo and duration)',
    action: 'Informational only. Compare with expected beats based on tempo × duration.',
    formula: 'Count of onset peaks exceeding adaptive threshold after tempo-guided peak-picking',
    technicalNotes: 'Beat tracking locks onto periodic onsets. Non-percussive music or rubato passages may have fewer detected beats than expected.',
    modes: ['advanced'],
  },
  {
    id: 'downbeats',
    name: 'Downbeats',
    category: 'musical',
    unit: 'count',
    description: 'The number of detected bar/measure starts (the "1" in 1-2-3-4 counting). Indicates how many complete bars of music were detected.',
    goodRange: 'N/A',
    action: 'Informational. Helps verify time signature assumptions and track structure.',
    formula: 'Beat tracking with accent pattern analysis to identify measure boundaries',
    technicalNotes: 'Assumes 4/4 time by default. Other time signatures may misidentify downbeat locations. Useful for automatic DJ mixing and remix tools.',
    modes: ['advanced'],
  },

  // ============================================
  // STREAMING METRICS
  // ============================================
  {
    id: 'spotify-gain',
    name: 'Spotify Gain Change',
    category: 'streaming',
    unit: 'dB',
    description: 'The volume adjustment Spotify will apply to your track to normalize it to their -14 LUFS target. Negative means they\'ll turn you down; positive means they\'ll turn you up. If they turn you up, quiet masters may reveal noise or lose impact.',
    goodRange: '-2 to 0 dB (slight turn-down is fine)',
    action: 'Master to around -14 LUFS integrated to minimize adjustment. Going louder than -14 LUFS offers no benefit—Spotify will just turn it down.',
    formula: '-14 − integrated LUFS',
    technicalNotes: 'Spotify uses ReplayGain with -14 LUFS target. Normalization can be disabled by users. Spotify also applies a limiter to prevent clipping on boosted content.',
    modes: ['simple', 'advanced'],
  },
  {
    id: 'apple-gain',
    name: 'Apple Music Gain Change',
    category: 'streaming',
    unit: 'dB',
    description: 'The volume adjustment Apple Music will apply with Sound Check enabled. Apple targets -16 LUFS, slightly quieter than Spotify, which can benefit more dynamic masters.',
    goodRange: '-1 to 0 dB',
    action: 'Master to around -16 LUFS if optimizing for Apple, or -14 LUFS as a compromise for all platforms.',
    formula: '-16 − integrated LUFS',
    technicalNotes: 'Apple Sound Check analyzes the full track and applies album-aware gain. Apple Digital Masters program requires -1 dBTP and recommends -16 LUFS.',
    modes: ['simple', 'advanced'],
  },
  {
    id: 'youtube-gain',
    name: 'YouTube Gain Change',
    category: 'streaming',
    unit: 'dB',
    description: 'The volume adjustment YouTube will apply. YouTube normalizes to -14 LUFS like Spotify, but only turns content DOWN (never up), so quiet masters stay quiet.',
    goodRange: '-2 to 0 dB',
    action: 'Master to around -14 LUFS to avoid turn-down while preserving dynamics.',
    formula: '-14 − integrated LUFS (only applied if positive)',
    technicalNotes: 'YouTube uses a one-way limiter—content louder than -14 LUFS is reduced, but quieter content is not boosted. This asymmetry means very quiet masters will play back quiet.',
    modes: ['simple', 'advanced'],
  },
  {
    id: 'tidal-gain',
    name: 'Tidal Gain Change',
    category: 'streaming',
    unit: 'dB',
    description: 'The expected normalization on Tidal. Tidal uses ReplayGain with a -14 LUFS target, similar to Spotify.',
    goodRange: '-2 to 0 dB',
    action: 'Same recommendation as Spotify: -14 LUFS target.',
    formula: '-14 − integrated LUFS',
    technicalNotes: 'Tidal Masters (MQA) may behave differently. Standard Tidal HiFi uses ReplayGain. User can disable normalization.',
    modes: ['advanced'],
  },
  {
    id: 'projected-true-peak',
    name: 'Projected True Peak',
    category: 'streaming',
    unit: 'dBTP',
    description: 'Your true peak level AFTER the platform applies its gain adjustment. Critical: if a platform boosts your quiet track and the projected peak exceeds 0 dBTP, it will clip.',
    goodRange: 'Below 0 dBTP (ideally below -0.5 dBTP)',
    action: 'If projected peak exceeds 0 dBTP on any platform, reduce your master level or increase loudness to reduce required boost.',
    formula: 'True Peak + Gain Change',
    technicalNotes: 'Platforms may apply limiting to prevent overs, but this adds distortion. Better to deliver content that doesn\'t require platform-side limiting.',
    modes: ['advanced'],
  },
  {
    id: 'platform-risk',
    name: 'Platform Risk Flags',
    category: 'streaming',
    unit: '',
    description: 'Warnings about potential issues on specific streaming platforms, such as projected clipping, excessive turn-down, or codec artifacts.',
    goodRange: 'No flags',
    action: 'Address each flagged issue before distribution. Adjust levels, reduce peaks, or re-check codec translation.',
    formula: 'Rule-based evaluation of loudness, peaks, and spectral content against platform specifications',
    technicalNotes: 'Rules based on published platform specifications and empirical testing. Thresholds are conservative to account for codec variation.',
    modes: ['simple', 'advanced'],
  },

  // ============================================
  // ARTIFACTS METRICS
  // ============================================
  {
    id: 'clipping-samples',
    name: 'Clipping Samples',
    category: 'artifacts',
    unit: 'count',
    description: 'The total number of audio samples that hit the digital ceiling (0 dBFS). While occasional samples at maximum may be acceptable, multiple consecutive clipped samples create audible distortion.',
    goodRange: '0',
    action: 'Find where clipping occurs and reduce gain at that point in your chain. Re-export.',
    formula: 'Count of samples where |value| ≥ 0.99999 (accounting for floating-point precision)',
    technicalNotes: 'Distinction between single-sample peaks (possibly legitimate) and consecutive clipping (definitely problematic). 3+ consecutive samples at 0 dBFS is hard clipping.',
    modes: ['advanced'],
  },
  {
    id: 'artifact-score',
    name: 'Artifact Score',
    category: 'artifacts',
    unit: '',
    description: 'An overall rating of audio quality based on detected processing artifacts like clipping, over-limiting, or codec damage. Higher scores indicate cleaner audio.',
    goodRange: 'Good or Excellent',
    action: 'If score is low, check individual artifact types to identify specific issues.',
    formula: 'Weighted combination: clipping (30%), limiting artifacts (25%), phase issues (20%), DC offset (10%), noise floor (15%)',
    technicalNotes: 'Each component is independently detected and scored 0-100, then combined. Thresholds calibrated against professionally mastered references.',
    modes: ['simple', 'advanced'],
  },
  {
    id: 'limiting-artifacts',
    name: 'Limiting Artifacts',
    category: 'artifacts',
    unit: '%',
    description: 'Detection of over-limiting side effects: pumping (audible gain changes), distortion, or loss of transient definition. Some limiting is normal in mastering; this flags when it becomes problematic.',
    goodRange: 'Below 5%',
    action: 'Reduce limiter input gain, use a slower attack time to preserve transients, or try a different limiter algorithm.',
    formula: 'Analysis of gain reduction patterns: rapid oscillation detection, harmonic distortion measurement, transient preservation ratio',
    technicalNotes: 'Modern limiters (FabFilter Pro-L, Ozone, DMG) have sophisticated algorithms that are harder to detect. Aggressive limiting on older or simpler limiters is more detectable.',
    modes: ['advanced'],
  },
  {
    id: 'codec-simulation',
    name: 'Codec Artifact Risk',
    category: 'artifacts',
    unit: '%',
    description: 'Estimated likelihood that lossy compression (MP3, AAC, Opus) will introduce audible artifacts. Tracks with complex high-frequency content, inter-sample peaks, or specific problematic patterns are higher risk.',
    goodRange: 'Below 10%',
    action: 'Reduce true peak below -1 dBTP. Consider gentle high-frequency reduction on very bright material.',
    formula: 'Based on: true peak level, transient density, high-frequency complexity, stereo width at high frequencies',
    technicalNotes: 'Codecs use psychoacoustic masking—complex content near the masking threshold is most likely to exhibit artifacts. Pre-ringing on transients is a common issue.',
    modes: ['advanced'],
  },
  {
    id: 'silence-detected',
    name: 'Silence Detected',
    category: 'artifacts',
    unit: 'seconds',
    description: 'Duration of true digital silence (no signal at all) at the beginning and end of your track. Some silence is intentional for CD spacing, but excessive silence wastes listener time on streaming platforms.',
    goodRange: '0.0-0.3s start, 0.5-2s end',
    action: 'Trim excess silence, but leave a short gap for natural attack and release.',
    formula: 'Duration where signal RMS < -90 dBFS, measured from start/end inward',
    technicalNotes: 'CD standard recommends 2s pre-gap between tracks. Streaming platforms auto-crossfade, so long gaps can create awkward pauses.',
    modes: ['advanced'],
  },
  {
    id: 'fade-in-detected',
    name: 'Fade In Detected',
    category: 'artifacts',
    unit: 'boolean',
    description: 'Whether the track starts with a gradual fade-in rather than an instant start. Fade-ins are common and valid artistic choices.',
    goodRange: 'N/A',
    action: 'Informational. Ensure fade-in is intentional and long enough to sound natural if present.',
    formula: 'Detection of consistent gain increase over >200ms at track start',
    technicalNotes: 'Short fades (<50ms) may be anti-click measures. Long fades (>2s) are definite artistic choices. Medium fades may be either.',
    modes: ['advanced'],
  },
  {
    id: 'fade-out-detected',
    name: 'Fade Out Detected',
    category: 'artifacts',
    unit: 'boolean',
    description: 'Whether the track ends with a gradual fade-out. A classic technique for ending songs, especially when there\'s no natural ending point.',
    goodRange: 'N/A',
    action: 'Informational. If fade-out exists, ensure it\'s smooth and long enough (typically 3-10 seconds for full fade-outs).',
    formula: 'Detection of consistent gain decrease over >500ms at track end',
    technicalNotes: 'Fade-outs fell out of fashion in the 2010s as streaming made song endings more important (autoplay). Still common in certain genres.',
    modes: ['advanced'],
  },

  // ============================================
  // ALBUM METRICS
  // ============================================
  {
    id: 'overall-score',
    name: 'Overall Score',
    category: 'album',
    unit: '/10',
    description: 'A composite quality score based on all analysis metrics. Evaluates loudness appropriateness, dynamic range, peak safety, stereo imaging, spectral balance, and streaming platform readiness.',
    goodRange: '8.0-10.0',
    action: 'Check the score breakdown to see which component is pulling the score down. Address the lowest-scoring area first.',
    formula: 'Weighted average: Loudness adherence to targets (20%), Dynamic range preservation (25%), Peak/headroom safety (20%), Spectral balance (15%), Streaming readiness (20%)',
    technicalNotes: 'Weights reflect modern streaming-first distribution priorities. A track with great dynamics but unsafe peaks will score lower than one with moderate dynamics and proper peaks.',
    modes: ['album'],
  },
  {
    id: 'distribution-ready',
    name: 'Distribution Ready',
    category: 'album',
    unit: 'boolean',
    description: 'Whether your album meets the technical requirements for distribution to streaming platforms and download stores. This is a basic pass/fail check for critical issues only.',
    goodRange: 'Yes',
    action: 'If "No", check for: true peaks above -0.5 dBTP, clipping, sample rates below 44.1 kHz, or bit depths below 16-bit.',
    formula: 'Pass if: all tracks have true peak ≤ -0.5 dBTP, no hard clipping, sample rate ≥ 44.1 kHz, bit depth ≥ 16',
    technicalNotes: 'Distributors (DistroKid, TuneCore, CD Baby) have minimum specs. This checks the common denominators. Apple Digital Masters has stricter requirements.',
    modes: ['album'],
  },
  {
    id: 'album-loudness-spread',
    name: 'Album Loudness Spread',
    category: 'album',
    unit: 'LU',
    description: 'The loudness difference between your loudest and quietest tracks. A wide spread means listeners may need to adjust volume between songs. Some variation is natural and artistic; too much is jarring.',
    goodRange: 'Under 4 LU',
    action: 'Adjust output gain on outlier tracks to bring them closer to the album average while respecting intentional dynamic contrast.',
    formula: 'max(integrated LUFS) − min(integrated LUFS)',
    technicalNotes: 'Intentionally quiet tracks (intros, interludes) should be considered separately. A loud rock song and a quiet acoustic ballad on the same album may have 6+ LU spread intentionally.',
    modes: ['album'],
  },
  {
    id: 'sequence-consistency',
    name: 'Sequence Flow Score',
    category: 'album',
    unit: '%',
    description: 'How smoothly the album flows from track to track in terms of loudness. Penalizes jarring volume jumps between adjacent songs. 100% means no significant jumps.',
    goodRange: '85-100%',
    action: 'If score is low, check which track transitions have large loudness differences. Adjust those tracks or reconsider track order.',
    formula: 'Score = 100 − (10 × Σmax(0, |ΔLUFSᵢ| − 2)) where ΔLUFSᵢ is the loudness change between track i and i+1',
    technicalNotes: 'Jumps under 2 LU are not penalized. Each LU over 2 subtracts points. Very large jumps (>6 LU) heavily penalize the score.',
    modes: ['album'],
  },
  {
    id: 'spectral-consistency',
    name: 'Spectral Match Score',
    category: 'album',
    unit: '%',
    description: 'How sonically consistent your tracks are in terms of tonal character (brightness, bass content, etc.). Higher scores mean the album sounds cohesive; lower scores may indicate tracks that stick out sonically.',
    goodRange: '80-100%',
    action: 'Identify outlier tracks using spectral analysis and consider reference-matching EQ to bring them closer to the album\'s overall character.',
    formula: 'Based on standard deviation of: spectral tilt, centroid, and harshness values across tracks. Lower deviation = higher score.',
    technicalNotes: 'Some albums intentionally vary (mixed by different engineers, compilation albums). Consider context. A cohesive studio album should score higher than a compilation.',
    modes: ['album'],
  },
  {
    id: 'album-avg-tilt',
    name: 'Album Average Tilt',
    category: 'album',
    unit: 'dB/oct',
    description: 'The average spectral tilt across all tracks—the album\'s overall tonal signature. Tells you if the album leans bright, neutral, or warm overall.',
    goodRange: '-2 to -4 dB/oct',
    action: 'This is informational—it describes your album\'s sonic character rather than indicating a problem.',
    formula: 'Arithmetic mean of spectral tilt values for all tracks',
    technicalNotes: 'Compare against genre references. Bright pop/EDM: -1 to -2 dB/oct. Rock/indie: -2 to -3 dB/oct. Acoustic/jazz/classical: -3 to -5 dB/oct.',
    modes: ['album'],
  },
  {
    id: 'outlier-tracks',
    name: 'Outlier Tracks',
    category: 'album',
    unit: '',
    description: 'Specific tracks that deviate significantly from the album norm in loudness, spectral character, or dynamics. These tracks may stand out as inconsistent with the rest of the album.',
    goodRange: 'None',
    action: 'Review flagged tracks and consider whether the deviation is intentional (artistic choice) or a mastering inconsistency that should be addressed.',
    formula: 'Flagged if any metric exceeds 2 standard deviations from the album mean: |xᵢ − μ| > 2σ',
    technicalNotes: 'Statistical outlier detection. With 10 tracks, approximately 1 may be flagged randomly. Multiple metrics flagging the same track is more significant.',
    modes: ['album'],
  },
];

/**
 * Get metrics filtered by category
 */
export function getMetricsByCategory(category: MetricCategory): MetricDefinition[] {
  return METRIC_DEFINITIONS.filter(m => m.category === category);
}

/**
 * Get metrics filtered by mode
 */
export function getMetricsByMode(mode: 'simple' | 'advanced' | 'album'): MetricDefinition[] {
  return METRIC_DEFINITIONS.filter(m => m.modes.includes(mode));
}

/**
 * Search metrics by query
 */
export function searchMetrics(query: string): MetricDefinition[] {
  const q = query.toLowerCase().trim();
  if (!q) return METRIC_DEFINITIONS;

  return METRIC_DEFINITIONS.filter(m =>
    m.name.toLowerCase().includes(q) ||
    m.description.toLowerCase().includes(q) ||
    m.id.toLowerCase().includes(q) ||
    (m.unit && m.unit.toLowerCase().includes(q)) ||
    (m.standard && m.standard.toLowerCase().includes(q))
  );
}

/**
 * Score a metric based on how well it matches the query
 */
function scoreMetric(metric: MetricDefinition, query: string): number {
  const q = query.toLowerCase();
  const name = metric.name.toLowerCase();
  const categoryName = CATEGORY_INFO[metric.category].title.toLowerCase();

  let score = 0;

  // Exact name match (highest)
  if (name === q) {
    score += 100;
  }
  // Name starts with query
  else if (name.startsWith(q)) {
    score += 80;
  }
  // Name contains query
  else if (name.includes(q)) {
    score += 60;
  }

  // Category name match
  if (categoryName.includes(q)) {
    score += 40;
  }

  // Unit or standard match
  if (metric.unit?.toLowerCase().includes(q)) {
    score += 50;
  }
  if (metric.standard?.toLowerCase().includes(q)) {
    score += 45;
  }

  // Description match (lower priority)
  if (metric.description.toLowerCase().includes(q)) {
    score += 30;
  }

  // Good range or action match
  if (metric.goodRange?.toLowerCase().includes(q)) {
    score += 25;
  }
  if (metric.action?.toLowerCase().includes(q)) {
    score += 20;
  }

  return score;
}

/**
 * Search metrics with relevance ranking
 */
export function searchMetricsRanked(query: string): MetricDefinition[] {
  const q = query.toLowerCase().trim();
  if (!q) return METRIC_DEFINITIONS;

  // Score all metrics
  const scored = METRIC_DEFINITIONS.map(m => ({
    metric: m,
    score: scoreMetric(m, q)
  }));

  // Filter to those with a score > 0 and sort by score descending
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.metric);
}

/**
 * Get top suggestions for autocomplete (max 6)
 */
export function getSuggestions(query: string, limit: number = 6): MetricDefinition[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];

  // Prioritize name matches for suggestions
  const nameMatches = METRIC_DEFINITIONS
    .map(m => ({
      metric: m,
      score: scoreMetric(m, q)
    }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.metric);

  return nameMatches;
}

/**
 * Get all categories in display order
 */
export function getCategories(): MetricCategory[] {
  return ['loudness', 'peaks', 'dynamics', 'stereo', 'spectral', 'musical', 'streaming', 'artifacts', 'album'];
}
