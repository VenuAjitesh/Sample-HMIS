import datetime as dt
from typing import Optional

from sqlmodel import Field

from app.common.models import Base


class Appointment(Base, table=True):
    patient_id: int = Field(index=True)
    doctor_id: int = Field(index=True)
    date: dt.date
    slot: str = ""
    reason: str = ""
    status: str = "Booked"
    token: Optional[int] = None
