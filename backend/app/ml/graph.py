from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class TrafficGraph:
    # adjacency: source_ip -> {dest_ip: connection_count}
    adjacency: dict = field(default_factory=lambda: defaultdict(lambda: defaultdict(int)))
    # reverse adjacency for fast in-degree lookups: dest_ip -> {source_ip: count}
    reverse_adjacency: dict = field(default_factory=lambda: defaultdict(lambda: defaultdict(int)))
    last_seen: dict = field(default_factory=dict)  # ip -> last timestamp seen

    def add_connection(self, src_ip: str, dst_ip: str, timestamp: datetime = None) -> None:
        self.adjacency[src_ip][dst_ip] += 1
        self.reverse_adjacency[dst_ip][src_ip] += 1
        ts = timestamp or datetime.now(timezone.utc)
        self.last_seen[src_ip] = ts
        self.last_seen[dst_ip] = ts

    def out_degree(self, ip: str) -> int:
        """Number of DISTINCT destinations this IP has contacted (port-scan signal)."""
        return len(self.adjacency.get(ip, {}))

    def in_degree(self, ip: str) -> int:
        """Number of DISTINCT sources that contacted this IP (DDoS signal)."""
        return len(self.reverse_adjacency.get(ip, {}))

    def detect_port_scan_candidates(self, distinct_dest_threshold: int = 15) -> list[dict]:
        """Flag source IPs that contacted an unusually high number of distinct destinations."""
        results = []
        for src_ip, dests in self.adjacency.items():
            distinct = len(dests)
            if distinct >= distinct_dest_threshold:
                results.append({
                    "source_ip": src_ip,
                    "distinct_destinations": distinct,
                    "pattern": "possible_port_scan",
                })
        return sorted(results, key=lambda r: r["distinct_destinations"], reverse=True)

    def detect_ddos_candidates(self, distinct_source_threshold: int = 20) -> list[dict]:
        """Flag destination IPs being hit by an unusually high number of distinct sources."""
        results = []
        for dst_ip, sources in self.reverse_adjacency.items():
            distinct = len(sources)
            if distinct >= distinct_source_threshold:
                results.append({
                    "destination_ip": dst_ip,
                    "distinct_sources": distinct,
                    "pattern": "possible_ddos",
                })
        return sorted(results, key=lambda r: r["distinct_sources"], reverse=True)

    def to_visual_graph(self, max_nodes: int = 100) -> dict:
        """
        Export as {nodes: [...], edges: [...]} for the frontend force-graph
        (e.g. react-force-graph or D3). Caps node count so the browser
        doesn't choke on huge graphs.
        """
        node_set = set()
        edges = []
        for src, dests in self.adjacency.items():
            for dst, weight in dests.items():
                if len(node_set) >= max_nodes:
                    break
                node_set.add(src)
                node_set.add(dst)
                edges.append({"source": src, "target": dst, "weight": weight})

        nodes = [
            {
                "id": ip,
                "out_degree": self.out_degree(ip),
                "in_degree": self.in_degree(ip),
            }
            for ip in node_set
        ]
        return {"nodes": nodes, "edges": edges}


if __name__ == "__main__":
    g = TrafficGraph()
    # simulate a port scan: one source hitting 20 distinct destinations
    for i in range(20):
        g.add_connection("10.0.0.99", f"192.168.1.{i}")
    # simulate a ddos: 25 distinct sources hitting one destination
    for i in range(25):
        g.add_connection(f"203.0.113.{i}", "10.0.0.5")

    scans = g.detect_port_scan_candidates(distinct_dest_threshold=15)
    ddos = g.detect_ddos_candidates(distinct_source_threshold=20)
    assert len(scans) == 1 and scans[0]["source_ip"] == "10.0.0.99"
    assert len(ddos) == 1 and ddos[0]["destination_ip"] == "10.0.0.5"
    print("Graph self-tests passed.")
    print("Port scan candidates:", scans)
    print("DDoS candidates:", ddos)
