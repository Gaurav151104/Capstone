import os
import sys
import json
import time
import hashlib
import secrets
from datetime import datetime
from typing import Dict, Any, Optional, List

import joblib
import numpy as np
import pandas as pd
import shap
from pydantic import BaseModel, Field

from fastapi import FastAPI, HTTPException, Header, Depends, status, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.wsgi import WSGIMiddleware
from pymongo import MongoClient

# Ensure backend directory is in sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Import existing Flask app
from app import app as flask_app, get_collection, use_mongo, db, LocalCollection, generate_signed_token, verify_signed_token

# Initialize FastAPI application
fastapi_app = FastAPI(
    title="NeuroSense AI — Cognitive & Lifestyle Screening API",
    version="2.0.0",
    description="Unified API serving ML-based lifestyle dementia risk prediction and existing cognitive screening modules."
)

# Enable CORS for frontend
cors_origins_env = os.environ.get("CORS_ORIGINS", "")
if cors_origins_env.strip():
    allowed_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
else:
    allowed_origins = ["*"]

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# SHAP neutral impact threshold configuration constant
SHAP_NEUTRAL_THRESHOLD = 0.05

# --------------------------------------------------------------------------
# Database Layer
# --------------------------------------------------------------------------
users_col = get_collection("users")

def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    if not salt:
        salt = secrets.token_hex(16)
    # Secure PBKDF2 HMAC SHA-256
    pwd_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000).hex()
    return pwd_hash, salt

def verify_password(password: str, salt: str, expected_hash: str) -> bool:
    pwd_hash, _ = hash_password(password, salt)
    return secrets.compare_digest(pwd_hash, expected_hash)

# In-memory session token store (token -> user_id)
TOKEN_STORE: Dict[str, str] = {}

DEV_SEED_DEMO_USER = os.environ.get("DEV_SEED_DEMO_USER", "0") == "1"

def seed_demo_user():
    if not DEV_SEED_DEMO_USER:
        print("[Auth] DEV_SEED_DEMO_USER=0 (default off). Demo user seeding skipped.")
        return
    if use_mongo:
        print("[Auth] Connected to real dementia_db MongoDB. Refusing to seed demo user into production database.")
        return
    existing = users_col.find_one({"email": "user@test.com"})
    if not existing:
        pwd_hash, salt = hash_password("password123")
        demo_user = {
            "id": "demo_user_001",
            "name": "Demo User",
            "email": "user@test.com",
            "password_hash": pwd_hash,
            "salt": salt,
            "age": 65,
            "gender": 0,
            "educationLevel": 2,
            "ethnicity": 0,
            "lifestyle": {
                "Age": 65,
                "Gender": 0,
                "EducationLevel": 2,
                "Ethnicity": 0,
                "BMI": 24.5,
                "Smoking": 0,
                "AlcoholConsumption": 2.0,
                "PhysicalActivity": 5.0,
                "DietQuality": 7.5,
                "SleepQuality": 7.0,
                "FamilyHistoryAlzheimers": 0,
                "CardiovascularDisease": 0,
                "Diabetes": 0,
                "Depression": 0,
                "HeadInjury": 0,
                "Hypertension": 0,
                "SystolicBP": 120,
                "DiastolicBP": 80,
                "CholesterolTotal": 195,
                "CholesterolLDL": 110,
                "CholesterolHDL": 55,
                "CholesterolTriglycerides": 140,
                "MMSE": 28,
                "FunctionalAssessment": 8.5,
                "MemoryComplaints": 0,
                "BehavioralProblems": 0,
                "ADL": 9.0,
                "Confusion": 0,
                "Disorientation": 0,
                "PersonalityChanges": 0,
                "DifficultyCompletingTasks": 0,
                "Forgetfulness": 0
            },
            "healthDataConsent": True,
            "createdAt": datetime.utcnow().isoformat(),
            "updatedAt": datetime.utcnow().isoformat()
        }
        users_col.insert_one(demo_user)
        print("[Auth] DEV_SEED_DEMO_USER=1: Seeded development demo user 'user@test.com' into local fallback store.")

try:
    seed_demo_user()
except Exception as e:
    print(f"[Auth] Notice: Could not seed demo user: {e}")

