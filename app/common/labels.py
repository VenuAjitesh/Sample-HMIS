from sqlmodel import select

LABELS = {}


def register(field, model, fn=lambda row: row.name):
    LABELS[field] = (model, fn)


def attach(session, rows):
    for field, (model, fn) in LABELS.items():
        ids = {row[field] for row in rows if row.get(field)}
        if not ids:
            continue
        names = {m.id: fn(m) for m in session.exec(select(model).where(model.id.in_(ids))).all()}
        target = field.removesuffix("_id") + "_label"
        for row in rows:
            if row.get(field):
                row[target] = names.get(row[field])
    return rows
