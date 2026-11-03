from app.common import labels
from app.modules.appointments.router import router as appointments
from app.modules.billing.router import router as billing
from app.modules.clinical.router import router as clinical
from app.modules.dialysis.router import router as dialysis
from app.modules.ipd.router import router as ipd
from app.modules.lab.router import router as lab
from app.modules.masters.models import (
    Bed,
    Department,
    DialysisMachine,
    Doctor,
    Drug,
    LabTest,
    PaymentMode,
    Service,
    Ward,
)
from app.modules.masters.router import router as masters
from app.modules.mis.router import router as mis
from app.modules.opd.router import router as opd
from app.modules.patients.models import Patient
from app.modules.patients.router import router as patients
from app.modules.pharmacy.router import router as pharmacy
from app.modules.wellness.router import router as wellness

ROUTERS = [masters, patients, appointments, opd, clinical, ipd, dialysis, lab, pharmacy, wellness, billing, mis]

LABEL_FIELDS = [
    ("patient_id", Patient, lambda p: f"{p.mrn} · {p.name}"),
    ("doctor_id", Doctor),
    ("department_id", Department),
    ("service_id", Service),
    ("drug_id", Drug),
    ("test_id", LabTest),
    ("ward_id", Ward),
    ("bed_id", Bed, lambda b: b.code),
    ("machine_id", DialysisMachine),
    ("mode_id", PaymentMode),
]


def register_labels():
    for field, model, *fn in LABEL_FIELDS:
        labels.register(field, model, *fn)
