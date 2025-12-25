/**
 * WAV File Reader for Tests
 *
 * Reads PCM WAV files and returns sample data for loudness testing.
 * Supports 16-bit, 24-bit, and 32-bit PCM formats at any sample rate.
 */

import { readFileSync } from 'fs';

export interface WavData {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  samples: Float32Array[];
  duration: number;
}

/**
 * Read a WAV file and return normalized sample data
 *
 * @param filePath - Path to WAV file
 * @returns Parsed WAV data with Float32Array samples
 */
export function readWavFile(filePath: string): WavData {
  const buffer = readFileSync(filePath);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  // RIFF header
  const riff = String.fromCharCode(buffer[0], buffer[1], buffer[2], buffer[3]);
  if (riff !== 'RIFF') {
    throw new Error(`Invalid WAV file: expected RIFF header, got ${riff}`);
  }

  const wave = String.fromCharCode(buffer[8], buffer[9], buffer[10], buffer[11]);
  if (wave !== 'WAVE') {
    throw new Error(`Invalid WAV file: expected WAVE format, got ${wave}`);
  }

  // Find fmt chunk
  let offset = 12;
  let fmtChunkFound = false;
  let audioFormat = 0;
  let numChannels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;

  while (offset < buffer.length - 8) {
    const chunkId = String.fromCharCode(buffer[offset], buffer[offset + 1], buffer[offset + 2], buffer[offset + 3]);
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === 'fmt ') {
      audioFormat = view.getUint16(offset + 8, true);
      numChannels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
      fmtChunkFound = true;
    }

    if (chunkId === 'data') {
      if (!fmtChunkFound) {
        throw new Error('Invalid WAV: data chunk before fmt chunk');
      }

      // Only support PCM (1) and IEEE float (3)
      if (audioFormat !== 1 && audioFormat !== 3) {
        throw new Error(`Unsupported audio format: ${audioFormat}. Only PCM (1) and IEEE float (3) are supported.`);
      }

      const dataOffset = offset + 8;
      const bytesPerSample = bitsPerSample / 8;
      const numSamples = chunkSize / (bytesPerSample * numChannels);

      // Create channel arrays
      const channels: Float32Array[] = [];
      for (let ch = 0; ch < numChannels; ch++) {
        channels.push(new Float32Array(numSamples));
      }

      // Read samples
      let sampleOffset = dataOffset;
      for (let i = 0; i < numSamples; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
          let sample: number;

          if (audioFormat === 3) {
            // IEEE float
            if (bitsPerSample === 32) {
              sample = view.getFloat32(sampleOffset, true);
            } else if (bitsPerSample === 64) {
              sample = view.getFloat64(sampleOffset, true);
            } else {
              throw new Error(`Unsupported float bit depth: ${bitsPerSample}`);
            }
          } else {
            // PCM integer
            if (bitsPerSample === 16) {
              sample = view.getInt16(sampleOffset, true) / 32768;
            } else if (bitsPerSample === 24) {
              // Read 24-bit signed integer
              const b0 = buffer[sampleOffset];
              const b1 = buffer[sampleOffset + 1];
              const b2 = buffer[sampleOffset + 2];
              let val = (b2 << 16) | (b1 << 8) | b0;
              if (val & 0x800000) val |= 0xFF000000; // Sign extend
              sample = val / 8388608; // 2^23
            } else if (bitsPerSample === 32) {
              sample = view.getInt32(sampleOffset, true) / 2147483648;
            } else {
              throw new Error(`Unsupported PCM bit depth: ${bitsPerSample}`);
            }
          }

          channels[ch][i] = sample;
          sampleOffset += bytesPerSample;
        }
      }

      return {
        sampleRate,
        channels: numChannels,
        bitDepth: bitsPerSample,
        samples: channels,
        duration: numSamples / sampleRate
      };
    }

    offset += 8 + chunkSize;
    // Align to word boundary
    if (chunkSize % 2 === 1) offset++;
  }

  throw new Error('Invalid WAV: no data chunk found');
}
