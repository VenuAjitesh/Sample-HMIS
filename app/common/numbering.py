from sqlmodel import Field, SQLModel


class Sequence(SQLModel, table=True):
    key: str = Field(primary_key=True)
    value: int = 0


def bump(session, key):
    seq = session.get(Sequence, key) or Sequence(key=key)
    seq.value += 1
    session.add(seq)
    session.flush()
    return seq.value


def next_number(session, key, prefix, width=6):
    return f"{prefix}{bump(session, key):0{width}d}"


def next_daily(session, key, day):
    return bump(session, f"{key}:{day.isoformat()}")
