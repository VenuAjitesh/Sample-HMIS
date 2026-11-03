import csv
import datetime as dt
import io
from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import Response
from sqlmodel import func, select

from app.core.db import SessionDep
from app.modules.appointments.models import Appointment
from app.modules.billing.models import Charge, Payment
from app.modules.dialysis.models import DialysisSession
from app.modules.ipd.models import Admission
from app.modules.lab.models import LabOrder
from app.modules.masters.models import Bed, PaymentMode
from app.modules.opd.models import Consultation
from app.modules.patients.models import Patient
from app.modules.pharmacy.models import StockLedger

router = APIRouter(prefix="/api/mis", tags=["MIS"])


def count(session, model, column, day, *conditions):
    stmt = select(func.count()).select_from(model).where(func.date(column) == day.isoformat(), *conditions)
    return session.exec(stmt).one()


def total(session, model, column, day):
    return session.exec(
        select(func.coalesce(func.sum(model.amount), 0)).where(func.date(column) == day.isoformat())
    ).one()


def grouped(session, label_column, amount_column, date_column, day):
    stmt = (
        select(label_column, func.sum(amount_column))
        .where(func.date(date_column) == day.isoformat())
        .group_by(label_column)
    )
    return [(label, round(amount, 2)) for label, amount in session.exec(stmt).all()]


def daily_report(session, day):
    beds = session.exec(select(func.count()).select_from(Bed).where(Bed.active == True)).one()
    occupied = session.exec(select(func.count()).select_from(Bed).where(Bed.status == "Occupied")).one()
    inpatients = session.exec(select(func.count()).select_from(Admission).where(Admission.status == "Admitted")).one()
    modes = {m.id: m.name for m in session.exec(select(PaymentMode)).all()}
    cards = [
        ("New registrations", count(session, Patient, Patient.created_at, day)),
        ("Appointments booked", count(session, Appointment, Appointment.date, day)),
        ("OPD consultations", count(session, Consultation, Consultation.created_at, day)),
        ("Admissions", count(session, Admission, Admission.admit_date, day)),
        ("Discharges", count(session, Admission, Admission.discharge_date, day)),
        ("Current inpatients", inpatients),
        ("Bed occupancy", f"{occupied} / {beds} ({round(100 * occupied / beds) if beds else 0}%)"),
        ("Dialysis sessions completed", count(session, DialysisSession, DialysisSession.date, day, DialysisSession.status == "Completed")),
        ("Lab tests ordered", count(session, LabOrder, LabOrder.ordered_at, day)),
        ("Lab tests resulted", count(session, LabOrder, LabOrder.resulted_at, day)),
        ("Pharmacy items dispensed", count(session, StockLedger, StockLedger.created_at, day, StockLedger.kind == "Dispense")),
    ]
    revenue = grouped(session, Charge.category, Charge.amount, Charge.created_at, day)
    collections = [(modes.get(mode, "Unspecified"), amount) for mode, amount in grouped(session, Payment.mode_id, Payment.amount, Payment.created_at, day)]
    return {
        "date": day.isoformat(),
        "cards": [{"label": label, "value": value} for label, value in cards],
        "revenue": [{"label": label, "amount": amount} for label, amount in revenue],
        "collections": [{"label": label, "amount": amount} for label, amount in collections],
        "total_revenue": round(sum(a for _, a in revenue), 2),
        "total_collection": round(sum(a for _, a in collections), 2),
    }


@router.get("/daily")
def daily(session: SessionDep, on: Optional[dt.date] = Query(None, alias="date")):
    return daily_report(session, on or dt.date.today())


@router.get("/daily.csv")
def daily_csv(session: SessionDep, on: Optional[dt.date] = Query(None, alias="date")):
    report = daily_report(session, on or dt.date.today())
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Section", "Item", "Value"])
    for section, rows, key in (("Summary", report["cards"], "value"), ("Revenue", report["revenue"], "amount"), ("Collections", report["collections"], "amount")):
        writer.writerows([section, row["label"], row[key]] for row in rows)
    return Response(
        buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="mis-{report["date"]}.csv"'},
    )
