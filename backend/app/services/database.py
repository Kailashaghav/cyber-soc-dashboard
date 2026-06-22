import os
import logging
from datetime import datetime, timezone

logger = logging.getLogger("db")

MONGODB_URI = os.environ.get("MONGODB_URI", "")
MONGODB_DB_NAME = os.environ.get("MONGODB_DB_NAME", "cyber_soc_dashboard")

_client = None
_db = None
_connected = False


async def connect():
    global _client, _db, _connected
    if not MONGODB_URI:
        logger.warning(
            "MONGODB_URI not set -- running with in-memory storage only. "
            "Alert history and manual blocklist additions will NOT persist across restarts."
        )
        return
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        _client = AsyncIOMotorClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
        await _client.admin.command("ping")
        _db = _client[MONGODB_DB_NAME]
        _connected = True
        logger.info(f"Connected to MongoDB database '{MONGODB_DB_NAME}'")
        await _db.alerts.create_index("timestamp")
        await _db.blocklist_ips.create_index("pattern", unique=True)
        await _db.blocklist_domains.create_index("pattern", unique=True)
    except Exception as e:
        logger.warning(f"MongoDB connection failed ({e}). Falling back to in-memory storage.")
        _client = None
        _db = None
        _connected = False


async def disconnect():
    global _client
    if _client:
        _client.close()


def is_connected() -> bool:
    return _connected


def get_db():
    return _db


async def save_alert(alert: dict):
    if not _connected:
        return
    try:
        doc = dict(alert)
        doc["_saved_at"] = datetime.now(timezone.utc)
        await _db.alerts.insert_one(doc)
    except Exception as e:
        logger.error(f"Failed to save alert to MongoDB: {e}")


async def fetch_recent_alerts(limit: int = 50) -> list:
    if not _connected:
        return []
    try:
        cursor = _db.alerts.find({}, {"_id": 0}).sort("_saved_at", -1).limit(limit)
        docs = await cursor.to_list(length=limit)
        return list(reversed(docs))
    except Exception as e:
        logger.error(f"Failed to fetch alerts from MongoDB: {e}")
        return []


async def save_blocklist_ip(pattern: str, reason: str, severity: str):
    if not _connected:
        return
    try:
        await _db.blocklist_ips.update_one(
            {"pattern": pattern},
            {"$set": {"pattern": pattern, "reason": reason, "severity": severity}},
            upsert=True,
        )
    except Exception as e:
        logger.error(f"Failed to save IP blocklist entry: {e}")


async def save_blocklist_domain(pattern: str, reason: str, severity: str):
    if not _connected:
        return
    try:
        await _db.blocklist_domains.update_one(
            {"pattern": pattern},
            {"$set": {"pattern": pattern, "reason": reason, "severity": severity}},
            upsert=True,
        )
    except Exception as e:
        logger.error(f"Failed to save domain blocklist entry: {e}")


async def fetch_all_blocklist_ips() -> list:
    if not _connected:
        return []
    try:
        cursor = _db.blocklist_ips.find({}, {"_id": 0})
        return await cursor.to_list(length=10000)
    except Exception as e:
        logger.error(f"Failed to fetch IP blocklist: {e}")
        return []


async def fetch_all_blocklist_domains() -> list:
    if not _connected:
        return []
    try:
        cursor = _db.blocklist_domains.find({}, {"_id": 0})
        return await cursor.to_list(length=10000)
    except Exception as e:
        logger.error(f"Failed to fetch domain blocklist: {e}")
        return []