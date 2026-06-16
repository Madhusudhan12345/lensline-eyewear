"""
Seeds the database with:
1. Inventory items (in-house lens stock) with realistic power-range coverage.
2. ~400 historical (completed) orders with realistic stage durations, some
   breaches, some QC failures/re-orders -> this is the "past data" the
   TAT predictor and inventory logic learn from.
3. A handful of LIVE in-flight orders for the demo dashboard.

Run: python seed.py
"""
import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import engine, SessionLocal
from models import (
    Base, Order, StageLog, InventoryItem, LENS_TYPE_SLA_HOURS, STAGES,
    ORDER_SOURCES, STORE_LOCATIONS
)

random.seed(42)

LENS_TYPES = list(LENS_TYPE_SLA_HOURS.keys())
LENS_INDICES = ["1.50", "1.56", "1.61", "1.67", "1.74"]
COATINGS = ["AR", "UV", "blue_cut", "scratch_resistant", "photochromic_coat"]
FRAMES = ["Aviator Classic", "Round Wire", "Wayframe Pro", "Urban Square",
          "Cat Eye Luxe", "Sport Wrap", "Vintage Hex", "Minimal Rim"]
FIRST_NAMES = ["Aarav", "Vihaan", "Diya", "Ishaan", "Ananya", "Kabir", "Myra",
               "Rohan", "Saanvi", "Aditya", "Priya", "Karan", "Neha", "Rahul"]
LAST_NAMES = ["Sharma", "Verma", "Iyer", "Reddy", "Nair", "Gupta", "Singh", "Mehta"]


def rand_name():
    return f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"


def rand_prescription():
    return {
        "od_sph": round(random.uniform(-6, 4), 2),
        "od_cyl": round(random.uniform(-2, 0), 2),
        "od_axis": random.randint(0, 180),
        "os_sph": round(random.uniform(-6, 4), 2),
        "os_cyl": round(random.uniform(-2, 0), 2),
        "os_axis": random.randint(0, 180),
        "pd": round(random.uniform(58, 68), 1),
    }


def seed_inventory(db: Session):
    items = []
    for lt in LENS_TYPES:
        for li in LENS_INDICES:
            for coat in COATINGS:
                # Not every combo is stocked in-house -- mirrors real life
                if random.random() < 0.55:
                    continue
                sph_min = random.choice([-8, -6, -4])
                sph_max = random.choice([4, 6, 8])
                items.append(InventoryItem(
                    lens_type=lt, lens_index=li, coating=coat,
                    sph_min=sph_min, sph_max=sph_max,
                    cyl_min=-2.0, cyl_max=0.0,
                    qty_on_hand=random.randint(0, 80),
                    reorder_level=random.choice([10, 15, 20]),
                    avg_velocity_per_day=round(random.uniform(0.5, 6.0), 2),
                ))
    db.add_all(items)
    db.commit()


def make_order_code(i):
    return f"EYW-{10000 + i}"


