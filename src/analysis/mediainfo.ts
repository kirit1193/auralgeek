import mediaInfoFactory from "mediainfo.js";

export interface MediaInfoAudioBasics {
  format?: string;
  samplingRate?: number;
  channels?: number;
  bitDepth?: number;
  overallBitrate?: number;
  durationSeconds?: number;
}

export async function analyzeMediaInfo(file: File): Promise<MediaInfoAudioBasics> {
  const mi = await mediaInfoFactory({
    format: "object",
    locateFile: () => "/MediaInfoModule.wasm"
  });

  const size = file.size;
  const readChunk = async (chunkSize: number, offset: number) => {
    const buf = await file.slice(offset, offset + chunkSize).arrayBuffer();
    return new Uint8Array(buf);
  };

  const result: any = await mi.analyzeData(size, readChunk);
  mi.close();

  const tracks: any[] = result?.media?.track ?? [];
  const general = tracks.find((t) => t["@type"] === "General");
  const audio = tracks.find((t) => t["@type"] === "Audio");

  const samplingRate = audio?.SamplingRate ? Number(audio.SamplingRate) : undefined;
  const channels = audio?.Channels ? Number(audio.Channels) : undefined;
  const bitDepth = audio?.BitDepth ? Number(audio.BitDepth) : undefined;
  const overallBitrate = general?.OverallBitRate ? Number(general.OverallBitRate) : undefined;
  const durationSeconds = general?.Duration ? Number(general.Duration) : undefined;

  return {
    format: audio?.Format ?? general?.Format,
    samplingRate,
    channels,
    bitDepth,
    overallBitrate,
    durationSeconds
  };
}
