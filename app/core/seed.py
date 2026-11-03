import datetime as dt

from sqlmodel import Session, select

from app.common.numbering import next_number
from app.core.db import engine
from app.modules.dialysis.models import DialysisSchedule
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
from app.modules.patients.models import Patient
from app.modules.pharmacy.service import receive_stock

DEPARTMENTS = ["General Medicine", "Nephrology", "Paediatrics", "Orthopaedics", "Wellness"]
DOCTORS = [
    ("Dr. Asha Rao", 1, "MD General Medicine"),
    ("Dr. Vikram Shah", 2, "DM Nephrology"),
    ("Dr. Meera Nair", 3, "MD Paediatrics"),
    ("Dr. Rohan Iyer", 4, "MS Orthopaedics"),
    ("Dr. Kavya Menon", 5, "MD Preventive Medicine"),
]
SERVICES = [
    ("CONSULT", "OPD Consultation", "Consultation", 500),
    ("DIALYSIS", "Haemodialysis Session", "Dialysis", 1800),
    ("WELL-BASIC", "Basic Health Checkup", "Wellness", 1500),
    ("WELL-FULL", "Executive Health Checkup", "Wellness", 4500),
    ("DRESSING", "Dressing / Minor Procedure", "Procedure", 300),
]
ICD10 = [
    ("A09", "Infectious gastroenteritis"), ("B34.9", "Viral infection, unspecified"),
    ("D64.9", "Anaemia, unspecified"), ("E11.9", "Type 2 diabetes mellitus"),
    ("E78.5", "Hyperlipidaemia"), ("E66.9", "Obesity, unspecified"),
    ("I10", "Essential hypertension"), ("I25.9", "Chronic ischaemic heart disease"),
    ("J06.9", "Acute upper respiratory infection"), ("J18.9", "Pneumonia, unspecified"),
    ("J45.9", "Asthma, unspecified"), ("K29.7", "Gastritis, unspecified"),
    ("K80.2", "Gallbladder calculus"), ("M54.5", "Low back pain"),
    ("M17.9", "Osteoarthritis of knee"), ("N17.9", "Acute kidney failure"),
    ("N18.5", "Chronic kidney disease stage 5"), ("N39.0", "Urinary tract infection"),
    ("R50.9", "Fever, unspecified"), ("R51", "Headache"),
    ("S52.5", "Fracture of lower end of radius"), ("Z49.1", "Extracorporeal dialysis"),
    ("O80", "Single spontaneous delivery"), ("L30.9", "Dermatitis, unspecified"),
    ("G43.9", "Migraine, unspecified"), ("F41.9", "Anxiety disorder, unspecified"),
    ("H10.9", "Conjunctivitis, unspecified"), ("K35.8", "Acute appendicitis"),
    ("E03.9", "Hypothyroidism, unspecified"), ("A91", "Dengue fever"),
]
DRUGS = [
    ("Paracetamol 500mg", "Paracetamol", "Tab", 2, 100), ("Amoxicillin 500mg", "Amoxicillin", "Cap", 8, 50),
    ("Azithromycin 500mg", "Azithromycin", "Tab", 20, 30), ("Metformin 500mg", "Metformin", "Tab", 3, 100),
    ("Amlodipine 5mg", "Amlodipine", "Tab", 4, 60), ("Atorvastatin 10mg", "Atorvastatin", "Tab", 9, 60),
    ("Pantoprazole 40mg", "Pantoprazole", "Tab", 7, 60), ("Ondansetron 4mg", "Ondansetron", "Tab", 6, 40),
    ("Cetirizine 10mg", "Cetirizine", "Tab", 3, 50), ("Salbutamol Inhaler", "Salbutamol", "Inh", 120, 10),
    ("ORS Sachet", "ORS", "Sac", 12, 50), ("Diclofenac 50mg", "Diclofenac", "Tab", 3, 80),
    ("Erythropoietin 4000IU", "Epoetin", "Inj", 650, 20), ("Heparin 5000IU", "Heparin", "Inj", 140, 20),
    ("Iron Sucrose 100mg", "Iron sucrose", "Inj", 380, 15), ("Calcium Carbonate 500mg", "Calcium", "Tab", 4, 60),
    ("Furosemide 40mg", "Furosemide", "Tab", 2, 50), ("Insulin Glargine", "Insulin", "Vial", 780, 10),
    ("Levothyroxine 50mcg", "Levothyroxine", "Tab", 3, 60), ("Normal Saline 500ml", "NaCl 0.9%", "Bag", 45, 30),
]
LAB_TESTS = [
    ("Haemoglobin", "g/dL", 12, 16, 150), ("Total Leukocyte Count", "/cu.mm", 4000, 11000, 200),
    ("Platelet Count", "/cu.mm", 150000, 410000, 250), ("Fasting Blood Sugar", "mg/dL", 70, 100, 100),
    ("Post-prandial Blood Sugar", "mg/dL", 70, 140, 100), ("HbA1c", "%", 4, 5.6, 450),
    ("Serum Creatinine", "mg/dL", 0.6, 1.3, 250), ("Blood Urea", "mg/dL", 15, 40, 200),
    ("Serum Potassium", "mmol/L", 3.5, 5.1, 250), ("Serum Sodium", "mmol/L", 135, 145, 250),
    ("Total Cholesterol", "mg/dL", 0, 200, 300), ("SGPT (ALT)", "U/L", 7, 56, 250),
    ("TSH", "uIU/mL", 0.4, 4.0, 400), ("Serum Ferritin", "ng/mL", 30, 400, 550), ("C-Reactive Protein", "mg/L", 0, 6, 350),
]
PATIENTS = [
    ("Ramesh Kumar", "Male", dt.date(1968, 3, 12), "9876500001", "B+"),
    ("Sunita Devi", "Female", dt.date(1975, 8, 2), "9876500002", "O+"),
    ("Arjun Patel", "Male", dt.date(1990, 1, 25), "9876500003", "A+"),
    ("Fatima Begum", "Female", dt.date(1958, 11, 9), "9876500004", "AB-"),
    ("Baby Ananya", "Female", dt.date(2021, 5, 17), "9876500005", "O-"),
]
WARDS = [("General Ward", 800, "G", 12), ("Private Ward", 2500, "P", 8)]
PAYMENT_MODES = ["Cash", "Card", "UPI", "Insurance"]


