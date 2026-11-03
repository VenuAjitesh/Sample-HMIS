ROLES = {
    "admin": "Administrator",
    "doctor": "Doctor",
    "nurse": "Nurse",
    "reception": "Front desk",
    "lab": "Lab technician",
    "pharmacist": "Pharmacist",
    "billing": "Billing",
}

EVERYONE = set(ROLES)
ADMIN = {"admin"}
CLINICAL = {"admin", "doctor", "nurse"}
FRONT = CLINICAL | {"reception"}
MONEY = {"admin", "billing", "reception"}

POLICY = {
    "/api/masters": (EVERYONE, ADMIN),
    "/api/patients": (EVERYONE, FRONT),
    "/api/appointments": (EVERYONE, FRONT),
    "/api/opd": (EVERYONE, CLINICAL),
    "/api/clinical": (EVERYONE, CLINICAL),
    "/api/ipd": (EVERYONE, FRONT),
    "/api/dialysis": (EVERYONE, CLINICAL),
    "/api/wellness": (EVERYONE, CLINICAL),
    "/api/lab": (EVERYONE, CLINICAL | {"lab"}),
    "/api/pharmacy": (EVERYONE, {"admin", "pharmacist"}),
    "/api/billing": (MONEY, MONEY),
    "/api/mis": ({"admin", "billing"}, ADMIN),
    "/api/auth/users": (ADMIN, ADMIN),
}

READ_METHODS = {"GET", "HEAD", "OPTIONS"}


def match(path):
    prefixes = [p for p in POLICY if path == p or path.startswith(p + "/")]
    return max(prefixes, key=len) if prefixes else None


def permits(role, path, method):
    prefix = match(path)
    if prefix is None:
        return False
    readers, writers = POLICY[prefix]
    return role in (readers if method in READ_METHODS else writers)


def access_for(role):
    return {prefix: {"read": role in r, "write": role in w} for prefix, (r, w) in POLICY.items()}
