from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.staticfiles import StaticFiles

from app.core.config import FACILITY_NAME, WEB_DIR
from app.core.db import init_db
from app.core.registry import ROUTERS, register_labels
from app.core.seed import seed_if_empty
from app.modules.auth.deps import guard
from app.modules.auth.router import router as auth
from app.modules.auth.service import ensure_default_admin


@asynccontextmanager
async def lifespan(app):
    init_db()
    seed_if_empty()
    ensure_default_admin()
    yield


def create_app():
    app = FastAPI(title="Ajitesh Hospital", lifespan=lifespan)
    register_labels()
    app.include_router(auth)
    for router in ROUTERS:
        app.include_router(router, dependencies=[Depends(guard)])

    @app.get("/api/config")
    def config():
        return {"facility": FACILITY_NAME}

    app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="web")
    return app


app = create_app()
