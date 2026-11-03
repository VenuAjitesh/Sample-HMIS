from fastapi import APIRouter

from app.common.crud import fetch, make_crud_router, rows_for, serialize
from app.common.numbering import next_number
from app.core.db import SessionDep
from app.modules.appointments.models import Appointment
from app.modules.billing.models import Bill
from app.modules.dialysis.models import DialysisSession
from app.modules.ipd.models import Admission
from app.modules.lab.models import LabOrder
from app.modules.opd.models import Consultation
from app.modules.patients.models import Patient
from app.modules.wellness.models import WellnessRecord

HISTORY = [
    ("Appointment", Appointment, "date", lambda r: f"{r.get('doctor_label')} · {r['status']}"),
    ("Consultation", Consultation, "created_at", lambda r: r["complaint"] or r["status"]),
    ("Admission", Admission, "admit_date", lambda r: f"{r['adm_no']} · {r['status']}"),
    ("Lab", LabOrder, "ordered_at", lambda r: f"{r.get('test_label')} · {r['status']}"),
    ("Dialysis", DialysisSession, "date", lambda r: f"{r['shift']} · {r['status']}"),
    ("Wellness", WellnessRecord, "date", lambda r: f"BMI {r['bmi']} · BP {r['bp_sys']}/{r['bp_dia']}"),
    ("Bill", Bill, "created_at", lambda r: f"{r['bill_no']} · net {r['net']}"),
]

extra = APIRouter()


@extra.get("/{patient_id}/history")
def history(patient_id: int, session: SessionDep):
    fetch(session, Patient, patient_id)
    events = []
    for kind, model, field, summarize in HISTORY:
        for row in serialize(session, rows_for(session, model, model.patient_id == patient_id)):
            events.append({"type": kind, "date": row[field], "summary": summarize(row)})
    return sorted(events, key=lambda e: e["date"], reverse=True)


def assign_mrn(session, patient):
    patient.mrn = next_number(session, "MRN", "MRN")


router = make_crud_router(
    Patient, "/api/patients", search=("name", "mrn", "phone"), before_create=assign_mrn, extra=extra
)
