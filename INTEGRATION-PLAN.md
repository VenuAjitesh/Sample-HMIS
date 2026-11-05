# ABDM M1 integration plan: patient registration

Status: **built; waiting on a live sandbox run with a test person present** · 4 of 13 buildable steps done (31%) · Last updated 2026-11-06

Source of truth: the ABDM Developer Portal, catalogue `2026.09.16`, through the `abdm-docs` MCP server and the
`abdm-m1` skill (abdm-integrators-assistant plugin). Every path, header and field below comes from that catalogue. Each one is cited
by operationId so it can be re-read with `get <operationId>`. Never write a token, secret, OTP, password or patient
identifier into this file.

## 1. Scope

| | |
|---|---|
| Goal | ABHA at the registration desk. Create an ABHA for a patient who has none, verify an existing ABHA, read the profile into the registration form, and update the profile where ABDM permits |
| Role | Private healthcare facility, acting as a provider (HIP side of M1). Entity type answered 2026-11-06 |
| Module / skill | **M1 only**, skill `abdm-m1`. M2 and M3 are separate plans and are not touched here |
| Gateway | HIE-CM sandbox: ABHA service `https://abhasbx.abdm.gov.in`, gateway `https://dev.abdm.gov.in`, `X-CM-ID: sbx` |
| Done means | Each functionality's journey works **once** against the sandbox (CLAUDE.local.md) |

**Deployment interview (2026-11-06):** private entity · the record holds the patient's mobile at check-in (yes) · no
fingerprint or iris reader · no face/ABHA-app route · no driving-licence route. None of the answers adds an optional route.
"Mobile held = yes" means the find-by-mobile journey starts from the phone already in the record instead of asking for it.

**What "update the profile where permitted" means in M1.** For an adult ABHA, the only published profile update is the
**mobile number** (`m1_post_v3_profile_account_request_otp_update_mobile` / `..._verify_update_mobile`). Name, date of birth and gender come from
Aadhaar and stay read-only on every form filled from an ABHA. `PATCH /abha/api/v3/profile/account` is published only for child ABHAs
(`m1_patch_v3_profile_account_child_*`), which are out of scope. Email can be verified once, during creation (optional calls 5–6 of create).

### Out of scope

| Item | Why |
|---|---|
| M2 (care contexts, HIP data flow) and M3 (HIU, consent) | Separate milestones. Separate plans |
| Scan and share / scan and register (SHARE_PATIENT_PROFILE_701, 702) | **Deferred.** It is mandatory for every entity type, but it needs a public HTTPS callback URL and this demo runs on localhost with none (CLAUDE.local.md). Building it later needs `ABDM_CALLBACK_URL` set to a tunnel to :8000 and the callback registered against the facility. Then it becomes the default route, with the identifier routes as the fallback |
| Create by demographic auth (CRT_ABHA_301–309), find ABHA benefits | Government entities only |
| Biometric, face, driving-licence routes; read ABHA QR | Optional. The interview added none |
| Child ABHA create/update | Not requested |
| NHA functional test run (`/abdm-test`, workbook, `abdm-ft/`) | **Not run in this demo** (CLAUDE.local.md). Case IDs are listed in §8 |

## 2. Prerequisites

| # | Prerequisite | State |
|---|---|---|
| P1 | Sandbox client id and secret from ABDM sandbox registration, in `.env` as `ABDM_CLIENT_ID` / `ABDM_CLIENT_SECRET` | Done 2026-11-06 (`.env`, git-ignored) |
| P2 | Outbound HTTPS from the backend to `dev.abdm.gov.in` and `abhasbx.abdm.gov.in` | To confirm at step 1 |
| P3 | Machine clock in sync. `TIMESTAMP` must be UTC ISO-8601 with milliseconds and a trailing `Z` | To confirm at step 1 |
| P4 | Test people for the sandbox runs: an Aadhaar holder with an ABHA, an Aadhaar without one, a mobile with several ABHAs, a mobile with none, and a second mobile for the update. They must be present to read OTPs | Person to arrange |
| P5 | `BENEFIT_NAME` header value, if NHA approved one for this integrator (`enrol/byAadhaar`) | Ask NHA. Omit it if none was approved |
| P6 | `httpx` and `cryptography` | Already in `requirements.txt` |
| P7 | Public callback URL | Not needed for this plan's scope. Needed only for deferred scan-and-share |

## 3. Cross-cutting rules (from `abdm-m1` foundations)

