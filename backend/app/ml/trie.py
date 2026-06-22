from typing import Optional


class TrieNode:
    __slots__ = ("children", "is_end", "meta")

    def __init__(self):
        self.children: dict[str, "TrieNode"] = {}
        self.is_end: bool = False
        self.meta: Optional[dict] = None  # e.g. {"reason": "tor_exit_node", "severity": "high"}


class IPDomainTrie:
    """
    A Trie that supports both:
      - IP prefix insertion/lookup, split on '.'
      - Domain suffix insertion/lookup, split on '.' but REVERSED
        (so "evil.com" and "login.evil.com" share a path from the TLD inward)
    """

    def __init__(self):
        self.ip_root = TrieNode()
        self.domain_root = TrieNode()

    # ---------- IP handling ----------
    def insert_ip_prefix(self, ip_prefix: str, reason: str = "blocklisted", severity: str = "high") -> None:
        """Insert a full IP or a partial prefix like '185.220.10'."""
        parts = ip_prefix.strip().split(".")
        node = self.ip_root
        for part in parts:
            if part not in node.children:
                node.children[part] = TrieNode()
            node = node.children[part]
        node.is_end = True
        node.meta = {"reason": reason, "severity": severity, "pattern": ip_prefix}

    def check_ip(self, ip: str) -> Optional[dict]:
        """
        Walk the trie as far as the IP matches. If we pass through ANY
        node marked is_end along the way, the IP (or its containing
        subnet) is flagged. Returns metadata dict if flagged, else None.
        """
        parts = ip.strip().split(".")
        node = self.ip_root
        for part in parts:
            if part not in node.children:
                return None
            node = node.children[part]
            if node.is_end:
                return node.meta
        return None

    # ---------- Domain handling ----------
    def insert_domain(self, domain: str, reason: str = "phishing_domain", severity: str = "high") -> None:
        """Insert domain reversed (tld -> sld -> subdomain) so suffix sharing works."""
        parts = list(reversed(domain.strip().lower().split(".")))
        node = self.domain_root
        for part in parts:
            if part not in node.children:
                node.children[part] = TrieNode()
            node = node.children[part]
        node.is_end = True
        node.meta = {"reason": reason, "severity": severity, "pattern": domain}

    def check_domain(self, domain: str) -> Optional[dict]:
        parts = list(reversed(domain.strip().lower().split(".")))
        node = self.domain_root
        for part in parts:
            if part not in node.children:
                return None
            node = node.children[part]
            if node.is_end:
                return node.meta
        return None

    # ---------- Bulk load ----------
    def bulk_load_ips(self, ip_list: list[str], reason: str = "blocklisted", severity: str = "high") -> int:
        for ip in ip_list:
            self.insert_ip_prefix(ip, reason, severity)
        return len(ip_list)

    def bulk_load_domains(self, domain_list: list[str], reason: str = "phishing_domain", severity: str = "high") -> int:
        for d in domain_list:
            self.insert_domain(d, reason, severity)
        return len(domain_list)


# Quick self-test when run directly: python trie.py
if __name__ == "__main__":
    t = IPDomainTrie()
    t.insert_ip_prefix("185.220.10", reason="tor_exit_range", severity="medium")
    t.insert_ip_prefix("45.155.205.233", reason="known_c2_server", severity="critical")
    t.insert_domain("evil-bank-secure.com", reason="phishing_kit", severity="critical")

    assert t.check_ip("185.220.10.55") is not None
    assert t.check_ip("185.220.11.55") is None
    assert t.check_ip("45.155.205.233") is not None
    assert t.check_domain("login.evil-bank-secure.com") is not None
    assert t.check_domain("safe-bank.com") is None
    print("All Trie self-tests passed.")
