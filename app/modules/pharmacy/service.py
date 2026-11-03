import datetime as dt

from fastapi import HTTPException

from app.common.crud import fetch, rows_for
from app.modules.billing.service import add_charge
from app.modules.masters.models import Drug
from app.modules.pharmacy.models import StockBatch, StockLedger


def receive_stock(session, drug_id, batch_no, expiry, qty, purchase_rate=0, mrp=0):
    batch = StockBatch(
        drug_id=drug_id, batch_no=batch_no, expiry=expiry, qty=qty, purchase_rate=purchase_rate, mrp=mrp
    )
    session.add(batch)
    session.flush()
    session.add(StockLedger(drug_id=drug_id, batch_id=batch.id, qty_change=qty, kind="Receive"))
    return batch


def issue_stock(session, drug_id, qty, ref_type=None, ref_id=None):
    batches = rows_for(
        session,
        StockBatch,
        StockBatch.drug_id == drug_id,
        StockBatch.qty > 0,
        StockBatch.expiry >= dt.date.today(),
        order=StockBatch.expiry,
    )
    remaining = qty
    for batch in batches:
        take = min(batch.qty, remaining)
        batch.qty -= take
        remaining -= take
        session.add(batch)
        session.add(
            StockLedger(drug_id=drug_id, batch_id=batch.id, qty_change=-take, kind="Dispense", ref_type=ref_type, ref_id=ref_id)
        )
        if remaining == 0:
            return
    raise HTTPException(400, f"Insufficient stock for {fetch(session, Drug, drug_id).name}")


def dispense_item(session, patient_id, drug_id, qty, ref_type=None, ref_id=None):
    drug = fetch(session, Drug, drug_id)
    issue_stock(session, drug_id, qty, ref_type, ref_id)
    add_charge(session, patient_id, f"{drug.name} x{qty}", drug.rate, qty, "Pharmacy", ref_type, ref_id)