- **Gateway session first.** `POST {GATEWAY}/api/hiecm/gateway/v3/sessions` (`gateway_post_gateway_v3_sessions`) with headers
  `REQUEST-ID`, `TIMESTAMP`, `X-CM-ID` and body `{clientId, clientSecret, grantType: "client_credentials"}`. It has no Authorization header.
  The spec's success status is **202**, but the sandbox returned **200** (§10). The body carries `accessToken`, `expiresIn`, `refreshToken` and `tokenType`. Cache the token and renew it before `expiresIn` runs out.
- **Two tokens, never swapped.** The gateway `accessToken` goes in `Authorization: Bearer …` on every M1 call. The user token from
  enrolment or login goes in `X-token: Bearer …`. Profile/card calls need both. `T-token` (login verify without `refreshToken`) is exchanged at
  `POST /abha/api/v3/profile/login/verify/user` (`m1_post_v3_profile_login_verify_user`). `R-token` refreshes at
  `GET /abha/api/v3/profile/account/request/token`.
- **Encryption.** Aadhaar, ABHA number, mobile, email, OTP and password are RSA-encrypted in-process and then base64'd.
  The key comes from `GET /abha/api/v3/profile/public/certificate` (`m1_get_v3_profile_public_certificate`), which returns `publicKey` and `encryptionAlgorithm`.
  Read the padding from `encryptionAlgorithm` (currently `RSA/ECB/OAEPWithSHA-1AndMGF1Padding`, so OAEP with SHA-1 for both the digest and the MGF). Never hard-code it.
  Add PEM armour to the base64 DER key. Cache it with a TTL. Never log a value before it is encrypted.
- **Every call:** a fresh `REQUEST-ID` UUID, logged before sending, plus `TIMESTAMP`. Read the body, not only the status. Handle an empty body.
  Match error codes on the code itself, tolerating a trailing `": "`. Back off on 401 and never loop credentials.
- **Duplicate-ABHA guard.** On a login, only **`ABDM-1114`** means nobody holds an ABHA, so offer creation only on that code.
  `enrol/byAadhaar` answering 200 with `isNew: false` is the existing account: carry on to its profile, card and address step, not to an error.
  Decide the token exchange from the presence of `refreshToken`, never from `accounts.length`. Creation is from Aadhaar only.
- **Registration completes without an ABHA.** The ABHA step has three exits: success, failure, and **"not now"**. "Not now" opens
  the normal form, and the record is keyed by the MRN as today.
- **Screen honesty.** Show ABDM's message as returned. Show the masked mobile from the `request/otp` `message`. Never mark an update
  done without a success response. Clear all per-patient state between patients.

## 4. Codebase map (survey 2026-11-06)

| Need | Where it lives now | M1 change |
|---|---|---|
| Runtime / run / test | Python, FastAPI + SQLModel. `uvicorn app.main:app`, `pytest` | Tests for the client and guards in `tests/test_abdm.py` (new) |
| Front/back split | `web/` vanilla ES modules call `/api/*` through `web/js/api.js` | Every ABDM call goes through the backend. The browser never sees a gateway token or X-token |
| Outbound HTTP client | None in `app/` (`httpx` only in requirements) | New, at `app/modules/abdm/client.py` |
| Config / secrets | `app/core/config.py` reads `.env` (already has `ABDM_*`) | Reuse. Add `ABDM_BENEFIT_NAME` (optional) |
| Patient model | `app/modules/patients/models.py` `Patient` (mrn, name, gender, dob, phone, address) | Add nullable columns: `abha_number` (indexed), `abha_address`, `abha_kyc_verified`, `email`, `state`, `district`. `init_db()` adds them on start |
| Consent record | none | New table `AbhaConsent` (patient/flow, code `abha-enrollment`, version `1.4`, worker user, beneficiary name, timestamp) in `app/modules/abdm/models.py` |
| Inbound routing / auth | `app/core/registry.py` ROUTERS, `app/modules/auth/access.py` POLICY + `guard` | Register `app/modules/abdm/router.py` at `/api/abdm`. Add `"/api/abdm": (FRONT, FRONT)` to POLICY |
| Public URL | none (localhost) | Callback journeys deferred |
| Crypto helpers | none | RSA-OAEP via `cryptography` in `app/modules/abdm/crypto.py` (new) |
| Registration page | `web/js/pages/patients.js` `crudPanel` + `PATIENT_FIELDS` | `onNew: (openNew) => abhaStep(openNew)`. Prefill and add ABHA fields |
| ABHA step UI | none | New `web/js/ui/abha.js` (wizard in a modal, built on `modal.js` / `dom.js`) |
| Read-only fields | `web/js/ui/form.js` has no per-field read-only | Add `readOnly` support so name, dob and gender lock when filled from an ABHA |
| Errors to user | `web/js/ui/toast.js`, form errors | Errors render on the active wizard step |
| User tokens | n/a | Held **server-side** per flow id (in memory, expiring with `expiresIn`). The browser holds only the opaque flow id |

