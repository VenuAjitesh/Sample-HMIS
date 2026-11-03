import datetime as dt

from pydantic import NaiveDatetime
from sqlmodel import Field, SQLModel

from app.common.models import Base


class User(Base, table=True):
    username: str = Field(index=True, unique=True)
    full_name: str = ""
    role: str = "reception"
    password_hash: str = ""
    active: bool = True


class AuthSession(SQLModel, table=True):
    token_hash: str = Field(primary_key=True)
    user_id: int = Field(index=True)
    expires_at: NaiveDatetime = Field(default_factory=dt.datetime.now)
