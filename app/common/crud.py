from typing import get_args

from fastapi import APIRouter, Body, HTTPException, Request
from pydantic import TypeAdapter, ValidationError
from sqlmodel import or_, select

from app.common import labels
from app.core.db import SessionDep

RESERVED = {"q", "limit", "offset"}
PROTECTED = {"id", "created_at"}
OPERATORS = {
    "eq": lambda col, val: col == val,
    "gte": lambda col, val: col >= val,
    "lte": lambda col, val: col <= val,
}


def describe(error):
    return "; ".join(f"{'.'.join(map(str, e['loc']))}: {e['msg']}" for e in error.errors())


def guarded(fn, *args):
    try:
        return fn(*args)
    except ValidationError as error:
        raise HTTPException(422, describe(error))


def is_text(annotation):
    return str in (annotation, *get_args(annotation))


def coerce(model, key, value):
    annotation = model.model_fields[key].annotation
    if value is None or (value == "" and not is_text(annotation)):
        return None
    return guarded(TypeAdapter(annotation).validate_python, value)


def apply_filters(stmt, model, params):
    for key, raw in params.items():
        if key in RESERVED:
            continue
        name, _, op = key.partition("__")
        operator = OPERATORS.get(op or "eq")
        if name in model.model_fields and operator:
            stmt = stmt.where(operator(getattr(model, name), coerce(model, name, raw)))
    return stmt


def fetch(session, model, row_id):
    obj = session.get(model, row_id)
    if not obj:
        raise HTTPException(404, f"{model.__name__} {row_id} not found")
    return obj


def serialize(session, rows):
    return labels.attach(session, [row.model_dump(mode="json") for row in rows])


def serialize_one(session, row):
    return serialize(session, [row])[0]


def rows_for(session, model, *conditions, order=None):
    stmt = select(model).where(*conditions)
    return session.exec(stmt.order_by(order if order is not None else model.id)).all()


def make_crud_router(
    model,
    prefix,
    search=(),
    order=None,
    writable=True,
    before_create=None,
    after_create=None,
    before_update=None,
    extra=None,
):
    router = APIRouter(prefix=prefix, tags=[model.__name__])
    if extra:
        router.include_router(extra)
    ordering = order if order is not None else model.id.desc()

    @router.get("")
    def list_rows(request: Request, session: SessionDep, q: str = "", limit: int = 500, offset: int = 0):
        stmt = apply_filters(select(model), model, request.query_params)
        if q and search:
            stmt = stmt.where(or_(*[getattr(model, field).ilike(f"%{q}%") for field in search]))
        rows = session.exec(stmt.order_by(ordering).offset(offset).limit(limit)).all()
        return serialize(session, rows)

    @router.get("/{row_id}")
    def get_row(row_id: int, session: SessionDep):
        return serialize_one(session, fetch(session, model, row_id))

    if not writable:
        return router

    @router.post("")
    def create_row(session: SessionDep, body: dict = Body(...)):
        data = {k: v for k, v in body.items() if k not in PROTECTED}
        obj = guarded(model.model_validate, data)
        if before_create:
            before_create(session, obj)
        session.add(obj)
        session.flush()
        if after_create:
            after_create(session, obj)
        session.commit()
        session.refresh(obj)
        return serialize_one(session, obj)

    @router.put("/{row_id}")
    def update_row(row_id: int, session: SessionDep, body: dict = Body(...)):
        obj = fetch(session, model, row_id)
        for key, value in body.items():
            if key in model.model_fields and key not in PROTECTED:
                setattr(obj, key, coerce(model, key, value))
        if before_update:
            before_update(session, obj)
        session.add(obj)
        session.commit()
        session.refresh(obj)
        return serialize_one(session, obj)

    @router.delete("/{row_id}")
    def delete_row(row_id: int, session: SessionDep):
        obj = fetch(session, model, row_id)
        if "active" in model.model_fields:
            obj.active = False
            session.add(obj)
        else:
            session.delete(obj)
        session.commit()
        return {"deleted": row_id}

    return router
