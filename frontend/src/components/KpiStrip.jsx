export default function KpiStrip({ summary }) {
  if (!summary) return null;
  const { status_counts, live_order_count, historical_on_time_rate_pct, model_trained_on_n } = summary;

  const items = [
    { label: "Live orders", value: live_order_count, mono: true },
    { label: "On track", value: status_counts.on_track, color: "var(--accent)" },
    { label: "At risk", value: status_counts.at_risk, color: "var(--risk-track)" },
    { label: "Breached", value: status_counts.breached, color: "var(--risk-breach)" },
    {
      label: "Historical on-time rate",
      value: historical_on_time_rate_pct !== null ? `${historical_on_time_rate_pct}%` : "—",
      sub: `from ${model_trained_on_n} past orders`,
    },
  ];

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 1,
      background: "var(--line)", border: "1px solid var(--line)",
      borderRadius: "var(--radius-md)", overflow: "hidden",
    }}>
      {items.map((it, i) => (
        <div key={i} style={{ background: "var(--paper-raised)", padding: "16px 20px" }}>
          <div style={{
            fontSize: 11, color: "var(--slate-soft)", textTransform: "uppercase",
            letterSpacing: "0.04em", marginBottom: 6, fontFamily: "var(--font-body)", fontWeight: 600,
          }}>
            {it.label}
          </div>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 26, fontWeight: 500,
            color: it.color || "var(--ink)",
          }}>
            {it.value}
          </div>
          {it.sub && (
            <div style={{ fontSize: 11, color: "var(--slate-soft)", marginTop: 2 }}>{it.sub}</div>
          )}
        </div>
      ))}
    </div>
  );
}
