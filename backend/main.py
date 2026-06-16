from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional
from datetime import datetime
import os

from database import engine, get_db, SessionLocal
from models import Base, Order, StageLog, InventoryItem, Alert, STAGES, LENS_TYPE_SLA_HOURS, STORE_LOCATIONS, ORDER_SOURCES
from inventory_engine import evaluate_order_inventory, low_stock_report
from tat_engine import tat_predictor
from alert_engine import run_breach_sweep, dispatch_breach_alert
import schemas

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Eyewear AI Order Management System")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    db = SessionLocal()
    try:
        tat_predictor.fit(db)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Reference data
# ---------------------------------------------------------------------------
@app.get("/api/meta")
def get_meta():
    return {
        "stages": STAGES,
        "lens_types": list(LENS_TYPE_SLA_HOURS.keys()),
        "sla_hours": LENS_TYPE_SLA_HOURS,
        "store_locations": STORE_LOCATIONS,
        "sources": ORDER_SOURCES,
    }


# ---------------------------------------------------------------------------
# Orders: create / list / detail / status update
# ---------------------------------------------------------------------------
@app.post("/api/orders", response_model=schemas.OrderOut)
def create_order(payload: schemas.OrderCreate, db: Session = Depends(get_db)):
    sla_hours = LENS_TYPE_SLA_HOURS.get(payload.lens_type, 48)
    now = datetime.utcnow()
    code = f"EYW-{int(now.timestamp()) % 100000}"

    order = Order(
        order_code=code,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        source=payload.source,
        store_location=payload.store_location,
        frame_model=payload.frame_model,
        lens_type=payload.lens_type,
        lens_index=payload.lens_index,
        coating=payload.coating,
        prescription_json=payload.prescription.dict(),
        current_stage="order_placed",
        status="on_track",
        created_at=now,
        updated_at=now,
        sla_due_at=now,  # placeholder, corrected below
    )
    from datetime import timedelta
    order.sla_due_at = now + timedelta(hours=sla_hours)
    db.add(order)
    db.flush()

    db.add(StageLog(order_id=order.id, from_stage=None, to_stage="order_placed",
                     changed_by="api", timestamp=now))

    inv_result = evaluate_order_inventory(db, order)
    order.power_in_house = inv_result["power_in_house"]
    order.inventory_match_id = inv_result["inventory_match_id"]

    db.commit()
    db.refresh(order)
    return _order_to_out(order)


@app.get("/api/orders", response_model=list[schemas.OrderOut])
def list_orders(
    status: Optional[str] = None,
    lens_type: Optional[str] = None,
    store_location: Optional[str] = None,
    search: Optional[str] = None,
    include_delivered: bool = True,
    db: Session = Depends(get_db),
):
    q = db.query(Order)
    if status:
        q = q.filter(Order.status == status)
    if lens_type:
        q = q.filter(Order.lens_type == lens_type)
    if store_location:
        q = q.filter(Order.store_location == store_location)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(Order.order_code.ilike(like), Order.customer_name.ilike(like)))
    if not include_delivered:
        q = q.filter(Order.current_stage != "delivered")
    orders = q.order_by(Order.created_at.desc()).limit(500).all()

    out = []
    for o in orders:
        pred = tat_predictor.score(db, o) if o.current_stage != "delivered" else None
        if pred and pred["band"] != o.status and o.current_stage != "delivered":
            o.status = pred["band"]
            db.add(o)
        out.append(_order_to_out(o, prediction=pred))
    db.commit()
    return out


@app.get("/api/orders/{order_id}", response_model=schemas.OrderDetailOut)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    pred = tat_predictor.score(db, order) if order.current_stage != "delivered" else None
    logs = db.query(StageLog).filter(StageLog.order_id == order.id).order_by(StageLog.timestamp.asc()).all()
    base = _order_to_out(order, prediction=pred).dict()
    base["stage_logs"] = [
        {"from_stage": l.from_stage, "to_stage": l.to_stage, "delay_reason": l.delay_reason,
         "changed_by": l.changed_by, "timestamp": l.timestamp} for l in logs
    ]
    return base


