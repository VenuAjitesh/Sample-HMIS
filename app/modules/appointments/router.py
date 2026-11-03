import datetime as dt
from typing import Optional

from fastapi import APIRouter, Body, Query

from app.common.crud import fetch, make_crud_router, rows_for, serialize, serialize_one
from app.common.numbering import next_daily
from app.common.state import move, save
from app.core.db import SessionDep
from app.modules.appointments.models import Appointment
from app.modules.billing.service import add_service_charge

TRANSITIONS = {
    "Waiting": {"Booked"},
    "InConsultation": {"Waiting"},
    "Done": {"InConsultation", "Waiting"},
    "Cancelled": {"Booked", "Waiting"},
}

extra = APIRouter()


@extra.get("/queue")
def queue(
    session: SessionDep,
    on: Optional[dt.date] = Query(None, alias="date"),
    doctor_id: Optional[int] = None,
):
    conditions = [Appointment.date == (on or dt.date.today()), Appointment.status.in_(["Waiting", "InConsultation"])]
    if doctor_id:
        conditions.append(Appointment.doctor_id == doctor_id)
    return serialize(session, rows_for(session, Appointment, *conditions, order=Appointment.token))


@extra.post("/{appointment_id}/checkin")
def check_in(appointment_id: int, session: SessionDep):
    appointment = move(fetch(session, Appointment, appointment_id), "Waiting", TRANSITIONS["Waiting"])
    appointment.token = next_daily(session, f"TOKEN:{appointment.doctor_id}", appointment.date)
    add_service_charge(session, appointment.patient_id, "CONSULT", ref_type="APPT", ref_id=appointment.id)
    return serialize_one(session, save(session, appointment))


@extra.post("/{appointment_id}/status")
def set_status(appointment_id: int, session: SessionDep, body: dict = Body(...)):
    target = body["status"]
    appointment = move(fetch(session, Appointment, appointment_id), target, TRANSITIONS.get(target, set()))
    return serialize_one(session, save(session, appointment))


router = make_crud_router(
    Appointment, "/api/appointments", order=Appointment.date.desc(), extra=extra
)
