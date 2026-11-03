import datetime as dt
from typing import Annotated

from fastapi import Depends, HTTPException, Request

from app.core.db import SessionDep
from app.modules.auth.access import permits
from app.modules.auth.models import AuthSession, User
from app.modules.auth.security import digest_token


def bearer(request: Request):
    scheme, _, token = request.headers.get("authorization", "").partition(" ")
    return token if scheme.lower() == "bearer" and token else None


def current_user(request: Request, session: SessionDep):
    token = bearer(request)
    record = session.get(AuthSession, digest_token(token)) if token else None
    if not record or record.expires_at < dt.datetime.now():
        raise HTTPException(401, "Please sign in")
    user = session.get(User, record.user_id)
    if not user or not user.active:
        raise HTTPException(401, "Account is disabled")
    return user


CurrentUser = Annotated[User, Depends(current_user)]


def guard(request: Request, user: CurrentUser):
    if not permits(user.role, request.url.path, request.method):
        raise HTTPException(403, f"Your role ({user.role}) is not allowed to do this")
    return user


def admin_only(user: CurrentUser):
    if user.role != "admin":
        raise HTTPException(403, "Administrators only")
    return user