@app.patch("/api/orders/{order_id}/stage", response_model=schemas.OrderOut)
def update_stage(order_id: int, payload: schemas.StageUpdate, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")

    if payload.to_stage not in STAGES and payload.to_stage != "cancelled":
        raise HTTPException(400, f"Invalid stage: {payload.to_stage}")

    from_stage = order.current_stage

    # QC failure loop-back: explicit signal from UI sends to_stage=lens_cutting_fitting
    # with a qc_fail flag, bump attempts counter
    if payload.qc_failed:
        order.qc_attempts = (order.qc_attempts or 0) + 1

    order.current_stage = payload.to_stage
    order.updated_at = datetime.utcnow()
    if payload.to_stage == "delivered":
        order.delivered_at = order.updated_at
        order.status = "breached" if order.delivered_at > order.sla_due_at else "delivered"
    elif payload.to_stage == "cancelled":
        order.status = "cancelled"

    db.add(StageLog(
        order_id=order.id, from_stage=from_stage, to_stage=payload.to_stage,
        changed_by=payload.changed_by or "ops_team", delay_reason=payload.delay_reason,
        notes=payload.notes, timestamp=order.updated_at,
    ))
    db.commit()
    db.refresh(order)
    pred = tat_predictor.score(db, order) if order.current_stage != "delivered" else None
    return _order_to_out(order, prediction=pred)


@app.post("/api/orders/{order_id}/reorder", response_model=schemas.OrderOut)
def create_reorder(order_id: int, db: Session = Depends(get_db)):
    """QC failure beyond rework threshold -> spawn a fresh order linked to original."""
    original = db.get(Order, order_id)
    if not original:
        raise HTTPException(404, "Order not found")
    sla_hours = LENS_TYPE_SLA_HOURS.get(original.lens_type, 48)
    now = datetime.utcnow()
    from datetime import timedelta
    new_order = Order(
        order_code=f"{original.order_code}-R{original.qc_attempts}",
        customer_name=original.customer_name, customer_phone=original.customer_phone,
        source=original.source, store_location=original.store_location,
        frame_model=original.frame_model, lens_type=original.lens_type,
        lens_index=original.lens_index, coating=original.coating,
        prescription_json=original.prescription_json,
        current_stage="lens_sourcing", status="on_track",
        reorder_of=original.id, created_at=now, updated_at=now,
        sla_due_at=now + timedelta(hours=sla_hours * 0.6),
    )
    db.add(new_order)
    db.flush()
    db.add(StageLog(order_id=new_order.id, from_stage=None, to_stage="lens_sourcing",
                     changed_by="system", notes=f"Re-order from QC failure on {original.order_code}",
                     timestamp=now))
    original.current_stage = "cancelled"
    original.status = "cancelled"
    db.commit()
    db.refresh(new_order)
    return _order_to_out(new_order)


# ---------------------------------------------------------------------------
# Dashboard summary
# ---------------------------------------------------------------------------
@app.get("/api/dashboard/summary")
def dashboard_summary(db: Session = Depends(get_db)):
    from models import TERMINAL_STAGES
    live = db.query(Order).filter(~Order.current_stage.in_(TERMINAL_STAGES)).all()
    counts = {"on_track": 0, "at_risk": 0, "breached": 0}
    by_stage = {s: 0 for s in STAGES}
    by_lens_type = {}
    for o in live:
        pred = tat_predictor.score(db, o)
        band = pred["band"]
        if band in counts:
            counts[band] += 1
        by_stage[o.current_stage] = by_stage.get(o.current_stage, 0) + 1
        by_lens_type[o.lens_type] = by_lens_type.get(o.lens_type, 0) + 1

    delivered_total = db.query(Order).filter(Order.current_stage == "delivered").count()
    breached_total = db.query(Order).filter(
        Order.current_stage == "delivered", Order.delivered_at > Order.sla_due_at
    ).count()
    on_time_rate = round(100 * (1 - breached_total / delivered_total), 1) if delivered_total else None

    return {
        "live_order_count": len(live),
        "status_counts": counts,
        "by_stage": by_stage,
        "by_lens_type": by_lens_type,
        "historical_on_time_rate_pct": on_time_rate,
        "historical_delivered_count": delivered_total,
        "model_trained_on_n": tat_predictor.trained_on_n,
    }


# ---------------------------------------------------------------------------
# Inventory
# ---------------------------------------------------------------------------
@app.get("/api/inventory/low-stock")
def get_low_stock(db: Session = Depends(get_db)):
    return low_stock_report(db)


@app.get("/api/inventory")
def list_inventory(db: Session = Depends(get_db)):
    items = db.query(InventoryItem).order_by(InventoryItem.qty_on_hand.asc()).all()
    return [
        {"id": i.id, "lens_type": i.lens_type, "lens_index": i.lens_index, "coating": i.coating,
         "sph_min": i.sph_min, "sph_max": i.sph_max, "qty_on_hand": i.qty_on_hand,
         "reorder_level": i.reorder_level, "avg_velocity_per_day": i.avg_velocity_per_day}
        for i in items
    ]


# ---------------------------------------------------------------------------
# TAT prediction & alerts
# ---------------------------------------------------------------------------
@app.get("/api/orders/{order_id}/predict")
def predict_order(order_id: int, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    return tat_predictor.score(db, order)


@app.post("/api/alerts/sweep")
def alerts_sweep(db: Session = Depends(get_db)):
    fired = run_breach_sweep(db, tat_predictor)
    return {"alerts_fired": fired, "count": len(fired)}


@app.get("/api/alerts")
def list_alerts(db: Session = Depends(get_db)):
    alerts = db.query(Alert).order_by(Alert.sent_at.desc()).limit(100).all()
    out = []
    for a in alerts:
        order = db.get(Order, a.order_id)
        out.append({
            "id": a.id, "order_id": a.order_id,
            "order_code": order.order_code if order else None,
            "alert_type": a.alert_type, "channel": a.channel,
            "risk_score": a.risk_score, "message": a.message,
            "sent_at": a.sent_at, "acknowledged": a.acknowledged,
        })
    return out


@app.post("/api/alerts/{alert_id}/ack")
def ack_alert(alert_id: int, db: Session = Depends(get_db)):
    a = db.get(Alert, alert_id)
    if not a:
        raise HTTPException(404, "Alert not found")
    a.acknowledged = True
    db.commit()
    return {"ok": True}


def _order_to_out(order: Order, prediction: dict = None, inv_result: dict = None) -> schemas.OrderOut:
    sla_hours = LENS_TYPE_SLA_HOURS.get(order.lens_type, 48)
    hours_remaining = None
    if order.sla_due_at:
        hours_remaining = round((order.sla_due_at - datetime.utcnow()).total_seconds() / 3600, 1)
    return schemas.OrderOut(
        id=order.id, order_code=order.order_code, customer_name=order.customer_name,
        customer_phone=order.customer_phone, source=order.source, store_location=order.store_location,
        frame_model=order.frame_model, lens_type=order.lens_type, lens_index=order.lens_index,
        coating=order.coating, prescription=order.prescription_json,
        power_in_house=order.power_in_house, current_stage=order.current_stage,
        status=order.status, qc_attempts=order.qc_attempts or 0,
        created_at=order.created_at, updated_at=order.updated_at,
        sla_due_at=order.sla_due_at, delivered_at=order.delivered_at,
        sla_hours=sla_hours, hours_remaining=hours_remaining,
        risk_score=prediction["risk_score"] if prediction else (0.0 if order.current_stage == "delivered" else None),
        reorder_of=order.reorder_of,
    )


# ---------------------------------------------------------------------------
# Serve built frontend (single deployable artifact)
# ---------------------------------------------------------------------------
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        candidate = os.path.join(FRONTEND_DIST, full_path)
        if full_path and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
