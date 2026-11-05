## ABDM M1 scope for this demo

- Defer scan and share / scan and register (SHARE_PATIENT_PROFILE_701, 702): this demo runs on
  localhost with no public callback URL. List it in the plan as "deferred", do not build it.
- Do not run the NHA functional test cases (no `/abdm-test`, no workbook, no `abdm-ft/` setup, no
  per-functionality test loops). List the mandatory test case IDs in the plan as "not run in this demo".
  A functionality is done when its journey works once against the sandbox.
- Everything else mandatory for a private entity is in scope.
