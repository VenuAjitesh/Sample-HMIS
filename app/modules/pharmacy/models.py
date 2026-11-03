import datetime as dt
from typing import Optional

from sqlmodel import Field

from app.common.models import Base


class StockBatch(Base, table=True):
    drug_id: int = Field(index=True)
    batch_no: str
    expiry: dt.date
    qty: int = 0
    purchase_rate: float = 0
    mrp: float = 0


class StockLedger(Base, table=True):
    drug_id: int = Field(index=True)
    batch_id: int
    qty_change: int
    kind: str
    ref_type: Optional[str] = None
    ref_id: Optional[int] = None
