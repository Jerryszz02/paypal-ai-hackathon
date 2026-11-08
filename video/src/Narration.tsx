// Word timings transcribed locally from the generated narration with Whisper small.en.
import { Audio } from "@remotion/media";
import { Sequence, staticFile, useVideoConfig } from "remotion";
import { BasicCaptions } from "./basic-captions.element";

export const Voice1 = () => {
  const { fps } = useVideoConfig();
  return (
    <Sequence
      name="Scene 1 voice and captions"
      from={0.65 * fps}
      premountFor={fps}
    >
      <Audio
        name="English narration 1"
        src={staticFile("voiceover/scene-1.mp3")}
        playbackRate={0.93}
        premountFor={fps}
      />
      <BasicCaptions
        name="English captions 1"
        premountFor={fps}
        width={3000}
        combineTokensWithinMilliseconds={2200}
        style={{
          position: "absolute",
          left: 135,
          top: 949,
          scale: 0.55,
          transformOrigin: "top left",
        }}
        captions={[
          {
            text: "A",
            startMs: 172.04301075268816,
            endMs: 473.1182795698924,
            timestampMs: 322.5806451612903,
            confidence: null,
          },
          {
            text: " receipt",
            startMs: 473.1182795698924,
            endMs: 752.6881720430107,
            timestampMs: 612.9032258064516,
            confidence: null,
          },
          {
            text: " is",
            startMs: 752.6881720430107,
            endMs: 1096.774193548387,
            timestampMs: 924.7311827956988,
            confidence: null,
          },
          {
            text: " only",
            startMs: 1096.774193548387,
            endMs: 1333.3333333333333,
            timestampMs: 1215.0537634408602,
            confidence: null,
          },
          {
            text: " the",
            startMs: 1333.3333333333333,
            endMs: 1655.9139784946235,
            timestampMs: 1494.6236559139784,
            confidence: null,
          },
          {
            text: " start",
            startMs: 1655.9139784946235,
            endMs: 1913.9784946236557,
            timestampMs: 1784.9462365591396,
            confidence: null,
          },
          {
            text: " of",
            startMs: 1913.9784946236557,
            endMs: 2021.505376344086,
            timestampMs: 1967.741935483871,
            confidence: null,
          },
          {
            text: " a",
            startMs: 2021.505376344086,
            endMs: 2559.1397849462364,
            timestampMs: 2290.322580645161,
            confidence: null,
          },
          {
            text: " reimbursement.",
            startMs: 2559.1397849462364,
            endMs: 3290.322580645161,
            timestampMs: 2924.7311827956987,
            confidence: null,
          },
          {
            text: " Small",
            startMs: 3677.4193548387093,
            endMs: 4064.516129032258,
            timestampMs: 3870.9677419354834,
            confidence: null,
          },
          {
            text: " teams",
            startMs: 4064.516129032258,
            endMs: 4430.10752688172,
            timestampMs: 4247.311827956989,
            confidence: null,
          },
          {
            text: " still",
            startMs: 4430.10752688172,
            endMs: 4623.655913978494,
            timestampMs: 4526.881720430108,
            confidence: null,
          },
          {
            text: " need",
            startMs: 4623.655913978494,
            endMs: 4795.698924731182,
            timestampMs: 4709.677419354838,
            confidence: null,
          },
          {
            text: " to",
            startMs: 4795.698924731182,
            endMs: 4989.247311827957,
            timestampMs: 4892.4731182795695,
            confidence: null,
          },
          {
            text: " check",
            startMs: 4989.247311827957,
            endMs: 5161.290322580645,
            timestampMs: 5075.268817204301,
            confidence: null,
          },
          {
            text: " the",
            startMs: 5161.290322580645,
            endMs: 5591.397849462365,
            timestampMs: 5376.344086021505,
            confidence: null,
          },
          {
            text: " evidence,",
            startMs: 5591.397849462365,
            endMs: 6107.52688172043,
            timestampMs: 5849.462365591397,
            confidence: null,
          },
          {
            text: " apply",
            startMs: 6365.591397849462,
            endMs: 6537.63440860215,
            timestampMs: 6451.612903225806,
            confidence: null,
          },
          {
            text: " their",
            startMs: 6537.63440860215,
            endMs: 7032.258064516129,
            timestampMs: 6784.94623655914,
            confidence: null,
          },
          {
            text: " policy,",
            startMs: 7032.258064516129,
            endMs: 7440.860215053763,
            timestampMs: 7236.559139784946,
            confidence: null,
          },
          {
            text: " approve",
            startMs: 7827.956989247312,
            endMs: 8043.010752688172,
            timestampMs: 7935.4838709677415,
            confidence: null,
          },
          {
            text: " the",
            startMs: 8043.010752688172,
            endMs: 8451.612903225807,
            timestampMs: 8247.311827956988,
            confidence: null,
          },
          {
            text: " expense,",
            startMs: 8451.612903225807,
            endMs: 8903.225806451612,
            timestampMs: 8677.419354838708,
            confidence: null,
          },
          {
            text: " and",
            startMs: 9247.311827956988,
            endMs: 9483.870967741936,
            timestampMs: 9365.591397849463,
            confidence: null,
          },
          {
            text: " track",
            startMs: 9483.870967741936,
            endMs: 9698.924731182795,
            timestampMs: 9591.397849462364,
            confidence: null,
          },
          {
            text: " the",
            startMs: 9698.924731182795,
            endMs: 10043.010752688171,
            timestampMs: 9870.967741935483,
            confidence: null,
          },
          {
            text: " payment.",
            startMs: 10043.010752688171,
            endMs: 10172.043010752688,
            timestampMs: 10107.526881720429,
            confidence: null,
          },
        ]}
      />
    </Sequence>
  );
};

