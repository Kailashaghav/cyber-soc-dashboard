from collections import deque
from datetime import datetime, timezone
from typing import List

from fastapi import WebSocket
from app.services import database


class AlertManager:
    def __init__(self, max_history: int = 200):
        self.active_connections: List[WebSocket] = []
        self.alert_history = deque(maxlen=max_history)

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast_alert(self, alert: dict):
        alert["timestamp"] = datetime.now(timezone.utc).isoformat()
        self.alert_history.append(alert)
        await database.save_alert(alert)
        stale = []
        for connection in self.active_connections:
            try:
                await connection.send_json(alert)
            except Exception:
                stale.append(connection)
        for conn in stale:
            self.disconnect(conn)

    async def get_recent_alerts(self, limit: int = 50) -> list:
        if database.is_connected():
            db_alerts = await database.fetch_recent_alerts(limit=limit)
            if db_alerts:
                return db_alerts
        return list(self.alert_history)[-limit:]


alert_manager = AlertManager()