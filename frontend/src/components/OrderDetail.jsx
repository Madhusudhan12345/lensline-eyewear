import { useEffect, useState } from "react";
import { X, ArrowRight, RotateCcw, AlertTriangle } from "lucide-react";
import LensDial from "./LensDial";
import StatusBadge from "./StatusBadge";
import { STAGE_LABELS, LENS_TYPE_LABELS, stageProgress, formatHours, formatDate } from "../lib/format";
import { api } from "../lib/api";

const DELAY_REASONS = [
  "Supplier delay on lens blank",
  "Power not in stock, sourced externally",
  "Machine downtime at lab",
  "Awaiting frame from vendor",
  "Customer unreachable for confirmation",
  "Courier pickup delayed",
  "Other",
];

export default function OrderDetail({ orderId, stages, onClose, onUpdated }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [delayReason, setDelayReason] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const data = await api.orderDetail(orderId);
    setOrder(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, [orderId]);

  if (loading || !order) {
    return (
      <Backdrop onClose={onClose}>
        <div style={{ padding: 40, color: "var(--slate)" }}>Loading order…</div>
      </Backdrop>
    );
  }

  const idx = stages.indexOf(order.current_stage);
  const nextStage = idx >= 0 && idx < stages.length - 1 ? stages[idx + 1] : null;
  const progress = stageProgress(order.current_stage, stages);

  async function advance(toStage, qcFailed = false) {
    setBusy(true);
    try {
      await api.updateStage(order.id, {
        to_stage: toStage,
        delay_reason: delayReason || null,
        notes: notes || null,
        changed_by: "ops_team",
        qc_failed: qcFailed,
      });
      setDelayReason("");
      setNotes("");
      await load();
      onUpdated?.();
    } finally {
      setBusy(false);
    }
  }

  async function handleQcFail() {
    setBusy(true);
    try {
      await api.reorder(order.id);
      await load();
      onUpdated?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Backdrop onClose={onClose}>
      <div style={{ padding: "28px 32px", borderBottom: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <LensDial progress={progress} band={order.status} size={64} strokeWidth={5} />
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 500 }}>{order.order_code}</div>
            <div style={{ color: "var(--slate)", fontSize: 14, marginTop: 2 }}>{order.customer_name} · {order.customer_phone}</div>
            <div style={{ marginTop: 8 }}><StatusBadge band={order.status} /></div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", padding: 6, borderRadius: 6 }}>
          <X size={20} color="var(--slate)" />
        </button>
      </div>

      <div style={{ padding: "24px 32px", display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 32 }}>
        <div>
          <SectionLabel>Order specification</SectionLabel>
          <SpecGrid order={order} />

          <SectionLabel style={{ marginTop: 28 }}>Fulfilment timeline</SectionLabel>
          <div style={{ marginTop: 10 }}>
            {(order.stage_logs || []).map((log, i) => (
              <div key={i} style={{ display: "flex", gap: 12, fontSize: 13, padding: "7px 0", borderBottom: "1px dashed var(--line-soft)" }}>
                <div style={{ fontFamily: "var(--font-mono)", color: "var(--slate-soft)", minWidth: 110 }}>
                  {formatDate(log.timestamp)}
                </div>
                <div style={{ flex: 1 }}>
                  {log.from_stage ? (
                    <span>{STAGE_LABELS[log.from_stage] || log.from_stage} <ArrowRight size={11} style={{ display: "inline", verticalAlign: "middle" }} /> {STAGE_LABELS[log.to_stage] || log.to_stage}</span>
                  ) : (
                    <span>{STAGE_LABELS[log.to_stage] || log.to_stage}</span>
                  )}
                  {log.delay_reason && (
                    <div style={{ color: "var(--risk-track)", fontSize: 12, marginTop: 2 }}>⚠ {log.delay_reason}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionLabel>Update status</SectionLabel>
          {order.current_stage === "delivered" || order.current_stage === "cancelled" ? (
            <div style={{ marginTop: 10, fontSize: 13, color: "var(--slate)" }}>
              This order is {STAGE_LABELS[order.current_stage].toLowerCase()}. No further action needed.
            </div>
          ) : (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={{ fontSize: 12, color: "var(--slate)" }}>Delay reason (optional)</label>
              <select value={delayReason} onChange={(e) => setDelayReason(e.target.value)} style={selectStyle}>
                <option value="">No delay — on schedule</option>
                {DELAY_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <label style={{ fontSize: 12, color: "var(--slate)", marginTop: 4 }}>Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={textareaStyle} placeholder="Optional context for the next person handling this order" />

              {nextStage && (
                <button disabled={busy} onClick={() => advance(nextStage)} style={primaryBtn}>
                  Move to {STAGE_LABELS[nextStage]} <ArrowRight size={15} />
                </button>
              )}

              {order.current_stage === "quality_check" && (
                <button disabled={busy} onClick={handleQcFail} style={dangerBtn}>
                  <RotateCcw size={15} /> Fail QC — send to re-order
                </button>
              )}
            </div>
          )}

          <SectionLabel style={{ marginTop: 28 }}>AI breach prediction</SectionLabel>
          <PredictionPanel orderId={order.id} riskScore={order.risk_score} hoursRemaining={order.hours_remaining} />
        </div>
      </div>
    </Backdrop>
  );
}

function PredictionPanel({ orderId, riskScore, hoursRemaining }) {
  const [pred, setPred] = useState(null);
  useEffect(() => {
    api.predict(orderId).then(setPred).catch(() => {});
  }, [orderId]);

  if (!pred) return <div style={{ fontSize: 13, color: "var(--slate-soft)", marginTop: 10 }}>Scoring…</div>;
  if (pred.band === "delivered") return null;

  return (
    <div style={{
      marginTop: 10, padding: 14, borderRadius: "var(--radius-md)",
      background: pred.band === "breached" ? "var(--risk-breach-soft)" : pred.band === "at_risk" ? "var(--risk-track-soft)" : "var(--accent-soft)",
      fontSize: 13,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
        {pred.band !== "on_track" && <AlertTriangle size={14} />}
        Risk score: {(pred.risk_score * 100).toFixed(0)}%
      </div>
      <div style={{ marginTop: 6, color: "var(--ink-soft)" }}>
        Expected to be at <strong>{STAGE_LABELS[pred.expected_stage]}</strong> by now,
        currently at <strong>{STAGE_LABELS[pred.actual_stage]}</strong>.
        {pred.behind_schedule && " This order is behind the typical pace for its lens type."}
      </div>
      <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--slate)" }}>
        elapsed {(pred.features.f1_elapsed_fraction * 100).toFixed(0)}% of SLA ·
        {" "}stage deficit {(pred.features.f2_stage_deficit * 100).toFixed(0)}% ·
        {" "}{pred.features.f3_outsourced ? "sourced externally" : "in-house"} ·
        {" "}QC reworks {pred.features.f4_qc_attempts} ·
        {" "}base breach rate for this lane {(pred.features.f5_base_rate * 100).toFixed(0)}%
      </div>
    </div>
  );
}

function SpecGrid({ order }) {
  const p = order.prescription || {};
  const fields = [
    ["Frame", order.frame_model],
    ["Lens type", LENS_TYPE_LABELS[order.lens_type] || order.lens_type],
    ["Index", order.lens_index],
    ["Coating", order.coating.replace("_", " ")],
    ["Source", order.source.replace("_", " ")],
    ["Store", order.store_location],
    ["OD (sph/cyl/axis)", `${p.od_sph} / ${p.od_cyl} / ${p.od_axis}°`],
    ["OS (sph/cyl/axis)", `${p.os_sph} / ${p.os_cyl} / ${p.os_axis}°`],
    ["PD", `${p.pd} mm`],
    ["SLA due", formatDate(order.sla_due_at)],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px", marginTop: 10 }}>
      {fields.map(([label, value]) => (
        <div key={label}>
          <div style={{ fontSize: 11, color: "var(--slate-soft)", textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</div>
          <div style={{ fontSize: 13.5, marginTop: 2 }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

function SectionLabel({ children, style }) {
  return (
    <div style={{
      fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em",
      color: "var(--slate)", borderBottom: "1px solid var(--line-soft)", paddingBottom: 8, ...style,
    }}>
      {children}
    </div>
  );
}

function Backdrop({ children, onClose }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(17,22,26,0.4)",
      display: "flex", justifyContent: "flex-end", zIndex: 50,
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: "min(820px, 96vw)", background: "var(--paper-raised)", height: "100%",
        overflowY: "auto", boxShadow: "-8px 0 30px rgba(0,0,0,0.12)",
      }}>
        {children}
      </div>
    </div>
  );
}

const selectStyle = {
  padding: "9px 10px", borderRadius: 8, border: "1px solid var(--line)",
  fontSize: 13, background: "var(--paper-raised)", color: "var(--ink)",
};
const textareaStyle = { ...selectStyle, resize: "vertical", fontFamily: "inherit" };
const primaryBtn = {
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  padding: "11px 16px", borderRadius: 8, border: "none",
  background: "var(--accent)", color: "white", fontSize: 13.5, fontWeight: 600,
  marginTop: 6,
};
const dangerBtn = {
  ...primaryBtn, background: "var(--risk-breach-soft)", color: "var(--risk-breach)",
};
