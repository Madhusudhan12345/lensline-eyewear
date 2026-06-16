from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class Prescription(BaseModel):
    od_sph: float = 0
    od_cyl: float = 0
    od_axis: int = 0
    os_sph: float = 0
    os_cyl: float = 0
    os_axis: int = 0
    pd: float = 62.0


class OrderCreate(BaseModel):
    customer_name: str
    customer_phone: str
    source: str
    store_location: str
    frame_model: str
    lens_type: str
    lens_index: str
    coating: str
    prescription: Prescription


class StageUpdate(BaseModel):
    to_stage: str
    delay_reason: Optional[str] = None
    notes: Optional[str] = None
    changed_by: Optional[str] = None
    qc_failed: Optional[bool] = False


class OrderOut(BaseModel):
    id: int
    order_code: str
    customer_name: str
    customer_phone: str
    source: str
    store_location: str
    frame_model: str
    lens_type: str
    lens_index: str
    coating: str
    prescription: Optional[dict] = None
    power_in_house: Optional[bool] = None
    current_stage: str
    status: str
    qc_attempts: int
    created_at: datetime
    updated_at: datetime
    sla_due_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    sla_hours: float
    hours_remaining: Optional[float] = None
    risk_score: Optional[float] = None
    reorder_of: Optional[int] = None

    class Config:
        from_attributes = True


class StageLogOut(BaseModel):
    from_stage: Optional[str]
    to_stage: str
    delay_reason: Optional[str]
    changed_by: str
    timestamp: datetime


class OrderDetailOut(OrderOut):
    stage_logs: list[dict] = []
