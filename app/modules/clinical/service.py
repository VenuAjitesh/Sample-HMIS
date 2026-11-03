
from app.common.crud import rows_for, serialize
from app.modules.clinical.models import Diagnosis, Prescription, Vitals
from app.modules.lab.models import LabOrder


def summary(session, ref_type, ref_id):
    def collect(model):
        return serialize(session, rows_for(session, model, model.ref_type == ref_type, model.ref_id == ref_id))

    return {
        "vitals": collect(Vitals),
        "diagnoses": collect(Diagnosis),
        "prescriptions": collect(Prescription),
        "lab_orders": collect(LabOrder),
    }