## 5. Workflow points and screens

The ABHA step sits **before** the registration form and fills it. It opens from "New patient" (`crudPanel` `onNew`).

```
New patient ─► ABHA step ─┬─ Create ABHA (Aadhaar OTP) ───────────────┐
                          ├─ I have an ABHA: identifier first ───────┤
                          │    ABHA number  → Aadhaar OTP | mobile OTP│
                          │    ABHA address → methods from search     ├─► Already linked? ─► comparison screen (no new MRN)
                          │    Aadhaar      → Aadhaar OTP             │        │ no
                          │    Mobile (prefilled from record) → list  │        ▼
                          │                 → pick → OTP              ├─► Confirm form (name/dob/gender read-only) ─► save + link ABHA
                          └─ Not now ─────────────────────────────────┴─► empty/partial form ─► save with MRN only
```

| Screen | Collects | Must never ask | Cases it serves |
|---|---|---|---|
| ABHA entry | Create vs. existing ABHA, plus the identifier | anything already held (the mobile is prefilled) | CRT_ABHA_101, VRFY_ABHA_301 |
| Aadhaar consent | 5 declarations + 2 confirmations (worker name from login, patient name dynamic, "government" removed for a private entity) + T&C "I agree" | names (filled automatically) | CRT_ABHA_102 |
| Aadhaar entry | 12 digits, masked after entry, "Aadhaar Number is not valid" with no call | n/a | CRT_ABHA_104, VRFY_ABHA_401 |
| OTP (shared) | 6 digits. Verify auto-enables. Masked mobile from `message`. Resend after 60 s, at most 2, visible counter. Third press shows "Maximum OTP resend attempts reached. Please try again after 30 mins" with no call. A wrong OTP keeps the `txnId` | the identifier again | CRT_ABHA_105–107, 109, VRFY_ABHA_101/201/102/202/304/307/402/405 |
| Communication mobile | Same as Aadhaar mobile → continue. Different → OTP | n/a | CRT_ABHA_108, 109 |
| ABHA address | at least 3 suggestions + custom field with live green/red rules (8–18 chars incl. `@sbx`, ≤1 dot, ≤1 underscore, not first/last). "ABHA address already exists." → use existing or create new | profile fields | CRT_ABHA_112 |
| Account chooser (mobile) | which of several ABHAs (masked number, address, name). OTP only after the pick | anything the list carries | VRFY_ABHA_302–305 |
| Not found | ABDM-1114 → fixed text + "Create ABHA" (carries the Aadhaar over without re-asking) | n/a | VRFY_ABHA_303, 403 |
| ABHA profile + card | 14-digit number, address, profile. Card view/download, or "card unavailable for non-KYC" | n/a | CRT_ABHA_113, 114, VRFY_ABHA_404 |
| Mobile update offer | Yes/No when the record's mobile ≠ the ABHA mobile → update-mobile OTP | n/a | VRFY_ABHA_101/201 step 5, PROF_ABHA_601 |
| Already linked | "This ABHA profile is already linked to HMIS Beneficiary ID." + side-by-side ABHA vs. record | n/a | VRFY_ABHA_308, TAGGING_… |
| Confirm form | corrections only. name/dob/gender read-only. address/email/mobile/state/district editable | anything the profile carries | VRFY_ABHA_306 and every route |
| Returning-patient match | backend search by mobile + name + gender + age, or MRN. A match links to the existing MRN | n/a | CRT_ABHA_116 |

## 6. Journeys, calls, and outcomes

All calls are on `ABHA = https://abhasbx.abdm.gov.in` unless marked otherwise, and all carry `Authorization` (gateway token), `REQUEST-ID` and `TIMESTAMP`.
Bodies follow the operation named. Encrypted fields are marked 🔒.

