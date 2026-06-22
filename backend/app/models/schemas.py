from typing import Optional, List
from pydantic import BaseModel, Field


class TrafficLogInput(BaseModel):
    """
    Single traffic record to classify. Mirrors a SIMPLIFIED subset of
    NSL-KDD fields -- enough for a believable demo without forcing the
    frontend to supply all 41 raw features by hand. Missing fields
    default sensibly inside the inference service.
    """
    protocol_type: str = Field(default="tcp", examples=["tcp", "udp", "icmp"])
    service: str = Field(default="http", examples=["http", "ftp", "smtp", "private"])
    flag: str = Field(default="SF", examples=["SF", "S0", "REJ"])
    src_bytes: float = Field(default=0)
    dst_bytes: float = Field(default=0)
    duration: float = Field(default=0)
    count: float = Field(default=0)
    srv_count: float = Field(default=0)
    logged_in: float = Field(default=0)
    same_srv_rate: float = Field(default=0)
    diff_srv_rate: float = Field(default=0)
    src_ip: Optional[str] = Field(default=None, description="Optional, used for graph + trie checks")
    dst_ip: Optional[str] = Field(default=None, description="Optional, used for graph + trie checks")


class IPCheckInput(BaseModel):
    ip: str


class DomainCheckInput(BaseModel):
    domain: str


class EmailCheckInput(BaseModel):
    subject: Optional[str] = ""
    body: str


class BlocklistIPInput(BaseModel):
    ip_prefix: str
    reason: str = "manual_blocklist"
    severity: str = "high"


class BlocklistDomainInput(BaseModel):
    domain: str
    reason: str = "manual_blocklist"
    severity: str = "high"