def get_current_user_id(
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None)
) -> str:
    """Extract authenticated user ID from Bearer token or fallback headers."""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1].strip()
        if token in TOKEN_STORE:
            return TOKEN_STORE[token]
        signed_uid = verify_signed_token(token)
        if signed_uid:
            return signed_uid
        # In simple stateless setups, token itself may be the user_id if valid
        user = users_col.find_one({"id": token}) or users_col.find_one({"_id": token})
        if user:
            return user.get("id") or str(user.get("_id"))
    
    if x_user_id and x_user_id.strip():
        user = users_col.find_one({"id": x_user_id.strip()}) or users_col.find_one({"_id": x_user_id.strip()})
        if user:
            return user.get("id") or str(user.get("_id"))
        # If user document not yet written (first registration), return x_user_id
        return x_user_id.strip()

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Please provide a valid Bearer token or User ID."
    )

# --------------------------------------------------------------------------
# Model Bundle Loader & SHAP Explainer
# --------------------------------------------------------------------------
BUNDLE_PATH = os.path.join(PROJECT_ROOT, "models", "dementia_bundle.pkl")
bundle_data: Optional[Dict[str, Any]] = None
shap_explainer: Optional[Any] = None

def load_ml_bundle():
    global bundle_data, shap_explainer
    if os.path.exists(BUNDLE_PATH):
        try:
            bundle_data = joblib.load(BUNDLE_PATH)
            model = bundle_data["model"]
            features = bundle_data["features"]
            # Pre-initialize SHAP explainer
            if hasattr(model, "coef_"):
                # Linear/Logistic model
                shap_explainer = shap.LinearExplainer(model, np.zeros((1, len(features))))
            else:
                shap_explainer = shap.TreeExplainer(model)
            print(f"[ML Engine] Loaded lifestyle dementia bundle with {len(features)} features ({bundle_data.get('model_name')}).")
        except Exception as e:
            print(f"[ML Engine] Warning loading dementia bundle from {BUNDLE_PATH}: {e}")
    else:
        print(f"[ML Engine] dementia_bundle.pkl not found at {BUNDLE_PATH}. Please run train.py first.")

load_ml_bundle()

# Human readable feature label mapping
FEATURE_LABELS = {
    "Age": "Age",
    "Gender": "Gender",
    "Ethnicity": "Ethnicity",
    "EducationLevel": "Education Level",
    "BMI": "Body Mass Index (BMI)",
    "Smoking": "Smoking Status",
    "AlcoholConsumption": "Alcohol Consumption",
    "PhysicalActivity": "Physical Activity Level",
    "DietQuality": "Dietary Quality",
    "SleepQuality": "Sleep Quality Index",
    "FamilyHistoryAlzheimers": "Family History of Alzheimer's",
    "CardiovascularDisease": "Cardiovascular Disease History",
    "Diabetes": "Diabetes Condition",
    "Depression": "Depression History",
    "HeadInjury": "Prior Head Injury",
    "Hypertension": "Hypertension (High Blood Pressure)",
    "SystolicBP": "Systolic Blood Pressure",
    "DiastolicBP": "Diastolic Blood Pressure",
    "CholesterolTotal": "Total Cholesterol",
    "CholesterolLDL": "LDL Cholesterol",
    "CholesterolHDL": "HDL Cholesterol",
    "CholesterolTriglycerides": "Triglycerides",
    "Confusion": "Confusion Episode Reports",
    "Disorientation": "Spatial/Temporal Disorientation",
    "PersonalityChanges": "Personality Variations",
    "DifficultyCompletingTasks": "Difficulty with Routine Tasks",
    "Forgetfulness": "Recurrent Forgetfulness"
}

# --------------------------------------------------------------------------
# Pydantic Schemas
# --------------------------------------------------------------------------
class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    age: int
    gender: Optional[int] = 0
    educationLevel: Optional[int] = 1
    ethnicity: Optional[int] = 0
    lifestyle: Optional[Dict[str, Any]] = None
    healthDataConsent: Optional[bool] = False

class LoginRequest(BaseModel):
    email: str
    password: str

