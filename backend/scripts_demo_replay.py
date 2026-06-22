import argparse
import sys
import random
from pathlib import Path

import httpx
import pandas as pd

sys.path.append(str(Path(__file__).parent / "app" / "ml"))
from schema import NSL_KDD_COLUMNS

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
API_BASE = "http://localhost:8000"

# Simplified fields our API's TrafficLogInput actually accepts
SIMPLIFIED_FIELDS = [
    "protocol_type", "service", "flag", "src_bytes", "dst_bytes",
    "duration", "count", "srv_count", "logged_in", "same_srv_rate", "diff_srv_rate",
]


def fake_ip(seed: int, malicious: bool = False) -> str:
    if malicious:
        # Pull from our seeded blocklist ranges so demo shows critical alerts too
        return random.choice(["185.220.10.55", "45.155.205.233", "194.165.16.12"])
    return f"10.0.{(seed // 256) % 256}.{seed % 256}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--n", type=int, default=10, help="number of records to replay")
    parser.add_argument("--kind", choices=["normal", "attack", "mixed"], default="mixed")
    parser.add_argument("--delay", type=float, default=0.3, help="seconds between requests")
    args = parser.parse_args()

    test_df = pd.read_csv(RAW_DIR / "KDDTest.txt", header=None, names=NSL_KDD_COLUMNS)

    if args.kind == "normal":
        pool = test_df[test_df["label"] == "normal"]
    elif args.kind == "attack":
        pool = test_df[test_df["label"] != "normal"]
    else:
        pool = test_df

    sample = pool.sample(n=min(args.n, len(pool)), random_state=None)

    print(f"Replaying {len(sample)} real NSL-KDD test rows through {API_BASE}/api/network/analyze\n")

    with httpx.Client(timeout=10.0) as client:
        for i, (_, row) in enumerate(sample.iterrows()):
            payload = {field: row[field] for field in SIMPLIFIED_FIELDS}
            # cast numpy types to plain python for JSON serialization
            payload = {k: (v.item() if hasattr(v, "item") else v) for k, v in payload.items()}

            malicious_ip = row["label"] != "normal" and random.random() < 0.3
            payload["src_ip"] = fake_ip(i, malicious=malicious_ip)
            payload["dst_ip"] = fake_ip(i + 1000)

            resp = client.post(f"{API_BASE}/api/network/analyze", json=payload)
            result = resp.json()

            true_label = row["label"]
            flagged = result.get("flagged")
            severity = result.get("severity")
            print(f"[{i+1}/{len(sample)}] true_label={true_label:<12s} -> flagged={flagged}  severity={severity}")

            import time
            time.sleep(args.delay)

    print("\nDone. Check /api/alerts/history or the dashboard's live feed to see these come through.")


if __name__ == "__main__":
    main()