export const Voice2 = () => {
  const { fps } = useVideoConfig();
  return (
    <Sequence
      name="Scene 2 voice and captions"
      from={0.18 * fps}
      premountFor={fps}
    >
      <Audio
        name="English narration 2"
        src={staticFile("voiceover/scene-2.mp3")}
        playbackRate={1}
        premountFor={fps}
      />
      <BasicCaptions
        name="English captions 2"
        premountFor={fps}
        width={3000}
        combineTokensWithinMilliseconds={2200}
        style={{
          position: "absolute",
          left: 135,
          top: 949,
          scale: 0.55,
          transformOrigin: "top left",
        }}
        captions={[
          {
            text: "Carry",
            startMs: 240,
            endMs: 620,
            timestampMs: 430,
            confidence: null,
          },
          {
            text: " brings",
            startMs: 620,
            endMs: 880,
            timestampMs: 750,
            confidence: null,
          },
          {
            text: " those",
            startMs: 880,
            endMs: 1180,
            timestampMs: 1030,
            confidence: null,
          },
          {
            text: " steps",
            startMs: 1180,
            endMs: 1500,
            timestampMs: 1340,
            confidence: null,
          },
          {
            text: " into",
            startMs: 1500,
            endMs: 1820,
            timestampMs: 1660,
            confidence: null,
          },
          {
            text: " one",
            startMs: 1820,
            endMs: 2140,
            timestampMs: 1980,
            confidence: null,
          },
          {
            text: " traceable",
            startMs: 2140,
            endMs: 2820,
            timestampMs: 2480,
            confidence: null,
          },
          {
            text: " workflow.",
            startMs: 2820,
            endMs: 3400,
            timestampMs: 3110,
            confidence: null,
          },
          {
            text: " This",
            startMs: 3600,
            endMs: 3840,
            timestampMs: 3720,
            confidence: null,
          },
          {
            text: " walkthrough",
            startMs: 3840,
            endMs: 4740,
            timestampMs: 4290,
            confidence: null,
          },
          {
            text: " uses",
            startMs: 4740,
            endMs: 5300,
            timestampMs: 5020,
            confidence: null,
          },
          {
            text: " synthetic",
            startMs: 5300,
            endMs: 5820,
            timestampMs: 5560,
            confidence: null,
          },
          {
            text: " receipts",
            startMs: 5820,
            endMs: 6240,
            timestampMs: 6030,
            confidence: null,
          },
          {
            text: " and",
            startMs: 6440,
            endMs: 7040,
            timestampMs: 6740,
            confidence: null,
          },
          {
            text: " simulated",
            startMs: 7040,
            endMs: 7740,
            timestampMs: 7390,
            confidence: null,
          },
          {
            text: " extraction",
            startMs: 7740,
            endMs: 8000,
            timestampMs: 7870,
            confidence: null,
          },
          {
            text: " and",
            startMs: 8000,
            endMs: 8360,
            timestampMs: 8180,
            confidence: null,
          },
          {
            text: " payments",
            startMs: 8360,
            endMs: 8780,
            timestampMs: 8570,
            confidence: null,
          },
          {
            text: " so",
            startMs: 8960,
            endMs: 9160,
            timestampMs: 9060,
            confidence: null,
          },
          {
            text: " you",
            startMs: 9160,
            endMs: 9320,
            timestampMs: 9240,
            confidence: null,
          },
          {
            text: " can",
            startMs: 9320,
            endMs: 9800,
            timestampMs: 9560,
            confidence: null,
          },
          {
            text: " explore",
            startMs: 9800,
            endMs: 9960,
            timestampMs: 9880,
            confidence: null,
          },
          {
            text: " the",
            startMs: 9960,
            endMs: 10280,
            timestampMs: 10120,
            confidence: null,
          },
          {
            text: " working",
            startMs: 10280,
            endMs: 10820,
            timestampMs: 10550,
            confidence: null,
          },
          {
            text: " application",
            startMs: 10820,
            endMs: 11160,
            timestampMs: 10990,
            confidence: null,
          },
          {
            text: " without",
            startMs: 11520,
            endMs: 12020,
            timestampMs: 11770,
            confidence: null,
          },
          {
            text: " credentials.",
            startMs: 12020,
            endMs: 12456,
            timestampMs: 12238,
            confidence: null,
          },
        ]}
      />
    </Sequence>
  );
};

