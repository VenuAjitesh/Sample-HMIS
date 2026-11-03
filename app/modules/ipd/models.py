import datetime as dt
from typing import Optional

from pydantic import NaiveDatetime
from sqlmodel import Field

from app.common.models import Base


class Admission(Base, table=True):
    adm_no: str = Field(default="", index=True)
    patient_id: int = Field(index=True)
    doctor_id: int
    bed_id: int = Field(index=True)
    reason: str = ""
    status: str = "Admitted"
    admit_date: NaiveDatetime = Field(default_factory=dt.datetime.now)
    bed_since: NaiveDatetime = Field(default_factory=dt.datetime.now)
    discharge_date: Optional[NaiveDatetime] = None


class DischargeSummary(Base, table=True):
    admission_id: int = Field(index=True, unique=True)
    final_diagnosis: str = ""
    course: str = ""
    procedures: str = ""
    medications: str = ""
    advice: str = ""
    condition: str = "Stable"
    followup_date: Optional[dt.date] = None
