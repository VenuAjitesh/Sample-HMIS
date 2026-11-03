from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.core.config import FACILITY_NAME, WEB_DIR
from app.core.db import init_db
from app.core.registry import ROUTERS, register_labels
from app.core.seed import seed_if_empty


@asynccontextmanager
async def lifespan(app):
    init_db()
    seed_if_empty()
    yield


def create_app():
    app = FastAPI(title="Ajitesh Hospital", lifespan=lifespan)
    register_labels()
    for router in ROUTERS:
        app.include_router(router)

    @app.get("/api/config")
    def config():
        return {"facility": FACILITY_NAME}

    app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="web")
    return app


app = create_app()