export const Voice3 = () => {
  const { fps } = useVideoConfig();
  return (
    <Sequence
      name="Scene 3 voice and captions"
      from={0.65 * fps}
      premountFor={fps}
    >
      <Audio
        name="English narration 3"
        src={staticFile("voiceover/scene-3.mp3")}
        playbackRate={0.9}
        premountFor={fps}
      />
      <BasicCaptions
        name="English captions 3"
        premountFor={fps}
        width={3000}
        combineTokensWithinMilliseconds={2200}
        style={{
          position: "absolute",
          left: 135,
          top: 949,
          scale: 0.55,
          transformOrigin: "top left",
        }}
        captions={[
          {
            text: "Alex",
            startMs: 355.55555555555554,
            endMs: 600,
            timestampMs: 477.77777777777777,
            confidence: null,
          },
          {
            text: " submits",
            startMs: 600,
            endMs: 955.5555555555555,
            timestampMs: 777.7777777777777,
            confidence: null,
          },
          {
            text: " a",
            startMs: 955.5555555555555,
            endMs: 1266.6666666666667,
            timestampMs: 1111.111111111111,
            confidence: null,
          },
          {
            text: " travel",
            startMs: 1266.6666666666667,
            endMs: 1733.3333333333333,
            timestampMs: 1500,
            confidence: null,
          },
          {
            text: " expense.",
            startMs: 1733.3333333333333,
            endMs: 2400,
            timestampMs: 2066.6666666666665,
            confidence: null,
          },
          {
            text: " The",
            startMs: 2533.3333333333335,
            endMs: 2866.6666666666665,
            timestampMs: 2700,
            confidence: null,
          },
          {
            text: " receipt",
            startMs: 2866.6666666666665,
            endMs: 3333.333333333333,
            timestampMs: 3100,
            confidence: null,
          },
          {
            text: " stays",
            startMs: 3333.333333333333,
            endMs: 3977.777777777778,
            timestampMs: 3655.5555555555557,
            confidence: null,
          },
          {
            text: " beside",
            startMs: 3977.777777777778,
            endMs: 4288.888888888889,
            timestampMs: 4133.333333333333,
            confidence: null,
          },
          {
            text: " its",
            startMs: 4288.888888888889,
            endMs: 4800,
            timestampMs: 4544.444444444444,
            confidence: null,
          },
          {
            text: " extracted",
            startMs: 4800,
            endMs: 5444.444444444444,
            timestampMs: 5122.222222222222,
            confidence: null,
          },
          {
            text: " details,",
            startMs: 5444.444444444444,
            endMs: 5933.333333333333,
            timestampMs: 5688.888888888889,
            confidence: null,
          },
          {
            text: " making",
            startMs: 6088.888888888889,
            endMs: 6333.333333333333,
            timestampMs: 6211.111111111111,
            confidence: null,
          },
          {
            text: " the",
            startMs: 6333.333333333333,
            endMs: 6800,
            timestampMs: 6566.666666666666,
            confidence: null,
          },
          {
            text: " evidence",
            startMs: 6800,
            endMs: 7177.777777777777,
            timestampMs: 6988.888888888889,
            confidence: null,
          },
          {
            text: " easy",
            startMs: 7177.777777777777,
            endMs: 7488.888888888889,
            timestampMs: 7333.333333333333,
            confidence: null,
          },
          {
            text: " to",
            startMs: 7488.888888888889,
            endMs: 7911.111111111111,
            timestampMs: 7700,
            confidence: null,
          },
          {
            text: " inspect.",
            startMs: 7911.111111111111,
            endMs: 8688.888888888889,
            timestampMs: 8300,
            confidence: null,
          },
          {
            text: " Alex",
            startMs: 9066.666666666666,
            endMs: 9488.888888888889,
            timestampMs: 9277.777777777777,
            confidence: null,
          },
          {
            text: " reviews",
            startMs: 9488.888888888889,
            endMs: 9755.555555555555,
            timestampMs: 9622.222222222223,
            confidence: null,
          },
          {
            text: " the",
            startMs: 9755.555555555555,
            endMs: 10155.555555555555,
            timestampMs: 9955.555555555555,
            confidence: null,
          },
          {
            text: " amount,",
            startMs: 10155.555555555555,
            endMs: 10622.222222222223,
            timestampMs: 10388.888888888889,
            confidence: null,
          },
          {
            text: " confirms",
            startMs: 11066.666666666666,
            endMs: 11333.333333333334,
            timestampMs: 11200,
            confidence: null,
          },
          {
            text: " the",
            startMs: 11333.333333333334,
            endMs: 11777.777777777777,
            timestampMs: 11555.555555555555,
            confidence: null,
          },
          {
            text: " expense",
            startMs: 11777.777777777777,
            endMs: 12088.888888888889,
            timestampMs: 11933.333333333334,
            confidence: null,
          },
          {
            text: " and",
            startMs: 12088.888888888889,
            endMs: 12400,
            timestampMs: 12244.444444444443,
            confidence: null,
          },
          {
            text: " payment",
            startMs: 12400,
            endMs: 12888.888888888889,
            timestampMs: 12644.444444444443,
            confidence: null,
          },
          {
            text: " evidence,",
            startMs: 12888.888888888889,
            endMs: 13377.777777777777,
            timestampMs: 13133.333333333332,
            confidence: null,
          },
          {
            text: " and",
            startMs: 13577.777777777777,
            endMs: 13777.777777777777,
            timestampMs: 13677.777777777777,
            confidence: null,
          },
          {
            text: " submits",
            startMs: 13777.777777777777,
            endMs: 14222.222222222223,
            timestampMs: 14000,
            confidence: null,
          },
          {
            text: " the",
            startMs: 14222.222222222223,
            endMs: 14533.333333333332,
            timestampMs: 14377.777777777777,
            confidence: null,
          },
          {
            text: " claim.",
            startMs: 14533.333333333332,
            endMs: 15200,
            timestampMs: 14866.666666666666,
            confidence: null,
          },
          {
            text: " The",
            startMs: 15377.777777777777,
            endMs: 15911.111111111111,
            timestampMs: 15644.444444444443,
            confidence: null,
          },
          {
            text: " reimbursement",
            startMs: 15911.111111111111,
            endMs: 16466.666666666668,
            timestampMs: 16188.888888888889,
            confidence: null,
          },
          {
            text: " recipient",
            startMs: 16466.666666666668,
            endMs: 16866.666666666668,
            timestampMs: 16666.666666666668,
            confidence: null,
          },
          {
            text: " is",
            startMs: 16866.666666666668,
            endMs: 17288.888888888887,
            timestampMs: 17077.777777777777,
            confidence: null,
          },
          {
            text: " confirmed",
            startMs: 17288.888888888887,
            endMs: 17777.777777777777,
            timestampMs: 17533.333333333332,
            confidence: null,
          },
          {
            text: " separately",
            startMs: 17777.777777777777,
            endMs: 18133.333333333332,
            timestampMs: 17955.555555555555,
            confidence: null,
          },
          {
            text: " in",
            startMs: 18133.333333333332,
            endMs: 18288.888888888887,
            timestampMs: 18211.11111111111,
            confidence: null,
          },
          {
            text: " their",
            startMs: 18288.888888888887,
            endMs: 18755.555555555555,
            timestampMs: 18522.222222222223,
            confidence: null,
          },
          {
            text: " profile.",
            startMs: 18755.555555555555,
            endMs: 18933.333333333332,
            timestampMs: 18844.444444444445,
            confidence: null,
          },
        ]}
      />
    </Sequence>
  );
};

