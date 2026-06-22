import os
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import network, email, threat_intel, alerts
from app.services import database

app = FastAPI(
    title="AI Smart Cybersecurity Dashboard API",
    description=(
        "Backend for a SOC-style dashboard: network anomaly detection "
        "(RandomForest + Autoencoder on NSL-KDD), phishing email "
        "detection (TF-IDF + Logistic Regression on Enron-Spam), "
        "Trie-based threat intel lookups, and graph-based attack "
        "pattern detection (port scans, DDoS clustering)."
    ),
    version="1.0.0",
)

frontend_origin = os.environ.get("FRONTEND_ORIGIN", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin] if frontend_origin != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(network.router)
app.include_router(email.router)
app.include_router(threat_intel.router)
app.include_router(alerts.router)


@app.on_event("startup")
async def on_startup():
    await database.connect()
    if database.is_connected():
        sys.path.append(str(Path(__file__).resolve().parent / "ml"))
        from inference_service import threat_service
        await threat_service.reload_persisted_blocklist()


@app.on_event("shutdown")
async def on_shutdown():
    await database.disconnect()


@app.get("/")
async def root():
    return {
        "status": "ok",
        "service": "AI Smart Cybersecurity Dashboard API",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "database": "connected" if database.is_connected() else "not configured (in-memory fallback)",
    }