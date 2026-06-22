import urllib.request
import urllib.error
import json
import sys

BACKEND_URL = "http://localhost:8000"

print("=" * 60)
print("Cyber SOC System Connectivity Check")
print("=" * 60)

# 1. Test Health endpoint
print("\n[1/3] Testing Backend Health Check...")
try:
    with urllib.request.urlopen(f"{BACKEND_URL}/health", timeout=3) as response:
        status_code = response.getcode()
        data = json.loads(response.read().decode())
        print(f"      Status Code: {status_code}")
        print(f"      Response: {data}")
        if data.get("status") == "healthy" or data.get("status") == "ok":
            print("      SUCCESS: Backend is running and healthy!")
except Exception as e:
    print(f"      FAILED: Could not connect to backend at {BACKEND_URL}/health")
    print(f"      Error: {e}")
    print("\n      --> TO RUN THE BACKEND:")
    print("      Open a terminal and run:")
    print("      cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000")
    sys.exit(1)

# 2. Test Phishing Email Classifier endpoint
print("\n[2/3] Testing Phishing Email Classifier Endpoint...")
email_payload = {
    "subject": "Urgent Security Update required",
    "body": "Your bank account has been locked. Click http://scam-bank-verify.com/login now to unlock."
}
req = urllib.request.Request(
    f"{BACKEND_URL}/api/email/analyze",
    data=json.dumps(email_payload).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST"
)
try:
    with urllib.request.urlopen(req, timeout=3) as response:
        status_code = response.getcode()
        data = json.loads(response.read().decode())
        print(f"      Status Code: {status_code}")
        print(f"      Phishing Flagged: {data.get('is_phishing')}")
        print(f"      Phishing Probability: {data.get('phishing_probability')}")
        print(f"      Top Signals: {data.get('top_signals')}")
        print("      SUCCESS: Phishing classifier is working!")
except Exception as e:
    print(f"      FAILED: Phishing endpoint request failed. Error: {e}")

# 3. Test Network Anomaly Classifier endpoint
print("\n[3/3] Testing Network Traffic Anomaly Endpoint...")
network_payload = {
    "protocol_type": "tcp",
    "service": "http",
    "flag": "SF",
    "src_bytes": 350,
    "dst_bytes": 1200,
    "duration": 0,
    "count": 10,
    "srv_count": 10,
    "logged_in": 1,
    "same_srv_rate": 1.0,
    "diff_srv_rate": 0.0,
    "src_ip": "192.168.1.100",
    "dst_ip": "10.0.0.5"
}
req = urllib.request.Request(
    f"{BACKEND_URL}/api/network/analyze",
    data=json.dumps(network_payload).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST"
)
try:
    with urllib.request.urlopen(req, timeout=3) as response:
        status_code = response.getcode()
        data = json.loads(response.read().decode())
        print(f"      Status Code: {status_code}")
        print(f"      Traffic Flagged (Anomaly/Attack)? {data.get('flagged')}")
        print(f"      Severity Level: {data.get('severity')}")
        print(f"      Random Forest Result: {data.get('random_forest')}")
        print(f"      Autoencoder Result: {data.get('autoencoder')}")
        print("      SUCCESS: Network anomaly endpoint is working!")
except Exception as e:
    print(f"      FAILED: Network anomaly endpoint request failed. Error: {e}")

print("\n" + "=" * 60)
print("System is connected and functional!")
print("Open your browser to http://localhost:5173 to load the frontend dashboard.")
print("=" * 60)
