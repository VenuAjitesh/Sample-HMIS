import datetime as dt
from typing import Optional

from sqlmodel import Field

from app.common.models import Base


class Patient(Base, table=True):
    mrn: str = Field(default="", index=True)
    name: str
    gender: str = "Male"
    dob: Optional[dt.date] = None
    phone: str = ""
    blood_group: str = ""
    address: str = ""
    active: bool = True
