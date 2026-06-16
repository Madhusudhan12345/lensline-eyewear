import { bandColor, bandSoftColor, bandLabel } from "../lib/format";

export default function StatusBadge({ band, size = "md" }) {
  const pad = size === "sm" ? "3px 8px" : "4px 11px";
  const fontSize = size === "sm" ? "11px" : "12.5px";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: pad, borderRadius: 99, fontSize,
      fontFamily: "var(--font-mono)", fontWeight: 500,
      background: bandSoftColor(band), color: bandColor(band),
      whiteSpace: "nowrap",
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: bandColor(band), flexShrink: 0,
      }} />
      {bandLabel(band)}
    </span>
  );
}
