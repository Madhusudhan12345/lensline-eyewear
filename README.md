# Lensline — AI-Powered Eyewear Order Management System

## Run locally (2 commands)
```bash
cd backend
pip install -r requirements.txt
python seed.py          # generates historical + live demo data, trains the TAT model on startup
uvicorn main:app --reload --port 8000
```
Open **http://localhost:8000** — the React dashboard is served from the same process as the API (built assets are already in `backend/static/`). No separate frontend server needed.

To rebuild the frontend after changing it:
```bash
cd frontend
npm install
npm run build
cp -r dist/* ../backend/static/
```

## Get a live public URL (free tier, ~2 minutes)
The project includes a `Dockerfile` and `render.yaml`, so any of these work without code changes:

- **Render**: New → Web Service → connect this repo/zip → it detects `render.yaml` automatically → Deploy. You get a `https://lensline-xxxx.onrender.com` URL.
- **Railway**: New Project → Deploy from repo/zip → it detects the Dockerfile → Deploy.
- **Fly.io**: `fly launch` from the project root, accept the detected Dockerfile, `fly deploy`.

All three give a public HTTPS URL on their free tier within a couple of minutes, with zero code changes required.

## Modules (all in one app)

1. **Lens inventory management** — `backend/inventory_engine.py`. Every new order is matched against in-house stock by lens type, index, coating and power range. Matches get the fast-track path; misses get flagged for external sourcing with a data-driven ETA. See the **Lens inventory** tab for stock levels and low-stock/days-to-stockout.
2. **Order dashboard** — main view. Every live order, current stage, time remaining vs SLA, breach status, filterable by status / lens type / store. Click any order to update its stage, log a delay reason, or fail QC (which spins up a linked re-order).
3. **TAT prediction & alerts** — `backend/tat_engine.py` (model) + `backend/alert_engine.py` (dispatch). Each order's breach risk is scored live; the **Breach alerts** tab lets you trigger a prediction sweep that fires email + WhatsApp alerts for at-risk/breached orders (logged to `backend/alert_outbox.jsonl` since no real SMTP/WhatsApp credentials are configured in this environment — see `ARCHITECTURE.md`).

## Demo script (for the 15-minute walkthrough)
1. Dashboard tour: KPI strip, filters, click an order to open the detail drawer.
2. Place a **New order** — show the inventory check responding instantly (in-house vs sourced).
3. Advance an order's stage, add a delay reason, show the AI risk panel update.
4. Open an order at **Quality check**, click "Fail QC" — show the linked re-order spawn.
5. **Lens inventory** tab — low-stock combinations, days-to-stockout.
6. **Breach alerts** tab — run a prediction sweep, show alerts firing with the explainable feature breakdown.
