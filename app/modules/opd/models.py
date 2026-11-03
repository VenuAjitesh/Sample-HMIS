import datetime as dt
from typing import Optional

from sqlmodel import Field

from app.common.models import Base


class Consultation(Base, table=True):
    patient_id: int = Field(index=True)
    doctor_id: int = Field(index=True)
    appointment_id: Optional[int] = Field(default=None, index=True)
    complaint: str = ""
    examination: str = ""
    assessment: str = ""
    plan: str = ""
    followup_date: Optional[dt.date] = None
    status: str = "Open"
