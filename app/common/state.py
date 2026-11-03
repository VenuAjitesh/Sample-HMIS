from fastapi import HTTPException


def move(obj, target, allowed):
    if obj.status not in allowed:
        raise HTTPException(400, f"Cannot change status from {obj.status} to {target}")
    obj.status = target
    return obj


def save(session, obj):
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj
