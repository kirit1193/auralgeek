export interface DecodedAudio {
  sampleRate: number;
  channels: number;
  channelData: Float32Array[];
}

export async function decodeToPCM(file: File): Promise<DecodedAudio> {
  const ab = await file.arrayBuffer();
  const ctx = new OfflineAudioContext(1, 1, 48000);
  const audio = await ctx.decodeAudioData(ab.slice(0));
  const channels = audio.numberOfChannels;
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < channels; ch++) channelData.push(audio.getChannelData(ch).slice());
  return { sampleRate: audio.sampleRate, channels, channelData };
}
