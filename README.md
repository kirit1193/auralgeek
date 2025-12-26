# Auralgeek

Privacy-first audio analysis tool that runs **entirely in your browser** - no uploads, no servers.

## Features

### Loudness Analysis
- **EBU R128 Compliance**: Integrated loudness (LUFS), true peak (dBTP), loudness range (LRA)
- **Per-Band Loudness**: LUFS by frequency range (sub, bass, mid, presence, brilliance)
- **Loudness Correction**: Exact gain needed to reach -14 LUFS streaming target
- **Streaming Simulation**: Platform-specific normalization preview (Spotify, Apple Music, YouTube, Tidal)

### Advanced Dynamics
- **Dynamic Preservation Score**: 0-100 rating of dynamic range preservation quality
- **Compression Detection**: Estimated ratio, threshold, and compression character
- **Transient Analysis**: Attack sharpness, timing regularity, spacing uniformity
- **Transient Timing Character**: Classification as robotic, tight, natural, or loose

### Spectral Intelligence
- **THD Estimation**: Total Harmonic Distortion detection and classification
- **Codec Quality Detection**: Lossy compression artifact detection via spectral cutoff and bit depth
- **Perceptual Metrics**: A-weighted harshness and sibilance indices

### Stereo & Spatial
- **Mid/Side Analysis**: Energy distribution and stereo width
- **Correlation Tracking**: Time-resolved phase correlation with worst-case timestamps
- **Mono Compatibility**: Low-end phase coherence and downmix impact

### Additional Features
- **Musical Analysis**: Tempo (BPM) with confidence, key detection, tempo drift index
- **Spectrogram Visualization**: Time-frequency display with Viridis colormap
- **AI Artifact Detection**: Shimmer detection and robotic timing flagging
- **Distribution Readiness**: Checks against streaming platform requirements
- **Enhanced Export**: JSON export with key findings and recommendations

## Tech Stack

- **Lit** - Web Components UI
- **ebur128-wasm** - WASM-based EBU R128 loudness measurement (4x oversampling per ITU-R BS.1770-4)
- **mediainfo.js** - WASM container/codec metadata extraction
- **Web Audio API** - Audio decoding and DSP
- **Web Workers** - Non-blocking analysis pipeline with buffer pooling
- **OffscreenCanvas** - Worker-thread spectrogram rendering with ImageBitmap transfer
- **Vitest** - Unit testing with synthetic WAV fixtures

## Local Development

```bash
npm install
npm run dev
```

## Testing

```bash
# Generate synthetic test WAV files
node scripts/generate-test-wavs.mjs

# Run tests
npm test
```

## Build

```bash
npm run build
npm run preview
```

## Deploy to Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`

The `public/_headers` file enables COOP/COEP for SharedArrayBuffer support and other security headers.

## License

[Unlicense](https://unlicense.org) - Public Domain
