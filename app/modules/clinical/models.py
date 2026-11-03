from typing import Optional

from sqlmodel import Field

from app.common.models import Base


class Vitals(Base, table=True):
    patient_id: int = Field(index=True)
    ref_type: str = Field(index=True)
    ref_id: int = Field(index=True)
    bp_sys: Optional[int] = None
    bp_dia: Optional[int] = None
    pulse: Optional[int] = None
    temp: Optional[float] = None
    spo2: Optional[int] = None
    weight: Optional[float] = None
    height: Optional[float] = None


class Diagnosis(Base, table=True):
    patient_id: int = Field(index=True)
    ref_type: str = Field(index=True)
    ref_id: int = Field(index=True)
    icd_code: str
    description: str = ""
    kind: str = "Primary"


class Prescription(Base, table=True):
    patient_id: int = Field(index=True)
    ref_type: str = Field(index=True)
    ref_id: int = Field(index=True)
    drug_id: int
    dose: str = ""
    frequency: str = ""
    duration: str = ""
    qty: int = 1
    dispensed: bool = False
