import os
from pathlib import Path

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///hmis.db")
WEB_DIR = Path(__file__).resolve().parents[2] / "web"
FACILITY_NAME = os.getenv("FACILITY_NAME", "Ajitesh Hospital")
