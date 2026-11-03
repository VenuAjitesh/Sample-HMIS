import datetime as dt
from typing import Optional

from pydantic import NaiveDatetime
from sqlmodel import Field, SQLModel


class Base(SQLModel):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: NaiveDatetime = Field(default_factory=dt.datetime.now)
