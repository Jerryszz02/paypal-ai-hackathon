import React from "react";
import {
  AbsoluteFill,
  CanvasImage,
  Easing,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Video } from "@remotion/media";

const ink = "#173340",
  teal = "#087f79",
  paper = "#f4f7f8",
  muted = "#62747f";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const font = "'Avenir Next', Avenir, Arial, sans-serif";

export const Mark = ({ size = 50 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
    <rect width="56" height="56" rx="15" fill={teal} />
    <path
      d="M18 13l4 3 6-3 6 3 4-3v30l-4-3-6 3-6-3-4 3V13Z"
      stroke="white"
      strokeWidth="2.5"
    />
    <path
      d="M23 22h10M23 28h10M23 34h7"
      stroke="white"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
);

export const SceneBase = ({
  children,
  dark = false,
}: {
  children: React.ReactNode;
  dark?: boolean;
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        fontFamily: font,
        background: dark ? ink : paper,
        color: dark ? "white" : ink,
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        style={{
          opacity: interpolate(
            frame,
            [0, 9, durationInFrames - 9, durationInFrames - 1],
            [0, 1, 1, 0],
            clamp,
          ),
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Header = ({ chapter, step }: { chapter: string; step: string }) => (
  <div
    style={{
      position: "absolute",
      left: 78,
      right: 78,
      top: 38,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <Mark size={44} />
      <span style={{ fontWeight: 800, fontSize: 42, letterSpacing: -2 }}>
        carry<span style={{ color: teal }}>.</span>
      </span>
      <span
        style={{ marginLeft: 20, fontSize: 24, color: muted, letterSpacing: 3 }}
      >
        {step} / {chapter.toUpperCase()}
      </span>
    </div>
    <div
      style={{
        fontSize: 22,
        color: teal,
        border: "1px solid #bddbd5",
        background: "#e7f3ef",
        padding: "11px 19px",
        borderRadius: 30,
      }}
    >
      LOCAL DEMO · SIMULATED AI & PAYMENTS
    </div>
  </div>
);

const Screen = ({
  file,
  rate = 1,
  still = false,
  zoom = 1,
}: {
  file: string;
  rate?: number;
  still?: boolean;
  zoom?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        left: 514,
        top: 137,
        width: 1328,
        height: 791,
        borderRadius: 17,
        overflow: "hidden",
        boxShadow: "0 22px 64px #1733401c",
        border: "1px solid #cfdce0",
        background: "white",
      }}
    >
      <div
        style={{
          height: 30,
          borderBottom: "1px solid #dfe8eb",
          display: "flex",
          alignItems: "center",
          gap: 8,
          paddingLeft: 16,
          background: "#fff",
        }}
      >
        <i
          style={{
            width: 8,
            height: 8,
            borderRadius: 8,
            background: "#d2dfe2",
          }}
        />
        <i
          style={{
            width: 8,
            height: 8,
            borderRadius: 8,
            background: "#d2dfe2",
          }}
        />
        <i
          style={{
            width: 8,
            height: 8,
            borderRadius: 8,
            background: "#d2dfe2",
          }}
        />
        <span style={{ fontSize: 14, color: muted, marginLeft: 14 }}>
          Carry / local working prototype
        </span>
      </div>
      <div style={{ height: 761, position: "relative", overflow: "hidden" }}>
        <div
          style={{
            width: 1440,
            height: 900,
            scale: interpolate(frame, [0, 2 * fps], [0.921, 0.921 * zoom], {
              ...clamp,
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            transformOrigin: "top left",
          }}
        >
          {still ? (
            <CanvasImage
              src={staticFile("footage/" + file)}
              premountFor={fps}
              style={{ width: 1440, height: 900 }}
            />
          ) : (
            <Video
              name={file}
              src={staticFile("footage/" + file)}
              playbackRate={rate}
              muted
              premountFor={fps}
              style={{ width: 1440, height: 900 }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

const Sidebar = ({
  eyebrow,
  title,
  amount,
  note,
  children,
  warning = false,
}: {
  eyebrow: string;
  title: string;
  amount?: string;
  note: string;
  children?: React.ReactNode;
  warning?: boolean;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        left: 78,
        top: 198,
        width: 396,
        opacity: interpolate(frame, [0, 0.6 * fps], [0, 1], clamp),
        translate: interpolate(
          frame,
          [0, 0.7 * fps],
          ["0px 26px", "0px 0px"],
          clamp,
        ),
      }}
    >
      <div
        style={{
          fontSize: 22,
          letterSpacing: 4,
          fontWeight: 600,
          color: warning ? "#a76718" : teal,
          marginBottom: 30,
        }}
      >
        {eyebrow}
      </div>
      <h1
        style={{
          fontSize: 65,
          lineHeight: 1.1,
          letterSpacing: -2.8,
          margin: 0,
          fontWeight: 650,
        }}
      >
        {title}
      </h1>
      {amount && (
        <div
          style={{
            fontSize: 96,
            fontWeight: 650,
            letterSpacing: -5,
            marginTop: 24,
            color: warning ? "#a76718" : teal,
          }}
        >
          {amount}
        </div>
      )}
      <div
        style={{
          width: 60,
          height: 4,
          background: warning ? "#a76718" : teal,
          marginTop: 34,
          marginBottom: 27,
        }}
      />
      <p style={{ fontSize: 29, lineHeight: 1.5, color: muted, margin: 0 }}>
        {note}
      </p>
      {children}
    </div>
  );
};

const Tag = ({
  children,
  warning = false,
}: {
  children: React.ReactNode;
  warning?: boolean;
}) => (
  <div
    style={{
      display: "inline-block",
      marginTop: 26,
      fontSize: 22,
      padding: "12px 16px",
      borderRadius: 10,
      color: warning ? "#915c1b" : teal,
      background: warning ? "#fbefdc" : "#e1efeb",
    }}
  >
    {children}
  </div>
);

export const Opening = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <SceneBase>
      <div
        style={{
          position: "absolute",
          left: 104,
          top: 100,
          display: "flex",
          alignItems: "center",
          gap: 24,
        }}
      >
        <Mark size={66} />
        <span style={{ fontSize: 66, fontWeight: 800, letterSpacing: -3 }}>
          carry<span style={{ color: teal }}>.</span>
        </span>
      </div>
      <div style={{ position: "absolute", left: 104, top: 263, width: 1060 }}>
        <div
          style={{
            color: teal,
            fontSize: 27,
            letterSpacing: 5,
            marginBottom: 26,
          }}
        >
          FOR SMALL TEAMS
        </div>
        <h1
          style={{
            fontSize: 112,
            lineHeight: 1.03,
            letterSpacing: -6,
            margin: 0,
            fontWeight: 650,
          }}
        >
          A receipt is
          <br />
          only the start.
        </h1>
        <p
          style={{
            fontSize: 37,
            lineHeight: 1.4,
            color: muted,
            marginTop: 36,
            width: 870,
          }}
        >
          Evidence. Policy. Approval. Payment.
          <br />
          One expense, a complete story.
        </p>
      </div>
      {["Receipt", "Policy checks", "Finance review", "Payment result"].map(
        (t, i) => (
          <div
            key={t}
            style={{
              position: "absolute",
              left: 1270 + (i % 2) * 32,
              top: 235 + i * 132,
              width: 440,
              height: 100,
              background: i === 3 ? teal : "white",
              color: i === 3 ? "white" : ink,
              border: "1px solid #dce8e9",
              borderRadius: 17,
              boxShadow: "0 15px 40px #17334010",
              display: "flex",
              alignItems: "center",
              gap: 25,
              padding: "0 28px",
              fontSize: 29,
              opacity: interpolate(
                f,
                [(0.7 + i * 0.9) * fps, (1.2 + i * 0.9) * fps],
                [0, 1],
                clamp,
              ),
              translate: interpolate(
                f,
                [(0.7 + i * 0.9) * fps, (1.2 + i * 0.9) * fps],
                ["35px 0px", "0px 0px"],
                clamp,
              ),
            }}
          >
            <span style={{ fontSize: 20, opacity: 0.6 }}>0{i + 1}</span>
            {t}
          </div>
        ),
      )}
      <div
        style={{
          position: "absolute",
          left: 104,
          bottom: 165,
          fontSize: 21,
          letterSpacing: 3,
          color: muted,
        }}
      >
        PAYPAL AI HACKATHON / WORKING PROTOTYPE
      </div>
    </SceneBase>
  );
};

export const Overview = () => (
  <SceneBase>
    <Header chapter="One workflow" step="01" />
    <Sidebar
      eyebrow="MEET CARRY"
      title="From receipt to reimbursement."
      note="Every step stays connected."
    >
      <Tag>Synthetic receipts · No money moves</Tag>
    </Sidebar>
    <Screen file="overview.png" still />
    <div
      style={{
        position: "absolute",
        left: 78,
        top: 835,
        fontSize: 24,
        color: muted,
      }}
    >
      A credential-free local demo.
    </div>
  </SceneBase>
);

export const Applicant = () => {
  const { fps } = useVideoConfig();
  return (
    <SceneBase>
      <Header chapter="Applicant" step="02" />
      <Sidebar
        eyebrow="ALEX / TEAM MEMBER"
        title="Start with the evidence."
        amount="£23.80"
        note="Inspect the source. Confirm the details. Submit the claim."
      >
        <Tag>Recipient confirmed separately</Tag>
      </Sidebar>
      <Screen file="applicant.webm" rate={0.91} />
      <Sequence
        name="Separate recipient profile"
        from={18 * fps}
        durationInFrames={6 * fps}
        premountFor={fps}
      >
        <div
          style={{
            position: "absolute",
            left: 75,
            top: 707,
            width: 408,
            height: 204,
            borderRadius: 12,
            overflow: "hidden",
            border: "2px solid #90c4ba",
            background: "white",
          }}
        >
          <CanvasImage
            src={staticFile("footage/recipient.png")}
            premountFor={fps}
            style={{
              position: "absolute",
              width: 1080,
              height: 675,
              left: -198,
              top: -168,
            }}
          />
        </div>
      </Sequence>
    </SceneBase>
  );
};

export const Checks = () => (
  <SceneBase>
    <Header chapter="Policy checks" step="03" />
    <Sidebar
      eyebrow="EXPLAINABLE ROUTING"
      title="Clear checks. Visible reasons."
      note="Evidence is confirmed. Application rules determine the next step."
    >
      <Tag>Automatic payments: disabled</Tag>
    </Sidebar>
    <Screen file="checks.webm" rate={1} />
  </SceneBase>
);

export const Review = () => (
  <SceneBase>
    <Header chapter="Finance review" step="04" />
    <Sidebar
      eyebrow="MORGAN / FINANCE"
      title="A decision with a reason."
      note="Approval is bound to the reviewed version, amount and recipient."
    >
      <Tag>Review history preserved</Tag>
    </Sidebar>
    <Screen file="review.webm" rate={0.89} />
  </SceneBase>
);

export const Payment = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <SceneBase>
      <Header chapter="Payment tracking" step="05" />
      <Sidebar
        eyebrow="APPROVAL ≠ PAYMENT"
        title="Track the result."
        amount="£23.80"
        note="Confirm the amount and recipient. Synchronize the individual result."
      >
        <Tag>Simulated payment · No money moved</Tag>
        <div
          style={{ marginTop: 30, fontSize: 28, fontWeight: 600, color: teal }}
        >
          {f < 15 * fps ? "Processing → result check" : "Processing → Paid"}
        </div>
      </Sidebar>
      <Screen file="payment.webm" rate={0.84} />
    </SceneBase>
  );
};

export const Exception = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <SceneBase>
      <Header chapter="Exceptions" step="06" />
      <Sidebar
        eyebrow="WHEN EVIDENCE IS UNCLEAR"
        title="Better evidence. Same policy."
        amount="£420"
        note="A clear replacement still exceeds the £50 example limit."
        warning
      >
        <Tag warning>
          {f < 10 * fps
            ? "Request better evidence"
            : "Finance review still required"}
        </Tag>
      </Sidebar>
      <Screen file="exception.webm" rate={0.82} />
    </SceneBase>
  );
};

export const Closing = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <SceneBase dark>
      <div
        style={{
          position: "absolute",
          left: 104,
          top: 86,
          display: "flex",
          alignItems: "center",
          gap: 24,
        }}
      >
        <Mark size={64} />
        <span style={{ fontSize: 68, fontWeight: 800, letterSpacing: -3 }}>
          carry.
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 104,
          top: 212,
          fontSize: 82,
          lineHeight: 1.1,
          letterSpacing: -3,
          fontWeight: 600,
        }}
      >
        From receipt to reimbursement.
        <br />
        <span style={{ color: "#8ed8c4" }}>Every decision explained.</span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 104,
          top: 467,
          display: "flex",
          gap: 22,
        }}
      >
        {[
          ["01", "Receipt evidence", "AI adapter"],
          ["02", "Rules + review", "Application controls"],
          ["03", "Payment tracking", "PayPal Sandbox adapter"],
        ].map(([n, t, s], i) => (
          <div
            key={t}
            style={{
              width: 550,
              border: "1px solid #ffffff30",
              borderRadius: 17,
              padding: "27px 32px",
              background: "#ffffff06",
              opacity: interpolate(
                f,
                [i * 0.3 * fps, (i * 0.3 + 0.5) * fps],
                [0, 1],
                clamp,
              ),
            }}
          >
            <div style={{ fontSize: 22, color: "#8ed8c4", marginBottom: 16 }}>
              {n}
            </div>
            <div style={{ fontSize: 34, fontWeight: 600 }}>{t}</div>
            <div style={{ fontSize: 24, color: "#b4c8ce", marginTop: 12 }}>
              {s}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          left: 104,
          top: 721,
          fontSize: 26,
          color: "#ffdfaa",
        }}
      >
        Real AI calls and PayPal Sandbox transactions remain to be verified.
      </div>
      <div
        style={{
          position: "absolute",
          left: 104,
          top: 819,
          fontSize: 29,
          color: "white",
        }}
      >
        github.com/Jerryszz02/paypal-ai-hackathon
      </div>
      <div
        style={{
          position: "absolute",
          left: 104,
          top: 865,
          fontSize: 22,
          color: "#b4c8ce",
        }}
      >
        Working local demo · MIT-licensed source · English setup instructions
      </div>
    </SceneBase>
  );
};
