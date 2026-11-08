# Carry demonstration video

An English, 160-second, 1920×1080 / 30 fps Remotion composition for the PayPal AI Hackathon. The user approved the storyboard on 2026-11-08. `CarryDemo` is the complete video; the eight scenes are also registered separately for visual editing.

## Preview and export

This is an independent package. Installing it does not change the application's dependencies.

```sh
cd video
npm ci
npm run dev
```

Open http://localhost:3210/CarryDemo. The recordings and narration are included, so the application does not need to be running. Playback makes no AI or payment API calls.

```sh
npm run lint
npm run verify
npm run build
npm run render
```

The export is `out/carry-demo.mp4` (H.264, yuv420p, AAC audio). English subtitles are burned in; `public/carry-demo.en.srt` is also supplied for YouTube's selectable caption track. Generated exports and bundles are ignored by Git.

## Storyboard

| Time        | Scene                       | Evidence shown                                                                               |
| ----------- | --------------------------- | -------------------------------------------------------------------------------------------- |
| 00:00–00:12 | A receipt is only the start | Original motion graphics explain the workflow                                                |
| 00:12–00:25 | Meet Carry                  | Actual local claim list and explicit simulation label                                        |
| 00:25–00:50 | Applicant                   | Alex confirms and submits a synthetic £23.80 receipt; separately confirmed recipient profile |
| 00:50–01:10 | Checks                      | Actual policy findings with original PDF evidence                                            |
| 01:10–01:32 | Finance review              | Morgan records a reason and approves the reviewed version                                    |
| 01:32–01:57 | Payment tracking            | Simulated payment confirmation, Processing, synchronization and Paid result                  |
| 01:57–02:20 | Exceptions                  | Unreadable £420 total requests information; clear replacement still requires finance review  |
| 02:20–02:40 | Architecture and status     | Implemented adapter boundaries, pending real-service acceptance and source URL               |

The script is in `public/narration.json`. Word timings were transcribed locally with Whisper `small.en`, then product names were corrected. To regenerate the editable caption nodes and SRT after changing timings:

```sh
npm run captions
```

`scripts/transcribe.mjs` can recreate word timings on a machine with supported WebGPU. It downloads the local English model on first use; it does not send the recordings to a transcription service. The committed caption files are sufficient for ordinary preview and export. The generated `src/Narration.tsx` intentionally keeps each caption array inline for the Remotion caption editor. Keep its audio offsets/rates and `scripts/prepare-captions.mjs` consistent when editing.

## Asset provenance and recording

- All browser footage and screenshots were captured from Carry's actual local demo on 2026-11-08, based on application commit `9c6889e`. Five separate WebM clips were recorded in Chrome at 1440×900 / 30 fps; presentation playback is slowed slightly in selected scenes. Only Next.js's development-tools overlay was hidden.
- Demo data is isolated in this task's `.local/video-demo` directory. The captured people, email (`alex@example.test`), receipts and payments are synthetic. No existing user claims or credentials were recorded.
- English narration was generated from the approved original script using the connected AI Voice Generator / AI Doc Maker service, `clear` voice. The eight complete short narration segments are stored locally; no credentials or expiring download URLs are needed to render.
- All title cards, diagrams and the receipt mark are original vector/HTML artwork derived from Carry's design. No stock footage, background music or externally sourced logos were added. Text uses locally available Avenir/Arial fallbacks; no system font binaries are redistributed.
- `src/basic-captions.element.tsx` was copied from Remotion's [Basic Captions element](https://www.remotion.dev/elements/captions/basic-captions/) without functional changes. Other dependencies keep their respective licenses.

For a fresh capture, start exactly one Carry demo server on `127.0.0.1:3107`, with a new `LOCAL_DATA_DIR`; never share a live PGlite directory with another process. From this `video` directory open a named Chrome session with `playwright-cli`, sign in as Alex, separately confirm `alex@example.test`, and navigate to `/claims/new`. Run `scripts/capture-workflow.js` through `playwright-cli run-code --filename=...`. The script uses observed UI controls and verifies the reconciled simulated Paid state. For the exception clip, sign in as Alex, create a new claim, select **Blurry · £420**, then run `scripts/capture-exception.js`; it verifies **Above the automatic limit** after replacement. Recording paths resolve relative to the directory in which that named browser session was first opened.

## Submission boundary

This is a local-workflow demonstration, not proof of real model extraction or PayPal Sandbox transactions. Those integration gates remain unverified in the application evidence. The film labels simulated AI/payments throughout and states this limitation in the closing narration and card. Replace those parts with accepted real-service footage before presenting the video as a verified integration demo. Creating this video does not upload to YouTube, publish a release, or submit the Devpost entry.

Official video requirements were checked on 2026-11-08: less than three minutes, footage of the functioning project, and a publicly visible YouTube link. See the [competition requirements](https://paypalaihackathon.devpost.com/) and [Official Rules](https://paypalaihackathon.devpost.com/rules).
