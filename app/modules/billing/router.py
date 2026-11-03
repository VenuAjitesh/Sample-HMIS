from typing import Optional

from fastapi import APIRouter, Body, HTTPException
from sqlmodel import func, select

from app.common.crud import fetch, make_crud_router, rows_for, serialize, serialize_one
from app.common.numbering import next_number
from app.common.state import save
from app.core.db import SessionDep
from app.modules.billing.models import Bill, Charge, Payment
from app.modules.patients.models import Patient

router = APIRouter(prefix="/api/billing")


def price(obj):
    obj.amount = round(obj.rate * obj.qty, 2)


def unbilled(session, patient_id, ref_type=None, ref_id=None):
    conditions = [Charge.patient_id == patient_id, Charge.billed_bill_id.is_(None)]
    if ref_type:
        conditions.append(Charge.ref_type == ref_type)
    if ref_id:
        conditions.append(Charge.ref_id == ref_id)
    return rows_for(session, Charge, *conditions)


def paid_amount(session, bill_id):
    return session.exec(select(func.coalesce(func.sum(Payment.amount), 0)).where(Payment.bill_id == bill_id)).one()


def bill_row(session, bill):
    paid = paid_amount(session, bill.id)
    due = round(bill.net - paid, 2)
    status = "Paid" if due <= 0 else "Partial" if paid > 0 else "Unpaid"
    return {**serialize_one(session, bill), "paid": paid, "due": due, "status": status}


def bill_detail(session, bill):
    return {
        **bill_row(session, bill),
        "patient": session.get(Patient, bill.patient_id).model_dump(mode="json"),
        "charges": serialize(session, rows_for(session, Charge, Charge.billed_bill_id == bill.id)),
        "payments": serialize(session, rows_for(session, Payment, Payment.bill_id == bill.id)),
    }


charges_extra = APIRouter()


@charges_extra.get("/unbilled")
def list_unbilled(session: SessionDep, patient_id: int, ref_type: Optional[str] = None, ref_id: Optional[int] = None):
    return serialize(session, unbilled(session, patient_id, ref_type, ref_id))


bills = APIRouter(prefix="/bills", tags=["Bill"])


@bills.get("")
def list_bills(session: SessionDep, patient_id: Optional[int] = None, status: Optional[str] = None):
    stmt = select(Bill).order_by(Bill.id.desc())
    if patient_id:
        stmt = stmt.where(Bill.patient_id == patient_id)
    rows = [bill_row(session, bill) for bill in session.exec(stmt).all()]
    return [row for row in rows if not status or row["status"] == status]


@bills.post("")
def create_bill(session: SessionDep, body: dict = Body(...)):
    patient_id = body["patient_id"]
    charges = unbilled(session, patient_id, body.get("ref_type"), body.get("ref_id"))
    if not charges:
        raise HTTPException(400, "No unbilled charges for this patient")
    total = round(sum(c.amount for c in charges), 2)
    discount = min(float(body.get("discount") or 0), total)
    bill = Bill(
        bill_no=next_number(session, "BILL", "BL"),
        patient_id=patient_id,
        total=total,
        discount=discount,
        net=round(total - discount, 2),
    )
    session.add(bill)
    session.flush()
    for charge in charges:
        charge.billed_bill_id = bill.id
        session.add(charge)
    session.commit()
    return bill_detail(session, bill)


@bills.get("/{bill_id}")
def get_bill(bill_id: int, session: SessionDep):
    return bill_detail(session, fetch(session, Bill, bill_id))


@bills.post("/{bill_id}/payments")
def pay_bill(bill_id: int, session: SessionDep, body: dict = Body(...)):
    bill = fetch(session, Bill, bill_id)
    amount = round(float(body["amount"]), 2)
    due = bill_row(session, bill)["due"]
    if amount <= 0 or amount > due:
        raise HTTPException(400, f"Amount must be between 0 and {due}")
    payment = Payment(
        receipt_no=next_number(session, "RCPT", "RC"),
        bill_id=bill.id,
        patient_id=bill.patient_id,
        mode_id=body.get("mode_id"),
        amount=amount,
    )
    save(session, payment)
    return serialize_one(session, payment)


payments_extra = APIRouter()


@payments_extra.get("/{payment_id}/receipt")
def receipt(payment_id: int, session: SessionDep):
    payment = fetch(session, Payment, payment_id)
    bill = fetch(session, Bill, payment.bill_id)
    return {
        "payment": serialize_one(session, payment),
        "bill": bill_row(session, bill),
        "patient": session.get(Patient, payment.patient_id).model_dump(mode="json"),
    }


router.include_router(
    make_crud_router(Charge, "/charges", search=("description",), before_create=lambda s, o: price(o), extra=charges_extra)
)
router.include_router(bills)
router.include_router(make_crud_router(Payment, "/payments", writable=False, extra=payments_extra))
