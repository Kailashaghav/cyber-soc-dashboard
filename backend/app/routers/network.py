"""Routes for network traffic anomaly detection (RF + Autoencoder)."""

import sys
from pathlib import Path

from fastapi import APIRouter

sys.path.append(str(Path(__file__).resolve().parents[1] / "ml"))
from inference_service import threat_service
from app.models.schemas import TrafficLogInput
from app.services.alert_manager import alert_manager

router = APIRouter(prefix="/api/network", tags=["network"])


@router.post("/analyze")
async def analyze_traffic(log: TrafficLogInput):
    """
    Analyze a single traffic record with both the RandomForest classifier
    and the autoencoder anomaly detector. If src_ip/dst_ip are provided,
    also records the connection in the in-memory traffic graph and checks
    both IPs against the Trie-based threat intel blocklist.
    """
    row = log.model_dump(exclude={"src_ip", "dst_ip"})
    result = threat_service.predict_combined(row)

    ip_flags = {}
    if log.src_ip:
        ip_flags["src_ip"] = threat_service.check_ip_reputation(log.src_ip)
    if log.dst_ip:
        ip_flags["dst_ip"] = threat_service.check_ip_reputation(log.dst_ip)
    if log.src_ip and log.dst_ip:
        threat_service.record_connection(log.src_ip, log.dst_ip)

    if ip_flags and any(v["flagged"] for v in ip_flags.values()):
        result["severity"] = "critical"
        result["flagged"] = True

    result["ip_reputation"] = ip_flags

    if result["flagged"]:
        await alert_manager.broadcast_alert({
            "type": "network",
            "severity": result["severity"],
            "summary": f"{result['random_forest']['attack_category']} traffic flagged"
            if result["random_forest"]["is_attack"] else "Anomalous traffic pattern detected",
            "details": result,
            "src_ip": log.src_ip,
            "dst_ip": log.dst_ip,
        })

    return result


@router.get("/graph")
async def get_graph(max_nodes: int = 100):
    """Returns the current traffic graph snapshot for frontend visualization."""
    return threat_service.get_graph_snapshot(max_nodes=max_nodes)


@router.get("/graph/port-scan-alerts")
async def port_scan_alerts():
    return {"alerts": threat_service.get_port_scan_alerts()}


@router.get("/graph/ddos-alerts")
async def ddos_alerts():
    return {"alerts": threat_service.get_ddos_alerts()}
