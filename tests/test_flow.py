import datetime as dt

from tests.conftest import create

TODAY = dt.date.today().isoformat()


def test_patient_numbering_and_search(client, patient):
    assert patient["mrn"].startswith("MRN")
    found = client.get("/api/patients", params={"q": "Test Pat"}).json()
    assert any(p["id"] == patient["id"] for p in found)


def test_validation_error_is_422(client):
    assert client.post("/api/patients", json={}).status_code == 422


def test_master_soft_delete_and_filter(client):
    dept = create(client, "/api/masters/departments", name="Temp Dept")
    client.delete(f"/api/masters/departments/{dept['id']}")
    active = client.get("/api/masters/departments", params={"active": "true"}).json()
    assert all(d["id"] != dept["id"] for d in active)


def test_appointment_queue_to_bill_and_receipt(client, patient, doctor):
    appt = create(client, "/api/appointments", patient_id=patient["id"], doctor_id=doctor["id"], date=TODAY)
    checked = client.post(f"/api/appointments/{appt['id']}/checkin").json()
    assert checked["status"] == "Waiting" and checked["token"] >= 1
    assert client.post(f"/api/appointments/{appt['id']}/checkin").status_code == 400

    queue = client.get("/api/appointments/queue", params={"date": TODAY}).json()
    assert any(a["id"] == appt["id"] for a in queue)

    consult = create(client, "/api/opd/consultations", patient_id=patient["id"], doctor_id=doctor["id"], appointment_id=appt["id"], complaint="Fever")
    assert client.get(f"/api/appointments/{appt['id']}").json()["status"] == "InConsultation"
    create(client, "/api/clinical/diagnoses", patient_id=patient["id"], ref_type="OPD", ref_id=consult["id"], icd_code="R50.9")
    summary = client.get(f"/api/opd/consultations/{consult['id']}/summary").json()
    assert summary["diagnoses"][0]["description"] == "Fever, unspecified"
    client.post(f"/api/opd/consultations/{consult['id']}/complete")
    assert client.get(f"/api/appointments/{appt['id']}").json()["status"] == "Done"

    unbilled = client.get("/api/billing/charges/unbilled", params={"patient_id": patient["id"]}).json()
    assert unbilled[0]["amount"] == 500
    bill = create(client, "/api/billing/bills", patient_id=patient["id"], discount=100)
    assert bill["net"] == 400 and bill["status"] == "Unpaid"
    mode = client.get("/api/masters/payment-modes").json()[0]
    payment = create(client, f"/api/billing/bills/{bill['id']}/payments", amount=150, mode_id=mode["id"])
    assert client.get(f"/api/billing/bills/{bill['id']}").json()["status"] == "Partial"
    assert client.post(f"/api/billing/bills/{bill['id']}/payments", json={"amount": 999}).status_code == 400
    receipt = client.get(f"/api/billing/payments/{payment['id']}/receipt").json()
    assert receipt["bill"]["due"] == 250


def test_bed_lifecycle_and_discharge(client, patient, doctor):
    board = client.get("/api/ipd/board").json()
    bed = board[0]["beds"][0]
    admission = create(client, "/api/ipd/admissions", patient_id=patient["id"], doctor_id=doctor["id"], bed_id=bed["id"], reason="Observation")
    assert client.get(f"/api/masters/beds/{bed['id']}").json()["status"] == "Occupied"
    assert client.post("/api/ipd/admissions", json={"patient_id": patient["id"], "doctor_id": doctor["id"], "bed_id": bed["id"]}).status_code == 400

    target = board[0]["beds"][1]
    client.post(f"/api/ipd/admissions/{admission['id']}/transfer", json={"bed_id": target["id"]})
    assert client.get(f"/api/masters/beds/{bed['id']}").json()["status"] == "Cleaning"

    client.put(f"/api/ipd/admissions/{admission['id']}/summary", json={"final_diagnosis": "Resolved", "advice": "Rest"})
    client.post(f"/api/ipd/admissions/{admission['id']}/discharge")
    assert client.get(f"/api/masters/beds/{target['id']}").json()["status"] == "Cleaning"
    document = client.get(f"/api/ipd/admissions/{admission['id']}/summary").json()
    assert document["summary"]["final_diagnosis"] == "Resolved"
    assert client.post(f"/api/ipd/beds/{bed['id']}/status", json={"status": "Vacant"}).json()["status"] == "Vacant"
    charges = client.get("/api/billing/charges/unbilled", params={"patient_id": patient["id"], "ref_type": "IPD"}).json()
    assert len(charges) == 2


def test_pharmacy_dispense_reduces_stock(client, patient):
    before = {r["drug_id"]: r["qty"] for r in client.get("/api/pharmacy/stock").json()}
    drug_id = 2
    create(client, "/api/pharmacy/dispense", patient_id=patient["id"], items=[{"drug_id": drug_id, "qty": 5}])
    after = {r["drug_id"]: r["qty"] for r in client.get("/api/pharmacy/stock").json()}
    assert before[drug_id] - after[drug_id] == 5
    assert client.post("/api/pharmacy/dispense", json={"patient_id": patient["id"], "items": [{"drug_id": drug_id, "qty": 10**6}]}).status_code == 400


def test_lab_flow_flags_abnormal(client, patient):
    test = client.get("/api/masters/lab-tests").json()[0]
    order = create(client, "/api/lab/orders", patient_id=patient["id"], test_id=test["id"])
    client.post(f"/api/lab/orders/{order['id']}/collect")
    resulted = client.post(f"/api/lab/orders/{order['id']}/result", json={"result_value": "5"}).json()
    assert resulted["flag"] == "L"
    report = client.get("/api/lab/report", params={"patient_id": patient["id"]}).json()
    assert report["results"][0]["reference"] == "12.0 - 16.0"


def test_dialysis_generate_start_complete(client, patient):
    machine = client.get("/api/masters/machines").json()[0]
    weekday = dt.date.today().strftime("%a")
    create(client, "/api/dialysis/schedules", patient_id=patient["id"], machine_id=machine["id"], days=weekday)
    assert client.post("/api/dialysis/sessions/generate", json={"date": TODAY}).json()["created"] >= 1
    run = [s for s in client.get("/api/dialysis/sessions", params={"patient_id": patient["id"]}).json()][0]
    client.post(f"/api/dialysis/sessions/{run['id']}/start")
    create(client, "/api/dialysis/readings", session_id=run["id"], time="10:00", bp_sys=130, bp_dia=80, pulse=76)
    client.post(f"/api/dialysis/sessions/{run['id']}/complete")
    sheet = client.get(f"/api/dialysis/sessions/{run['id']}/flowsheet").json()
    assert sheet["session"]["status"] == "Completed" and len(sheet["readings"]) == 1


def test_wellness_bmi_and_mis(client, patient):
    record = create(client, "/api/wellness/records", patient_id=patient["id"], height=170, weight=72.25)
    assert record["bmi"] == 25.0
    report = client.get("/api/mis/daily").json()
    cards = {c["label"]: c["value"] for c in report["cards"]}
    assert cards["New registrations"] >= 1
    assert report["total_revenue"] > 0
    assert client.get("/api/mis/daily.csv").text.startswith("Section,Item,Value")


def test_patient_history(client, patient, doctor):
    create(client, "/api/appointments", patient_id=patient["id"], doctor_id=doctor["id"], date=TODAY)
    events = client.get(f"/api/patients/{patient['id']}/history").json()
    assert events and events[0]["type"] in {"Appointment", "Bill"}