def seed_historical_orders(db: Session, n=420):
    """Generate completed historical orders with realistic stage timing,
    occasional QC failures (re-order loop) and SLA breaches, spread over
    the last 120 days. This is the dataset the TAT predictor learns from."""
    base_now = datetime.utcnow()

    for i in range(n):
        lens_type = random.choice(LENS_TYPES)
        sla_hours = LENS_TYPE_SLA_HOURS[lens_type]
        created_days_ago = random.randint(2, 120)
        created_at = base_now - timedelta(days=created_days_ago, hours=random.randint(0, 23))

        in_house = random.random() < 0.62  # in-house hit rate ~62%
        source = random.choice(ORDER_SOURCES)
        store = random.choice(STORE_LOCATIONS)

        # Simulate stage-by-stage elapsed time with noise; in-house orders move faster
        speed_factor = 0.75 if in_house else 1.25
        elapsed_hours = 0.0
        logs = []
        prev_stage = None
        qc_attempts = 0
        cur_time = created_at

        for stage in STAGES:
            # base share of SLA each stage consumes
            share = {
                "order_placed": 0.03, "prescription_verified": 0.07,
                "power_check": 0.05, "lens_sourcing": 0.20,
                "lens_cutting_fitting": 0.30, "quality_check": 0.10,
                "packed": 0.05, "dispatched": 0.15, "delivered": 0.05,
            }[stage]
            noise = random.uniform(0.7, 1.6)
            stage_hours = sla_hours * share * speed_factor * noise
            cur_time = cur_time + timedelta(hours=stage_hours)
            elapsed_hours += stage_hours

            delay_reason = None
            if stage in ("lens_sourcing", "lens_cutting_fitting") and random.random() < 0.12:
                delay_reason = random.choice([
                    "Supplier delay on lens blank", "Power not in stock, sourced externally",
                    "Machine downtime at lab", "Awaiting frame from vendor",
                ])
                cur_time += timedelta(hours=random.uniform(4, 20))

            logs.append((prev_stage, stage, cur_time, delay_reason))
            prev_stage = stage

            # QC failure loop-back, ~9% of orders fail QC at least once
            if stage == "quality_check" and random.random() < 0.09:
                qc_attempts += 1
                logs.append(("quality_check", "lens_cutting_fitting", cur_time, "QC failed - redone"))
                rework_hours = sla_hours * 0.25 * random.uniform(0.8, 1.3)
                cur_time += timedelta(hours=rework_hours)
                logs.append(("lens_cutting_fitting", "quality_check", cur_time, None))
                cur_time += timedelta(hours=sla_hours * 0.08)
                logs.append(("quality_check", "packed", cur_time, None))
                prev_stage = "packed"

        delivered_at = cur_time
        sla_due_at = created_at + timedelta(hours=sla_hours)
        breached = delivered_at > sla_due_at
        status = "delivered"

        order = Order(
            order_code=make_order_code(i),
            customer_name=rand_name(),
            customer_phone=f"9{random.randint(100000000, 999999999)}",
            source=source,
            store_location=store,
            frame_model=random.choice(FRAMES),
            lens_type=lens_type,
            lens_index=random.choice(LENS_INDICES),
            coating=random.choice(COATINGS),
            prescription_json=rand_prescription(),
            power_in_house=in_house,
            current_stage="delivered",
            status=status,
            qc_attempts=qc_attempts,
            created_at=created_at,
            updated_at=delivered_at,
            sla_due_at=sla_due_at,
            delivered_at=delivered_at,
        )
        db.add(order)
        db.flush()

        for from_s, to_s, ts, reason in logs:
            db.add(StageLog(
                order_id=order.id, from_stage=from_s, to_stage=to_s,
                changed_by="system_seed", delay_reason=reason, timestamp=ts,
            ))

        # tag breach in a log note for transparency (status itself stays 'delivered')
        if breached:
            db.add(StageLog(
                order_id=order.id, from_stage="delivered", to_stage="delivered",
                changed_by="system", delay_reason="SLA_BREACHED", timestamp=delivered_at,
            ))

    db.commit()


def seed_live_orders(db: Session, n=28):
    """In-flight orders at various stages for the live dashboard demo."""
    base_now = datetime.utcnow()
    start_idx = 9000

    live_stage_pool = STAGES[:-1]  # exclude 'delivered' for in-flight

    for i in range(n):
        lens_type = random.choice(LENS_TYPES)
        sla_hours = LENS_TYPE_SLA_HOURS[lens_type]
        hours_ago_created = random.uniform(1, sla_hours * 1.3)
        created_at = base_now - timedelta(hours=hours_ago_created)
        sla_due_at = created_at + timedelta(hours=sla_hours)

        stage_idx = min(int((hours_ago_created / sla_hours) * len(live_stage_pool)), len(live_stage_pool) - 1)
        stage_idx = max(0, stage_idx + random.randint(-1, 1))
        stage_idx = max(0, min(stage_idx, len(live_stage_pool) - 1))
        current_stage = live_stage_pool[stage_idx]

        in_house = random.random() < 0.62
        now = base_now
        if now > sla_due_at:
            status = "breached"
        elif (sla_due_at - now).total_seconds() < sla_hours * 3600 * 0.2:
            status = "at_risk"
        else:
            status = "on_track"

        order = Order(
            order_code=make_order_code(start_idx + i),
            customer_name=rand_name(),
            customer_phone=f"9{random.randint(100000000, 999999999)}",
            source=random.choice(ORDER_SOURCES),
            store_location=random.choice(STORE_LOCATIONS),
            frame_model=random.choice(FRAMES),
            lens_type=lens_type,
            lens_index=random.choice(LENS_INDICES),
            coating=random.choice(COATINGS),
            prescription_json=rand_prescription(),
            power_in_house=in_house,
            current_stage=current_stage,
            status=status,
            qc_attempts=1 if (current_stage == "lens_cutting_fitting" and random.random() < 0.15) else 0,
            created_at=created_at,
            updated_at=created_at + timedelta(hours=hours_ago_created * 0.8),
            sla_due_at=sla_due_at,
        )
        db.add(order)
        db.flush()
        db.add(StageLog(order_id=order.id, from_stage=None, to_stage="order_placed",
                         changed_by="system_seed", timestamp=created_at))
        if current_stage != "order_placed":
            db.add(StageLog(order_id=order.id, from_stage="order_placed", to_stage=current_stage,
                             changed_by="system_seed", timestamp=order.updated_at))
    db.commit()


def main():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_inventory(db)
        seed_historical_orders(db, n=420)
        seed_live_orders(db, n=28)
        print("Seed complete.")
        print("Orders:", db.query(Order).count())
        print("Inventory items:", db.query(InventoryItem).count())
    finally:
        db.close()


if __name__ == "__main__":
    main()
