import datetime as dt
import math

from fastapi import APIRouter, Body, HTTPException
from sqlmodel import select

from app.common.crud import PROTECTED, coerce, fetch, make_crud_router, rows_for, serialize, serialize_one
from app.common.numbering import next_number
from app.common.state import move, save
from app.core.db import SessionDep
from app.modules.billing.service import add_charge
from app.modules.clinical.service import summary
from app.modules.ipd.models import Admission, DischargeSummary
from app.modules.masters.models import Bed, Ward
from app.modules.patients.models import Patient

BED_STATES = {"Vacant", "Cleaning", "Blocked"}


def occupy(session, bed_id):
    bed = fetch(session, Bed, bed_id)
    if bed.status != "Vacant":
        raise HTTPException(400, f"Bed {bed.code} is {bed.status}")
    bed.status = "Occupied"
    session.add(bed)


def release(session, bed_id):
    bed = fetch(session, Bed, bed_id)
    bed.status = "Cleaning"
    session.add(bed)


def charge_bed_days(session, admission):
    bed = fetch(session, Bed, admission.bed_id)
    ward = fetch(session, Ward, bed.ward_id)
    days = max(1, math.ceil((dt.datetime.now() - admission.bed_since).total_seconds() / 86400))
    add_charge(
        session,
        admission.patient_id,
        f"Bed charges {ward.name} {bed.code}",
        ward.bed_rate,
        days,
        "Bed",
        "IPD",
        admission.id,
    )


def prepare_admission(session, admission):
    admission.adm_no = next_number(session, "ADM", "AD")
    occupy(session, admission.bed_id)


extra = APIRouter()


@extra.get("/board")
def board(session: SessionDep):
    admitted = rows_for(session, Admission, Admission.status == "Admitted")
    by_bed = {row["bed_id"]: row for row in serialize(session, admitted)}
    result = []
    for ward in rows_for(session, Ward, Ward.active == True):
        beds = rows_for(session, Bed, Bed.ward_id == ward.id, Bed.active == True, order=Bed.code)
        result.append(
            {
                **ward.model_dump(mode="json"),
                "beds": [{**bed.model_dump(mode="json"), "admission": by_bed.get(bed.id)} for bed in beds],
            }
        )
    return result


@extra.post("/beds/{bed_id}/status")
def set_bed_status(bed_id: int, session: SessionDep, body: dict = Body(...)):
    bed = fetch(session, Bed, bed_id)
    if bed.status == "Occupied" or body["status"] not in BED_STATES:
        raise HTTPException(400, "Bed status cannot be changed")
    bed.status = body["status"]
    return serialize_one(session, save(session, bed))


@extra.post("/admissions/{admission_id}/transfer")
def transfer(admission_id: int, session: SessionDep, body: dict = Body(...)):
    admission = fetch(session, Admission, admission_id)
    if admission.status != "Admitted":
        raise HTTPException(400, "Admission is not active")
    occupy(session, body["bed_id"])
    charge_bed_days(session, admission)
    release(session, admission.bed_id)
    admission.bed_id = body["bed_id"]
    admission.bed_since = dt.datetime.now()
    return serialize_one(session, save(session, admission))


@extra.post("/admissions/{admission_id}/discharge")
def discharge(admission_id: int, session: SessionDep):
    admission = move(fetch(session, Admission, admission_id), "Discharged", {"Admitted"})
    charge_bed_days(session, admission)
    release(session, admission.bed_id)
    admission.discharge_date = dt.datetime.now()
    return serialize_one(session, save(session, admission))


@extra.get("/admissions/{admission_id}/summary")
def discharge_summary(admission_id: int, session: SessionDep):
    admission = fetch(session, Admission, admission_id)
    record = session.exec(select(DischargeSummary).where(DischargeSummary.admission_id == admission_id)).first()
    return {
        "admission": serialize_one(session, admission),
        "patient": session.get(Patient, admission.patient_id).model_dump(mode="json"),
        "summary": record.model_dump(mode="json") if record else None,
        **summary(session, "IPD", admission_id),
    }


@extra.put("/admissions/{admission_id}/summary")
def save_summary(admission_id: int, session: SessionDep, body: dict = Body(...)):
    fetch(session, Admission, admission_id)
    record = session.exec(select(DischargeSummary).where(DischargeSummary.admission_id == admission_id)).first()
    record = record or DischargeSummary(admission_id=admission_id)
    for key, value in body.items():
        if key in DischargeSummary.model_fields and key not in PROTECTED | {"admission_id"}:
            setattr(record, key, coerce(DischargeSummary, key, value))
    return save(session, record).model_dump(mode="json")


router = APIRouter(prefix="/api/ipd")
router.include_router(extra)
router.include_router(
    make_crud_router(Admission, "/admissions", search=("adm_no",), before_create=prepare_admission)
)
