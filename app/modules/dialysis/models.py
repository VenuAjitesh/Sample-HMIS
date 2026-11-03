import datetime as dt
from typing import Optional

from pydantic import NaiveDatetime
from sqlmodel import Field

from app.common.models import Base


class DialysisSchedule(Base, table=True):
    patient_id: int = Field(index=True)
    machine_id: Optional[int] = None
    days: str = "Mon,Wed,Fri"
    shift: str = "Morning"
    active: bool = True


class DialysisSession(Base, table=True):
    patient_id: int = Field(index=True)
    machine_id: Optional[int] = None
    date: dt.date = Field(index=True)
    shift: str = "Morning"
    status: str = "Scheduled"
    access_type: str = ""
    dialyzer: str = ""
    heparin: str = ""
    pre_weight: Optional[float] = None
    post_weight: Optional[float] = None
    uf_goal: Optional[float] = None
    uf_achieved: Optional[float] = None
    start_time: Optional[NaiveDatetime] = None
    end_time: Optional[NaiveDatetime] = None
    notes: str = ""


class DialysisReading(Base, table=True):
    session_id: int = Field(index=True)
    time: str = ""
    bp_sys: Optional[int] = None
    bp_dia: Optional[int] = None
    pulse: Optional[int] = None
    blood_flow: Optional[int] = None
    dialysate_flow: Optional[int] = None
    venous_pressure: Optional[int] = None
    arterial_pressure: Optional[int] = None
    uf_rate: Optional[float] = None
    remarks: str = ""
