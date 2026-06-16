"""
Data models for the eyewear AI-powered Order Management System.
SQLite via SQLAlchemy. Designed to be swappable to Postgres/MySQL later.
"""
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text, JSON
)
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime

Base = declarative_base()

# ---------------------------------------------------------------------------
# Reference data: SLA hours per lens type (used by TAT engine)
# ---------------------------------------------------------------------------
LENS_TYPE_SLA_HOURS = {
    "single_vision": 24,
    "bifocal": 48,
    "progressive": 72,
    "high_index": 96,
    "photochromic": 96,
    "blue_cut": 36,
}

STAGES = [
    "order_placed",
    "prescription_verified",
    "power_check",          # in-house vs outsourced decision happens here
    "lens_sourcing",        # in-house pick OR external procurement
    "lens_cutting_fitting",
    "quality_check",
    "packed",
    "dispatched",
    "delivered",
]

TERMINAL_STAGES = {"delivered", "cancelled"}

ORDER_SOURCES = ["website", "app", "store_pos", "marketplace", "call_center"]

STORE_LOCATIONS = [
    "Bengaluru - Indiranagar", "Bengaluru - Koramangala", "Mumbai - Bandra",
    "Delhi - CP", "Pune - Baner", "Hyderabad - Gachibowli",
]


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_code = Column(String, unique=True, index=True)
    customer_name = Column(String)
    customer_phone = Column(String)
    source = Column(String)                 # website / app / store_pos / marketplace / call_center
    store_location = Column(String)

    # Eyewear-specific attributes
    frame_model = Column(String)
    lens_type = Column(String)               # single_vision / bifocal / progressive / high_index / photochromic / blue_cut
    lens_index = Column(String)               # 1.50 / 1.56 / 1.61 / 1.67 / 1.74
    coating = Column(String)                  # AR / blue_cut / UV / scratch_resistant / photochromic_coat
    prescription_json = Column(JSON)           # {od_sph, od_cyl, od_axis, os_sph, os_cyl, os_axis, pd}

    # Inventory decision
    power_in_house = Column(Boolean, default=None)  # decided at power_check stage
    inventory_match_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=True)

    # Lifecycle
    current_stage = Column(String, default="order_placed")
    status = Column(String, default="on_track")   # on_track / at_risk / breached / delivered / cancelled
    qc_attempts = Column(Integer, default=0)
    reorder_of = Column(Integer, ForeignKey("orders.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    sla_due_at = Column(DateTime)
    delivered_at = Column(DateTime, nullable=True)

    stage_logs = relationship("StageLog", back_populates="order", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="order", cascade="all, delete-orphan")


class StageLog(Base):
    """Every transition is logged here -> powers TAT history + audit + delay reasons."""
    __tablename__ = "stage_logs"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    from_stage = Column(String, nullable=True)
    to_stage = Column(String)
    changed_by = Column(String, default="system")
    delay_reason = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order", back_populates="stage_logs")


class InventoryItem(Base):
    """In-house stock of lens blanks, keyed by power range / index / coating combo."""
    __tablename__ = "inventory_items"

    id = Column(Integer, primary_key=True, index=True)
    lens_type = Column(String)
    lens_index = Column(String)
    coating = Column(String)
    sph_min = Column(Float)
    sph_max = Column(Float)
    cyl_min = Column(Float)
    cyl_max = Column(Float)
    qty_on_hand = Column(Integer, default=0)
    reorder_level = Column(Integer, default=10)
    avg_velocity_per_day = Column(Float, default=0.0)  # derived from past data


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    alert_type = Column(String)              # breach_predicted / breached / qc_failed
    channel = Column(String)                  # email / whatsapp
    risk_score = Column(Float)
    message = Column(Text)
    sent_at = Column(DateTime, default=datetime.utcnow)
    acknowledged = Column(Boolean, default=False)

    order = relationship("Order", back_populates="alerts")
