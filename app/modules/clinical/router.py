from fastapi import APIRouter

from app.common.crud import make_crud_router
from app.modules.clinical.models import Diagnosis, Prescription, Vitals
from app.modules.masters.models import Icd10
from sqlmodel import select

router = APIRouter(prefix="/api/clinical")


def fill_description(session, diagnosis):
    if not diagnosis.description:
        icd = session.exec(select(Icd10).where(Icd10.code == diagnosis.icd_code)).first()
        diagnosis.description = icd.description if icd else diagnosis.icd_code


router.include_router(make_crud_router(Vitals, "/vitals"))
router.include_router(make_crud_router(Diagnosis, "/diagnoses", before_create=fill_description))
router.include_router(make_crud_router(Prescription, "/prescriptions"))