export const Voice4 = () => {
  const { fps } = useVideoConfig();
  return (
    <Sequence
      name="Scene 4 voice and captions"
      from={0.65 * fps}
      premountFor={fps}
    >
      <Audio
        name="English narration 4"
        src={staticFile("voiceover/scene-4.mp3")}
        playbackRate={0.92}
        premountFor={fps}
      />
      <BasicCaptions
        name="English captions 4"
        premountFor={fps}
        width={3000}
        combineTokensWithinMilliseconds={2200}
        style={{
          position: "absolute",
          left: 135,
          top: 949,
          scale: 0.55,
          transformOrigin: "top left",
        }}
        captions={[
          {
            text: "Carry",
            startMs: 239.1304347826087,
            endMs: 630.4347826086956,
            timestampMs: 434.78260869565213,
            confidence: null,
          },
          {
            text: " checks",
            startMs: 630.4347826086956,
            endMs: 891.3043478260869,
            timestampMs: 760.8695652173913,
            confidence: null,
          },
          {
            text: " the",
            startMs: 891.3043478260869,
            endMs: 1108.695652173913,
            timestampMs: 1000,
            confidence: null,
          },
          {
            text: " claim",
            startMs: 1108.695652173913,
            endMs: 1456.5217391304348,
            timestampMs: 1282.6086956521738,
            confidence: null,
          },
          {
            text: " against",
            startMs: 1456.5217391304348,
            endMs: 2000,
            timestampMs: 1728.2608695652173,
            confidence: null,
          },
          {
            text: " explicit",
            startMs: 2000,
            endMs: 2673.9130434782605,
            timestampMs: 2336.9565217391305,
            confidence: null,
          },
          {
            text: " reimbursement",
            startMs: 2673.9130434782605,
            endMs: 3326.086956521739,
            timestampMs: 3000,
            confidence: null,
          },
          {
            text: " rules.",
            startMs: 3326.086956521739,
            endMs: 4021.7391304347825,
            timestampMs: 3673.9130434782605,
            confidence: null,
          },
          {
            text: " Missing",
            startMs: 4413.043478260869,
            endMs: 4891.304347826087,
            timestampMs: 4652.173913043478,
            confidence: null,
          },
          {
            text: " evidence",
            startMs: 4891.304347826087,
            endMs: 5195.652173913043,
            timestampMs: 5043.478260869565,
            confidence: null,
          },
          {
            text: " and",
            startMs: 5195.652173913043,
            endMs: 5652.173913043478,
            timestampMs: 5423.913043478261,
            confidence: null,
          },
          {
            text: " policy",
            startMs: 5652.173913043478,
            endMs: 6152.173913043478,
            timestampMs: 5902.173913043478,
            confidence: null,
          },
          {
            text: " exceptions",
            startMs: 6152.173913043478,
            endMs: 6695.652173913043,
            timestampMs: 6423.913043478261,
            confidence: null,
          },
          {
            text: " remain",
            startMs: 6695.652173913043,
            endMs: 7217.391304347826,
            timestampMs: 6956.521739130434,
            confidence: null,
          },
          {
            text: " visible",
            startMs: 7217.391304347826,
            endMs: 7456.521739130434,
            timestampMs: 7336.95652173913,
            confidence: null,
          },
          {
            text: " with",
            startMs: 7652.173913043478,
            endMs: 8130.434782608695,
            timestampMs: 7891.304347826087,
            confidence: null,
          },
          {
            text: " reasons",
            startMs: 8130.434782608695,
            endMs: 8456.521739130434,
            timestampMs: 8293.478260869564,
            confidence: null,
          },
          {
            text: " the",
            startMs: 8456.521739130434,
            endMs: 8847.826086956522,
            timestampMs: 8652.173913043478,
            confidence: null,
          },
          {
            text: " applicant",
            startMs: 8847.826086956522,
            endMs: 9152.173913043478,
            timestampMs: 9000,
            confidence: null,
          },
          {
            text: " and",
            startMs: 9152.173913043478,
            endMs: 9456.521739130434,
            timestampMs: 9304.347826086956,
            confidence: null,
          },
          {
            text: " reviewer",
            startMs: 9456.521739130434,
            endMs: 9782.608695652174,
            timestampMs: 9619.565217391304,
            confidence: null,
          },
          {
            text: " can",
            startMs: 9782.608695652174,
            endMs: 10282.608695652174,
            timestampMs: 10032.608695652174,
            confidence: null,
          },
          {
            text: " inspect.",
            startMs: 10282.608695652174,
            endMs: 11152.173913043478,
            timestampMs: 10717.391304347826,
            confidence: null,
          },
          {
            text: " AI",
            startMs: 11413.04347826087,
            endMs: 11913.043478260868,
            timestampMs: 11663.04347826087,
            confidence: null,
          },
          {
            text: " output",
            startMs: 11913.043478260868,
            endMs: 12152.173913043478,
            timestampMs: 12032.608695652174,
            confidence: null,
          },
          {
            text: " is",
            startMs: 12152.173913043478,
            endMs: 12434.782608695652,
            timestampMs: 12293.478260869564,
            confidence: null,
          },
          {
            text: " treated",
            startMs: 12434.782608695652,
            endMs: 12717.391304347826,
            timestampMs: 12576.086956521738,
            confidence: null,
          },
          {
            text: " as",
            startMs: 12717.391304347826,
            endMs: 13130.434782608696,
            timestampMs: 12923.91304347826,
            confidence: null,
          },
          {
            text: " evidence",
            startMs: 13130.434782608696,
            endMs: 13413.043478260868,
            timestampMs: 13271.739130434782,
            confidence: null,
          },
          {
            text: " to",
            startMs: 13413.043478260868,
            endMs: 13891.304347826086,
            timestampMs: 13652.173913043478,
            confidence: null,
          },
          {
            text: " confirm.",
            startMs: 13891.304347826086,
            endMs: 14478.260869565216,
            timestampMs: 14184.782608695652,
            confidence: null,
          },
          {
            text: " Deterministic",
            startMs: 14695.652173913042,
            endMs: 15826.086956521738,
            timestampMs: 15260.86956521739,
            confidence: null,
          },
          {
            text: " application",
            startMs: 15826.086956521738,
            endMs: 16456.521739130432,
            timestampMs: 16141.304347826086,
            confidence: null,
          },
          {
            text: " rules",
            startMs: 16456.521739130432,
            endMs: 16956.521739130432,
            timestampMs: 16706.521739130432,
            confidence: null,
          },
          {
            text: " control",
            startMs: 16956.521739130432,
            endMs: 17347.82608695652,
            timestampMs: 17152.173913043476,
            confidence: null,
          },
          {
            text: " routing.",
            startMs: 17347.82608695652,
            endMs: 17717.391304347824,
            timestampMs: 17532.608695652172,
            confidence: null,
          },
        ]}
      />
    </Sequence>
  );
};