**J0. Session + certificate.** `gateway_post_gateway_v3_sessions` (GATEWAY, +`X-CM-ID`) → `m1_get_v3_profile_public_certificate`.

**J1. Create ABHA by Aadhaar OTP** (`m1-create-abha-aadhaar-otp`, then `m1-abha-card-profile`)
1. `POST /abha/api/v3/enrollment/request/otp`: `scope:["abha-enrol"]`, `loginHint:"aadhaar"`, `loginId`🔒, `otpSystem:"aadhaar"` → `txnId` + masked mobile in `message`
2. `POST /abha/api/v3/enrollment/enrol/byAadhaar` (+`BENEFIT_NAME` if approved): `authData.authMethods:["otp"]`, `otp:{txnId, otpValue🔒, mobile}`, `consent:{code:"abha-enrollment", version:"1.4"}` → `isNew`, `tokens`, `ABHAProfile`
3. If the communication mobile differs: `POST …/enrollment/request/otp` (`scope:["abha-enrol","mobile-verify"]`, `loginHint:"mobile"`, `otpSystem:"abdm"`) → `POST …/enrollment/auth/byAbdm`
4. `GET …/enrollment/enrol/suggestion` (header `TRANSACTION_ID: txnId`) → `POST …/enrollment/enrol/abha-address` `{txnId, abhaAddress, preferred:1}` → `healthIdNumber`, `preferredAbhaAddress`
5. `GET /abha/api/v3/profile/account` + `GET …/profile/account/abha-card` (+`X-token`)

**J2. Verify by ABHA number** (`m1-login-abha-number-aadhaar-otp` / `-mobile-otp`)
`POST /abha/api/v3/profile/login/request/otp` `scope:["abha-login","aadhaar-verify"|"mobile-verify"]`, `loginHint:"abha-number"`, `loginId`🔒, `otpSystem:"aadhaar"|"abdm"` → `POST /abha/api/v3/profile/login/verify` → `token`, `refreshToken`, `accounts[]` → `GET /profile/account`.

**J3. Verify by ABHA address** (`m1-abha-address-login-aadhaar-otp` / `-mobile-otp`)
`POST /abha/api/v3/phr/web/login/abha/search` `{abhaAddress}` → offer **only** the returned `authMethods` → `POST …/phr/web/login/abha/request/otp` (`scope:["abha-address-login", …]`, `loginHint:"abha-address"`) → `POST …/phr/web/login/abha/verify` → `GET …/phr/web/login/profile/abha-profile` (+`X-token`) → `GET …/abha/phr-card`.
There is no published mobile update with this token: show the offer, but never show it as done.

**J4. Find ABHA by mobile** (`m1-find-abha-mobile-otp`)
`POST /abha/api/v3/profile/account/abha/search` `{scope:["search-abha"], mobile🔒}` → array `[0].txnId`, `[0].ABHA[]` (`index`, `ABHANumber`, `name`). Read it as plural, up to 6 accounts. If the shape differs (object with `txnId` + `message`, which the spec flags for NHA confirmation), log it.
→ pick → `POST …/profile/login/request/otp` `{scope:["abha-login","search-abha","mobile-verify"], loginHint:"index", loginId🔒, otpSystem:"abdm", txnId}` → `POST …/profile/login/verify` → `GET /profile/account`.
If the verify response has no `refreshToken`: `m1_post_v3_profile_login_verify_user` with `T-token`.

**J5. Verify by Aadhaar OTP** (`m1-login-aadhaar-number`)
`POST …/profile/login/request/otp` `{scope:["abha-login","aadhaar-verify"], loginHint:"aadhaar", loginId🔒, otpSystem:"aadhaar"}` → `POST …/profile/login/verify` → 404 `ABDM-1114` = no ABHA → offer J1 carrying the Aadhaar over. 200 → profile + card.

**J6. Update mobile** (`m1-profile-update-mobile`, X-token from an ABHA-number login)
`POST /abha/api/v3/profile/account/request/otp` `{scope:["abha-profile","mobile-verify"], loginHint:"mobile", loginId🔒, otpSystem:"abdm"}` → `POST …/profile/account/verify` → 200 `"Mobile Number linked successfully"` → re-read the profile to show the new mobile.

**J7. One ABHA per patient** (no ABDM call). Before creating an MRN, look up `abha_number` locally. Found: open the existing patient (comparison screen). Not found: tag the ABHA to the new MRN.

### Synchronous vs. asynchronous