class LifestyleUpdateRequest(BaseModel):
    lifestyle: Dict[str, Any]
    healthDataConsent: Optional[bool] = True

# --------------------------------------------------------------------------
# FastAPI Endpoints
# --------------------------------------------------------------------------

@fastapi_app.get("/api/health")
def api_health():
    return {
        "status": "healthy",
        "service": "NeuroSense-AI Unified FastAPI & Screening Engine",
        "model_loaded": bundle_data is not None,
        "database": "mongodb" if use_mongo else "local_json_store",
        "timestamp": datetime.utcnow().isoformat()
    }

# POST /auth/register
@fastapi_app.post("/auth/register")
def register_user(req: RegisterRequest):
    email_clean = req.email.strip().lower()
    existing = users_col.find_one({"email": email_clean})
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    pwd_hash, salt = hash_password(req.password)
    user_id = f"user_{int(time.time()*1000)}"

    # Normalize lifestyle answers
    lifestyle_data = req.lifestyle or {}
    # Ensure demographics are synced into lifestyle dict
    lifestyle_data["Age"] = req.age
    if "Gender" not in lifestyle_data:
        lifestyle_data["Gender"] = req.gender
    if "EducationLevel" not in lifestyle_data:
        lifestyle_data["EducationLevel"] = req.educationLevel
    if "Ethnicity" not in lifestyle_data:
        lifestyle_data["Ethnicity"] = req.ethnicity

    user_doc = {
        "id": user_id,
        "name": req.name.strip(),
        "email": email_clean,
        "password_hash": pwd_hash,
        "salt": salt,
        "age": req.age,
        "gender": req.gender,
        "educationLevel": req.educationLevel,
        "ethnicity": req.ethnicity,
        "lifestyle": lifestyle_data,
        "healthDataConsent": bool(req.healthDataConsent),
        "createdAt": datetime.utcnow().isoformat(),
        "updatedAt": datetime.utcnow().isoformat()
    }

    users_col.insert_one(user_doc)

    # Issue secure signed token
    token = generate_signed_token(user_id)
    TOKEN_STORE[token] = user_id

    # Return safe user record (no passwords or salts)
    safe_user = {
        "id": user_id,
        "name": user_doc["name"],
        "email": user_doc["email"],
        "age": user_doc["age"],
        "gender": user_doc["gender"],
        "educationLevel": user_doc["educationLevel"],
        "lifestyle": user_doc["lifestyle"],
        "healthDataConsent": user_doc["healthDataConsent"],
        "token": token
    }
    return {"message": "User registered successfully", "user": safe_user, "token": token}

# POST /auth/login
@fastapi_app.post("/auth/login")
def login_user(req: LoginRequest):
    email_clean = req.email.strip().lower()
    user = users_col.find_one({"email": email_clean})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    pwd_hash = user.get("password_hash")
    salt = user.get("salt")
    if not pwd_hash or not salt:
        # Fallback for plain-text legacy accounts: migrate on login
        if user.get("password") == req.password:
            pwd_hash, salt = hash_password(req.password)
            user["password_hash"] = pwd_hash
            user["salt"] = salt
            if "_id" in user:
                users_col.update_one({"_id": user["_id"]}, {"$set": {"password_hash": pwd_hash, "salt": salt}})
        else:
            raise HTTPException(status_code=401, detail="Invalid email or password.")
    else:
        if not verify_password(req.password, salt, pwd_hash):
            raise HTTPException(status_code=401, detail="Invalid email or password.")

    user_id = user.get("id") or str(user.get("_id"))
    token = generate_signed_token(user_id)
    TOKEN_STORE[token] = user_id

    safe_user = {
        "id": user_id,
        "name": user.get("name", "User"),
        "email": user.get("email"),
        "age": user.get("age"),
        "gender": user.get("gender", 0),
        "educationLevel": user.get("educationLevel", 1),
        "lifestyle": user.get("lifestyle", {}),
        "healthDataConsent": user.get("healthDataConsent", False),
        "token": token
    }
    return {"message": "Login successful", "user": safe_user, "token": token}

