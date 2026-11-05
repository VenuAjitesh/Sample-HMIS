# Sample HMIS

FastAPI + SQLModel backend (`app/`), dependency-free vanilla JS frontend (`web/`, ES modules, no build step). SQLite by default.

## Run and test

- `pip install -r requirements.txt`, then `uvicorn app.main:app --reload` → http://localhost:8000 (login `admin` / `admin`, API docs at `/docs`).
- `pytest` — tests use a throwaway SQLite file (`tests/conftest.py`); `tests/test_flow.py` walks the main hospital flow.
- Config comes from env vars or `.env` (copy `.env.example`). All settings live in `app/core/config.py`.

## Layout

- `app/modules/<name>/` — `models.py` (SQLModel tables) and `router.py` per module; register new routers in `app/core/registry.py`.
- `app/common/crud.py` — `make_crud_router(Model, path, search=..., before_create=..., extra=APIRouter)` gives list/get/create/update/delete. Custom endpoints go on the `extra` router.
- `app/common/models.py` — `Base` adds `id` and `created_at` to every table.
- `app/modules/auth/` — bearer-token sessions; `access.py` maps roles to the API areas they can reach. New API areas must be added there or `guard` rejects them.
- `web/js/pages/<name>.js` — one page config each, routed in `web/js/router.js`. Reusable pieces in `web/js/ui/` (`crud.js`, `form.js`, `modal.js`, `table.js`, `dom.js` with the `h()` element helper). `web/js/api.js` is the fetch wrapper.

## Patient registration (where ABDM M1 plugs in)

- Model: `app/modules/patients/models.py` (`Patient`: mrn, name, gender, dob, phone, blood_group, address). MRN is assigned in `before_create` in `router.py`.
- Page: `web/js/pages/patients.js` — a `crudPanel` with `PATIENT_FIELDS`.
- `crudPanel` supports putting a step before the form: pass `onNew: (openNew) => ...` to intercept the "New patient" button, then call `openNew({ name, gender, dob, phone, address, ... })` to open the form prefilled. `panel.openNew(prefill)` does the same from outside.
- Registration must still work without an ABHA.

## Database

- No migrations. On startup `init_db()` creates missing tables and adds missing columns (nullable) and their indexes to existing tables. Renames, type changes or drops need a fresh DB: delete `hmis.db` (it is re-seeded on start).

## ABDM

- Sandbox settings: `ABDM_CLIENT_ID`, `ABDM_CLIENT_SECRET`, `ABDM_GATEWAY_URL`, `ABDM_ABHA_URL`, `ABDM_X_CM_ID`, `ABDM_CALLBACK_URL` in `app/core/config.py`.
- `httpx` (HTTP client) and `cryptography` (RSA encryption of Aadhaar / mobile / OTP) are already in `requirements.txt`.
- Callbacks need a public HTTPS URL (tunnel to port 8000); put it in `ABDM_CALLBACK_URL`.
- Never commit `.env`, tokens, OTPs or patient identifiers.

## ABDM integration: skip the plan file

- Skip the `INTEGRATION-PLAN.md` step that the abdm-docs MCP server and the `abdm-*` skills ask for. Don't create, read, resume from or update a plan file, and don't wait for plan approval before building. This instruction overrides that step.
- The `INTEGRATION-PLAN.md` in the repo records an earlier M1 integration. It is not a tracker to resume.
- Everything else in the skills still applies. Take every path, header, payload field and error code from the abdm-docs server, and still ask the entity-type and deployment questions. The speed comes from skipping the paperwork, not from skipping the source checks.
