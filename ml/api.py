"""
FastAPI service exposing partner risk scores.

Start:
    cd pulse/ml && uvicorn api:app --reload --port 8100

The Express server proxies /api/partner-risk → this service.
"""

import logging
from contextlib import asynccontextmanager
from dataclasses import asdict

import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .pipeline import PartnerRiskPipeline

logger = logging.getLogger("pulse.ml")

_pipeline = PartnerRiskPipeline()
_ready = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _ready
    logger.info("Running partner risk pipeline …")
    _pipeline.run()
    _ready = True
    logger.info("Pipeline complete — %d partners scored", len(_pipeline.scores))
    yield


app = FastAPI(title="Pulse ML — Partner Risk", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok" if _ready else "loading", "partners_scored": len(_pipeline.scores)}


@app.get("/scores")
def get_scores(tier: str | None = None, limit: int = 50, offset: int = 0):
    """Return scored partners, optionally filtered by tier."""
    scores = _pipeline.scores
    if tier:
        scores = [s for s in scores if s.tier == tier]
    page = scores[offset: offset + limit]
    return {
        "total": len(scores),
        "limit": limit,
        "offset": offset,
        "partners": [_sanitize(asdict(s)) for s in page],
    }


@app.get("/scores/{partner_id}")
def get_partner_score(partner_id: str):
    """Return detailed scores for a single partner."""
    for s in _pipeline.scores:
        if s.partner_id == partner_id:
            return _sanitize(asdict(s))
    return {"error": "Partner not found"}, 404


def _sanitize(obj):
    """Convert numpy types to native Python for JSON serialization."""
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v) for v in obj]
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    return obj


@app.post("/refresh")
def refresh():
    """Re-run the pipeline (e.g. after new data lands)."""
    global _ready
    _ready = False
    _pipeline.run()
    _ready = True
    return {"status": "refreshed", "partners_scored": len(_pipeline.scores)}