# GET /risk/lifestyle (Task 6)
@fastapi_app.get("/risk/lifestyle")
def get_lifestyle_risk(user_id: str = Depends(get_current_user_id)):
    """
    Evaluates lifestyle dementia risk using the trained bundle.
    Returns probability, risk level (Low, Moderate, High), and top 5 SHAP contributing factors.
    """
    if bundle_data is None:
        load_ml_bundle()
    if bundle_data is None:
        raise HTTPException(
            status_code=500,
            detail="Model bundle not loaded. Ensure train.py has been executed to create models/dementia_bundle.pkl."
        )

    user = users_col.find_one({"id": user_id}) or users_col.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User profile not found.")

    saved_lifestyle = user.get("lifestyle") or {}
    
    # Task 9: Check if actual lifestyle metrics are present (not just empty demographic defaults)
    core_lifestyle_keys = ["BMI", "PhysicalActivity", "DietQuality", "SleepQuality", "Smoking", "AlcoholConsumption"]
    has_metrics = any(k in saved_lifestyle for k in core_lifestyle_keys)
    if not saved_lifestyle or not has_metrics:
        return {
            "has_lifestyle_data": False,
            "message": "No lifestyle data saved yet. Please complete your Lifestyle & Health survey to generate your personalized risk profile."
        }

    model = bundle_data["model"]
    scaler = bundle_data["scaler"]
    feature_names = bundle_data["features"]
    medians = bundle_data["medians"]

    # Reindex answers to model feature order and fill missing values with training medians
    input_row = {}
    for feat in feature_names:
        if feat in saved_lifestyle and saved_lifestyle[feat] is not None and str(saved_lifestyle[feat]).strip() != "":
            try:
                input_row[feat] = float(saved_lifestyle[feat])
            except (ValueError, TypeError):
                input_row[feat] = float(medians.get(feat, 0.0))
        elif feat == "Age" and user.get("age"):
            input_row[feat] = float(user["age"])
        elif feat == "Gender" and user.get("gender") is not None:
            input_row[feat] = float(user["gender"])
        elif feat == "EducationLevel" and user.get("educationLevel") is not None:
            input_row[feat] = float(user["educationLevel"])
        else:
            # Impute training median for unprovided features
            input_row[feat] = float(medians.get(feat, 0.0))

    df_single = pd.DataFrame([input_row], columns=feature_names)

    # Standardize features
    scaled_values = scaler.transform(df_single.values)

    # Predict risk probability
    prob_arr = model.predict_proba(scaled_values)[0]
    prob_risk = float(prob_arr[1])
    pct_risk = round(prob_risk * 100, 1)

    # Risk level categorization per requirements:
    # Low < 0.33, Moderate 0.33 - 0.66, High > 0.66
    if prob_risk < 0.33:
        risk_level = "Low"
        confidence_band = "Lower Relative Risk Band"
        badge_color = "emerald"
    elif prob_risk <= 0.66:
        risk_level = "Moderate"
        confidence_band = "Moderate Risk Band"
        badge_color = "yellow"
    else:
        risk_level = "High"
        confidence_band = "Higher Relative Risk Band"
        badge_color = "amber"

    # Compute Top 5 Contributing Factors using SHAP
    top_factors = []
    try:
        global shap_explainer
        if shap_explainer is None:
            if hasattr(model, "coef_"):
                shap_explainer = shap.LinearExplainer(model, np.zeros((1, len(feature_names))))
            else:
                shap_explainer = shap.TreeExplainer(model)

        shap_values = shap_explainer.shap_values(scaled_values)[0]
        # Sort indices by absolute impact magnitude
        sorted_indices = np.argsort(np.abs(shap_values))[::-1]

        for idx in sorted_indices[:5]:
            feat = feature_names[idx]
            impact_val = float(shap_values[idx])
            raw_val = input_row[feat]
            if abs(impact_val) < SHAP_NEUTRAL_THRESHOLD:
                direction = "No clear effect"
            elif impact_val > 0:
                direction = "Increases Risk"
            else:
                direction = "Protective / Lowers Risk"
            
            top_factors.append({
                "feature": feat,
                "label": FEATURE_LABELS.get(feat, feat),
                "value": raw_val,
                "impact": direction,
                "magnitude": round(abs(impact_val), 4),
                "shap_value": round(impact_val, 4)
            })
    except Exception as e:
        print(f"[SHAP] Explanation calculation fallback: {e}")
        # Fallback to model coefficients if available
        if hasattr(model, "coef_"):
            coefs = model.coef_[0]
            contributions = coefs * scaled_values[0]
            sorted_idx = np.argsort(np.abs(contributions))[::-1][:5]
            for idx in sorted_idx:
                feat = feature_names[idx]
                contrib = float(contributions[idx])
                if abs(contrib) < SHAP_NEUTRAL_THRESHOLD:
                    fallback_direction = "No clear effect"
                elif contrib > 0:
                    fallback_direction = "Increases Risk"
                else:
                    fallback_direction = "Protective / Lowers Risk"
                top_factors.append({
                    "feature": feat,
                    "label": FEATURE_LABELS.get(feat, feat),
                    "value": input_row[feat],
                    "impact": fallback_direction,
                    "magnitude": round(abs(contrib), 4),
                    "shap_value": round(contrib, 4)
                })

    return {
        "has_lifestyle_data": True,
        "risk_probability": round(prob_risk, 4),
        "risk_percentage": pct_risk,
        "risk_level": risk_level,
        "confidence_band": confidence_band,
        "badge_color": badge_color,
        "top_contributing_factors": top_factors,
        "disclaimer": "Screening aid only, not a medical diagnosis. Prototype model trained on synthetic data.",
        "model_name": bundle_data.get("model_name", "Logistic Regression"),
        "evaluated_at": datetime.utcnow().isoformat()
    }