def add_all(session, model, rows):
    objects = [model(**row) for row in rows]
    session.add_all(objects)
    session.flush()
    return objects


def seed_masters(session):
    add_all(session, Department, [{"name": n} for n in DEPARTMENTS])
    add_all(session, Doctor, [{"name": n, "department_id": d, "qualification": q} for n, d, q in DOCTORS])
    add_all(session, Service, [{"code": c, "name": n, "category": cat, "rate": r} for c, n, cat, r in SERVICES])
    add_all(session, Icd10, [{"code": c, "description": d} for c, d in ICD10])
    add_all(session, LabTest, [{"name": n, "unit": u, "ref_low": lo, "ref_high": hi, "rate": r} for n, u, lo, hi, r in LAB_TESTS])
    add_all(session, PaymentMode, [{"name": n} for n in PAYMENT_MODES])
    add_all(session, DialysisMachine, [{"name": f"HD Machine {i}"} for i in range(1, 5)])
    for name, rate, prefix, size in WARDS:
        ward = add_all(session, Ward, [{"name": name, "bed_rate": rate}])[0]
        add_all(session, Bed, [{"ward_id": ward.id, "code": f"{prefix}-{i:02d}"} for i in range(1, size + 1)])


def seed_pharmacy(session):
    drugs = add_all(session, Drug, [{"name": n, "generic": g, "unit": u, "rate": r, "reorder_level": 15} for n, g, u, r, _ in DRUGS])
    today = dt.date.today()
    for drug, (*_, qty) in zip(drugs, DRUGS):
        receive_stock(session, drug.id, f"B{drug.id:03d}A", today + dt.timedelta(days=540), qty * 3, drug.rate * 0.6, drug.rate)
    receive_stock(session, drugs[0].id, "B001X", today + dt.timedelta(days=45), 40, 1.2, 2)


def seed_patients(session):
    for name, gender, dob, phone, blood in PATIENTS:
        session.add(
            Patient(mrn=next_number(session, "MRN", "MRN"), name=name, gender=gender, dob=dob, phone=phone, blood_group=blood)
        )
    session.flush()
    session.add(DialysisSchedule(patient_id=1, machine_id=1, days="Mon,Wed,Fri", shift="Morning"))
    session.add(DialysisSchedule(patient_id=4, machine_id=2, days="Tue,Thu,Sat", shift="Afternoon"))


def seed_if_empty():
    with Session(engine) as session:
        if session.exec(select(Department)).first():
            return
        seed_masters(session)
        seed_pharmacy(session)
        seed_patients(session)
        session.commit()
