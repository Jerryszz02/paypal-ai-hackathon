import {
  AbsoluteFill,
  Series,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  Applicant,
  Checks,
  Closing,
  Exception,
  Opening,
  Overview,
  Payment,
  Review,
} from "./Scenes";
import {
  Voice1,
  Voice2,
  Voice3,
  Voice4,
  Voice5,
  Voice6,
  Voice7,
  Voice8,
} from "./Narration";

export const CarryVideo = () => {
  const { fps, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#f4f7f8" }}>
      <Series>
        <Series.Sequence
          name="A receipt is only the start"
          durationInFrames={12 * fps}
          premountFor={fps}
        >
          <Opening />
          <Voice1 />
        </Series.Sequence>
        <Series.Sequence
          name="Meet Carry"
          durationInFrames={13 * fps}
          premountFor={fps}
        >
          <Overview />
          <Voice2 />
        </Series.Sequence>
        <Series.Sequence
          name="Alex submits £23.80"
          durationInFrames={25 * fps}
          premountFor={fps}
        >
          <Applicant />
          <Voice3 />
        </Series.Sequence>
        <Series.Sequence
          name="Explainable policy checks"
          durationInFrames={20 * fps}
          premountFor={fps}
        >
          <Checks />
          <Voice4 />
        </Series.Sequence>
        <Series.Sequence
          name="Morgan reviews and approves"
          durationInFrames={22 * fps}
          premountFor={fps}
        >
          <Review />
          <Voice5 />
        </Series.Sequence>
        <Series.Sequence
          name="Simulated payment and reconciliation"
          durationInFrames={25 * fps}
          premountFor={fps}
        >
          <Payment />
          <Voice6 />
        </Series.Sequence>
        <Series.Sequence
          name="Blurry receipt and policy exception"
          durationInFrames={23 * fps}
          premountFor={fps}
        >
          <Exception />
          <Voice7 />
        </Series.Sequence>
        <Series.Sequence
          name="Architecture and current status"
          durationInFrames={20 * fps}
          premountFor={fps}
        >
          <Closing />
          <Voice8 />
        </Series.Sequence>
      </Series>
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: 5,
          width: (1920 * (frame + 1)) / durationInFrames,
          background: "#087f79",
        }}
      />
    </AbsoluteFill>
  );
};