# GET /api/user/lifestyle (Get current user's profile and lifestyle data)
@fastapi_app.get("/api/user/lifestyle")
def get_user_lifestyle(user_id: str = Depends(get_current_user_id)):
    user = users_col.find_one({"id": user_id}) or users_col.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    
    return {
        "userId": user_id,
        "name": user.get("name"),
        "email": user.get("email"),
        "age": user.get("age"),
        "lifestyle": user.get("lifestyle", {}),
        "healthDataConsent": user.get("healthDataConsent", False)
    }

# PUT /api/user/lifestyle (Task 8: update lifestyle answers and trigger fresh prediction)
@fastapi_app.put("/api/user/lifestyle")
def update_user_lifestyle(req: LifestyleUpdateRequest, user_id: str = Depends(get_current_user_id)):
    user = users_col.find_one({"id": user_id}) or users_col.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    lifestyle_data = dict(req.lifestyle)
    now_iso = datetime.utcnow().isoformat()

    # Update in database (MongoDB or local store)
    if use_mongo and db is not None:
        users_col.update_one(
            {"id": user_id},
            {"$set": {
                "lifestyle": lifestyle_data,
                "healthDataConsent": req.healthDataConsent,
                "updatedAt": now_iso
            }}
        )
    else:
        # Local JSON collection update
        items = users_col._read_all()
        for u in items:
            if u.get("id") == user_id or str(u.get("_id")) == user_id:
                u["lifestyle"] = lifestyle_data
                u["healthDataConsent"] = req.healthDataConsent
                u["updatedAt"] = now_iso
                break
        users_col._write_all(items)

    return {
        "message": "Lifestyle profile successfully updated.",
        "lifestyle": lifestyle_data,
        "updatedAt": now_iso
    }

# Also support PUT /api/users/{userId}/lifestyle
@fastapi_app.put("/api/users/{userId}/lifestyle")
def update_user_lifestyle_by_param(userId: str, req: LifestyleUpdateRequest):
    return update_user_lifestyle(req, user_id=userId)

# --------------------------------------------------------------------------
# Mount Flask App for full backward compatibility
# All existing routes (/health, /api/interview-result, /api/report, /analyze-audio, etc.)
# continue to work seamlessly!
# --------------------------------------------------------------------------
fastapi_app.mount("", WSGIMiddleware(flask_app))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 5000))
    print("\nStarting NeuroSense AI Unified Server (FastAPI + Flask WSGI)...")
    print(f"Listening on http://0.0.0.0:{port}\n")
    uvicorn.run(fastapi_app, host="0.0.0.0", port=port)