export const Voice5 = () => {
  const { fps } = useVideoConfig();
  return (
    <Sequence
      name="Scene 5 voice and captions"
      from={0.65 * fps}
      premountFor={fps}
    >
      <Audio
        name="English narration 5"
        src={staticFile("voiceover/scene-5.mp3")}
        playbackRate={0.9}
        premountFor={fps}
      />
      <BasicCaptions
        name="English captions 5"
        premountFor={fps}
        width={3000}
        combineTokensWithinMilliseconds={2200}
        style={{
          position: "absolute",
          left: 135,
          top: 949,
          scale: 0.55,
          transformOrigin: "top left",
        }}
        captions={[
          {
            text: "Morgan,",
            startMs: 488.88888888888886,
            endMs: 711.1111111111111,
            timestampMs: 600,
            confidence: null,
          },
          {
            text: " the",
            startMs: 800,
            endMs: 1177.7777777777778,
            timestampMs: 988.8888888888889,
            confidence: null,
          },
          {
            text: " finance",
            startMs: 1177.7777777777778,
            endMs: 1644.4444444444443,
            timestampMs: 1411.111111111111,
            confidence: null,
          },
          {
            text: " reviewer,",
            startMs: 1644.4444444444443,
            endMs: 2044.4444444444443,
            timestampMs: 1844.4444444444443,
            confidence: null,
          },
          {
            text: " checks",
            startMs: 2311.111111111111,
            endMs: 2577.777777777778,
            timestampMs: 2444.4444444444443,
            confidence: null,
          },
          {
            text: " the",
            startMs: 2577.777777777778,
            endMs: 2911.111111111111,
            timestampMs: 2744.4444444444443,
            confidence: null,
          },
          {
            text: " original",
            startMs: 2911.111111111111,
            endMs: 3444.4444444444443,
            timestampMs: 3177.777777777778,
            confidence: null,
          },
          {
            text: " receipt",
            startMs: 3444.4444444444443,
            endMs: 4022.222222222222,
            timestampMs: 3733.333333333333,
            confidence: null,
          },
          {
            text: " and",
            startMs: 4022.222222222222,
            endMs: 4422.222222222222,
            timestampMs: 4222.222222222222,
            confidence: null,
          },
          {
            text: " records",
            startMs: 4422.222222222222,
            endMs: 4666.666666666667,
            timestampMs: 4544.444444444444,
            confidence: null,
          },
          {
            text: " an",
            startMs: 4666.666666666667,
            endMs: 5066.666666666667,
            timestampMs: 4866.666666666667,
            confidence: null,
          },
          {
            text: " approval",
            startMs: 5066.666666666667,
            endMs: 5600,
            timestampMs: 5333.333333333333,
            confidence: null,
          },
          {
            text: " reason.",
            startMs: 5600,
            endMs: 6133.333333333333,
            timestampMs: 5866.666666666667,
            confidence: null,
          },
          {
            text: " That",
            startMs: 6311.111111111111,
            endMs: 6644.444444444444,
            timestampMs: 6477.777777777777,
            confidence: null,
          },
          {
            text: " approval",
            startMs: 6644.444444444444,
            endMs: 7355.555555555556,
            timestampMs: 7000,
            confidence: null,
          },
          {
            text: " belongs",
            startMs: 7355.555555555556,
            endMs: 7688.888888888889,
            timestampMs: 7522.222222222222,
            confidence: null,
          },
          {
            text: " to",
            startMs: 7688.888888888889,
            endMs: 7977.777777777777,
            timestampMs: 7833.333333333333,
            confidence: null,
          },
          {
            text: " this",
            startMs: 7977.777777777777,
            endMs: 8244.444444444443,
            timestampMs: 8111.111111111111,
            confidence: null,
          },
          {
            text: " claim",
            startMs: 8244.444444444443,
            endMs: 8733.333333333334,
            timestampMs: 8488.888888888889,
            confidence: null,
          },
          {
            text: " version,",
            startMs: 8733.333333333334,
            endMs: 9044.444444444443,
            timestampMs: 8888.888888888889,
            confidence: null,
          },
          {
            text: " amount,",
            startMs: 9422.222222222223,
            endMs: 9711.111111111111,
            timestampMs: 9566.666666666666,
            confidence: null,
          },
          {
            text: " policy,",
            startMs: 10111.111111111111,
            endMs: 10466.666666666666,
            timestampMs: 10288.888888888889,
            confidence: null,
          },
          {
            text: " and",
            startMs: 10533.333333333334,
            endMs: 10977.777777777777,
            timestampMs: 10755.555555555555,
            confidence: null,
          },
          {
            text: " recipient.",
            startMs: 10977.777777777777,
            endMs: 11688.888888888889,
            timestampMs: 11333.333333333334,
            confidence: null,
          },
          {
            text: " The",
            startMs: 11866.666666666666,
            endMs: 12200,
            timestampMs: 12033.333333333334,
            confidence: null,
          },
          {
            text: " decision",
            startMs: 12200,
            endMs: 12755.555555555555,
            timestampMs: 12477.777777777777,
            confidence: null,
          },
          {
            text: " history",
            startMs: 12755.555555555555,
            endMs: 13244.444444444443,
            timestampMs: 13000,
            confidence: null,
          },
          {
            text: " preserves",
            startMs: 13244.444444444443,
            endMs: 13644.444444444443,
            timestampMs: 13444.444444444443,
            confidence: null,
          },
          {
            text: " what",
            startMs: 13644.444444444443,
            endMs: 13844.444444444443,
            timestampMs: 13744.444444444443,
            confidence: null,
          },
          {
            text: " was",
            startMs: 13844.444444444443,
            endMs: 14355.555555555555,
            timestampMs: 14100,
            confidence: null,
          },
          {
            text: " reviewed",
            startMs: 14355.555555555555,
            endMs: 14955.555555555555,
            timestampMs: 14655.555555555555,
            confidence: null,
          },
          {
            text: " and",
            startMs: 14955.555555555555,
            endMs: 15244.444444444443,
            timestampMs: 15100,
            confidence: null,
          },
          {
            text: " why",
            startMs: 15244.444444444443,
            endMs: 15400,
            timestampMs: 15322.222222222223,
            confidence: null,
          },
          {
            text: " it",
            startMs: 15400,
            endMs: 15533.333333333332,
            timestampMs: 15466.666666666666,
            confidence: null,
          },
          {
            text: " was",
            startMs: 15533.333333333332,
            endMs: 15955.555555555555,
            timestampMs: 15744.444444444443,
            confidence: null,
          },
          {
            text: " approved.",
            startMs: 15955.555555555555,
            endMs: 16177.777777777777,
            timestampMs: 16066.666666666666,
            confidence: null,
          },
        ]}
      />
    </Sequence>
  );
};

