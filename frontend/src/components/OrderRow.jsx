import LensDial from "./LensDial";
import StatusBadge from "./StatusBadge";
import { STAGE_LABELS, LENS_TYPE_LABELS, stageProgress, formatHours } from "../lib/format";

export default function OrderRow({ order, stages, onClick }) {
  const progress = stageProgress(order.current_stage, stages);
  const band = order.status;

  return (
    <div
      onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: "44px 1.3fr 1fr 1fr 1.1fr 90px 110px 110px",
        alignItems: "center", gap: 14, padding: "12px 18px",
        borderBottom: "1px solid var(--line-soft)", cursor: "pointer",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-soft)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <LensDial progress={progress} band={band} size={36} strokeWidth={4}>
        <span style={{ fontSize: 9 }}></span>
      </LensDial>

      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 13.5, fontWeight: 500 }}>
          {order.order_code}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--slate)" }}>{order.customer_name}</div>
      </div>

      <div>
        <div style={{ fontSize: 13 }}>{LENS_TYPE_LABELS[order.lens_type] || order.lens_type}</div>
        <div style={{ fontSize: 11.5, color: "var(--slate-soft)" }}>
          idx {order.lens_index} · {order.coating.replace("_", " ")}
        </div>
      </div>

      <div style={{ fontSize: 13 }}>{STAGE_LABELS[order.current_stage] || order.current_stage}</div>

      <div style={{ fontSize: 12.5, color: "var(--slate)" }}>{order.store_location}</div>

      <div>
        <span style={{
          fontSize: 11, fontFamily: "var(--font-mono)",
          padding: "2px 7px", borderRadius: 5,
          background: order.power_in_house ? "var(--accent-soft)" : "var(--line-soft)",
          color: order.power_in_house ? "var(--accent)" : "var(--slate)",
        }}>
          {order.power_in_house ? "in-house" : "sourced"}
        </span>
      </div>

      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 12.5,
        color: order.hours_remaining < 0 ? "var(--risk-breach)" : "var(--ink-soft)",
      }}>
        {formatHours(order.hours_remaining)}
      </div>

      <StatusBadge band={band} size="sm" />
    </div>
  );
}
