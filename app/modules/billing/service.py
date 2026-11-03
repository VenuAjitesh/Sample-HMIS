from sqlmodel import select

from app.modules.billing.models import Charge
from app.modules.masters.models import Service


def add_charge(session, patient_id, description, rate, qty=1, category="General", ref_type=None, ref_id=None):
    charge = Charge(
        patient_id=patient_id,
        description=description,
        category=category,
        rate=rate,
        qty=qty,
        amount=round(rate * qty, 2),
        ref_type=ref_type,
        ref_id=ref_id,
    )
    session.add(charge)
    return charge


def add_service_charge(session, patient_id, code, qty=1, ref_type=None, ref_id=None):
    service = session.exec(select(Service).where(Service.code == code)).first()
    if not service:
        return None
    return add_charge(session, patient_id, service.name, service.rate, qty, service.category, ref_type, ref_id)