export const Voice6 = () => {
  const { fps } = useVideoConfig();
  return (
    <Sequence
      name="Scene 6 voice and captions"
      from={0.65 * fps}
      premountFor={fps}
    >
      <Audio
        name="English narration 6"
        src={staticFile("voiceover/scene-6.mp3")}
        playbackRate={0.92}
        premountFor={fps}
      />
      <BasicCaptions
        name="English captions 6"
        premountFor={fps}
        width={3000}
        combineTokensWithinMilliseconds={2200}
        style={{
          position: "absolute",
          left: 135,
          top: 949,
          scale: 0.55,
          transformOrigin: "top left",
        }}
        captions={[
          {
            text: "Approval",
            startMs: 347.82608695652175,
            endMs: 717.391304347826,
            timestampMs: 532.6086956521739,
            confidence: null,
          },
          {
            text: " and",
            startMs: 717.391304347826,
            endMs: 978.2608695652174,
            timestampMs: 847.8260869565217,
            confidence: null,
          },
          {
            text: " payment",
            startMs: 978.2608695652174,
            endMs: 1434.782608695652,
            timestampMs: 1206.5217391304348,
            confidence: null,
          },
          {
            text: " are",
            startMs: 1434.782608695652,
            endMs: 1804.3478260869565,
            timestampMs: 1619.5652173913043,
            confidence: null,
          },
          {
            text: " separate",
            startMs: 1804.3478260869565,
            endMs: 2326.086956521739,
            timestampMs: 2065.2173913043475,
            confidence: null,
          },
          {
            text: " steps.",
            startMs: 2326.086956521739,
            endMs: 2826.086956521739,
            timestampMs: 2576.086956521739,
            confidence: null,
          },
          {
            text: " Morgan",
            startMs: 3195.6521739130435,
            endMs: 3782.6086956521735,
            timestampMs: 3489.1304347826085,
            confidence: null,
          },
          {
            text: " confirms",
            startMs: 3782.6086956521735,
            endMs: 4108.695652173913,
            timestampMs: 3945.6521739130435,
            confidence: null,
          },
          {
            text: " the",
            startMs: 4108.695652173913,
            endMs: 4456.521739130435,
            timestampMs: 4282.608695652174,
            confidence: null,
          },
          {
            text: " exact",
            startMs: 4456.521739130435,
            endMs: 4869.565217391304,
            timestampMs: 4663.043478260869,
            confidence: null,
          },
          {
            text: " amount",
            startMs: 4869.565217391304,
            endMs: 5260.869565217391,
            timestampMs: 5065.217391304348,
            confidence: null,
          },
          {
            text: " and",
            startMs: 5260.869565217391,
            endMs: 5695.652173913043,
            timestampMs: 5478.260869565217,
            confidence: null,
          },
          {
            text: " recipient",
            startMs: 5695.652173913043,
            endMs: 6195.652173913043,
            timestampMs: 5945.652173913043,
            confidence: null,
          },
          {
            text: " before",
            startMs: 6195.652173913043,
            endMs: 6652.173913043478,
            timestampMs: 6423.913043478261,
            confidence: null,
          },
          {
            text: " starting",
            startMs: 6652.173913043478,
            endMs: 6847.826086956521,
            timestampMs: 6750,
            confidence: null,
          },
          {
            text: " the",
            startMs: 6847.826086956521,
            endMs: 7282.608695652174,
            timestampMs: 7065.217391304347,
            confidence: null,
          },
          {
            text: " simulated",
            startMs: 7282.608695652174,
            endMs: 7760.869565217391,
            timestampMs: 7521.739130434782,
            confidence: null,
          },
          {
            text: " payment.",
            startMs: 7760.869565217391,
            endMs: 8695.652173913044,
            timestampMs: 8228.260869565216,
            confidence: null,
          },
          {
            text: " Processing",
            startMs: 9173.91304347826,
            endMs: 9586.95652173913,
            timestampMs: 9380.434782608696,
            confidence: null,
          },
          {
            text: " does",
            startMs: 9586.95652173913,
            endMs: 9869.565217391304,
            timestampMs: 9728.260869565216,
            confidence: null,
          },
          {
            text: " not",
            startMs: 9869.565217391304,
            endMs: 10173.91304347826,
            timestampMs: 10021.739130434782,
            confidence: null,
          },
          {
            text: " mean",
            startMs: 10173.91304347826,
            endMs: 10521.739130434782,
            timestampMs: 10347.826086956522,
            confidence: null,
          },
          {
            text: " paid.",
            startMs: 10521.739130434782,
            endMs: 11086.95652173913,
            timestampMs: 10804.347826086956,
            confidence: null,
          },
          {
            text: " Carry",
            startMs: 11391.304347826086,
            endMs: 11826.086956521738,
            timestampMs: 11608.695652173912,
            confidence: null,
          },
          {
            text: " synchronizes",
            startMs: 11826.086956521738,
            endMs: 12434.782608695652,
            timestampMs: 12130.434782608696,
            confidence: null,
          },
          {
            text: " the",
            startMs: 12434.782608695652,
            endMs: 12934.782608695652,
            timestampMs: 12684.782608695652,
            confidence: null,
          },
          {
            text: " individual",
            startMs: 12934.782608695652,
            endMs: 13304.347826086956,
            timestampMs: 13119.565217391304,
            confidence: null,
          },
          {
            text: " payment",
            startMs: 13304.347826086956,
            endMs: 13804.347826086956,
            timestampMs: 13554.347826086956,
            confidence: null,
          },
          {
            text: " result",
            startMs: 13804.347826086956,
            endMs: 14260.86956521739,
            timestampMs: 14032.608695652174,
            confidence: null,
          },
          {
            text: " before",
            startMs: 14260.86956521739,
            endMs: 14739.130434782608,
            timestampMs: 14500,
            confidence: null,
          },
          {
            text: " updating",
            startMs: 14739.130434782608,
            endMs: 15021.739130434782,
            timestampMs: 14880.434782608694,
            confidence: null,
          },
          {
            text: " its",
            startMs: 15021.739130434782,
            endMs: 15434.782608695652,
            timestampMs: 15228.260869565216,
            confidence: null,
          },
          {
            text: " status.",
            startMs: 15434.782608695652,
            endMs: 16173.91304347826,
            timestampMs: 15804.347826086956,
            confidence: null,
          },
          {
            text: " The",
            startMs: 16369.565217391304,
            endMs: 16826.08695652174,
            timestampMs: 16597.82608695652,
            confidence: null,
          },
          {
            text: " implemented",
            startMs: 16826.08695652174,
            endMs: 17369.565217391304,
            timestampMs: 17097.82608695652,
            confidence: null,
          },
          {
            text: " PayPal",
            startMs: 17369.565217391304,
            endMs: 17717.391304347824,
            timestampMs: 17543.478260869564,
            confidence: null,
          },
          {
            text: " Sandbox",
            startMs: 17717.391304347824,
            endMs: 18586.95652173913,
            timestampMs: 18152.173913043476,
            confidence: null,
          },
          {
            text: " adapter",
            startMs: 18586.95652173913,
            endMs: 19239.130434782608,
            timestampMs: 18913.043478260868,
            confidence: null,
          },
          {
            text: " follows",
            startMs: 19239.130434782608,
            endMs: 19586.95652173913,
            timestampMs: 19413.043478260868,
            confidence: null,
          },
          {
            text: " this",
            startMs: 19586.95652173913,
            endMs: 19891.304347826088,
            timestampMs: 19739.130434782608,
            confidence: null,
          },
          {
            text: " payment",
            startMs: 19891.304347826088,
            endMs: 20304.347826086956,
            timestampMs: 20097.82608695652,
            confidence: null,
          },
          {
            text: " intent",
            startMs: 20304.347826086956,
            endMs: 20630.434782608696,
            timestampMs: 20467.391304347824,
            confidence: null,
          },
          {
            text: " and",
            startMs: 20630.434782608696,
            endMs: 21152.173913043476,
            timestampMs: 20891.304347826084,
            confidence: null,
          },
          {
            text: " reconciliation",
            startMs: 21152.173913043476,
            endMs: 21869.565217391304,
            timestampMs: 21510.869565217392,
            confidence: null,
          },
          {
            text: " flow.",
            startMs: 21869.565217391304,
            endMs: 21956.521739130432,
            timestampMs: 21913.043478260868,
            confidence: null,
          },
        ]}
      />
    </Sequence>
  );
};

