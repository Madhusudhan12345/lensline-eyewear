export const STAGE_LABELS = {
  order_placed: "Order placed",
  prescription_verified: "Prescription verified",
  power_check: "Power check",
  lens_sourcing: "Lens sourcing",
  lens_cutting_fitting: "Cutting & fitting",
  quality_check: "Quality check",
  packed: "Packed",
  dispatched: "Dispatched",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const LENS_TYPE_LABELS = {
  single_vision: "Single vision",
  bifocal: "Bifocal",
  progressive: "Progressive",
  high_index: "High index",
  photochromic: "Photochromic",
  blue_cut: "Blue cut",
};

export function stageProgress(stage, stages) {
  const idx = stages.indexOf(stage);
  if (idx < 0) return stage === "delivered" ? 1 : 0;
  return (idx + 1) / stages.length;
}

export function bandColor(band) {
  switch (band) {
    case "breached": return "var(--risk-breach)";
    case "at_risk": return "var(--risk-track)";
    case "delivered": return "var(--accent)";
    case "cancelled": return "var(--slate)";
    default: return "var(--accent)";
  }
}

export function bandSoftColor(band) {
  switch (band) {
    case "breached": return "var(--risk-breach-soft)";
    case "at_risk": return "var(--risk-track-soft)";
    case "delivered": return "var(--accent-soft)";
    case "cancelled": return "var(--line-soft)";
    default: return "var(--accent-soft)";
  }
}

export function bandLabel(band) {
  switch (band) {
    case "breached": return "Breached";
    case "at_risk": return "At risk";
    case "delivered": return "Delivered";
    case "cancelled": return "Cancelled";
    default: return "On track";
  }
}

export function formatHours(h) {
  if (h === null || h === undefined) return "—";
  if (h < 0) return `${Math.abs(h).toFixed(0)}h overdue`;
  if (h < 24) return `${h.toFixed(0)}h left`;
  return `${(h / 24).toFixed(1)}d left`;
}

export function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export function timeAgo(d) {
  if (!d) return "—";
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
