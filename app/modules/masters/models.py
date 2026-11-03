from typing import Optional

from sqlmodel import Field

from app.common.models import Base


class Department(Base, table=True):
    name: str
    active: bool = True


class Doctor(Base, table=True):
    name: str
    department_id: Optional[int] = Field(default=None, index=True)
    qualification: str = ""
    active: bool = True


class Service(Base, table=True):
    code: str = Field(index=True, unique=True)
    name: str
    category: str = "General"
    rate: float = 0
    active: bool = True


class Drug(Base, table=True):
    name: str
    generic: str = ""
    unit: str = "Tab"
    rate: float = 0
    reorder_level: int = 10
    active: bool = True


class LabTest(Base, table=True):
    name: str
    unit: str = ""
    ref_low: Optional[float] = None
    ref_high: Optional[float] = None
    rate: float = 0
    active: bool = True


class Ward(Base, table=True):
    name: str
    bed_rate: float = 0
    active: bool = True


class Bed(Base, table=True):
    ward_id: int = Field(index=True)
    code: str
    status: str = "Vacant"
    active: bool = True


class DialysisMachine(Base, table=True):
    name: str
    status: str = "Available"
    active: bool = True


class PaymentMode(Base, table=True):
    name: str
    active: bool = True


class Icd10(Base, table=True):
    code: str = Field(index=True)
    description: str
    active: bool = True
