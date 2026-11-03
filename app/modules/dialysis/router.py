import datetime as dt

from fastapi import APIRouter, Body

from app.common.crud import fetch, make_crud_router, rows_for, serialize, serialize_one
from app.common.state import move, save
from app.core.db import SessionDep
from app.modules.billing.service import add_service_charge
from app.modules.dialysis.models import DialysisReading, DialysisSchedule, DialysisSession
from app.modules.masters.models import DialysisMachine
from app.modules.patients.models import Patient


def set_machine(session, machine_id, status):
    machine = session.get(DialysisMachine, machine_id) if machine_id else None
    if machine:
        machine.status = status
        session.add(machine)


extra = APIRouter()


@extra.post("/generate")
def generate(session: SessionDep, body: dict = Body(...)):
    day = dt.date.fromisoformat(body["date"])
    weekday = day.strftime("%a")
    existing = {s.patient_id for s in rows_for(session, DialysisSession, DialysisSession.date == day)}
    created = []
    for schedule in rows_for(session, DialysisSchedule, DialysisSchedule.active == True):
        if weekday in schedule.days and schedule.patient_id not in existing:
            created.append(
                DialysisSession(
                    patient_id=schedule.patient_id, machine_id=schedule.machine_id, date=day, shift=schedule.shift
                )
            )
    session.add_all(created)
    session.commit()
    return {"created": len(created)}


@extra.post("/{session_id}/start")
def start(session_id: int, session: SessionDep):
    run = move(fetch(session, DialysisSession, session_id), "InProgress", {"Scheduled"})
    run.start_time = dt.datetime.now()
    set_machine(session, run.machine_id, "InUse")
    return serialize_one(session, save(session, run))


@extra.post("/{session_id}/complete")
def complete(session_id: int, session: SessionDep):
    run = move(fetch(session, DialysisSession, session_id), "Completed", {"InProgress"})
    run.end_time = dt.datetime.now()
    set_machine(session, run.machine_id, "Available")
    add_service_charge(session, run.patient_id, "DIALYSIS", ref_type="DIAL", ref_id=run.id)
    return serialize_one(session, save(session, run))


@extra.get("/{session_id}/flowsheet")
def flowsheet(session_id: int, session: SessionDep):
    run = fetch(session, DialysisSession, session_id)
    return {
        "session": serialize_one(session, run),
        "patient": session.get(Patient, run.patient_id).model_dump(mode="json"),
        "readings": serialize(
            session, rows_for(session, DialysisReading, DialysisReading.session_id == session_id, order=DialysisReading.time)
        ),
    }


router = APIRouter(prefix="/api/dialysis")
router.include_router(make_crud_router(DialysisSession, "/sessions", order=DialysisSession.id.desc(), extra=extra))
router.include_router(make_crud_router(DialysisSchedule, "/schedules"))
router.include_router(make_crud_router(DialysisReading, "/readings", order=DialysisReading.time))
