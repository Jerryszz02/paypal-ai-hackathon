import { writeFile, mkdir } from "node:fs/promises";
import { registerMediabunnyServer } from "@mediabunny/server";
import {
  ALL_FORMATS,
  Conversion,
  FilePathSource,
  Input,
  NullTarget,
  Output,
  WavOutputFormat,
} from "mediabunny";
import {
  canUseWhisperWebGpu,
  downloadWhisperModel,
  loadWhisperModel,
  disposeWhisperModel,
  toCaptions,
  transcribe,
} from "@remotion/whisper-webgpu";

const support = await canUseWhisperWebGpu();
if (!support.supported) throw new Error(support.detailedReason);
const model = "small.en";
await mkdir("public/captions", { recursive: true });
console.log("Loading local English transcription model…");
await downloadWhisperModel({ model });
await loadWhisperModel({ model });
registerMediabunnyServer();
for (let i = 1; i <= 8; i++) {
  const input = new Input({
    formats: ALL_FORMATS,
    source: new FilePathSource(`public/voiceover/scene-${i}.mp3`),
  });
  const chunks = [];
  const conversion = await Conversion.init({
    input,
    output: new Output({
      format: new WavOutputFormat(),
      target: new NullTarget(),
    }),
    video: { discard: true },
    audio: {
      codec: "pcm-f32",
      forceTranscode: true,
      numberOfChannels: 1,
      sampleFormat: "f32",
      sampleRate: 16000,
      process: (sample) => {
        const waveform = new Float32Array(
          sample.allocationSize({ format: "f32", planeIndex: 0 }) / 4,
        );
        sample.copyTo(waveform, { format: "f32", planeIndex: 0 });
        chunks.push({ start: Math.round(sample.timestamp * 16000), waveform });
        return sample;
      },
    },
  });
  if (!conversion.isValid) throw new Error("Cannot decode scene " + i);
  await conversion.execute();
  const length = Math.max(...chunks.map((c) => c.start + c.waveform.length));
  const channelWaveform = new Float32Array(length);
  for (const c of chunks)
    channelWaveform.set(
      c.waveform.subarray(Math.max(0, -c.start)),
      Math.max(0, c.start),
    );
  const output = await transcribe({ channelWaveform, model });
  const { captions } = toCaptions({ whisperWebGpuOutput: output });
  await writeFile(
    `public/captions/scene-${i}.json`,
    JSON.stringify(captions, null, 2),
  );
  console.log(`Scene ${i}: ${captions.map((c) => c.text).join("")}`);
  input.dispose();
}
await disposeWhisperModel({ model });
