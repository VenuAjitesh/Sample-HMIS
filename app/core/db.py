from typing import Annotated

from fastapi import Depends
from sqlalchemy import inspect, text
from sqlmodel import Session, SQLModel, create_engine

from app.core.config import DATABASE_URL

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)


def init_db():
    SQLModel.metadata.create_all(engine)
    add_missing_columns()


def add_missing_columns():
    """No migrations here: a field added to an existing model is added to its table on startup
    (as a nullable column, with its index). Renames, type changes and drops still need a fresh database."""
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table in SQLModel.metadata.sorted_tables:
            existing = {column["name"] for column in inspector.get_columns(table.name)}
            missing = [column for column in table.columns if column.name not in existing]
            for column in missing:
                ddl = column.type.compile(engine.dialect)
                conn.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {ddl}'))
            if missing:
                for index in table.indexes:
                    index.create(conn, checkfirst=True)


def get_session():
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]
