import { readFile, writeFile } from "node:fs/promises";
import { serializeSrt } from "@remotion/captions";
const lengths = [12, 13, 25, 20, 22, 25, 23, 20];
const rates = [0.93, 1, 0.9, 0.92, 0.9, 0.92, 0.9, 0.96];
const offsets = [0.65, 0.18, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65];
let source = `// Word timings transcribed locally from the generated narration with Whisper small.en.\nimport {Audio} from '@remotion/media';\nimport {Sequence,staticFile,useVideoConfig} from 'remotion';\nimport {BasicCaptions} from './basic-captions.element';\n`;
let elapsed = 0;
const globalCaptions = [];
for (let i = 0; i < 8; i++) {
  const captions = JSON.parse(
    await readFile(`public/captions/scene-${i + 1}.json`, "utf8"),
  );
  for (const c of captions) {
    c.text = c.text
      .replace(/\bCary\b/g, "Carry")
      .replace(/\bsandbox\b/g, "Sandbox")
      .replace(/\blicense\b/g, "licensed");
  }
  await writeFile(
    `public/captions/scene-${i + 1}.json`,
    JSON.stringify(captions, null, 2) + "\n",
  );
  const scaled = captions.map((c) => ({
    ...c,
    startMs: c.startMs / rates[i],
    endMs: c.endMs / rates[i],
    timestampMs: c.timestampMs === null ? null : c.timestampMs / rates[i],
  }));
  if (scaled.at(-1).endMs + offsets[i] * 1000 > lengths[i] * 1000)
    throw new Error("Captions overflow scene " + (i + 1));
  source += `\nexport const Voice${i + 1}=()=>{const{fps}=useVideoConfig();return <Sequence name="Scene ${i + 1} voice and captions" from={${offsets[i]}*fps} premountFor={fps}><Audio name="English narration ${i + 1}" src={staticFile('voiceover/scene-${i + 1}.mp3')} playbackRate={${rates[i]}} premountFor={fps}/><BasicCaptions name="English captions ${i + 1}" premountFor={fps} width={3000} combineTokensWithinMilliseconds={2200} style={{position:'absolute',left:135,top:949,scale:0.55,transformOrigin:'top left'}} captions={${JSON.stringify(scaled, null, 2)}}/></Sequence>};\n`;
  globalCaptions.push(
    ...scaled.map((c) => ({
      ...c,
      startMs: c.startMs + (elapsed + offsets[i]) * 1000,
      endMs: c.endMs + (elapsed + offsets[i]) * 1000,
    })),
  );
  elapsed += lengths[i];
}
await writeFile("src/Narration.tsx", source);
const lines = [];
let line = [];
for (const caption of globalCaptions) {
  if (
    line.length &&
    (caption.startMs - line.at(-1).endMs > 700 ||
      caption.endMs - line[0].startMs > 3200 ||
      line.map((c) => c.text).join("").length > 65)
  ) {
    lines.push(line);
    line = [];
  }
  line.push(caption);
  if (/[.!?]$/.test(caption.text.trim())) {
    lines.push(line);
    line = [];
  }
}
if (line.length) lines.push(line);
await writeFile("public/carry-demo.en.srt", serializeSrt({ lines }));
console.log(
  "Prepared 8 independently editable caption tracks and a YouTube SRT.",
);
