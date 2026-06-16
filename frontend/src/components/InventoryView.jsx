import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { api } from "../lib/api";
import { LENS_TYPE_LABELS } from "../lib/format";

export default function InventoryView() {
  const [items, setItems] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [inv, low] = await Promise.all([api.inventory(), api.lowStock()]);
    setItems(inv);
    setLowStock(low);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  if (loading) return <Empty>Loading inventory…</Empty>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
        <div>
          <h2 style={titleStyle}>Lens inventory</h2>
          <p style={subStyle}>
            In-house stock by lens type, index and coating. New orders are matched against this
            automatically — a match means same-day fast-track; no match means external sourcing.
          </p>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div style={{
          marginBottom: 20, padding: "14px 18px", borderRadius: "var(--radius-md)",
          background: "var(--risk-track-soft)", display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          <AlertCircle size={18} color="var(--risk-track)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13.5 }}>
            <strong>{lowStock.length} combinations at or below reorder level.</strong> Days-to-stockout
            is estimated from average daily usage on each combination, learned from order history.
          </div>
        </div>
      )}

      <div style={{ background: "var(--paper-raised)", borderRadius: "var(--radius-md)", border: "1px solid var(--line-soft)", overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1.2fr 0.8fr 1.2fr 1fr 1fr 1fr 1fr",
          padding: "11px 18px", fontSize: 11.5, color: "var(--slate-soft)",
          textTransform: "uppercase", letterSpacing: "0.03em", borderBottom: "1px solid var(--line-soft)",
          fontWeight: 600,
        }}>
          <div>Lens type</div><div>Index</div><div>Coating</div><div>Power range</div>
          <div>On hand</div><div>Reorder level</div><div>Days to stockout</div>
        </div>
        <div style={{ maxHeight: 520, overflowY: "auto" }}>
          {items.map((it) => {
            const low = it.qty_on_hand <= it.reorder_level;
            return (
              <div key={it.id} style={{
                display: "grid", gridTemplateColumns: "1.2fr 0.8fr 1.2fr 1fr 1fr 1fr 1fr",
                padding: "10px 18px", fontSize: 13, borderBottom: "1px solid var(--line-soft)",
                background: low ? "var(--risk-track-soft)" : "transparent",
              }}>
                <div>{LENS_TYPE_LABELS[it.lens_type] || it.lens_type}</div>
                <div className="mono">{it.lens_index}</div>
                <div>{it.coating.replace("_", " ")}</div>
                <div className="mono" style={{ color: "var(--slate)" }}>{it.sph_min} to {it.sph_max}</div>
                <div className="mono" style={{ fontWeight: 600, color: low ? "var(--risk-track)" : "var(--ink)" }}>{it.qty_on_hand}</div>
                <div className="mono" style={{ color: "var(--slate)" }}>{it.reorder_level}</div>
                <div className="mono" style={{ color: "var(--slate)" }}>
                  {it.days_to_stockout !== null ? `${it.days_to_stockout}d` : "—"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Empty({ children }) {
  return <div style={{ padding: 60, textAlign: "center", color: "var(--slate)" }}>{children}</div>;
}

const titleStyle = { fontFamily: "var(--font-display)", fontSize: 20, margin: 0, fontWeight: 600 };
const subStyle = { fontSize: 13.5, color: "var(--slate)", marginTop: 4, maxWidth: 600 };
