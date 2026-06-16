# Lensline — Architecture Note

## What was built
A single FastAPI service (Python) backing a React dashboard, covering all three required modules end to end: lens inventory matching, full order-lifecycle status tracking, and AI-driven TAT breach prediction with alerting. SQLite holds the data; the same SQLAlchemy models port to MySQL/Postgres by changing one connection string.

## AI / ML components — what and why

**TAT breach predictor (custom logistic-regression model, no external AI API).**
Rather than calling a third-party LLM for a numeric risk score — which would be slower, costlier per order, and harder to explain to ops — the predictor is a small logistic regression fit directly from the historical orders table (`tat_engine.py`). On startup it trains on every delivered order's actual outcome (breached / on-time) using five features: elapsed fraction of SLA, how far behind the typical stage sequence the order is for its lens type, whether the lens was sourced in-house vs externally, QC rework count, and the historical breach base-rate for that lens-type × order-source combination. Weights are learned by gradient descent (dependency-free, no sklearn needed for deploy). This is the brief's "use order history and current stage to drive this" implemented literally: every prediction is traceable to the five feature values shown in the UI, which matters for an ops team that needs to trust and act on the score, not just see a black-box percentage. As more real orders complete, refitting on startup adapts the model to the brand's actual operational patterns automatically.

**Inventory matching (rule + history hybrid).**
Incoming prescriptions are matched against in-house stock by lens type, index, coating and power range (`inventory_engine.py`). When no match exists, the external-sourcing ETA isn't a hardcoded constant — it's the median historical duration of the `lens_sourcing` stage for that lens type and in-house/outsourced split, recomputed from real StageLog timestamps. Low-stock alerts compute days-to-stockout from each SKU's learned average daily velocity.

**Alerting.**
`alert_engine.py` implements the full breach-alert pipeline (risk scoring → dedup → email + WhatsApp dispatch) against an outbox abstraction. Production SMTP/WhatsApp Business API credentials weren't provisioned for this evaluation environment, so sends are logged to `alert_outbox.jsonl` and surfaced live in the dashboard's Alerts tab; swapping in real credentials only touches `_send_email` / `_send_whatsapp`, the triggering logic is already real and is exercised by `POST /api/alerts/sweep`.

## Why not call an external LLM API for prediction
A generic LLM call per order would add latency and cost to a high-frequency operational signal, would not improve on a model that already has the actual historical ground truth to fit against, and would be far less explainable to an ops team deciding whether to escalate. The brief explicitly asks for prediction "from order history and current stage" — a fitted statistical model directly satisfies that requirement and is verifiable end-to-end during the demo by changing an order's stage and watching the score move.

## Stack
FastAPI + SQLAlchemy + SQLite (backend, port 8000) · React + Vite, hand-built design system, Recharts-ready (frontend, built to static assets served by the same FastAPI process) · single Docker image for one-command deploy to Render/Railway/Fly.
