from fastapi import APIRouter

from app.common.crud import make_crud_router
from app.modules.masters.models import (
    Bed,
    Department,
    DialysisMachine,
    Doctor,
    Drug,
    Icd10,
    LabTest,
    PaymentMode,
    Service,
    Ward,
)

MASTERS = {
    "departments": (Department, ("name",)),
    "doctors": (Doctor, ("name", "qualification")),
    "services": (Service, ("code", "name", "category")),
    "drugs": (Drug, ("name", "generic")),
    "lab-tests": (LabTest, ("name",)),
    "wards": (Ward, ("name",)),
    "beds": (Bed, ("code",)),
    "machines": (DialysisMachine, ("name",)),
    "payment-modes": (PaymentMode, ("name",)),
    "icd10": (Icd10, ("code", "description")),
}

router = APIRouter(prefix="/api/masters")

for name, (model, search) in MASTERS.items():
    router.include_router(make_crud_router(model, f"/{name}", search=search, order=model.id))
