from typing import Optional

from sqlmodel import Field

from app.common.models import Base


class Charge(Base, table=True):
    patient_id: int = Field(index=True)
    description: str
    category: str = "General"
    rate: float = 0
    qty: float = 1
    amount: float = 0
    ref_type: Optional[str] = None
    ref_id: Optional[int] = None
    billed_bill_id: Optional[int] = Field(default=None, index=True)


class Bill(Base, table=True):
    bill_no: str = Field(index=True)
    patient_id: int = Field(index=True)
    total: float = 0
    discount: float = 0
    net: float = 0


class Payment(Base, table=True):
    receipt_no: str = Field(index=True)
    bill_id: int = Field(index=True)
    patient_id: int = Field(index=True)
    mode_id: Optional[int] = None
    amount: float
