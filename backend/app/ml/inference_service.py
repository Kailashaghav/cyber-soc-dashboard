import sys
from pathlib import Path

import joblib
import numpy as np
import torch
import torch.nn as nn

sys.path.append(str(Path(__file__).parent))
from schema import NSL_KDD_COLUMNS, CATEGORICAL_COLUMNS
from safe_label_encoder import SafeLabelEncoder
from trie import IPDomainTrie
from graph import TrafficGraph

ROOT = Path(__file__).resolve().parents[3]
MODELS_DIR = ROOT / "data" / "models"


class Autoencoder(nn.Module):
    def __init__(self, input_dim: int):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 32), nn.ReLU(),
            nn.Linear(32, 16), nn.ReLU(),
            nn.Linear(16, 8), nn.ReLU(),
        )
        self.decoder = nn.Sequential(
            nn.Linear(8, 16), nn.ReLU(),
            nn.Linear(16, 32), nn.ReLU(),
            nn.Linear(32, input_dim),
        )

    def forward(self, x):
        return self.decoder(self.encoder(x))


class ThreatDetectionService:
    """Singleton-style service: instantiate once, reuse across requests."""

    def __init__(self):
        print("Loading ML artifacts...")
        self.scaler = joblib.load(MODELS_DIR / "scaler.joblib")
        self.categorical_encoders = joblib.load(MODELS_DIR / "categorical_encoders.joblib")
        self.category_label_encoder = joblib.load(MODELS_DIR / "category_label_encoder.joblib")
        self.feature_cols = joblib.load(MODELS_DIR / "feature_columns.joblib")

        self.rf_binary = joblib.load(MODELS_DIR / "rf_binary.joblib")
        self.rf_category = joblib.load(MODELS_DIR / "rf_category.joblib")

        ae_meta = joblib.load(MODELS_DIR / "autoencoder_meta.joblib")
        self.ae_threshold = ae_meta["threshold"]
        self.autoencoder = Autoencoder(ae_meta["input_dim"])
        self.autoencoder.load_state_dict(torch.load(MODELS_DIR / "autoencoder.pt", map_location="cpu"))
        self.autoencoder.eval()

        # Phishing/spam email classifier (NLP module)
        self.email_vectorizer = joblib.load(MODELS_DIR / "email_tfidf_vectorizer.joblib")
        self.email_classifier = joblib.load(MODELS_DIR / "email_classifier.joblib")

        # DSA components -- in-memory, populated via load_threat_intel()
        self.trie = IPDomainTrie()
        self.graph = TrafficGraph()
        self._load_seed_threat_intel()
        print("All artifacts loaded.")

    def _load_seed_threat_intel(self):
        """
        Seed the Trie with a small starter blocklist so the demo has
        something to show immediately. In production this would be
        refreshed periodically from real threat-intel feeds (e.g.
        AbuseIPDB, Spamhaus) -- left as a clearly-labeled TODO/extension
        point rather than faked as "live" data.
        """
        known_bad_ip_prefixes = [
            ("185.220.10", "tor_exit_range", "medium"),
            ("185.220.101", "tor_exit_range", "medium"),
            ("45.155.205.233", "known_c2_server", "critical"),
            ("194.165.16", "known_botnet_range", "high"),
        ]
        for prefix, reason, sev in known_bad_ip_prefixes:
            self.trie.insert_ip_prefix(prefix, reason=reason, severity=sev)

        known_phishing_domains = [
            "secure-login-verify.com",
            "account-update-alert.net",
            "paypal-confirm-security.com",
        ]
        for d in known_phishing_domains:
            self.trie.insert_domain(d, reason="known_phishing_domain", severity="critical")

    # ---------- Feature preparation ----------
    def _row_to_feature_vector(self, row: dict) -> np.ndarray:
        """
        Convert a single raw traffic-log dict (matching NSL-KDD raw
        column names) into the scaled feature vector the models expect.
        Missing fields default to 0 / 'UNK' so partial/simplified
        records from the demo frontend still work.
        """
        encoded = {}
        for col in CATEGORICAL_COLUMNS:
            raw_val = row.get(col, "UNK")
            enc = self.categorical_encoders[col]
            encoded[col + "_enc"] = enc.transform([raw_val])[0]

        vector = []
        for col in self.feature_cols:
            if col in encoded:
                vector.append(encoded[col])
            else:
                vector.append(float(row.get(col, 0)))
        X = np.array(vector, dtype=float).reshape(1, -1)
        return self.scaler.transform(X)

    # ---------- Predictions ----------
    def predict_email(self, subject: str, body: str) -> dict:
        """Classify an email/message as phishing/spam or legitimate."""
        text = f"{subject or ''} {body or ''}".strip()
        X = self.email_vectorizer.transform([text])
        pred = int(self.email_classifier.predict(X)[0])
        proba = float(self.email_classifier.predict_proba(X)[0][1])

        # Pull top contributing words present in this specific email for explainability
        feature_names = self.email_vectorizer.get_feature_names_out()
        coefs = self.email_classifier.coef_[0]
        present_idx = X.nonzero()[1]
        contributions = sorted(
            ((feature_names[i], coefs[i]) for i in present_idx),
            key=lambda x: abs(x[1]),
            reverse=True,
        )[:5]

        return {
            "is_phishing": bool(pred),
            "phishing_probability": round(proba, 4),
            "top_signals": [{"term": t, "weight": round(float(w), 3)} for t, w in contributions],
        }

    def predict_rf(self, row: dict) -> dict:
        X_scaled = self._row_to_feature_vector(row)
        binary_pred = int(self.rf_binary.predict(X_scaled)[0])
        binary_proba = float(self.rf_binary.predict_proba(X_scaled)[0][1])

        cat_pred_idx = int(self.rf_category.predict(X_scaled)[0])
        cat_label = self.category_label_encoder.classes_[cat_pred_idx]

        return {
            "model": "random_forest",
            "is_attack": bool(binary_pred),
            "attack_probability": round(binary_proba, 4),
            "attack_category": str(cat_label),
        }

    def predict_autoencoder(self, row: dict) -> dict:
        X_scaled = self._row_to_feature_vector(row)
        X_tensor = torch.tensor(X_scaled, dtype=torch.float32)
        with torch.no_grad():
            recon = self.autoencoder(X_tensor)
            error = torch.mean((recon - X_tensor) ** 2).item()
        is_anomaly = error > self.ae_threshold
        return {
            "model": "autoencoder",
            "is_anomaly": bool(is_anomaly),
            "reconstruction_error": round(error, 6),
            "threshold": round(self.ae_threshold, 6),
        }

    def predict_combined(self, row: dict) -> dict:
        """
        Combine both models: RF gives a labeled-attack-type guess,
        autoencoder gives a novel-pattern anomaly signal. Either one
        firing raises an alert -- this mirrors real SOC "defense in
        depth" thinking (don't rely on a single detector).
        """
        rf_result = self.predict_rf(row)
        ae_result = self.predict_autoencoder(row)
        flagged = rf_result["is_attack"] or ae_result["is_anomaly"]

        if flagged:
            if rf_result["is_attack"] and ae_result["is_anomaly"]:
                severity = "critical"
            elif rf_result["is_attack"]:
                severity = "high"
            else:
                severity = "medium"  # autoencoder-only = novel/unseen pattern, flag cautiously
        else:
            severity = "none"

        return {
            "flagged": flagged,
            "severity": severity,
            "random_forest": rf_result,
            "autoencoder": ae_result,
        }

    # ---------- Threat intel (Trie) ----------
    def check_ip_reputation(self, ip: str) -> dict:
        result = self.trie.check_ip(ip)
        return {"ip": ip, "flagged": result is not None, "details": result}

    def check_domain_reputation(self, domain: str) -> dict:
        result = self.trie.check_domain(domain)
        return {"domain": domain, "flagged": result is not None, "details": result}

    # ---------- Graph ----------
    def record_connection(self, src_ip: str, dst_ip: str):
        self.graph.add_connection(src_ip, dst_ip)

    def get_graph_snapshot(self, max_nodes: int = 100) -> dict:
        return self.graph.to_visual_graph(max_nodes=max_nodes)

    def get_port_scan_alerts(self):
        return self.graph.detect_port_scan_candidates()

    def get_ddos_alerts(self):
        return self.graph.detect_ddos_candidates()
    async def reload_persisted_blocklist(self):
        from app.services import database

        if not database.is_connected():
            return

        ip_entries = await database.fetch_all_blocklist_ips()
        for entry in ip_entries:
            self.trie.insert_ip_prefix(
                entry["pattern"], reason=entry["reason"], severity=entry["severity"]
            )

        domain_entries = await database.fetch_all_blocklist_domains()
        for entry in domain_entries:
            self.trie.insert_domain(
                entry["pattern"], reason=entry["reason"], severity=entry["severity"]
            )

        if ip_entries or domain_entries:
            print(
                f"Reloaded {len(ip_entries)} IP + "
                f"{len(domain_entries)} domain blocklist entries from MongoDB"
            )


# Module-level singleton, imported by FastAPI routers
threat_service = ThreatDetectionService()
