import { useEffect, useState } from "react";
import { Mail, MessageCircle, RefreshCw, Check } from "lucide-react";
import { api } from "../lib/api";
import { timeAgo } from "../lib/format";

export default function AlertsView() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sweeping, setSweeping] = useState(false);

  async function load() {
    setLoading(true);
    setAlerts(await api.alerts());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function runSweep() {
    setSweeping(true);
    try {
      await api.alertsSweep();
      await load();
    } finally {
      setSweeping(false);
    }
  }

  async function ack(id) {
    await api.ackAlert(id);
    load();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
        <div>
          <h2 style={titleStyle}>Breach alerts</h2>
          <p style={subStyle}>
            The TAT model scans every live order, scores breach risk from order history and current
            stage, and notifies the team by email and WhatsApp before SLA is missed.
          </p>
        </div>
        <button onClick={runSweep} disabled={sweeping} style={sweepBtn}>
          <RefreshCw size={14} className={sweeping ? "spin" : ""} />
          {sweeping ? "Scanning…" : "Run prediction sweep"}
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, color: "var(--slate)" }}>Loading alerts…</div>
      ) : alerts.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--slate)", background: "var(--paper-raised)", borderRadius: "var(--radius-md)", border: "1px solid var(--line-soft)" }}>
          No alerts yet. Run a prediction sweep to scan live orders for breach risk.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {alerts.map((a) => (
            <div key={a.id} style={{
              display: "flex", gap: 14, padding: "14px 18px", borderRadius: "var(--radius-md)",
              background: "var(--paper-raised)", border: "1px solid var(--line-soft)",
              opacity: a.acknowledged ? 0.55 : 1,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                background: a.channel === "email" ? "var(--accent-soft)" : "#DCEEE6", flexShrink: 0,
              }}>
                {a.channel === "email" ? <Mail size={15} color="var(--accent)" /> : <MessageCircle size={15} color="var(--accent)" />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 13.5 }}>{a.order_code}</span>
                  <span style={{ fontSize: 11.5, color: "var(--slate-soft)" }}>{timeAgo(a.sent_at)}</span>
                </div>
                <div style={{
                  fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em",
                  color: a.alert_type === "breached" ? "var(--risk-breach)" : "var(--risk-track)", margin: "3px 0",
                }}>
                  {a.alert_type.replace("_", " ")} · risk {(a.risk_score * 100).toFixed(0)}% · via {a.channel}
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-soft)", whiteSpace: "pre-line" }}>{a.message}</div>
              </div>
              {!a.acknowledged && (
                <button onClick={() => ack(a.id)} title="Acknowledge" style={ackBtn}>
                  <Check size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

const titleStyle = { fontFamily: "var(--font-display)", fontSize: 20, margin: 0, fontWeight: 600 };
const subStyle = { fontSize: 13.5, color: "var(--slate)", marginTop: 4, maxWidth: 560 };
const sweepBtn = {
  display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 8,
  border: "1px solid var(--accent)", background: "var(--accent-soft)", color: "var(--accent)",
  fontWeight: 600, fontSize: 13,
};
const ackBtn = {
  alignSelf: "flex-start", background: "none", border: "1px solid var(--line)",
  borderRadius: 6, padding: 6, color: "var(--slate)",
};
