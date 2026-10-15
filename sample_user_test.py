import requests
import json
import time

BASE_URL = "http://localhost:5000"

def run_tests():
    print("=" * 60)
    print("NEUROSENSE AI — END-TO-END VERIFICATION SUITE")
    print("=" * 60)

    # 1. Health Checks
    print("\n[1] Testing Health Endpoints...")
    r_fastapi = requests.get(f"{BASE_URL}/api/health")
    print(f"  FastAPI /api/health: {r_fastapi.status_code}, service={r_fastapi.json().get('service')}")
    assert r_fastapi.status_code == 200

    r_flask = requests.get(f"{BASE_URL}/health")
    print(f"  Flask WSGI /health:  {r_flask.status_code}, db={r_flask.json().get('database')}")
    assert r_flask.status_code == 200

    # 2. Register Sample User With Lifestyle Data
    print("\n[2] Registering Sample User (Eleanor Vance, age 74, with lifestyle metrics)...")
    user_email = f"eleanor.vance.{int(time.time())}@example.com"
    reg_payload = {
        "name": "Eleanor Vance",
        "email": user_email,
        "password": "SecurePassword#2026",
        "age": 74,
        "gender": 1,
        "educationLevel": 2,
        "ethnicity": 0,
        "lifestyle": {
            "Age": 74,
            "Gender": 1,
            "Ethnicity": 0,
            "EducationLevel": 2,
            "BMI": 27.8,
            "Smoking": 0,
            "AlcoholConsumption": 1.5,
            "PhysicalActivity": 4.0,
            "DietQuality": 8.0,
            "SleepQuality": 7.5,
            "FamilyHistoryAlzheimers": 1,
            "CardiovascularDisease": 0,
            "Diabetes": 0,
            "Depression": 0,
            "HeadInjury": 0,
            "Hypertension": 1,
            "SystolicBP": 132,
            "DiastolicBP": 84,
            "CholesterolTotal": 205.0
        },
        "healthDataConsent": True
    }

    r_reg = requests.post(f"{BASE_URL}/auth/register", json=reg_payload)
    print(f"  Register Status: {r_reg.status_code}")
    assert r_reg.status_code == 200
    reg_data = r_reg.json()
    user_id = reg_data["user"]["id"]
    token = reg_data["token"]
    print(f"  Created user ID: {user_id}")
    print(f"  Session Token:   {token[:15]}...")

    headers = {"Authorization": f"Bearer {token}", "X-User-Id": user_id}

    # 3. Test Login
    print("\n[3] Testing Login with Hashed Password Authentication...")
    r_login = requests.post(f"{BASE_URL}/auth/login", json={
        "email": user_email,
        "password": "SecurePassword#2026"
    })
    print(f"  Login Status: {r_login.status_code}")
    assert r_login.status_code == 200
    print(f"  Logged in user: {r_login.json()['user']['name']}")

    # 4. Test GET /risk/lifestyle
    print("\n[4] Testing GET /risk/lifestyle (ML Inference & SHAP)...")
    r_risk = requests.get(f"{BASE_URL}/risk/lifestyle", headers=headers)
    print(f"  Risk Evaluation Status: {r_risk.status_code}")
    assert r_risk.status_code == 200
    risk_info = r_risk.json()
    print(f"  Risk Probability : {risk_info['risk_probability']}")
    print(f"  Risk Percentage  : {risk_info['risk_percentage']}%")
    print(f"  Risk Level       : {risk_info['risk_level']}")
    print(f"  Confidence Band  : {risk_info['confidence_band']}")
    print(f"  Disclaimer       : \"{risk_info['disclaimer']}\"")
    print(f"\n  Top 5 Contributing Factors (SHAP):")
    for idx, factor in enumerate(risk_info["top_contributing_factors"], 1):
        print(f"    {idx}. {factor['label']}: val={factor['value']}, impact={factor['impact']} (magnitude={factor['magnitude']})")

    # 5. Test Profile Update: Modify Lifestyle Answers (Task 8)
    print("\n[5] Updating Lifestyle Answers via PUT /api/user/lifestyle...")
    update_payload = {
        "lifestyle": {
            **reg_payload["lifestyle"],
            "Smoking": 1,
            "PhysicalActivity": 0.5,
            "SleepQuality": 4.5,
            "Hypertension": 1
        },
        "healthDataConsent": True
    }
    r_update = requests.put(f"{BASE_URL}/api/user/lifestyle", json=update_payload, headers=headers)
    print(f"  Update Status: {r_update.status_code}")
    assert r_update.status_code == 200

    # 6. Verify Refreshed Prediction
    print("\n[6] Verifying Refreshed Prediction After Lifestyle Changes...")
    r_risk_new = requests.get(f"{BASE_URL}/risk/lifestyle", headers=headers)
    assert r_risk_new.status_code == 200
    new_risk = r_risk_new.json()
    print(f"  Previous Risk Score: {risk_info['risk_percentage']}%")
    print(f"  Refreshed Risk Score: {new_risk['risk_percentage']}% ({new_risk['risk_level']})")

    # 7. Test Account with Missing Lifestyle Data (Task 9)
    print("\n[7] Testing User Without Lifestyle Data (Task 9 Prompt Check)...")
    empty_email = f"incomplete.user.{int(time.time())}@example.com"
    r_empty_reg = requests.post(f"{BASE_URL}/auth/register", json={
        "name": "Legacy User",
        "email": empty_email,
        "password": "Password123!",
        "age": 65,
        "lifestyle": {},
        "healthDataConsent": False
    })
    empty_token = r_empty_reg.json()["token"]
    r_empty_risk = requests.get(f"{BASE_URL}/risk/lifestyle", headers={"Authorization": f"Bearer {empty_token}"})
    print(f"  Status for Incomplete User: {r_empty_risk.status_code}")
    print(f"  has_lifestyle_data: {r_empty_risk.json().get('has_lifestyle_data')}")
    print(f"  Message: \"{r_empty_risk.json().get('message')}\"")
    assert r_empty_risk.json().get('has_lifestyle_data') is False

    print("\n" + "=" * 60)
    print("ALL 7 END-TO-END VERIFICATION CHECKS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
