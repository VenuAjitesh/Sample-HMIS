from fastapi import APIRouter

from app.common.crud import fetch, make_crud_router, serialize_one
from app.common.state import move, save
from app.core.db import SessionDep
from app.modules.appointments.models import Appointment
from app.modules.clinical.service import summary
from app.modules.opd.models import Consultation
from app.modules.patients.models import Patient


def start_appointment(session, consultation):
    appointment = session.get(Appointment, consultation.appointment_id) if consultation.appointment_id else None
    if appointment and appointment.status == "Waiting":
        appointment.status = "InConsultation"
        session.add(appointment)


extra = APIRouter()


@extra.post("/{consultation_id}/complete")
def complete(consultation_id: int, session: SessionDep):
    consultation = move(fetch(session, Consultation, consultation_id), "Completed", {"Open"})
    appointment = session.get(Appointment, consultation.appointment_id) if consultation.appointment_id else None
    if appointment:
        appointment.status = "Done"
        session.add(appointment)
    return serialize_one(session, save(session, consultation))


@extra.get("/{consultation_id}/summary")
def consultation_summary(consultation_id: int, session: SessionDep):
    consultation = fetch(session, Consultation, consultation_id)
    return {
        "consultation": serialize_one(session, consultation),
        "patient": session.get(Patient, consultation.patient_id).model_dump(mode="json"),
        **summary(session, "OPD", consultation_id),
    }


router = make_crud_router(
    Consultation,
    "/api/opd/consultations",
    after_create=start_appointment,
    extra=extra,
)
