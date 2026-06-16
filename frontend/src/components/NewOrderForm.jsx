import { useState } from "react";
import { X, CheckCircle2, Truck } from "lucide-react";
import { api } from "../lib/api";
import { LENS_TYPE_LABELS } from "../lib/format";

const COATINGS = ["AR", "UV", "blue_cut", "scratch_resistant", "photochromic_coat"];
const INDICES = ["1.50", "1.56", "1.61", "1.67", "1.74"];

export default function NewOrderForm({ meta, onClose, onCreated }) {
  const [form, setForm] = useState({
    customer_name: "", customer_phone: "", source: meta.sources[0],
    store_location: meta.store_locations[0], frame_model: "Aviator Classic",
    lens_type: meta.lens_types[0], lens_index: "1.56", coating: "AR",
    od_sph: -2.0, od_cyl: -0.5, od_axis: 90, os_sph: -2.0, os_cyl: -0.5, os_axis: 90, pd: 62,
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        customer_name: form.customer_name, customer_phone: form.customer_phone,
        source: form.source, store_location: form.store_location, frame_model: form.frame_model,
        lens_type: form.lens_type, lens_index: form.lens_index, coating: form.coating,
        prescription: {
          od_sph: +form.od_sph, od_cyl: +form.od_cyl, od_axis: +form.od_axis,
          os_sph: +form.os_sph, os_cyl: +form.os_cyl, os_axis: +form.os_axis, pd: +form.pd,
        },
      };
      const created = await api.createOrder(payload);
      setResult(created);
      onCreated?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(17,22,26,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: "min(640px, 94vw)", maxHeight: "90vh", overflowY: "auto",
        background: "var(--paper-raised)", borderRadius: "var(--radius-lg)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }}>
        <div style={{ padding: "22px 26px", borderBottom: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600 }}>New order intake</div>
          <button onClick={onClose} style={{ background: "none", border: "none" }}><X size={18} color="var(--slate)" /></button>
        </div>

        {result ? (
          <div style={{ padding: "32px 26px", textAlign: "center" }}>
            {result.power_in_house ? (
              <CheckCircle2 size={40} color="var(--accent)" style={{ marginBottom: 12 }} />
            ) : (
              <Truck size={40} color="var(--risk-track)" style={{ marginBottom: 12 }} />
            )}
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 17, marginBottom: 6 }}>{result.order_code}</div>
            <div style={{ fontSize: 14, color: "var(--ink-soft)" }}>
              {result.power_in_house
                ? "This power is in-house — routed for fastest fulfilment."
                : "This power isn't in stock — flagged for external sourcing, which adds lead time."}
            </div>
            <div style={{ fontSize: 13, color: "var(--slate)", marginTop: 8 }}>
              SLA due {new Date(result.sla_due_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </div>
            <button onClick={onClose} style={{ marginTop: 20, padding: "10px 22px", borderRadius: 8, border: "none", background: "var(--accent)", color: "white", fontWeight: 600, fontSize: 13.5 }}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} style={{ padding: "20px 26px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Customer name"><input required value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} style={inputStyle} /></Field>
            <Field label="Phone"><input required value={form.customer_phone} onChange={(e) => set("customer_phone", e.target.value)} style={inputStyle} /></Field>

            <Field label="Order source">
              <select value={form.source} onChange={(e) => set("source", e.target.value)} style={inputStyle}>
                {meta.sources.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </Field>
            <Field label="Store / fulfilment location">
              <select value={form.store_location} onChange={(e) => set("store_location", e.target.value)} style={inputStyle}>
                {meta.store_locations.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>

            <Field label="Frame model"><input value={form.frame_model} onChange={(e) => set("frame_model", e.target.value)} style={inputStyle} /></Field>
            <Field label="Lens type">
              <select value={form.lens_type} onChange={(e) => set("lens_type", e.target.value)} style={inputStyle}>
                {meta.lens_types.map((s) => <option key={s} value={s}>{LENS_TYPE_LABELS[s] || s}</option>)}
              </select>
            </Field>

            <Field label="Lens index">
              <select value={form.lens_index} onChange={(e) => set("lens_index", e.target.value)} style={inputStyle}>
                {INDICES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Coating">
              <select value={form.coating} onChange={(e) => set("coating", e.target.value)} style={inputStyle}>
                {COATINGS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </Field>

            <div style={{ gridColumn: "1 / -1", fontSize: 12, fontWeight: 600, color: "var(--slate)", marginTop: 6, textTransform: "uppercase", letterSpacing: "0.03em" }}>
              Prescription
            </div>
            <Field label="OD sphere"><input type="number" step="0.25" value={form.od_sph} onChange={(e) => set("od_sph", e.target.value)} style={inputStyle} /></Field>
            <Field label="OS sphere"><input type="number" step="0.25" value={form.os_sph} onChange={(e) => set("os_sph", e.target.value)} style={inputStyle} /></Field>
            <Field label="OD cylinder"><input type="number" step="0.25" value={form.od_cyl} onChange={(e) => set("od_cyl", e.target.value)} style={inputStyle} /></Field>
            <Field label="OS cylinder"><input type="number" step="0.25" value={form.os_cyl} onChange={(e) => set("os_cyl", e.target.value)} style={inputStyle} /></Field>
            <Field label="PD (mm)"><input type="number" step="0.5" value={form.pd} onChange={(e) => set("pd", e.target.value)} style={inputStyle} /></Field>
            <div />

            <button disabled={busy} type="submit" style={{
              gridColumn: "1 / -1", marginTop: 8, padding: "12px 16px", borderRadius: 8,
              border: "none", background: "var(--accent)", color: "white", fontWeight: 600, fontSize: 14,
            }}>
              {busy ? "Checking inventory…" : "Place order & check inventory"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--slate)" }}>
      {label}
      {children}
    </label>
  );
}

const inputStyle = {
  padding: "9px 10px", borderRadius: 8, border: "1px solid var(--line)",
  fontSize: 13.5, background: "var(--paper)", color: "var(--ink)",
};
