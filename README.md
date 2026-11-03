# Ajitesh Hospital HMIS

A small open-source Hospital Management Information System: FastAPI + SQLModel backend, dependency-free vanilla JS frontend.

## Modules

Patient registration · Appointments & OPD queue · OPD consultation notes (vitals, ICD-10 diagnoses, prescriptions) · Live ward board with bed management · IPD admission, transfer, discharge summaries · Dialysis unit (schedules, sessions, flowsheets) · Laboratory · Pharmacy stock (batches, FEFO dispensing, ledger) · Wellness records and trends · Billing with receipts · Daily MIS with CSV export · Master data.

## Run

```
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open http://localhost:8000 (API docs at `/docs`). SQLite `hmis.db` is created and seeded on first start. Set `DATABASE_URL` to use another database and `FACILITY_NAME` to rebrand print-outs.

## Docker

```
docker compose up --build
```

Open http://localhost:8000. Data persists in the `hmis-data` volume; set `FACILITY_NAME` in `docker-compose.yml` to rebrand.

## Test

```
pytest
```

## Structure

- `app/common/crud.py` – generic CRUD router factory used by every entity (filters via query string, `field__gte/lte`, search `q`).
- `app/common/labels.py` – automatic `<field>_label` for foreign keys; `app/core/registry.py` wires routers and labels.
- `app/modules/<name>/` – `models.py` and `router.py` per module. Every module raises charges through `billing/service.py`.
- `web/js/ui/` – reusable table, form, CRUD panel, tabs, charts and print documents; `web/js/pages/` – thin page configs.

Adding an entity: define a model, register `make_crud_router(Model, "/api/...")`, add a page config.

## Not included

Authentication/roles, audit trail, multi-facility, ABDM/NHCX integration.

MIT licensed.
