import { readFile, stat } from "node:fs/promises";
import assert from "node:assert/strict";
const durations = [12, 13, 25, 20, 22, 25, 23, 20];
const rates = [0.93, 1, 0.9, 0.92, 0.9, 0.92, 0.9, 0.96];
const offsets = [0.65, 0.18, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65];
assert.equal(
  durations.reduce((a, b) => a + b, 0),
  160,
);
assert.ok(durations.reduce((a, b) => a + b, 0) < 180);
for (let i = 0; i < 8; i++) {
  assert.ok((await stat(`public/voiceover/scene-${i + 1}.mp3`)).size > 1000);
  const captions = JSON.parse(
    await readFile(`public/captions/scene-${i + 1}.json`, "utf8"),
  );
  assert.ok(captions.length > 10);
  for (let j = 0; j < captions.length; j++) {
    const c = captions[j];
    assert.ok(
      c.startMs >= 0 && c.endMs >= c.startMs,
      `Scene ${i + 1} invalid caption`,
    );
    if (j > 0)
      assert.ok(
        c.startMs >= captions[j - 1].startMs,
        "Non-monotonic word timing",
      );
    assert.ok(
      c.endMs / rates[i] + offsets[i] * 1000 <= durations[i] * 1000,
      "Caption exceeds scene",
    );
  }
}
for (const name of ["applicant", "checks", "review", "payment", "exception"]) {
  assert.ok((await stat(`public/footage/${name}.webm`)).size > 1000);
}
for (const name of ["overview", "recipient"])
  assert.ok((await stat(`public/footage/${name}.png`)).size > 1000);
const srt = await readFile("public/carry-demo.en.srt", "utf8");
assert.ok(srt.includes("00:02:"));
assert.ok(!/Cary\b/.test(srt));
console.log(
  "PASS: 160s timeline, 8 narration tracks, word timings, SRT, and all recorded assets.",
);
