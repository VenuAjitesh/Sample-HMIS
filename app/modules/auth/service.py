import datetime as dt

from sqlmodel import Session, delete, select

from app.core.db import engine
from app.modules.auth.models import AuthSession, User
from app.modules.auth.security import digest_token, hash_password, new_token

SESSION_HOURS = 12


def ensure_default_admin():
    with Session(engine) as session:
        if session.exec(select(User)).first():
            return
        session.add(User(username="admin", full_name="Administrator", role="admin", password_hash=hash_password("admin")))
        session.commit()


def open_session(session, user):
    session.exec(delete(AuthSession).where(AuthSession.expires_at < dt.datetime.now()))
    token = new_token()
    expires = dt.datetime.now() + dt.timedelta(hours=SESSION_HOURS)
    session.add(AuthSession(token_hash=digest_token(token), user_id=user.id, expires_at=expires))
    session.commit()
    return token


def close_sessions(session, user_id):
    session.exec(delete(AuthSession).where(AuthSession.user_id == user_id))
    session.commit()


def public(user):
    return {"id": user.id, "username": user.username, "full_name": user.full_name, "role": user.role, "active": user.active}
