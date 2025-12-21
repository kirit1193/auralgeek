# Auralgeek

Privacy-first audio analysis tool that runs **entirely in your browser** - no uploads, no servers.

## Features

- **Loudness Analysis**: EBU R128 integrated loudness (LUFS), true peak (dBTP), loudness range (LRA)
- **Dynamics**: RMS, peak, crest factor, DC offset, clipping detection
- **Stereo Analysis**: Mid/side energy, stereo width, correlation, mono compatibility
- **Spectral Analysis**: Band energies (sub-bass, sibilance, high-frequency)
- **Musical Analysis**: Tempo (BPM), key detection, beat regularity
- **Distribution Readiness**: Checks against streaming platform requirements

## Tech Stack

- **Lit** - Web Components UI
- **ebur128-wasm** - WASM-based EBU R128 loudness measurement
- **mediainfo.js** - WASM container/codec metadata extraction
- **Web Audio API** - Audio decoding and DSP
- **Web Workers** - Non-blocking analysis pipeline

## Local Development

```bash
npm install
npm run dev
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

MIT
