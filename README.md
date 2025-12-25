# Auralgeek

Privacy-first audio analysis tool that runs **entirely in your browser** - no uploads, no servers.

## Features

- **Loudness Analysis**: EBU R128 integrated loudness (LUFS), true peak (dBTP), loudness range (LRA)
- **Dynamics**: RMS, peak, crest factor, DC offset, clipping detection
- **Stereo Analysis**: Mid/side energy, stereo width, correlation, mono compatibility
- **Spectral Analysis**: Power-based spectral centroid/rolloff, A-weighted perceptual metrics, harshness/sibilance indices
- **Musical Analysis**: Tempo (BPM), key detection, beat regularity
- **Distribution Readiness**: Checks against streaming platform requirements

## Tech Stack

- **Lit** - Web Components UI
- **ebur128-wasm** - WASM-based EBU R128 loudness measurement (4x oversampling per ITU-R BS.1770-4)
- **mediainfo.js** - WASM container/codec metadata extraction
- **Web Audio API** - Audio decoding and DSP
- **Web Workers** - Non-blocking analysis pipeline
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
