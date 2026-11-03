import datetime as dt
from typing import Optional

from fastapi import APIRouter, Body

from app.common.crud import fetch, make_crud_router, rows_for, serialize, serialize_one
from app.common.state import move, save
from app.core.db import SessionDep
from app.modules.billing.service import add_charge
from app.modules.lab.models import LabOrder
from app.modules.masters.models import LabTest
from app.modules.patients.models import Patient


def charge_for_order(session, order):
    test = fetch(session, LabTest, order.test_id)
    add_charge(session, order.patient_id, f"Lab: {test.name}", test.rate, 1, "Lab", order.ref_type, order.ref_id)


def flag_for(test, value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return ""
    if test.ref_low is not None and number < test.ref_low:
        return "L"
    if test.ref_high is not None and number > test.ref_high:
        return "H"
    return "N"


extra = APIRouter()


@extra.post("/orders/{order_id}/collect")
def collect(order_id: int, session: SessionDep):
    order = move(fetch(session, LabOrder, order_id), "Collected", {"Ordered"})
    order.collected_at = dt.datetime.now()
    return serialize_one(session, save(session, order))


@extra.post("/orders/{order_id}/result")
def enter_result(order_id: int, session: SessionDep, body: dict = Body(...)):
    order = move(fetch(session, LabOrder, order_id), "Resulted", {"Collected", "Resulted"})
    order.result_value = str(body["result_value"])
    order.flag = flag_for(fetch(session, LabTest, order.test_id), order.result_value)
    order.resulted_at = dt.datetime.now()
    return serialize_one(session, save(session, order))


@extra.get("/report")
def report(
    session: SessionDep,
    patient_id: int,
    ref_type: Optional[str] = None,
    ref_id: Optional[int] = None,
):
    conditions = [LabOrder.patient_id == patient_id, LabOrder.status == "Resulted"]
    if ref_type:
        conditions.append(LabOrder.ref_type == ref_type)
    if ref_id:
        conditions.append(LabOrder.ref_id == ref_id)
    results = []
    for row in serialize(session, rows_for(session, LabOrder, *conditions)):
        test = session.get(LabTest, row["test_id"])
        low, high = test.ref_low, test.ref_high
        reference = "" if low is None and high is None else f"{'' if low is None else low} - {'' if high is None else high}"
        results.append({**row, "unit": test.unit, "reference": reference})
    return {"patient": session.get(Patient, patient_id).model_dump(mode="json"), "results": results}


router = APIRouter(prefix="/api/lab")
router.include_router(extra)
router.include_router(make_crud_router(LabOrder, "/orders", after_create=charge_for_order))
