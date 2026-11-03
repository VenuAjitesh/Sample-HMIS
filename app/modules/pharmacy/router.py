import datetime as dt
from typing import Optional

from fastapi import APIRouter, Body
from pydantic import BaseModel, Field

from app.common.crud import fetch, make_crud_router, rows_for
from app.core.db import SessionDep
from app.modules.clinical.models import Prescription
from app.modules.masters.models import Drug
from app.modules.pharmacy.models import StockBatch, StockLedger
from app.modules.pharmacy.service import dispense_item, receive_stock

EXPIRY_WARNING_DAYS = 90

router = APIRouter(prefix="/api/pharmacy")


class Item(BaseModel):
    drug_id: int
    qty: int = Field(gt=0)


class Dispense(BaseModel):
    patient_id: int
    items: list[Item]
    ref_type: Optional[str] = None
    ref_id: Optional[int] = None
    prescription_id: Optional[int] = None


@router.get("/stock")
def stock(session: SessionDep):
    batches = rows_for(session, StockBatch, StockBatch.qty > 0)
    horizon = dt.date.today() + dt.timedelta(days=EXPIRY_WARNING_DAYS)
    rows = []
    for drug in rows_for(session, Drug, Drug.active == True, order=Drug.name):
        own = [b for b in batches if b.drug_id == drug.id]
        nearest = min((b.expiry for b in own), default=None)
        total = sum(b.qty for b in own)
        rows.append(
            {
                "drug_id": drug.id,
                "drug_label": drug.name,
                "unit": drug.unit,
                "qty": total,
                "reorder_level": drug.reorder_level,
                "nearest_expiry": nearest.isoformat() if nearest else None,
                "low": total <= drug.reorder_level,
                "expiring": bool(nearest and nearest <= horizon),
            }
        )
    return rows


@router.post("/receive")
def receive(session: SessionDep, body: dict = Body(...)):
    batch = receive_stock(
        session,
        body["drug_id"],
        body["batch_no"],
        dt.date.fromisoformat(body["expiry"]),
        int(body["qty"]),
        body.get("purchase_rate") or 0,
        body.get("mrp") or 0,
    )
    session.commit()
    return {"batch_id": batch.id}


@router.post("/dispense")
def dispense(session: SessionDep, body: Dispense):
    ref_type, ref_id = body.ref_type, body.ref_id
    prescription = fetch(session, Prescription, body.prescription_id) if body.prescription_id else None
    if prescription:
        ref_type, ref_id = prescription.ref_type, prescription.ref_id
        prescription.dispensed = True
        session.add(prescription)
    for item in body.items:
        dispense_item(session, body.patient_id, item.drug_id, item.qty, ref_type, ref_id)
    session.commit()
    return {"dispensed": len(body.items)}


router.include_router(make_crud_router(StockBatch, "/batches", writable=False, order=StockBatch.expiry))
router.include_router(make_crud_router(StockLedger, "/ledger", writable=False))
