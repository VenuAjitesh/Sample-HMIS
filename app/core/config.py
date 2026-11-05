import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///hmis.db")
WEB_DIR = ROOT / "web"
FACILITY_NAME = os.getenv("FACILITY_NAME", "Ajitesh Hospital")

# ABDM sandbox (M1). Values come from .env; see .env.example. Never commit real credentials.
ABDM_CLIENT_ID = os.getenv("ABDM_CLIENT_ID", "")
ABDM_CLIENT_SECRET = os.getenv("ABDM_CLIENT_SECRET", "")
ABDM_GATEWAY_URL = os.getenv("ABDM_GATEWAY_URL", "https://dev.abdm.gov.in")
ABDM_ABHA_URL = os.getenv("ABDM_ABHA_URL", "https://abhasbx.abdm.gov.in")
ABDM_X_CM_ID = os.getenv("ABDM_X_CM_ID", "sbx")
ABDM_CALLBACK_URL = os.getenv("ABDM_CALLBACK_URL", "")
