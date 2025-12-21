# Roadmap

This is a **client-side, privacy-first** audio analysis tool that runs entirely in the browser.

## Implemented

### Core Analysis
- **Loudness (WASM)**: Integrated loudness (LUFS), True peak (dBTP) via `ebur128-wasm`
- **Metadata (WASM)**: Format, sample rate, channels, bit depth, bitrate, duration via `mediainfo.js`
- **Dynamics (JS)**: RMS, peak, crest factor, DC offset, clipping detection
- **Stereo (JS)**: Mid/side energy, stereo width %, L/R correlation, sub-bass mono compatibility
- **Spectral (JS)**: Band energies (20-80Hz, 4-10kHz, 8-16kHz), spectral centroid, spectral rolloff

### Distribution Readiness Rules
- Sample rate < 44.1kHz → issue
- Bit depth < 16 → issue
- True peak > -1.0 dBTP → issue
- Clipping → issue
- Loudness > -9 LUFS → warning
- Mono → warning
- DC offset > 0.001 → warning

### UI/UX
- Lit + Web Components SPA
- Drag & drop / file picker
- Per-track expandable cards with metrics
- Visual meters with color-coded zones and markers
- Tooltips explaining each metric
- Album-level summary with score ring
- Export `album-analysis.json`

### Architecture
- Web Worker analysis pipeline (non-blocking UI)
- COOP/COEP headers for SharedArrayBuffer support
- CSP security headers

### Testing
- Vitest unit tests for DSP invariants

## Planned

### Analysis Enhancements
- EBU R128 LRA (loudness range) computation
- Spectrogram generation (canvas/FFT)
- Noise-floor estimation

### Musical Analysis (MIR)
- Tempo detection
- Key detection
- Beat regularity / timing character
- Onset strength analysis
- "Robotic timing" detection via Essentia.js (WASM)

### Report Features
- Single-file HTML export with embedded JSON + inline CSS
- PDF export option

### Performance
- Multi-worker sharding for concurrent track analysis
- Optional WASM SIMD + threads builds

### Validation
- Comparison harness against reference ffmpeg/libebur128 runs
- Synthetic test fixtures (pink noise, impulses, hard-limited waveforms)
