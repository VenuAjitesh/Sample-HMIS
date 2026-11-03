from app.common.crud import make_crud_router
from app.modules.billing.service import add_charge
from app.modules.masters.models import Service
from app.modules.wellness.models import WellnessRecord


def compute_bmi(session, record):
    if record.height and record.weight:
        record.bmi = round(record.weight / (record.height / 100) ** 2, 1)


def charge_package(session, record):
    service = session.get(Service, record.service_id) if record.service_id else None
    if service:
        add_charge(
            session, record.patient_id, service.name, service.rate, 1, service.category, "WELL", record.id
        )


router = make_crud_router(
    WellnessRecord,
    "/api/wellness/records",
    order=WellnessRecord.date.desc(),
    before_create=compute_bmi,
    before_update=compute_bmi,
    after_create=charge_package,
)
