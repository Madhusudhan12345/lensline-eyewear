import { bandColor } from "../lib/format";

/**
 * LensDial — the signature visual element: a circular progress ring styled
 * after an optometrist's trial lens / diopter dial, used everywhere we show
 * "how far through fulfilment is this order" instead of a generic progress bar.
 */
export default function LensDial({ progress = 0, band = "on_track", size = 56, strokeWidth = 5, children }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(1, Math.max(0, progress)));
  const color = bandColor(band);

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--line-soft)" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease, stroke 0.3s ease" }}
        />
        {/* tick marks, like a lens dial's diopter gradations */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i / 12) * 2 * Math.PI;
          const r1 = radius + strokeWidth / 2 + 1;
          const r2 = radius + strokeWidth / 2 + 3;
          const x1 = size / 2 + r1 * Math.cos(angle);
          const y1 = size / 2 + r1 * Math.sin(angle);
          const x2 = size / 2 + r2 * Math.cos(angle);
          const y2 = size / 2 + r2 * Math.sin(angle);
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="var(--line)" strokeWidth="1" />
          );
        })}
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex",
        alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-mono)", fontSize: size * 0.24, color: "var(--ink)",
        fontWeight: 500,
      }}>
        {children !== undefined ? children : `${Math.round(progress * 100)}`}
      </div>
    </div>
  );
}