export const Voice7 = () => {
  const { fps } = useVideoConfig();
  return (
    <Sequence
      name="Scene 7 voice and captions"
      from={0.65 * fps}
      premountFor={fps}
    >
      <Audio
        name="English narration 7"
        src={staticFile("voiceover/scene-7.mp3")}
        playbackRate={0.9}
        premountFor={fps}
      />
      <BasicCaptions
        name="English captions 7"
        premountFor={fps}
        width={3000}
        combineTokensWithinMilliseconds={2200}
        style={{
          position: "absolute",
          left: 135,
          top: 949,
          scale: 0.55,
          transformOrigin: "top left",
        }}
        captions={[
          {
            text: "Now",
            startMs: 266.6666666666667,
            endMs: 622.2222222222222,
            timestampMs: 444.44444444444446,
            confidence: null,
          },
          {
            text: " consider",
            startMs: 622.2222222222222,
            endMs: 1377.7777777777778,
            timestampMs: 1000,
            confidence: null,
          },
          {
            text: " a",
            startMs: 1377.7777777777778,
            endMs: 1377.7777777777778,
            timestampMs: 1377.7777777777778,
            confidence: null,
          },
          {
            text: " blurry,",
            startMs: 1377.7777777777778,
            endMs: 1644.4444444444443,
            timestampMs: 1511.111111111111,
            confidence: null,
          },
          {
            text: " 420",
            startMs: 2622.222222222222,
            endMs: 3000,
            timestampMs: 2811.111111111111,
            confidence: null,
          },
          {
            text: "-pound",
            startMs: 3000,
            endMs: 3511.111111111111,
            timestampMs: 3255.5555555555557,
            confidence: null,
          },
          {
            text: " receipt.",
            startMs: 3511.111111111111,
            endMs: 3933.333333333333,
            timestampMs: 3722.222222222222,
            confidence: null,
          },
          {
            text: " Carry",
            startMs: 4288.888888888889,
            endMs: 4866.666666666667,
            timestampMs: 4577.777777777777,
            confidence: null,
          },
          {
            text: " requests",
            startMs: 4866.666666666667,
            endMs: 5333.333333333333,
            timestampMs: 5100,
            confidence: null,
          },
          {
            text: " better",
            startMs: 5333.333333333333,
            endMs: 5888.888888888889,
            timestampMs: 5611.111111111111,
            confidence: null,
          },
          {
            text: " evidence.",
            startMs: 5888.888888888889,
            endMs: 6844.444444444444,
            timestampMs: 6366.666666666666,
            confidence: null,
          },
          {
            text: " A",
            startMs: 7111.111111111111,
            endMs: 7444.444444444444,
            timestampMs: 7277.777777777777,
            confidence: null,
          },
          {
            text: " clearer",
            startMs: 7444.444444444444,
            endMs: 8200,
            timestampMs: 7822.222222222222,
            confidence: null,
          },
          {
            text: " replacement",
            startMs: 8200,
            endMs: 8666.666666666666,
            timestampMs: 8433.333333333334,
            confidence: null,
          },
          {
            text: " resolves",
            startMs: 8666.666666666666,
            endMs: 8955.555555555555,
            timestampMs: 8811.111111111111,
            confidence: null,
          },
          {
            text: " the",
            startMs: 8955.555555555555,
            endMs: 9266.666666666666,
            timestampMs: 9111.111111111111,
            confidence: null,
          },
          {
            text: " evidence",
            startMs: 9266.666666666666,
            endMs: 9733.333333333334,
            timestampMs: 9500,
            confidence: null,
          },
          {
            text: " issue,",
            startMs: 9733.333333333334,
            endMs: 10044.444444444443,
            timestampMs: 9888.888888888889,
            confidence: null,
          },
          {
            text: " but",
            startMs: 10266.666666666666,
            endMs: 10400,
            timestampMs: 10333.333333333334,
            confidence: null,
          },
          {
            text: " the",
            startMs: 10400,
            endMs: 10800,
            timestampMs: 10600,
            confidence: null,
          },
          {
            text: " expense",
            startMs: 10800,
            endMs: 11177.777777777777,
            timestampMs: 10988.888888888889,
            confidence: null,
          },
          {
            text: " still",
            startMs: 11177.777777777777,
            endMs: 11600,
            timestampMs: 11388.888888888889,
            confidence: null,
          },
          {
            text: " exceeds",
            startMs: 11600,
            endMs: 11844.444444444443,
            timestampMs: 11722.222222222223,
            confidence: null,
          },
          {
            text: " the",
            startMs: 11844.444444444443,
            endMs: 12177.777777777777,
            timestampMs: 12011.111111111111,
            confidence: null,
          },
          {
            text: " example",
            startMs: 12177.777777777777,
            endMs: 12755.555555555555,
            timestampMs: 12466.666666666666,
            confidence: null,
          },
          {
            text: " policy",
            startMs: 12755.555555555555,
            endMs: 13133.333333333332,
            timestampMs: 12944.444444444443,
            confidence: null,
          },
          {
            text: " limit",
            startMs: 13133.333333333332,
            endMs: 13488.888888888889,
            timestampMs: 13311.111111111111,
            confidence: null,
          },
          {
            text: " and",
            startMs: 13711.111111111111,
            endMs: 14177.777777777777,
            timestampMs: 13944.444444444443,
            confidence: null,
          },
          {
            text: " requires",
            startMs: 14177.777777777777,
            endMs: 14733.333333333332,
            timestampMs: 14455.555555555555,
            confidence: null,
          },
          {
            text: " finance",
            startMs: 14733.333333333332,
            endMs: 15222.222222222223,
            timestampMs: 14977.777777777777,
            confidence: null,
          },
          {
            text: " review.",
            startMs: 15222.222222222223,
            endMs: 15977.777777777777,
            timestampMs: 15600,
            confidence: null,
          },
          {
            text: " Better",
            startMs: 16244.444444444443,
            endMs: 16733.333333333332,
            timestampMs: 16488.888888888887,
            confidence: null,
          },
          {
            text: " evidence",
            startMs: 16733.333333333332,
            endMs: 17044.444444444445,
            timestampMs: 16888.888888888887,
            confidence: null,
          },
          {
            text: " does",
            startMs: 17044.444444444445,
            endMs: 17333.333333333332,
            timestampMs: 17188.888888888887,
            confidence: null,
          },
          {
            text: " not",
            startMs: 17333.333333333332,
            endMs: 17755.555555555555,
            timestampMs: 17544.444444444445,
            confidence: null,
          },
          {
            text: " remove",
            startMs: 17755.555555555555,
            endMs: 17977.777777777777,
            timestampMs: 17866.666666666668,
            confidence: null,
          },
          {
            text: " the",
            startMs: 17977.777777777777,
            endMs: 18488.888888888887,
            timestampMs: 18233.333333333332,
            confidence: null,
          },
          {
            text: " policy",
            startMs: 18488.888888888887,
            endMs: 18955.555555555555,
            timestampMs: 18722.222222222223,
            confidence: null,
          },
          {
            text: " exception.",
            startMs: 18955.555555555555,
            endMs: 19466.666666666668,
            timestampMs: 19211.11111111111,
            confidence: null,
          },
        ]}
      />
    </Sequence>
  );
};

