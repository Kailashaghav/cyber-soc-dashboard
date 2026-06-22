"""Routes for phishing/spam email detection (NLP module)."""

import sys
from pathlib import Path

from fastapi import APIRouter

sys.path.append(str(Path(__file__).resolve().parents[1] / "ml"))
from inference_service import threat_service
from app.models.schemas import EmailCheckInput
from app.services.alert_manager import alert_manager

router = APIRouter(prefix="/api/email", tags=["email"])


@router.post("/analyze")
async def analyze_email(payload: EmailCheckInput):
    """Classify email/message text as phishing/spam or legitimate, with explainability."""
    result = threat_service.predict_email(payload.subject, payload.body)

    if result["is_phishing"]:
        await alert_manager.broadcast_alert({
            "type": "email",
            "severity": "high" if result["phishing_probability"] > 0.85 else "medium",
            "summary": f"Phishing email detected: \"{(payload.subject or payload.body)[:60]}\"",
            "details": result,
        })

    return result
