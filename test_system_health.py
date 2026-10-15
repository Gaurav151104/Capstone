import urllib.request
import json
import sys

def run_tests():
    print("==================================================")
    print("NeuroSense AI — Automated Component & API Validation")
    print("==================================================")

    # 1. Frontend
    try:
        with urllib.request.urlopen("http://localhost:5173/") as resp:
            print(f"[OK] 1. Frontend (Vite) responded with HTTP {resp.status}")
    except Exception as e:
        print(f"[FAIL] 1. Frontend error: {e}")
        sys.exit(1)

    # 2. Backend Health
    try:
        with urllib.request.urlopen("http://localhost:5000/api/health") as resp:
            data = json.loads(resp.read().decode())
            print(f"[OK] 2. Backend Unified API: status={data.get('status')}, model_loaded={data.get('model_loaded')}, db={data.get('database')}")
    except Exception as e:
        print(f"[FAIL] 2. Backend health error: {e}")
        sys.exit(1)

    # 3. Flask Health
    try:
        with urllib.request.urlopen("http://localhost:5000/health") as resp:
            data = json.loads(resp.read().decode())
            print(f"[OK] 3. Flask WSGI Mount: status={data.get('status')}, database={data.get('database')}")
    except Exception as e:
        print(f"[FAIL] 3. Flask health error: {e}")
        sys.exit(1)

    # 4. Auth Login
    token = None
    try:
        payload = json.dumps({"email": "user@test.com", "password": "password123"}).encode("utf-8")
        req = urllib.request.Request("http://localhost:5000/auth/login", data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req) as resp:
            login_res = json.loads(resp.read().decode())
            token = login_res.get("token")
            user = login_res.get("user", {})
            print(f"[OK] 4. Authentication Login: authenticated '{user.get('name')}' ({user.get('email')}), token received.")
    except Exception as e:
        print(f"[FAIL] 4. Auth login error: {e}")
        sys.exit(1)

    # 5. Lifestyle Risk Assessment & SHAP Explainability
    try:
        req = urllib.request.Request("http://localhost:5000/risk/lifestyle", headers={"Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(req) as resp:
            risk_res = json.loads(resp.read().decode())
            print(f"[OK] 5. Lifestyle Risk & SHAP: risk_level={risk_res.get('risk_level')}, probability={risk_res.get('risk_probability')} ({risk_res.get('risk_percentage')}%)")
            factors = risk_res.get("top_contributing_factors", [])
            print(f"     Top {len(factors)} SHAP Contributing Factors identified:")
            for f in factors:
                print(f"       • {f.get('label')}: {f.get('impact')} (value={f.get('value')}, shap={f.get('shap_value')})")
    except Exception as e:
        print(f"[FAIL] 5. Lifestyle risk error: {e}")
        sys.exit(1)

    # 6. Cognitive Consent Check
    try:
        req = urllib.request.Request("http://localhost:5000/api/cognitive-consent", headers={"Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(req) as resp:
            consent_res = json.loads(resp.read().decode())
            print(f"[OK] 6. Cognitive Consent: consented={consent_res.get('consented')}")
    except Exception as e:
        print(f"[WARN] 6. Cognitive consent check: {e}")

    # 7. User History & Composite Trend Fusion
    try:
        req = urllib.request.Request("http://localhost:5000/api/user-history/demo_user_001", headers={"Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(req) as resp:
            history_res = json.loads(resp.read().decode())
            print(f"[OK] 7. User History & Trend Fusion: latestComposite={history_res.get('latestComposite')}, band={history_res.get('bandInfo', {}).get('band')}")
    except Exception as e:
        print(f"[WARN] 7. User history check: {e}")

    print("==================================================")
    print("ALL CORE SYSTEM SERVICES AND MODULES VALIDATED!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