export const Voice8 = () => {
  const { fps } = useVideoConfig();
  return (
    <Sequence
      name="Scene 8 voice and captions"
      from={0.65 * fps}
      premountFor={fps}
    >
      <Audio
        name="English narration 8"
        src={staticFile("voiceover/scene-8.mp3")}
        playbackRate={0.96}
        premountFor={fps}
      />
      <BasicCaptions
        name="English captions 8"
        premountFor={fps}
        width={3000}
        combineTokensWithinMilliseconds={2200}
        style={{
          position: "absolute",
          left: 135,
          top: 949,
          scale: 0.55,
          transformOrigin: "top left",
        }}
        captions={[
          {
            text: "Carry",
            startMs: 229.16666666666669,
            endMs: 833.3333333333334,
            timestampMs: 531.25,
            confidence: null,
          },
          {
            text: " combines",
            startMs: 833.3333333333334,
            endMs: 1229.1666666666667,
            timestampMs: 1031.25,
            confidence: null,
          },
          {
            text: " receipt",
            startMs: 1229.1666666666667,
            endMs: 1645.8333333333335,
            timestampMs: 1437.5,
            confidence: null,
          },
          {
            text: " evidence,",
            startMs: 1645.8333333333335,
            endMs: 2125,
            timestampMs: 1885.4166666666667,
            confidence: null,
          },
          {
            text: " explicit",
            startMs: 2458.3333333333335,
            endMs: 2979.166666666667,
            timestampMs: 2718.75,
            confidence: null,
          },
          {
            text: " rules,",
            startMs: 2979.166666666667,
            endMs: 3416.666666666667,
            timestampMs: 3197.916666666667,
            confidence: null,
          },
          {
            text: " human",
            startMs: 3562.5,
            endMs: 4041.666666666667,
            timestampMs: 3802.0833333333335,
            confidence: null,
          },
          {
            text: " review,",
            startMs: 4041.666666666667,
            endMs: 4458.333333333334,
            timestampMs: 4250,
            confidence: null,
          },
          {
            text: " and",
            startMs: 4604.166666666667,
            endMs: 4875,
            timestampMs: 4739.583333333334,
            confidence: null,
          },
          {
            text: " payment",
            startMs: 4875,
            endMs: 5333.333333333334,
            timestampMs: 5104.166666666667,
            confidence: null,
          },
          {
            text: " tracking.",
            startMs: 5333.333333333334,
            endMs: 5937.5,
            timestampMs: 5635.416666666667,
            confidence: null,
          },
          {
            text: " Real",
            startMs: 6187.5,
            endMs: 6520.833333333334,
            timestampMs: 6354.166666666667,
            confidence: null,
          },
          {
            text: " AI",
            startMs: 6520.833333333334,
            endMs: 6937.5,
            timestampMs: 6729.166666666667,
            confidence: null,
          },
          {
            text: " calls",
            startMs: 6937.5,
            endMs: 7270.833333333334,
            timestampMs: 7104.166666666667,
            confidence: null,
          },
          {
            text: " and",
            startMs: 7270.833333333334,
            endMs: 7604.166666666667,
            timestampMs: 7437.5,
            confidence: null,
          },
          {
            text: " PayPal",
            startMs: 7604.166666666667,
            endMs: 8104.166666666667,
            timestampMs: 7854.166666666667,
            confidence: null,
          },
          {
            text: " Sandbox",
            startMs: 8104.166666666667,
            endMs: 8895.833333333334,
            timestampMs: 8500,
            confidence: null,
          },
          {
            text: " transactions",
            startMs: 8895.833333333334,
            endMs: 8958.333333333334,
            timestampMs: 8927.083333333334,
            confidence: null,
          },
          {
            text: " remain",
            startMs: 9291.666666666668,
            endMs: 9520.833333333334,
            timestampMs: 9406.25,
            confidence: null,
          },
          {
            text: " to",
            startMs: 9520.833333333334,
            endMs: 9645.833333333334,
            timestampMs: 9583.333333333334,
            confidence: null,
          },
          {
            text: " be",
            startMs: 9645.833333333334,
            endMs: 10083.333333333334,
            timestampMs: 9864.583333333334,
            confidence: null,
          },
          {
            text: " verified.",
            startMs: 10083.333333333334,
            endMs: 10708.333333333334,
            timestampMs: 10395.833333333334,
            confidence: null,
          },
          {
            text: " The",
            startMs: 10812.5,
            endMs: 11125,
            timestampMs: 10968.75,
            confidence: null,
          },
          {
            text: " working",
            startMs: 11125,
            endMs: 11458.333333333334,
            timestampMs: 11291.666666666668,
            confidence: null,
          },
          {
            text: " local",
            startMs: 11458.333333333334,
            endMs: 11791.666666666668,
            timestampMs: 11625,
            confidence: null,
          },
          {
            text: " demo",
            startMs: 11791.666666666668,
            endMs: 12125,
            timestampMs: 11958.333333333334,
            confidence: null,
          },
          {
            text: " and",
            startMs: 12125,
            endMs: 12562.5,
            timestampMs: 12343.75,
            confidence: null,
          },
          {
            text: " MIT",
            startMs: 12562.5,
            endMs: 12875,
            timestampMs: 12718.75,
            confidence: null,
          },
          {
            text: " licensed",
            startMs: 12875,
            endMs: 13270.833333333334,
            timestampMs: 13072.916666666668,
            confidence: null,
          },
          {
            text: " source",
            startMs: 13270.833333333334,
            endMs: 13395.833333333334,
            timestampMs: 13333.333333333334,
            confidence: null,
          },
          {
            text: " are",
            startMs: 13541.666666666668,
            endMs: 13812.5,
            timestampMs: 13677.083333333334,
            confidence: null,
          },
          {
            text: " available",
            startMs: 13812.5,
            endMs: 14250,
            timestampMs: 14031.25,
            confidence: null,
          },
          {
            text: " today.",
            startMs: 14250,
            endMs: 14791.666666666668,
            timestampMs: 14520.833333333334,
            confidence: null,
          },
          {
            text: " Carry,",
            startMs: 15104.166666666668,
            endMs: 15354.166666666668,
            timestampMs: 15229.166666666668,
            confidence: null,
          },
          {
            text: " from",
            startMs: 15520.833333333334,
            endMs: 15875,
            timestampMs: 15697.916666666668,
            confidence: null,
          },
          {
            text: " receipt",
            startMs: 15875,
            endMs: 16125,
            timestampMs: 16000,
            confidence: null,
          },
          {
            text: " to",
            startMs: 16125,
            endMs: 16604.166666666668,
            timestampMs: 16364.583333333334,
            confidence: null,
          },
          {
            text: " reimbursement,",
            startMs: 16604.166666666668,
            endMs: 16916.666666666668,
            timestampMs: 16760.416666666668,
            confidence: null,
          },
          {
            text: " with",
            startMs: 17062.5,
            endMs: 17416.666666666668,
            timestampMs: 17239.583333333336,
            confidence: null,
          },
          {
            text: " every",
            startMs: 17416.666666666668,
            endMs: 17812.5,
            timestampMs: 17614.583333333336,
            confidence: null,
          },
          {
            text: " decision",
            startMs: 17812.5,
            endMs: 18375,
            timestampMs: 18093.75,
            confidence: null,
          },
          {
            text: " explained.",
            startMs: 18375,
            endMs: 18700,
            timestampMs: 18537.5,
            confidence: null,
          },
        ]}
      />
    </Sequence>
  );
};
