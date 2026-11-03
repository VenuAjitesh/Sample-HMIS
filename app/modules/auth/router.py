from fastapi import APIRouter, Body, Depends, HTTPException, Request
from sqlmodel import select

from app.core.db import SessionDep
from app.modules.auth import service
from app.modules.auth.access import ROLES, access_for
from app.modules.auth.deps import CurrentUser, admin_only, bearer
from app.modules.auth.models import AuthSession, User
from app.modules.auth.security import digest_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["Auth"])
users = APIRouter(prefix="/users", dependencies=[Depends(admin_only)])


def session_payload(user, token=None):
    body = {"user": service.public(user), "access": access_for(user.role), "roles": ROLES}
    return {**body, "token": token} if token else body


def require_role(role):
    if role not in ROLES:
        raise HTTPException(422, f"Unknown role '{role}'")


def require_password(password):
    if not password or len(password) < 4:
        raise HTTPException(422, "Password must be at least 4 characters")


@router.post("/login")
def login(session: SessionDep, body: dict = Body(...)):
    user = session.exec(select(User).where(User.username == str(body.get("username", "")).strip())).first()
    if not user or not user.active or not verify_password(str(body.get("password", "")), user.password_hash):
        raise HTTPException(401, "Invalid username or password")
    return session_payload(user, service.open_session(session, user))


@router.post("/logout")
def logout(request: Request, session: SessionDep):
    record = session.get(AuthSession, digest_token(bearer(request) or ""))
    if record:
        session.delete(record)
        session.commit()
    return {"ok": True}


@router.get("/me")
def me(user: CurrentUser):
    return session_payload(user)


@router.post("/password")
def change_password(user: CurrentUser, session: SessionDep, body: dict = Body(...)):
    if not verify_password(str(body.get("current", "")), user.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    require_password(body.get("new"))
    user.password_hash = hash_password(body["new"])
    session.add(user)
    session.commit()
    return {"ok": True}


@users.get("")
def list_users(session: SessionDep):
    return [service.public(u) for u in session.exec(select(User).order_by(User.username)).all()]


@users.post("")
def create_user(session: SessionDep, body: dict = Body(...)):
    username = str(body.get("username", "")).strip()
    if not username:
        raise HTTPException(422, "Username is required")
    if session.exec(select(User).where(User.username == username)).first():
        raise HTTPException(409, "Username already exists")
    require_role(body.get("role"))
    require_password(body.get("password"))
    user = User(username=username, full_name=body.get("full_name") or "", role=body["role"], password_hash=hash_password(body["password"]))
    session.add(user)
    session.commit()
    return service.public(user)


@users.put("/{user_id}")
def update_user(user_id: int, session: SessionDep, admin: CurrentUser, body: dict = Body(...)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if "full_name" in body:
        user.full_name = body["full_name"] or ""
    if body.get("role"):
        require_role(body["role"])
        user.role = body["role"]
    if "active" in body:
        user.active = bool(body["active"])
    if body.get("password"):
        require_password(body["password"])
        user.password_hash = hash_password(body["password"])
    if user.id == admin.id and (user.role != "admin" or not user.active):
        raise HTTPException(400, "You cannot demote or disable your own account")
    session.add(user)
    session.commit()
    if not user.active or body.get("password"):
        service.close_sessions(session, user.id)
    return service.public(user)


@users.delete("/{user_id}")
def delete_user(user_id: int, session: SessionDep, admin: CurrentUser):
    if user_id == admin.id:
        raise HTTPException(400, "You cannot disable your own account")
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    user.active = False
    session.add(user)
    session.commit()
    service.close_sessions(session, user.id)
    return {"deleted": user_id}


router.include_router(users)
