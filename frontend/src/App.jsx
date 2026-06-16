import { useEffect, useState, useCallback } from "react";
import { LayoutGrid, Boxes, BellRing, Plus, Search } from "lucide-react";
import { api } from "./lib/api";
import KpiStrip from "./components/KpiStrip";
import OrderRow from "./components/OrderRow";
import OrderDetail from "./components/OrderDetail";
import NewOrderForm from "./components/NewOrderForm";
import InventoryView from "./components/InventoryView";
import AlertsView from "./components/AlertsView";
import { LENS_TYPE_LABELS } from "./lib/format";

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [meta, setMeta] = useState(null);
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: "", lens_type: "", store_location: "", search: "" });
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [showNewOrder, setShowNewOrder] = useState(false);

  const loadAll = useCallback(async () => {
    const [m, s] = await Promise.all([api.meta(), api.dashboardSummary()]);
    setMeta(m);
    setSummary(s);
  }, []);

  const loadOrders = useCallback(async (f) => {
    setLoading(true);
    const data = await api.orders({ ...f, include_delivered: false });
    setOrders(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { loadOrders(filters); }, [filters, loadOrders]);

  function refresh() {
    loadAll();
    loadOrders(filters);
  }

  if (!meta) {
    return <div style={{ padding: 60, fontFamily: "var(--font-body)", color: "var(--slate)" }}>Loading Lensline…</div>;
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar tab={tab} setTab={setTab} />

      <main style={{ flex: 1, padding: "28px 36px", maxWidth: 1320 }}>
        {tab === "dashboard" && (
          <>
            <HeaderRow onNewOrder={() => setShowNewOrder(true)} />
            <div style={{ marginBottom: 22 }}>
              <KpiStrip summary={summary} />
            </div>
            <FilterBar meta={meta} filters={filters} setFilters={setFilters} />
            <OrderTable
              orders={orders} stages={meta.stages} loading={loading}
              onSelect={setSelectedOrderId}
            />
          </>
        )}

        {tab === "inventory" && <InventoryView />}
        {tab === "alerts" && <AlertsView />}
      </main>

      {selectedOrderId && (
        <OrderDetail
          orderId={selectedOrderId}
          stages={meta.stages}
          onClose={() => setSelectedOrderId(null)}
          onUpdated={refresh}
        />
      )}
      {showNewOrder && (
        <NewOrderForm meta={meta} onClose={() => { setShowNewOrder(false); refresh(); }} onCreated={refresh} />
      )}
    </div>
  );
}

function Sidebar({ tab, setTab }) {
  const items = [
    { id: "dashboard", label: "Order dashboard", icon: LayoutGrid },
    { id: "inventory", label: "Lens inventory", icon: Boxes },
    { id: "alerts", label: "Breach alerts", icon: BellRing },
  ];
  return (
    <aside style={{
      width: 240, background: "var(--ink)", color: "var(--paper)",
      padding: "26px 18px", display: "flex", flexDirection: "column", gap: 4,
      flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px 24px" }}>
        <LensMark />
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600 }}>Lensline</div>
          <div style={{ fontSize: 10.5, color: "#8FA396", letterSpacing: "0.04em" }}>ORDER OPERATIONS</div>
        </div>
      </div>
      {items.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setTab(id)}
          style={{
            display: "flex", alignItems: "center", gap: 11, padding: "10px 12px",
            borderRadius: 8, border: "none", textAlign: "left", fontSize: 13.5,
            background: tab === id ? "rgba(255,255,255,0.08)" : "transparent",
            color: tab === id ? "#FFFFFF" : "#A9B4AE",
            fontWeight: tab === id ? 600 : 500,
          }}
        >
          <Icon size={16} />
          {label}
        </button>
      ))}
      <div style={{ marginTop: "auto", padding: "16px 8px 0", fontSize: 11, color: "#5C6B73", lineHeight: 1.5 }}>
        AI-assisted fulfilment for prescription eyewear — intake to delivery.
      </div>
    </aside>
  );
}

function LensMark() {
  return (
    <svg width="28" height="20" viewBox="0 0 56 40">
      <circle cx="18" cy="20" r="15" fill="none" stroke="#5FA88A" strokeWidth="4" />
      <circle cx="38" cy="20" r="15" fill="none" stroke="#5FA88A" strokeWidth="4" />
      <line x1="32" y1="20" x2="24" y2="20" stroke="#5FA88A" strokeWidth="4" />
    </svg>
  );
}

function HeaderRow({ onNewOrder }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
      <div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, margin: 0, fontWeight: 600 }}>
          Order dashboard
        </h1>
        <p style={{ fontSize: 13.5, color: "var(--slate)", marginTop: 4, maxWidth: 560 }}>
          Every live order across all stages, with AI-predicted SLA risk updated in real time.
        </p>
      </div>
      <button onClick={onNewOrder} style={{
        display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 8,
        border: "none", background: "var(--accent)", color: "white", fontWeight: 600, fontSize: 13.5,
      }}>
        <Plus size={16} /> New order
      </button>
    </div>
  );
}

function FilterBar({ meta, filters, setFilters }) {
  function set(k, v) { setFilters((f) => ({ ...f, [k]: v })); }
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ position: "relative", flex: "1 1 220px", minWidth: 200 }}>
        <Search size={14} style={{ position: "absolute", left: 11, top: 11, color: "var(--slate-soft)" }} />
        <input
          placeholder="Search order code or customer"
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          style={{ ...selectStyle, paddingLeft: 32, width: "100%" }}
        />
      </div>
      <select value={filters.status} onChange={(e) => set("status", e.target.value)} style={selectStyle}>
        <option value="">All statuses</option>
        <option value="on_track">On track</option>
        <option value="at_risk">At risk</option>
        <option value="breached">Breached</option>
      </select>
      <select value={filters.lens_type} onChange={(e) => set("lens_type", e.target.value)} style={selectStyle}>
        <option value="">All lens types</option>
        {meta.lens_types.map((t) => <option key={t} value={t}>{LENS_TYPE_LABELS[t] || t}</option>)}
      </select>
      <select value={filters.store_location} onChange={(e) => set("store_location", e.target.value)} style={selectStyle}>
        <option value="">All locations</option>
        {meta.store_locations.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  );
}

function OrderTable({ orders, stages, loading, onSelect }) {
  return (
    <div style={{ background: "var(--paper-raised)", borderRadius: "var(--radius-md)", border: "1px solid var(--line-soft)", overflow: "hidden" }}>
      <div style={{
        display: "grid", gridTemplateColumns: "44px 1.3fr 1fr 1fr 1.1fr 90px 110px 110px",
        gap: 14, padding: "11px 18px", fontSize: 11.5, color: "var(--slate-soft)",
        textTransform: "uppercase", letterSpacing: "0.03em", borderBottom: "1px solid var(--line-soft)",
        fontWeight: 600,
      }}>
        <div></div><div>Order</div><div>Lens spec</div><div>Stage</div><div>Location</div><div>Sourcing</div><div>SLA</div><div>Status</div>
      </div>
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--slate)" }}>Loading orders…</div>
      ) : orders.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--slate)" }}>No orders match these filters.</div>
      ) : (
        <div style={{ maxHeight: 600, overflowY: "auto" }}>
          {orders.map((o) => (
            <OrderRow key={o.id} order={o} stages={stages} onClick={() => onSelect(o.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

const selectStyle = {
  padding: "9px 12px", borderRadius: 8, border: "1px solid var(--line)",
  fontSize: 13, background: "var(--paper-raised)", color: "var(--ink)",
};
