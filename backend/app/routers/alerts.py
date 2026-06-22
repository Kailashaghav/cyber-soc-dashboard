from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.alert_manager import alert_manager

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.websocket("/ws")
async def alerts_websocket(websocket: WebSocket):
    await alert_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        alert_manager.disconnect(websocket)


@router.get("/history")
async def alert_history(limit: int = 50):
    return {"alerts": await alert_manager.get_recent_alerts(limit=limit)}