Every journey in scope (J0–J7) is **synchronous request/response** on the ABHA service. **No callbacks** are involved, which is why they work on localhost.
The time-dependent outcomes the screens must handle:

| Outcome | Source | Handling |
|---|---|---|
| OTP delivered out of band (SMS) | `request/otp` 200 + `message` with masked mobile | Show the masked number. Start the 60 s resend timer |
| OTP wrong / expired | 400 naming `otpValue` (login), 422 `ABDM-1204` (enrolment) | Show ABDM's message. Keep `txnId`. Allow retry |
| Resend limit | client rule (2 resends) | Third press: fixed message, no call |
| Transaction expired/invalid | 401 `ABDM-1017` (e.g. suggestion) | Restart the journey from the identifier with a fresh transaction |
| User token expiry | `expiresIn` 1800 s (example) | Refresh with `R-token`, or re-login. `ABDM-1094` often means the wrong token kind |
| Gateway token expiry / bad creds | 401 `900901` / `900902` | Renew the session once. Don't loop |
| No ABHA | 404 `ABDM-1114` (login), 400 `ABDM-1211` (ABHA-address search) | Fixed "not found" text + Create ABHA |
| Existing ABHA on create | 200 `isNew:false` | Continue as success with that account |

The only callback-driven (asynchronous) M1 journey is scan-and-share, which is deferred. When it is built, the screen must show five distinct states: sent, accepted/waiting, answered, refused, and "nothing arrived in the window".

## 7. Steps

| # | Step | Exit condition | Status | Evidence | Date |
|---|---|---|---|---|---|
| 1 | Sandbox credentials in `.env`. Gateway session call from the backend | `sessions` returns 2xx with `accessToken`. A following M1 call is not 401 | **done** | Session 200 (request-id `c0651361-…`). The certificate call then returned 200 with that token | 2026-11-06 |
| 2 | Certificate fetch + RSA encryption helper (padding read from `encryptionAlgorithm`, TTL cache) | An encrypted value is accepted: an OTP request returns `txnId`, not a validation refusal | in progress | Certificate 200: `RSA/ECB/OAEPWithSHA-1AndMGF1Padding`, 4096-bit. OAEP-SHA1 round trip proven in `tests/test_abdm.py`. ABDM accepting an encrypted value is still to be observed: it needs a real mobile or Aadhaar | 2026-11-06 |
| 3 | `app/modules/abdm/` scaffold: client, router at `/api/abdm/m1`, POLICY entry, server-side flow/token store | `pytest tests/test_abdm.py` passes. `guard` admits reception at `/api/abdm` | **done** | `client.py`, `crypto.py`, `flows.py`, `router.py`. `pytest`: 29 passed (15 M1) | 2026-11-06 |
| 4 | Patient columns + `AbhaConsent` table. `form.js` `readOnly` | Columns present after restart. Registration without ABHA still passes | **done** | `init_db` added the columns on start. `test_registration_without_abha_still_works` and `test_flow.py` pass | 2026-11-06 |
| 5 | ABHA step in `patients.js` `onNew` → `web/js/ui/abha.js`, "Not now" exit, shared OTP/resend component | "Not now" opens the form and saves a patient with MRN only | **done** | Browser check: Not now → "New patient" form, ABHA fields read-only. Consent gating, Aadhaar and mobile validation errors on the active step. No console errors | 2026-11-06 |
| 6 | J1 Create ABHA by Aadhaar OTP | One sandbox creation ends on a filled form with a 14-digit ABHA number + address, saved and linked | **blocked** (built) | Mocked flow passes, incl. `isNew:false`, consent block, resend reuses txnId. Needs a person with an Aadhaar-linked phone for OTPs | |
| 7 | J2 Verify by ABHA number (Aadhaar OTP + mobile OTP) | Both methods verify once and fill the form read-only | **blocked** (built) | Needs an ABHA holder present. `loginId` sent hyphenated (`XX-XXXX-XXXX-XXXX`): **unverified**, confirm on the first run | |
| 8 | J3 Verify by ABHA address (methods from search) | Methods shown = `authMethods`. Profile fills the form | **blocked** (built) | Search is reachable through the app (sandbox answered an unknown address, see §10) | 2026-11-06 |
| 9 | J4 Find ABHA by mobile | A list appears before any OTP. The chosen ABHA opens. A no-ABHA mobile shows the not-found screen | **blocked** (built) | Mocked: list before OTP, `index` + search `txnId`, T-token exchange | |
| 10 | J5 Verify by Aadhaar OTP | 200 path fills the form. `ABDM-1114` offers create with the Aadhaar carried over | **blocked** (built) | Mocked: carry-over sends the same encrypted Aadhaar with no re-entry | |
| 11 | J7 One ABHA per patient + returning-patient match + comparison screen | The same ABHA twice leaves one patient row. The second time shows the comparison | **done** (no ABDM call) | `test_one_abha_per_patient` (409 names the MRN), `test_returning_patient_match` | 2026-11-06 |
| 12 | J6 Update mobile | Verify returns success. The re-read profile shows the new masked mobile | **blocked** (built) | Needs an ABHA holder + a second mobile | |
| 13 | End-to-end walk on the registration page | Each journey completed once against the sandbox, with REQUEST-IDs noted here | pending | | |
| 14 | Functional test cases (§8) | **Not run in this demo** (CLAUDE.local.md) | n/a | | |

