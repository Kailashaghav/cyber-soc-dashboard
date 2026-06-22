# 🛡️ AI-Based Smart Cybersecurity Dashboard (SOC System)

<div align="center">

![Python](https://img.shields.io/badge/Python-3.11-blue?style=for-the-badge&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green?style=for-the-badge&logo=fastapi)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb)
![PyTorch](https://img.shields.io/badge/PyTorch-2.3-EE4C2C?style=for-the-badge&logo=pytorch)
![scikit-learn](https://img.shields.io/badge/scikit--learn-1.8-F7931E?style=for-the-badge&logo=scikitlearn)

**A real-time AI-powered Security Operations Center (SOC) dashboard that detects network intrusions, phishing emails, and threat patterns using machine learning.**

[🌐 Live Demo](https://cyber-soc-dashboard.vercel.app) · [📡 API Docs](https://cyber-soc-dashboard-api.onrender.com/docs) · [🐛 Report Bug](https://github.com/Kailashaghav/cyber-soc-dashboard/issues)

</div>

---

## 📸 Screenshots

| Dashboard Overview | 3D Network Graph | Phishing Scanner |
|---|---|---|
| Real-time alert feed | IP attack clustering | NLP email analysis |

---

## ✨ Features

- **🔍 Network Anomaly Detection** — RandomForest classifier + Autoencoder trained on NSL-KDD dataset (125,973 records). The autoencoder detects novel/zero-day attacks by flagging traffic that deviates from learned "normal" patterns, even attack types never seen during training.

- **📧 Phishing Email Detection** — TF-IDF + Logistic Regression trained on the Enron-Spam corpus (33,000+ emails). Returns explainable top-signal words showing exactly why an email was flagged (99% F1-score).

- **🌐 3D Network Graph** — Force-directed 3D visualization of IP traffic relationships using Three.js. Nodes color-coded by threat level. Auto-detects port scan patterns (high out-degree) and DDoS targets (high in-degree).

- **🔎 Threat Intel Lookup** — Trie data structure for O(k) IP prefix and domain suffix matching against a blocklist — lookup time scales with IP/domain length, not blocklist size.

- **⚡ Real-Time Alerts** — WebSocket-based live alert broadcasting with MongoDB Atlas persistence. Alerts survive backend restarts.

- **📊 Analytics** — Real-time alert load chart, threat classification breakdown, inspection summary.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│         React Frontend (Vercel)              │
│  3D Graph · Alert Feed · Email Scanner       │
│  Threat Intel · Analytics Charts             │
└──────────────────┬──────────────────────────┘
                   │  REST API + WebSocket
┌──────────────────┴──────────────────────────┐
│         FastAPI Backend (Render)             │
│                                              │
│  ┌─────────────┐  ┌──────────────────────┐  │
│  │ ML Models   │  │ DSA Components       │  │
│  │ RandomForest│  │ Trie (IP/Domain)     │  │
│  │ Autoencoder │  │ Graph (Port scan/    │  │
│  │ TF-IDF+LR   │  │       DDoS detect)   │  │
│  └─────────────┘  └──────────────────────┘  │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │ WebSocket Alert Broadcast Manager    │   │
│  └──────────────────────────────────────┘   │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────┴──────────────────────────┐
│         MongoDB Atlas (Database)             │
│  alerts · blocklist_ips · blocklist_domains  │
└─────────────────────────────────────────────┘
```

---

## 🤖 ML Models & Performance

### Network Anomaly Detection (NSL-KDD Dataset)

| Model | Accuracy | Attack Recall | ROC-AUC | Notes |
|---|---|---|---|---|
| RandomForest (supervised) | 77% | 61% | 0.97 | Fast, explainable, labeled attack types |
| Autoencoder (unsupervised) | 83% | 76% | 0.94 | Catches novel/zero-day attacks RF misses |

> The autoencoder outperforms the supervised RandomForest on the NSL-KDD test set specifically because NSL-KDD's test set deliberately includes attack types not present in training — simulating real-world zero-day scenarios. The autoencoder only needs to learn what "normal" looks like, so it can flag anything anomalous regardless of whether it's a known attack type.

### Phishing Email Detection (Enron-Spam Dataset)

| Metric | Value |
|---|---|
| Accuracy | 99% |
| F1-Score | 0.99 |
| ROC-AUC | 0.999 |
| Training samples | 26,932 emails |

### DSA Components

| Component | Structure | Time Complexity | Use Case |
|---|---|---|---|
| IP Blocklist | Trie (split on `.`) | O(k) lookup | Subnet prefix matching |
| Domain Blocklist | Reverse Trie | O(k) lookup | Subdomain suffix matching |
| Traffic Graph | Directed Graph | O(1) edge insert | Port scan / DDoS detection |

---

## 🚀 Quick Start (Local)

### Prerequisites
- Python 3.11+
- Node.js 18+

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Visit **http://localhost:8000/docs** for the interactive API documentation.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env          # Edit VITE_API_BASE=http://localhost:8000
npm run dev
```

Visit **http://localhost:5173**

### Environment Variables

**Backend** (`backend/.env`):
```env
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/
MONGODB_DB_NAME=cyber_soc_dashboard
FRONTEND_ORIGIN=http://localhost:5173
```

**Frontend** (`frontend/.env`):
```env
VITE_API_BASE=http://localhost:8000
```

> MongoDB is optional — without it, the app runs fully on in-memory storage (alerts reset on restart).

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/network/analyze` | Classify traffic (RF + Autoencoder) |
| GET | `/api/network/graph` | Get IP traffic graph for visualization |
| GET | `/api/network/graph/port-scan-alerts` | Flagged port scan source IPs |
| GET | `/api/network/graph/ddos-alerts` | Flagged DDoS target IPs |
| POST | `/api/email/analyze` | Classify email as phishing/legitimate |
| POST | `/api/threat-intel/check-ip` | Check IP against Trie blocklist |
| POST | `/api/threat-intel/check-domain` | Check domain against Trie blocklist |
| POST | `/api/threat-intel/blocklist/ip` | Add IP prefix to blocklist |
| POST | `/api/threat-intel/blocklist/domain` | Add domain to blocklist |
| WS | `/api/alerts/ws` | Real-time alert WebSocket stream |
| GET | `/api/alerts/history` | Recent alert history |
| GET | `/health` | Health check + DB status |

---

## 🧪 Test the Live API

```bash
# Network anomaly detection (known malicious IP)
curl -X POST https://cyber-soc-dashboard-api.onrender.com/api/network/analyze \
  -H "Content-Type: application/json" \
  -d '{"protocol_type":"tcp","service":"http","flag":"SF","src_bytes":300,"dst_bytes":1500,"src_ip":"185.220.10.55","dst_ip":"10.0.0.5"}'

# Phishing email detection
curl -X POST https://cyber-soc-dashboard-api.onrender.com/api/email/analyze \
  -H "Content-Type: application/json" \
  -d '{"subject":"Verify your account now","body":"Click here immediately or your account will be suspended http://bit.ly/x"}'

# Threat intel lookup
curl -X POST https://cyber-soc-dashboard-api.onrender.com/api/threat-intel/check-ip \
  -H "Content-Type: application/json" \
  -d '{"ip":"185.220.10.55"}'
```

---

## 📁 Project Structure

```
cyber-soc-dashboard/
├── backend/
│   ├── app/
│   │   ├── main.py                    # FastAPI app + lifecycle hooks
│   │   ├── routers/
│   │   │   ├── network.py             # Traffic analysis endpoints
│   │   │   ├── email.py               # Phishing detection endpoints
│   │   │   ├── threat_intel.py        # IP/domain lookup endpoints
│   │   │   └── alerts.py              # WebSocket + alert history
│   │   ├── services/
│   │   │   ├── alert_manager.py       # WebSocket broadcast manager
│   │   │   └── database.py            # MongoDB persistence layer
│   │   └── ml/
│   │       ├── inference_service.py   # Unified ML inference service
│   │       ├── trie.py                # IP/domain Trie implementation
│   │       ├── graph.py               # Traffic graph + attack detection
│   │       ├── train_rf.py            # RandomForest training
│   │       ├── train_autoencoder.py   # Autoencoder training
│   │       └── train_email_classifier.py  # NLP classifier training
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/                # NetworkGraph3D, AlertPanel, etc.
│       └── services/
│           └── api.ts                 # Typed API client
├── data/
│   └── models/                        # Trained model artifacts
└── render.yaml                        # Render deployment config
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Three.js, Recharts, Vite |
| Backend | Python 3.11, FastAPI, WebSockets |
| ML/AI | scikit-learn, PyTorch, NumPy, Pandas |
| Database | MongoDB Atlas, Motor (async driver) |
| DSA | Custom Trie, Directed Graph |
| Deployment | Vercel (frontend), Render (backend), MongoDB Atlas |

---

## 🎯 Interview Talking Points

- **Why Autoencoder over just RandomForest?** The RF is supervised — it can only recognize attacks it was trained on. The autoencoder learns what "normal" looks like and flags deviations, catching zero-day attacks by definition. On NSL-KDD's test set (which deliberately includes unseen attack types), the autoencoder achieves 83% accuracy vs RF's 77%.

- **Why a Trie for the blocklist?** Linear scan of a blocklist with 10,000 entries is O(n) per lookup. A Trie brings this to O(k) where k is the IP/domain length — independent of blocklist size. Critical for high-volume traffic inspection.

- **Why not Kafka/Spark?** Real-time alerts use in-process WebSocket broadcasting — the right tool for a single-instance deployment. Redis Pub/Sub would be the documented upgrade path to scale across multiple instances, but claiming Kafka without using it is a red flag in interviews.

- **MongoDB graceful degradation** — if `MONGODB_URI` isn't set, the app falls back to in-memory storage transparently. Production-ready design: zero-setup for local dev, full persistence in deployment.

---

## 👨‍💻 Author

**Kailash Aghav**
- LinkedIn: [linkedin.com/in/kailash-aghav](https://linkedin.com/in/kailash-aghav)
- GitHub: [@Kailashaghav](https://github.com/Kailashaghav)
- Portfolio: [kailashaghavportfolio.vercel.app](https://kailashaghavportfolio.vercel.app)

---

## 📄 License

MIT License — feel free to use this project as a reference or starting point.

---

<div align="center">
⭐ Star this repo if you found it useful!
</div>
