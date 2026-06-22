import sys
from pathlib import Path

from fastapi import APIRouter

sys.path.append(str(Path(__file__).resolve().parents[1] / "ml"))
from inference_service import threat_service
from app.models.schemas import IPCheckInput, DomainCheckInput, BlocklistIPInput, BlocklistDomainInput
from app.services import database

router = APIRouter(prefix="/api/threat-intel", tags=["threat-intel"])


@router.post("/check-ip")
async def check_ip(payload: IPCheckInput):
    return threat_service.check_ip_reputation(payload.ip)


@router.post("/check-domain")
async def check_domain(payload: DomainCheckInput):
    return threat_service.check_domain_reputation(payload.domain)


@router.post("/blocklist/ip")
async def add_ip_to_blocklist(payload: BlocklistIPInput):
    threat_service.trie.insert_ip_prefix(
        payload.ip_prefix, reason=payload.reason, severity=payload.severity
    )
    await database.save_blocklist_ip(payload.ip_prefix, payload.reason, payload.severity)
    return {
        "added": True,
        "ip_prefix": payload.ip_prefix,
        "persisted": database.is_connected()
    }


@router.post("/blocklist/domain")
async def add_domain_to_blocklist(payload: BlocklistDomainInput):
    threat_service.trie.insert_domain(
        payload.domain, reason=payload.reason, severity=payload.severity
    )
    await database.save_blocklist_domain(payload.domain, payload.reason, payload.severity)
    return {
        "added": True,
        "domain": payload.domain,
        "persisted": database.is_connected()
    }