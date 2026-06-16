"""
Alerting module: dispatches breach-risk alerts via email or WhatsApp.

For this deployed demo, real SMTP/WhatsApp Business API credentials are not
provisioned (would require the brand's own Twilio/WhatsApp Cloud API keys
and a sending domain) -- so this module implements the FULL dispatch logic
and interface, and writes every alert to the `alerts` table + an
`outbox` JSON log that the dashboard renders as a live "Alerts" feed.
Swapping in real credentials only requires filling in `_send_email` /
`_send_whatsapp` below; the decision logic and triggering are real.
"""
import json
import os
from datetime import datetime
from sqlalchemy.orm import Session
from models import Order, Alert

OUTBOX_PATH = os.path.join(os.path.dirname(__file__), "alert_outbox.jsonl")

TEAM_EMAIL = "ops-team@eyewearbrand.example"
TEAM_WHATSAPP = "+91-90000-00000"


def _send_email(to: str, subject: str, body: str):
    record = {"channel": "email", "to": to, "subject": subject, "body": body,
              "sent_at": datetime.utcnow().isoformat()}
    _append_outbox(record)
    return True


def _send_whatsapp(to: str, body: str):
    record = {"channel": "whatsapp", "to": to, "body": body,
              "sent_at": datetime.utcnow().isoformat()}
    _append_outbox(record)
    return True


def _append_outbox(record: dict):
    with open(OUTBOX_PATH, "a") as f:
        f.write(json.dumps(record) + "\n")


def dispatch_breach_alert(db: Session, order: Order, prediction: dict, channel: str = "both") -> list[Alert]:
    """Create Alert rows + send via chosen channel(s). Idempotent-ish: skips
    if an unacknowledged alert for this order+band already exists."""
    existing = db.query(Alert).filter(
        Alert.order_id == order.id, Alert.alert_type == prediction["band"],
        Alert.acknowledged == False,  # noqa: E712
    ).first()
    if existing:
        return [existing]

    subject = f"SLA risk: {order.order_code} ({prediction['band'].upper()})"
    body = (
        f"Order {order.order_code} for {order.customer_name} is flagged "
        f"'{prediction['band']}'.\n"
        f"Lens type: {order.lens_type} | Stage: {order.current_stage} "
        f"(expected: {prediction['expected_stage']})\n"
        f"Risk score: {prediction['risk_score']*100:.0f}% | "
        f"Hours remaining: {prediction['hours_remaining']}\n"
        f"Store: {order.store_location} | Source: {order.source}"
    )

    created = []
    if channel in ("email", "both"):
        _send_email(TEAM_EMAIL, subject, body)
        a = Alert(order_id=order.id, alert_type=prediction["band"], channel="email",
                   risk_score=prediction["risk_score"], message=body)
        db.add(a)
        created.append(a)
    if channel in ("whatsapp", "both"):
        _send_whatsapp(TEAM_WHATSAPP, body)
        a = Alert(order_id=order.id, alert_type=prediction["band"], channel="whatsapp",
                   risk_score=prediction["risk_score"], message=body)
        db.add(a)
        created.append(a)

    db.commit()
    return created


def run_breach_sweep(db: Session, predictor, threshold: float = 0.55):
    """Scan all live (non-terminal) orders, score them, and fire alerts for
    anything at_risk or breached. Call this on a schedule (cron / background
    task) -- wired into the API as POST /alerts/sweep for the demo."""
    from models import TERMINAL_STAGES
    live_orders = db.query(Order).filter(~Order.current_stage.in_(TERMINAL_STAGES)).all()
    fired = []
    for order in live_orders:
        pred = predictor.score(db, order)
        if pred["band"] in ("at_risk", "breached"):
            alerts = dispatch_breach_alert(db, order, pred, channel="both")
            fired.append({"order_code": order.order_code, "band": pred["band"],
                           "risk_score": pred["risk_score"], "alerts_created": len(alerts)})
    return fired
