const BASE = "/api";

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  meta: () => req("/meta"),
  orders: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== "")
    ).toString();
    return req(`/orders${qs ? `?${qs}` : ""}`);
  },
  orderDetail: (id) => req(`/orders/${id}`),
  createOrder: (payload) => req("/orders", { method: "POST", body: JSON.stringify(payload) }),
  updateStage: (id, payload) => req(`/orders/${id}/stage`, { method: "PATCH", body: JSON.stringify(payload) }),
  reorder: (id) => req(`/orders/${id}/reorder`, { method: "POST" }),
  dashboardSummary: () => req("/dashboard/summary"),
  lowStock: () => req("/inventory/low-stock"),
  inventory: () => req("/inventory"),
  predict: (id) => req(`/orders/${id}/predict`),
  alertsSweep: () => req("/alerts/sweep", { method: "POST" }),
  alerts: () => req("/alerts"),
  ackAlert: (id) => req(`/alerts/${id}/ack`, { method: "POST" }),
};
