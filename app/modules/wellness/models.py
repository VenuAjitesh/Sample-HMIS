import datetime as dt
from typing import Optional

from sqlmodel import Field

from app.common.models import Base


class WellnessRecord(Base, table=True):
    patient_id: int = Field(index=True)
    date: dt.date = Field(default_factory=dt.date.today)
    service_id: Optional[int] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    bmi: Optional[float] = None
    bp_sys: Optional[int] = None
    bp_dia: Optional[int] = None
    glucose: Optional[float] = None
    cholesterol: Optional[float] = None
    notes: str = ""
