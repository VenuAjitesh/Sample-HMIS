import datetime as dt
from typing import Optional

from pydantic import NaiveDatetime
from sqlmodel import Field

from app.common.models import Base


class LabOrder(Base, table=True):
    patient_id: int = Field(index=True)
    test_id: int = Field(index=True)
    ref_type: Optional[str] = None
    ref_id: Optional[int] = None
    status: str = "Ordered"
    ordered_at: NaiveDatetime = Field(default_factory=dt.datetime.now)
    collected_at: Optional[NaiveDatetime] = None
    resulted_at: Optional[NaiveDatetime] = None
    result_value: Optional[str] = None
    flag: str = ""