**Blocked on (one question):** when can a test person with an Aadhaar-linked phone sit with the desk for about 20 minutes to
read OTPs? One person who already holds an ABHA covers steps 7–10 and 12. One Aadhaar without an ABHA, or the same person, covers step 6.

## 8. M1 functional test cases (private entity)

**Not run in this demo.** The IDs are listed so each screen above can be traced to its case.

| Functionality | Mandatory case IDs (private) | Plan step |
|---|---|---|
| Create ABHA by Aadhaar OTP | CRT_ABHA_101, 104, 102, 105, 106, 107, 108, 109, 112 (conditional), 113, 114, 116 | 6, 11 |
| Log in with ABHA number | VRFY_ABHA_101, 201 | 7 |
| Log in with ABHA address | VRFY_ABHA_102, 202 | 8 |
| Find ABHA by mobile | VRFY_ABHA_301, 302, 303, 304, 305, 306, 307, 308 | 9, 11 |
| Log in with Aadhaar OTP | VRFY_ABHA_401, 402, 403, 404, 405 | 10 |
| One ABHA per patient | TAGGING_UNIQUEPATIENTID_UNIQUEABHANUMBER | 11 |
| Scan and share | SHARE_PATIENT_PROFILE_701, 702 | **deferred** |

Optional cases covered by the build: PROF_ABHA_601 (mobile update, step 12). Not built: CRT_ABHA_103 (multilingual consent), CRT_ABHA_115 (own card instead of the ABHA card).

## 10. Observed against the sandbox (differences from the spec)

| Date | Call | Spec says | Sandbox did | Handling |
|---|---|---|---|---|
| 2026-11-06 | `POST /api/hiecm/gateway/v3/sessions` | 202 Accepted | 200 with `accessToken`, `expiresIn` | Client accepts any 2xx |
| 2026-11-06 | `POST /abha/api/v3/phr/web/login/abha/search` (unknown address) | 400 `ABDM-1211` "User not found." | 400 `ABDM-9999` "User not found" | ABDM's message is shown on the active step. Not used for any create decision |
| 2026-11-06 | Same call, with a gateway bearer token | security `basicAuth`, curl sends no Authorization | Bearer accepted (no 401) | Bearer sent |

Run notes: port 8000 on this machine is held by other processes, so run with `uvicorn app.main:app --port 8010`.

## 9. Sources (ABDM Developer Portal)

- M1 API reference: `/docs/hiecm/v3/api/m1` · M1 flows: `/docs/hiecm/v3/milestones/m1` · Test cases: `/docs/hiecm/v3/resources/test-cases/m1`
- Gateway session: `/docs/hiecm/v3/api/gateway/endpoints/gateway-post-gateway-v3-sessions` · Authentication: `/docs/hiecm/v3/reference/authentication`
- Certificate: `/docs/hiecm/v3/api/m1/endpoints/m1-get-v3-profile-public-certificate` · Encryption: `/docs/hiecm/v3/concepts/encryption`
- Verify user (T-token exchange): `/docs/hiecm/v3/api/m1/endpoints/m1-post-v3-profile-login-verify-user`
- Error codes: `/docs/hiecm/v3/reference/error-codes` · Glossary: `/docs/hiecm/v3/getting-started/glossary`
- Consent language (sandbox): https://sandbox.abdm.gov.in/sandbox/v3/new-documentation?doc=consentLanguage
- New vs. returning patients: https://sandbox.abdm.gov.in/sandbox/v3/new-documentation?doc=NewReturningPatients
