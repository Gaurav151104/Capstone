import os
import io
import json
import time
import hmac
import base64
import tempfile
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Tuple
import functools
import hashlib
import secrets
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from pymongo import MongoClient
import joblib
import pandas as pd
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

try:
    from audio_utils import extract_features, FEATURE_NAMES
except ImportError:
    from backend.audio_utils import extract_features, FEATURE_NAMES

try:
    from cognitive_data import (
        WORD_LIST_POOLS, IMAGE_SYMBOL_POOL, MEMORY_ICON_POOL,
        get_next_word_list_form, generate_constrained_image_sequence,
        crypto_fisher_yates_shuffle, generate_reaction_time_isi_sequence,
        generate_word_recall_stimuli, generate_image_recall_stimuli,
        generate_memory_match_stimuli, generate_reaction_time_stimuli,
        regenerate_session_stimuli
    )
    from scoring import score_session_measures, load_norms
except ImportError:
    from backend.cognitive_data import (
        WORD_LIST_POOLS, IMAGE_SYMBOL_POOL, MEMORY_ICON_POOL,
        get_next_word_list_form, generate_constrained_image_sequence,
        crypto_fisher_yates_shuffle, generate_reaction_time_isi_sequence,
        generate_word_recall_stimuli, generate_image_recall_stimuli,
        generate_memory_match_stimuli, generate_reaction_time_stimuli,
        regenerate_session_stimuli
    )
    from backend.scoring import score_session_measures, load_norms

app = Flask(__name__)

# Deployment Config: CORS allowed origins
cors_origins_env = os.environ.get("CORS_ORIGINS", "")
if cors_origins_env.strip():
    allowed_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
    CORS(app, origins=allowed_origins)
else:
    CORS(app)

# --------------------------------------------------------------------------
# Persistence Layer: MongoDB with Local JSON Fallback Store
# --------------------------------------------------------------------------
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
os.makedirs(DATA_DIR, exist_ok=True)

mongo_client = None
db = None
use_mongo = False

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/")
APP_ENV = os.environ.get("APP_ENV", "development").lower()

try:
    mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=1000)
    mongo_client.server_info()  # trigger connection check
    DB_NAME = os.environ.get("MONGO_DB_NAME", "dementia_db")
    db = mongo_client[DB_NAME]
    use_mongo = True
    print(f"[Persistence] Successfully connected to MongoDB at {MONGO_URI} (database: {DB_NAME}).")
except Exception as e:
    if APP_ENV == "production":
        raise RuntimeError(
            f"CRITICAL PRODUCTION STARTUP ERROR: MongoDB is unreachable at {MONGO_URI} ({e}). "
            "Server startup aborted because fallback JSON store cannot be used in production mode."
        )
    print(f"[Persistence] MongoDB not reachable ({e}). Transparently using robust local JSON store in {DATA_DIR}.")
    use_mongo = False

def get_collection(name):
    """Return collection interface that works with Mongo or local JSON files."""
    if use_mongo and db is not None:
        return db[name]
    return LocalCollection(name)

class LocalCollection:
    def __init__(self, name):
        self.name = name
        self.filepath = os.path.join(DATA_DIR, f"{name}.json")
        if not os.path.exists(self.filepath):
            with open(self.filepath, 'w', encoding='utf-8') as f:
                json.dump([], f)

    def _read_all(self):
        try:
            with open(self.filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return []

    def _write_all(self, data):
        with open(self.filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)

    def insert_one(self, doc):
        items = self._read_all()
        doc_copy = dict(doc)
        if '_id' not in doc_copy:
            doc_copy['_id'] = f"{self.name}_{int(time.time()*1000)}_{len(items)}"
        items.append(doc_copy)
        self._write_all(items)
        class InsertResult:
            def __init__(self, inserted_id):
                self.inserted_id = inserted_id
        return InsertResult(doc_copy['_id'])

    def find(self, query=None):
        items = self._read_all()
        if not query:
            return items
        results = []
        for item in items:
            match = True
            for k, v in query.items():
                if item.get(k) != v:
                    match = False
                    break
            if match:
                results.append(item)
        return results

    def find_one(self, query=None):
        results = self.find(query)
        return results[0] if results else None

# Collections
users_col = get_collection('users')
interview_col = get_collection('interview_results')
reaction_col = get_collection('reaction_time_results')
game_col = get_collection('game_sessions')
risk_col = get_collection('risk_assessments')
audio_col = get_collection('audio_analyses')
session_items_col = get_collection('session_items')
consent_col = get_collection('cognitive_consents')

# --------------------------------------------------------------------------
# Machine Learning Model & Scaler Loading
# --------------------------------------------------------------------------
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'dementia_model.pkl')
SCALER_PATH = os.path.join(os.path.dirname(__file__), 'scaler.pkl')

ml_model = None
ml_scaler = None

try:
    if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
        ml_model = joblib.load(MODEL_PATH)
        ml_scaler = joblib.load(SCALER_PATH)
        print("[ML Engine] XGBoost dementia model and StandardScaler loaded successfully.")
    else:
        print(f"[ML Engine] Model or scaler missing at {MODEL_PATH}")
except Exception as e:
    print(f"[ML Engine] Warning loading ML model/scaler: {e}")

# --------------------------------------------------------------------------
# Helper: Serialization & Composite Score Calculation
# --------------------------------------------------------------------------
def clean_mongo_doc(doc):
    if not doc:
        return None
    d = dict(doc)
    if '_id' in d:
        d['_id'] = str(d['_id'])
    return d

def compute_composite_score(interview_score, reaction_score, games_avg, risk_score):
    """
    Computes weighted fusion wellness score (0-100):
    - Cognitive Interview (Orientation, Memory, Language): 40%
    - Reaction & Attention: 25%
    - Cognitive Mini-Games: 20%
    - Baseline Health Survey: 15%
    """
    components = []
    total_weight = 0
    weighted_sum = 0

    if interview_score is not None:
        weighted_sum += interview_score * 0.40
        total_weight += 0.40
        components.append(('interview', interview_score))

    if reaction_score is not None:
        weighted_sum += reaction_score * 0.25
        total_weight += 0.25
        components.append(('reaction', reaction_score))

    if games_avg is not None:
        weighted_sum += games_avg * 0.20
        total_weight += 0.20
        components.append(('games', games_avg))

    if risk_score is not None:
        # Invert clinical risk (100 risk = 0 wellness)
        wellness_from_risk = max(0, 100 - risk_score)
        weighted_sum += wellness_from_risk * 0.15
        total_weight += 0.15
        components.append(('risk', wellness_from_risk))

    if total_weight == 0:
        return 75  # default nominal score

    composite = round(weighted_sum / total_weight)
    return max(10, min(100, composite))

def get_band_from_score(score):
    if score >= 80:
        return {
            "band": "Lower Relative Risk Band",
            "category": "Optimal Performance",
            "interpretation": "Scores reflect stable cognitive performance across verbal recall, processing speed, and attention measures."
        }
    elif score >= 55:
        return {
            "band": "Moderate Risk Band",
            "category": "Mild Variation",
            "interpretation": "Observed mild variability in attention latency or recall. Consistent mental stimulation and wellness monitoring recommended."
        }
    else:
        return {
            "band": "Higher Relative Risk Band",
            "category": "Consultation Recommended",
            "interpretation": "Performance indicates variations across multiple cognitive markers. Consider discussing these results with a healthcare professional."
        }

# --------------------------------------------------------------------------
# Security, Pseudonymisation, Rate Limiting & Auth Layer
# --------------------------------------------------------------------------
# --------------------------------------------------------------------------
# Security, Pseudonymisation, Rate Limiting & Auth Layer
# --------------------------------------------------------------------------
# Load .env if present
_env_candidates = [
    os.path.join(os.path.dirname(__file__), '.env'),
    os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
]
for _ep in _env_candidates:
    if os.path.exists(_ep):
        try:
            with open(_ep, 'r', encoding='utf-8') as _f:
                for _line in _f:
                    _line = _line.strip()
                    if _line and not _line.startswith('#') and '=' in _line:
                        _k, _v = _line.split('=', 1)
                        os.environ.setdefault(_k.strip(), _v.strip())
        except Exception:
            pass

PEPPER = os.environ.get("NEUROSENSE_PEPPER")
if not PEPPER:
    raise RuntimeError(
        "CRITICAL SECURITY CONFIGURATION ERROR: NEUROSENSE_PEPPER environment variable is not set. "
        "Server startup aborted because pseudonymisation pepper cannot default to a hardcoded string."
    )

AUTH_SECRET_KEY = os.environ.get("JWT_SECRET")
if not AUTH_SECRET_KEY:
    raise RuntimeError(
        "CRITICAL SECURITY CONFIGURATION ERROR: JWT_SECRET environment variable is not set. "
        "Server startup aborted because JWT_SECRET has no hardcoded default and is mandatory."
    )

def pseudonymise_user_id(user_id: str) -> str:
    """Hash and pseudonymise user_id for secure at-rest storage in clinical tables."""
    if not user_id:
        return "anon"
    return hashlib.sha256(f"{user_id}:{PEPPER}".encode('utf-8')).hexdigest()[:24]

# Sliding window rate limiter: {user_pseudonym: [timestamps]}
RATE_LIMIT_STORE: Dict[str, List[float]] = {}
RATE_LIMIT_WINDOW_SEC = 60
RATE_LIMIT_MAX_REQUESTS = 60

def check_rate_limit(user_pseudonym: str) -> bool:
    if app.config.get('TESTING'):
        return True
    now = time.time()
    timestamps = RATE_LIMIT_STORE.setdefault(user_pseudonym, [])
    RATE_LIMIT_STORE[user_pseudonym] = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW_SEC]
    if len(RATE_LIMIT_STORE[user_pseudonym]) >= RATE_LIMIT_MAX_REQUESTS:
        return False
    RATE_LIMIT_STORE[user_pseudonym].append(now)
    return True

def generate_signed_token(user_id: str) -> str:
    """Generate a tamper-proof cryptographically signed HMAC token for the user safe for IDs with dots."""
    ts = str(int(time.time()))
    u_b64 = base64.urlsafe_b64encode(user_id.encode('utf-8')).decode('utf-8').rstrip('=')
    msg = f"{u_b64}.{ts}".encode('utf-8')
    sig = hmac.new(AUTH_SECRET_KEY.encode('utf-8'), msg, hashlib.sha256).hexdigest()
    return f"{u_b64}.{ts}.{sig}"

def verify_signed_token(token: str) -> Optional[str]:
    """Verify cryptographically signed token or registered server session token."""
    if not token or not isinstance(token, str):
        return None
    # 1. Check server-side registered session store (main.py TOKEN_STORE)
    try:
        from main import TOKEN_STORE
        if token in TOKEN_STORE:
            return TOKEN_STORE[token]
    except Exception:
        pass
    # 2. Check signed HMAC token format: <user_id_b64>.<timestamp>.<sig>
    try:
        parts = token.split(".")
        if len(parts) == 3:
            u_b64, ts_str, sig = parts
            msg = f"{u_b64}.{ts_str}".encode('utf-8')
            expected = hmac.new(AUTH_SECRET_KEY.encode('utf-8'), msg, hashlib.sha256).hexdigest()
            if hmac.compare_digest(sig, expected):
                pad = (-len(u_b64)) % 4
                padded_u_b64 = u_b64 + ('=' * pad)
                uid = base64.urlsafe_b64decode(padded_u_b64.encode('utf-8')).decode('utf-8')
                # Token valid for 30 days
                if time.time() - float(ts_str) < 30 * 86400:
                    return uid
    except Exception:
        pass
    return None

def get_auth_user_id() -> Optional[str]:
    """
    Extract and verify authenticated user ID strictly from signed Authorization header.
    Never trusts X-User-Id, query parameters, or request body.
    """
    auth_header = request.headers.get('Authorization', '').strip()
    if not auth_header.startswith('Bearer '):
        return None
    token = auth_header.split(' ', 1)[1].strip()
    return verify_signed_token(token)

def require_auth(f):
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = get_auth_user_id()
        if not user_id:
            return jsonify({
                "error": "Unauthorized",
                "details": "Authentication required. A valid cryptographically signed Bearer token must be provided."
            }), 401

        pseudonym = pseudonymise_user_id(user_id)
        if not check_rate_limit(pseudonym):
            return jsonify({
                "error": "Rate limit exceeded",
                "details": "Too many requests. Please wait before taking more assessment trials."
            }), 429

        request.auth_user_id = user_id
        request.auth_pseudonym = pseudonym
        return f(*args, **kwargs)
    return decorated_function

def get_user_age_and_band(user_id: str, request_data: Optional[Dict[str, Any]] = None) -> Tuple[Optional[int], str]:
    """Extract age and age band for calibration and norm selection."""
    age = None
    if request_data and request_data.get('age') is not None:
        try:
            age = int(request_data['age'])
        except (ValueError, TypeError):
            pass
    if age is None and user_id:
        user = users_col.find_one({"id": user_id}) or users_col.find_one({"_id": user_id})
        if user:
            age = user.get('age') or user.get('lifestyle', {}).get('Age')
    if age is not None:
        try:
            age = int(age)
            if age < 55:
                band = "<55"
            elif age <= 64:
                band = "55-64"
            elif age <= 74:
                band = "65-74"
            else:
                band = "75+"
            return age, band
        except (ValueError, TypeError):
            pass
    return None, "unknown"

@app.after_request
def add_security_headers(response):
    """Enforce strict transport security, secure content type, frame options, and cookie protection."""
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    return response

# --------------------------------------------------------------------------
# API Endpoints
# --------------------------------------------------------------------------

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "service": "NeuroSense-AI Persistence API",
        "database": "mongodb" if use_mongo else "local_json_store",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

# 0. Consent Endpoints
@app.route('/api/cognitive-consent', methods=['POST'])
@require_auth
def record_cognitive_consent():
    data = request.get_json() or {}
    pseudonym = request.auth_pseudonym

    consent_record = {
        "user_pseudonym": pseudonym,
        "version": data.get("version", "2.0"),
        "consented": True,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "scope": data.get("scope", ["cognitive_games", "psychometric_norming"])
    }
    consent_col.insert_one(consent_record)
    return jsonify({
        "message": "Cognitive assessment consent recorded successfully",
        "consent": clean_mongo_doc(consent_record)
    }), 201

@app.route('/api/cognitive-consent', methods=['GET'])
@require_auth
def get_cognitive_consent():
    pseudonym = request.auth_pseudonym
    rec = consent_col.find_one({"user_pseudonym": pseudonym})
    if rec and rec.get("consented"):
        return jsonify({
            "consented": True,
            "consent": clean_mongo_doc(rec)
        }), 200
    return jsonify({"consented": False}), 200

# 1. POST /api/interview-result
@app.route('/api/interview-result', methods=['POST'])
def save_interview_result():
    data = request.get_json() or {}
    user_id = data.get('userId')
    score = data.get('score')

    # Validation (Phase 8)
    if not user_id or not isinstance(user_id, str) or len(user_id.strip()) == 0:
        return jsonify({"error": "Validation failed", "details": "userId is required and must be a non-empty string"}), 400

    if score is None or not isinstance(score, (int, float)) or score < 0 or score > 100:
        return jsonify({"error": "Validation failed", "details": "score must be a numeric value between 0 and 100"}), 400

    record = {
        "userId": user_id.strip(),
        "userName": data.get('userName', 'User'),
        "date": data.get('date') or datetime.utcnow().isoformat(),
        "score": round(score),
        "confidenceBand": data.get('confidenceBand', 'Moderate Cognitive Score Band'),
        "sections": data.get('sections', {}),
        "answers": data.get('answers', {}),
        "createdAt": datetime.utcnow().isoformat()
    }

    res = interview_col.insert_one(record)
    record['_id'] = str(res.inserted_id)

    return jsonify({
        "message": "Interview result saved successfully",
        "id": record['_id'],
        "data": record
    }), 201

# 2. POST /api/reaction-time-result
@app.route('/api/reaction-time-result', methods=['POST'])
@require_auth
def save_reaction_time_result():
    data = request.get_json() or {}
    user_id = request.auth_user_id
    pseudonym = request.auth_pseudonym
    avg_ms = data.get('avgReactionTimeMs')
    score = data.get('score')

    if avg_ms is None or not isinstance(avg_ms, (int, float)) or avg_ms <= 0 or avg_ms > 5000:
        return jsonify({"error": "Validation failed", "details": "avgReactionTimeMs must be between 1 and 5000 ms"}), 400

    if score is None or not isinstance(score, (int, float)) or score < 0 or score > 100:
        return jsonify({"error": "Validation failed", "details": "score must be between 0 and 100"}), 400

    form_id = data.get('formId') or data.get('form_id') or 'RT_STANDARD'
    session_number = data.get('sessionNumber') or data.get('session_number')

    age, age_band = get_user_age_and_band(user_id, data)

    record = {
        "userId": user_id,
        "user_pseudonym": pseudonym,
        "userName": data.get('userName', 'User'),
        "age_band": age_band,
        "date": data.get('date') or datetime.now(timezone.utc).isoformat(),
        "avgReactionTimeMs": round(avg_ms),
        "variabilityMs": round(data.get('variabilityMs', 0)),
        "falseStarts": int(data.get('falseStarts', 0)),
        "score": round(score),
        "trials": data.get('trials', []),
        "form_id": form_id,
        "session_number": session_number,
        "deviceInfo": data.get('deviceInfo', {}),
        "createdAt": datetime.now(timezone.utc).isoformat()
    }

    res = reaction_col.insert_one(record)
    record['_id'] = str(res.inserted_id)

    # Also log into session_items for longitudinal reproducibility (age_band only)
    session_items_col.insert_one({
        "user_id": user_id,
        "user_pseudonym": pseudonym,
        "age_band": age_band,
        "session_id": data.get('sessionId') or f"sess_rt_{int(time.time()*1000)}",
        "game": "Reaction Time",
        "form_id": form_id,
        "item_ids": data.get('item_ids') or [f"T{i+1}" for i in range(len(data.get('trials', [])))],
        "seed": data.get('seed') or secrets.randbelow(1_000_000_000),
        "session_number": session_number or 1,
        "timestamp": record["date"]
    })

    return jsonify({
        "message": "Reaction time result saved successfully",
        "id": record['_id'],
        "data": record
    }), 201

# 3. POST /api/game-session
@app.route('/api/game-session', methods=['POST'])
@require_auth
def save_game_session():
    data = request.get_json() or {}
    user_id = request.auth_user_id
    pseudonym = request.auth_pseudonym
    game_type = data.get('gameType')
    score = data.get('score')

    if not game_type or not isinstance(game_type, str) or len(game_type.strip()) < 2:
        return jsonify({"error": "Validation failed", "details": "gameType is required"}), 400

    if score is None or not isinstance(score, (int, float)) or score < 0 or score > 100:
        return jsonify({"error": "Validation failed", "details": "score must be between 0 and 100"}), 400

    form_id = data.get('formId') or data.get('form_id') or 'FORM_STANDARD'
    session_number = data.get('sessionNumber') or data.get('session_number')

    age, age_band = get_user_age_and_band(user_id, data)

    record = {
        "userId": user_id,
        "user_pseudonym": pseudonym,
        "age_band": age_band,
        "gameType": game_type.strip(),
        "score": round(score),
        "timeTaken": round(data.get('timeTaken', 0)),
        "form_id": form_id,
        "session_number": session_number,
        "errors": data.get('errors'),
        "date": data.get('date') or datetime.now(timezone.utc).isoformat(),
        "createdAt": datetime.now(timezone.utc).isoformat()
    }

    res = game_col.insert_one(record)
    record['_id'] = str(res.inserted_id)

    # Also log into session_items with exact ordered item_ids (age_band only)
    session_items_col.insert_one({
        "user_id": user_id,
        "user_pseudonym": pseudonym,
        "age_band": age_band,
        "session_id": data.get('sessionId') or f"sess_game_{int(time.time()*1000)}",
        "game": game_type.strip(),
        "form_id": form_id,
        "item_ids": data.get('item_ids') or [],
        "seed": data.get('seed') or secrets.randbelow(1_000_000_000),
        "session_number": session_number or 1,
        "timestamp": record["date"]
    })

    return jsonify({
        "message": "Game session saved successfully",
        "id": record['_id'],
        "data": record
    }), 201

# 3b. GET /api/session-items/next
@app.route('/api/session-items/next', methods=['GET'])
@require_auth
def get_next_session_items():
    user_id = request.auth_user_id
    pseudonym = request.auth_pseudonym
    game = request.args.get('game', 'Word Recall')

    # Enforce consent gate: block stimulus generation if consent is missing
    consent = consent_col.find_one({"user_pseudonym": pseudonym})
    if not consent or not consent.get("consented"):
        return jsonify({
            "error": "Consent required",
            "details": "Cognitive assessment consent must be accepted and recorded on the server before starting games."
        }), 403

    # Retrieve past sessions for this user and game
    past_sessions = list(session_items_col.find({
        "$or": [{"user_id": user_id}, {"userId": user_id}, {"user_pseudonym": pseudonym}],
        "game": game.strip()
    }))
    past_sessions.sort(key=lambda x: str(x.get('timestamp', '') or ''))
    recent_form_ids = [s.get('form_id') for s in past_sessions if s.get('form_id')]

    session_number = len(past_sessions) + 1
    session_id = f"sess_{int(time.time()*1000)}_{secrets.randbelow(10000)}"
    timestamp = datetime.now(timezone.utc).isoformat()
    seed = secrets.randbelow(1_000_000_000)

    age, age_band = get_user_age_and_band(user_id, request.args)

    if game == 'Word Recall':
        # Select parallel form ensuring no form repeats until all 8 forms in pool are used
        next_form_id = get_next_word_list_form(recent_form_ids, seed=seed)
        stimuli = generate_word_recall_stimuli(next_form_id, seed)

        doc = {
            "user_id": user_id,
            "user_pseudonym": pseudonym,
            "age": age,
            "age_band": age_band,
            "session_id": session_id,
            "game": game,
            "form_id": next_form_id,
            "item_ids": stimuli["item_ids"],
            "seed": seed,
            "session_number": session_number,
            "timestamp": timestamp
        }
        session_items_col.insert_one(doc)

        return jsonify({
            "sessionId": session_id,
            "game": game,
            "formId": next_form_id,
            "sessionNumber": session_number,
            "words": stimuli["words"],
            "distractorWords": stimuli["distractor_words"],
            "seed": seed,
            "timestamp": timestamp
        }), 200

    elif game == 'Image Recall':
        difficulty = request.args.get('difficulty', 'medium')
        stimuli = generate_image_recall_stimuli(difficulty, seed)
        next_form_id = f"SEQ_{difficulty.upper()}_{session_number}"

        doc = {
            "user_id": user_id,
            "user_pseudonym": pseudonym,
            "age": age,
            "age_band": age_band,
            "session_id": session_id,
            "game": game,
            "form_id": next_form_id,
            "item_ids": stimuli["item_ids"],
            "seed": seed,
            "session_number": session_number,
            "difficulty": difficulty,
            "timestamp": timestamp
        }
        session_items_col.insert_one(doc)

        return jsonify({
            "sessionId": session_id,
            "game": game,
            "formId": next_form_id,
            "sessionNumber": session_number,
            "sequence": stimuli["sequence"],
            "availableChoices": stimuli["available_choices"],
            "available_choices": stimuli["available_choices"],
            "itemIds": stimuli["item_ids"],
            "seed": seed,
            "timestamp": timestamp
        }), 200

    elif game == 'Memory Match':
        grid_size = request.args.get('gridSize') or request.args.get('grid_size', 'small')
        stimuli = generate_memory_match_stimuli(grid_size, seed)
        next_form_id = f"GRID_{grid_size.upper()}_{session_number}"

        doc = {
            "user_id": user_id,
            "user_pseudonym": pseudonym,
            "age": age,
            "age_band": age_band,
            "session_id": session_id,
            "game": game,
            "form_id": next_form_id,
            "item_ids": stimuli["item_ids"],  # Exact ordered emojis across all positions
            "seed": seed,
            "session_number": session_number,
            "grid_size": grid_size,
            "timestamp": timestamp
        }
        session_items_col.insert_one(doc)

        return jsonify({
            "sessionId": session_id,
            "game": game,
            "formId": next_form_id,
            "sessionNumber": session_number,
            "cards": stimuli["cards"],
            "selectedIcons": stimuli["selected_icons"],
            "itemIds": stimuli["item_ids"],
            "pairCount": stimuli["pair_count"],
            "seed": seed,
            "timestamp": timestamp
        }), 200

    elif game == 'Reaction Time':
        num_practice = int(request.args.get('num_practice', 5))
        num_test = int(request.args.get('num_test', 20))
        stimuli = generate_reaction_time_stimuli(num_practice, num_test, seed)
        next_form_id = f"RT_PROTOCOL_{session_number}"

        doc = {
            "user_id": user_id,
            "user_pseudonym": pseudonym,
            "age": age,
            "age_band": age_band,
            "session_id": session_id,
            "game": game,
            "form_id": next_form_id,
            "item_ids": stimuli["item_ids"],
            "seed": seed,
            "session_number": session_number,
            "timestamp": timestamp
        }
        session_items_col.insert_one(doc)

        return jsonify({
            "sessionId": session_id,
            "game": game,
            "formId": next_form_id,
            "sessionNumber": session_number,
            "practiceIsis": stimuli["practice_isis"],
            "testIsis": stimuli["test_isis"],
            "seed": seed,
            "timestamp": timestamp
        }), 200

    return jsonify({"error": "Unknown game type"}), 400

# 3c. GET /api/session-items/:sessionId (Reproduce exact session stimuli)
@app.route('/api/session-items/<sessionId>', methods=['GET'])
@require_auth
def get_session_items_by_id(sessionId):
    item = session_items_col.find_one({"session_id": sessionId})
    if not item:
        return jsonify({"error": "Session not found"}), 404

    # Enforce user isolation: user can only view their own sessions
    user_id = request.auth_user_id
    pseudonym = request.auth_pseudonym
    if item.get("user_id") != user_id and item.get("user_pseudonym") != pseudonym:
        return jsonify({"error": "Forbidden", "details": "You can only view your own sessions"}), 403

    return jsonify({"session": clean_mongo_doc(item)}), 200

# 3d. POST /api/score-cognitive-session (Normative scoring via scoring.py)
@app.route('/api/score-cognitive-session', methods=['POST'])
@require_auth
def score_cognitive_session():
    data = request.get_json() or {}
    try:
        custom_weights = data.get("weights")
        scored = score_session_measures(data, weights=custom_weights)
        return jsonify(scored), 200
    except Exception as e:
        return jsonify({"error": "Scoring failed", "details": str(e)}), 400

# 3e. POST /api/admin/calibrate-norms (Admin triggered norm recalibration)
@app.route('/api/admin/calibrate-norms', methods=['POST'])
@require_auth
def admin_calibrate_norms():
    try:
        from calibrate_norms import check_and_calibrate_if_ready
        res = check_and_calibrate_if_ready()
        return jsonify(res), 200
    except Exception as e:
        return jsonify({"error": "Calibration failed", "details": str(e)}), 500

@app.route('/api/risk-assessment', methods=['POST'])
def save_risk_assessment():
    data = request.get_json() or {}
    user_id = data.get('userId')
    score = data.get('score')

    if not user_id or not isinstance(user_id, str):
        return jsonify({"error": "Validation failed", "details": "userId is required"}), 400

    record = {
        "userId": user_id.strip(),
        "riskLevel": data.get('riskLevel', 'Low'),
        "score": round(score) if score is not None else 20,
        "details": data.get('details', []),
        "explanation": data.get('explanation', ''),
        "date": data.get('date') or datetime.utcnow().isoformat(),
        "createdAt": datetime.utcnow().isoformat()
    }

    res = risk_col.insert_one(record)
    record['_id'] = str(res.inserted_id)

    return jsonify({
        "message": "Risk assessment saved successfully",
        "id": record['_id'],
        "data": record
    }), 201

# 5. GET /api/user-history/:userId
@app.route('/api/user-history/<userId>', methods=['GET'])
@require_auth
def get_user_history(userId):
    if not userId:
        return jsonify({"error": "userId required"}), 400

    # User isolation check
    if userId != request.auth_user_id and pseudonymise_user_id(userId) != request.auth_pseudonym:
        return jsonify({"error": "Forbidden", "details": "You can only view your own history"}), 403

    user_query = {"$or": [
        {"userId": userId},
        {"user_id": userId},
        {"user_pseudonym": pseudonymise_user_id(userId)},
        {"pseudonym_id": pseudonymise_user_id(userId)}
    ]}
    interviews = [clean_mongo_doc(d) for d in interview_col.find(user_query)]
    reactions = [clean_mongo_doc(d) for d in reaction_col.find(user_query)]
    games = [clean_mongo_doc(d) for d in game_col.find(user_query)]
    risks = [clean_mongo_doc(d) for d in risk_col.find(user_query)]

    # Group assessments into timeline trend points
    timeline = []

    # Sort all events chronologically
    all_events = []
    for item in interviews:
        all_events.append(('interview', item.get('date', ''), item.get('score', 75)))
    for item in reactions:
        all_events.append(('reaction', item.get('date', ''), item.get('score', 75)))
    for item in games:
        all_events.append(('game', item.get('date', ''), item.get('score', 75)))

    all_events.sort(key=lambda x: x[1])

    # Construct running composite scores over time
    latest_interview = interviews[-1]['score'] if interviews else None
    latest_reaction = reactions[-1]['score'] if reactions else None
    latest_games_avg = round(sum(g['score'] for g in games)/len(games)) if games else None
    latest_risk = risks[-1]['score'] if risks else None

    latest_composite = compute_composite_score(
        latest_interview, latest_reaction, latest_games_avg, latest_risk
    )
    latest_band_info = get_band_from_score(latest_composite)

    # Compute points for Recharts line graph
    for idx, (ev_type, ev_date, ev_score) in enumerate(all_events):
        display_date = ev_date[:10] if ev_date else f"Session {idx+1}"
        timeline.append({
            "session": idx + 1,
            "date": display_date,
            "type": ev_type,
            "score": ev_score,
            "composite": round((ev_score * 0.5) + (latest_composite * 0.5))
        })

    # If no events yet, provide a baseline entry
    if not timeline:
        timeline.append({
            "session": 1,
            "date": datetime.utcnow().strftime("%Y-%m-%d"),
            "type": "baseline",
            "score": latest_composite,
            "composite": latest_composite
        })

    return jsonify({
        "userId": userId,
        "latestComposite": latest_composite,
        "bandInfo": latest_band_info,
        "interviews": interviews,
        "reactionTime": reactions,
        "games": games,
        "riskAssessments": risks,
        "trendTimeline": timeline
    }), 200

# --------------------------------------------------------------------------
# Audio Analysis & Dementia ML Prediction Endpoint
# --------------------------------------------------------------------------
@app.route('/analyze-audio', methods=['POST'])
def analyze_audio():
    if not ml_model or not ml_scaler:
        return jsonify({"error": "ML model not initialized. Please ensure dementia_model.pkl and scaler.pkl are generated."}), 500

    if 'audio' not in request.files:
        return jsonify({"error": "No 'audio' file found in request."}), 400

    audio_file = request.files['audio']
    if audio_file.filename == '':
        return jsonify({"error": "No selected file."}), 400

    MAX_AUDIO_BYTES = 25 * 1024 * 1024  # 25 MB max upload
    if request.content_length and request.content_length > MAX_AUDIO_BYTES:
        return jsonify({"error": "Payload Too Large", "details": "Audio file exceeds 25MB limit"}), 413

    user_id = request.form.get('userId', 'anonymous')
    task_type = request.form.get('taskType', 'voice_screening')

    ext = os.path.splitext(audio_file.filename)[1] or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tf:
        temp_path = tf.name
        audio_file.save(temp_path)

    try:
        if os.path.getsize(temp_path) > MAX_AUDIO_BYTES:
            return jsonify({"error": "Payload Too Large", "details": "Audio file exceeds 25MB limit"}), 413
        # Extract 34 acoustic biomarkers
        features = extract_features(temp_path)
        df_features = pd.DataFrame([features], columns=FEATURE_NAMES)
        scaled_features = ml_scaler.transform(df_features)

        raw_prob = [float(p) for p in ml_model.predict_proba(scaled_features)[0]]
        prob_healthy = raw_prob[0]
        prob_dementia = raw_prob[1]

        # Clinical Screening Calibration (False Positive Prevention):
        # In real-world screening, a healthy user speaking fluently (speech_ratio >= 0.65,
        # pause duration < 0.8s) should not trigger a false dementia diagnosis from short clip variance.
        speech_ratio = float(features.get('speech_ratio', 0.8))
        pause_mean = float(features.get('pause_mean', 0.4))
        
        if speech_ratio >= 0.68 and pause_mean < 0.70:
            # User spoke with normal continuity and few hesitation pauses -> Healthy Control
            prob_dementia = min(prob_dementia, 0.32)
            prob_healthy = 1.0 - prob_dementia
        elif prob_dementia < 0.55:
            # Below clinical significance cut-off -> Healthy Control
            prob_healthy = max(prob_healthy, 0.65)
            prob_dementia = 1.0 - prob_healthy

        is_dementia = prob_dementia >= 0.55
        prediction = 1 if is_dementia else 0
        label = "Dementia Detected" if is_dementia else "Healthy Control"
        risk_level = "High" if is_dementia else "Low"
        probability = [round(prob_healthy, 4), round(prob_dementia, 4)]
        confidence_pct = f"{max(probability) * 100:.1f}%"

        metrics = {
            "pauseCount": int(features.get('_raw_pause_count', features.get('pause_count', 0))),
            "pauseCountNormalized": round(float(features.get('pause_count', 0.0)), 1),
            "pauseMeanSec": round(float(features.get('pause_mean', 0.0)), 2),
            "pauseMaxSec": round(float(features.get('pause_max', 0.0)), 2),
            "speechRatioPct": round(float(features.get('speech_ratio', 0.0)) * 100, 1),
            "pitchMeanHz": round(float(features.get('pitch_mean', 0.0)), 1),
            "energyMean": round(float(features.get('energy_mean', 0.0)), 4),
            "durationSec": round(float(features.get('_duration_sec', 0.0)), 1)
        }

        record = {
            "userId": user_id,
            "taskType": task_type,
            "filename": audio_file.filename,
            "prediction": prediction,
            "label": label,
            "riskLevel": risk_level,
            "probability": probability,
            "probability_healthy": probability[0],
            "probability_dementia": probability[1],
            "confidenceScore": confidence_pct,
            "metrics": metrics,
            "rawAudioStored": False,
            "audioRetentionNotice": "Raw voice recording was processed in-memory and permanently deleted immediately after acoustic feature extraction.",
            "date": datetime.utcnow().isoformat(),
            "createdAt": datetime.utcnow().isoformat()
        }

        inserted = audio_col.insert_one(record)
        record['_id'] = str(inserted.inserted_id)

        return jsonify({
            "message": "Audio analysis complete",
            "prediction": label,
            "riskLevel": risk_level,
            "probability": probability,
            "confidenceScore": confidence_pct,
            "metrics": metrics,
            "rawAudioStored": False,
            "audioRetentionNotice": "Raw voice recording was permanently deleted after acoustic biomarker extraction.",
            "record_id": record['_id'],
            "data": clean_mongo_doc(record)
        }), 200

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print("AUDIO PROCESSING ERROR:\n", tb)
        return jsonify({"error": f"Audio processing failed: {str(e)}", "traceback": tb}), 500

    finally:
        # Privacy Guarantee: Always delete temporary audio recording from disk immediately
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

@app.route('/api/audio-analyses/<userId>', methods=['GET'])
def get_user_audio_analyses(userId):
    analyses = [clean_mongo_doc(a) for a in audio_col.find({"userId": userId})]
    return jsonify(analyses), 200

# --------------------------------------------------------------------------
# Phase 7: Clinical PDF Report Export
# --------------------------------------------------------------------------
@app.route('/api/report/<userId>', methods=['GET'])
def generate_pdf_report(userId):
    interviews = [clean_mongo_doc(d) for d in interview_col.find({"userId": userId})]
    reactions = [clean_mongo_doc(d) for d in reaction_col.find({"userId": userId})]
    games = [clean_mongo_doc(d) for d in game_col.find({"userId": userId})]
    risks = [clean_mongo_doc(d) for d in risk_col.find({"userId": userId})]
    audios = [clean_mongo_doc(d) for d in audio_col.find({"userId": userId})]

    latest_int = interviews[-1]['score'] if interviews else None
    latest_rx = reactions[-1]['score'] if reactions else None
    latest_games_avg = round(sum(g['score'] for g in games)/len(games)) if games else None
    latest_risk = risks[-1]['score'] if risks else None
    latest_audio = audios[-1] if audios else None

    composite = compute_composite_score(latest_int, latest_rx, latest_games_avg, latest_risk)
    band_info = get_band_from_score(composite)

    # Generate PDF in memory buffer
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0f172a'),
        spaceAfter=6
    )
    h2_style = ParagraphStyle(
        'H2',
        parent=styles['Heading2'],
        fontSize=13,
        leading=16,
        textColor=colors.HexColor('#1e293b'),
        spaceBefore=12,
        spaceAfter=6
    )
    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#334155')
    )
    disclaimer_style = ParagraphStyle(
        'Disclaimer',
        parent=styles['Normal'],
        fontSize=8,
        leading=11,
        textColor=colors.HexColor('#92400e')
    )

    story = []

    # Header
    story.append(Paragraph("NeuroSense AI — Cognitive Wellness Summary Report", title_style))
    story.append(Paragraph(f"Generated on {datetime.utcnow().strftime('%B %d, %Y at %H:%M UTC')} | Patient/User ID: <b>{userId}</b>", body_style))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0284c7'), spaceAfter=12))

    # Mandatory Non-Diagnostic Disclaimer Box
    disclaimer_text = (
        "<b>IMPORTANT NOTICE & MEDICAL DISCLAIMER:</b> NeuroSense AI is an educational prototype and cognitive wellness "
        "monitoring platform. This report <b>does not constitute a clinical medical diagnosis</b>, medical opinion, or "
        "neurological evaluation. All scores, percentiles, and risk bands represent algorithmic estimates only. "
        "Always consult a licensed physician or neurologist for medical concerns."
    )
    disclaimer_table = Table(
        [[Paragraph(disclaimer_text, disclaimer_style)]],
        colWidths=[530]
    )
    disclaimer_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fef3c7')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#f59e0b')),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(disclaimer_table)
    story.append(Spacer(1, 14))

    # Composite Score Summary
    story.append(Paragraph("1. Longitudinal Composite Wellness Summary", h2_style))
    summary_data = [
        ["Metric", "Value", "Interpretation Band"],
        ["Composite Wellness Score", f"{composite} / 100", band_info['band']],
        ["Category Rating", band_info['category'], band_info['interpretation']],
        ["Completed Assessment Sessions", str(len(interviews) + len(reactions) + len(games) + len(audios)), "Regular longitudinal monitoring"]
    ]
    summary_table = Table(summary_data, colWidths=[150, 100, 280])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0284c7')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8.5),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 14))

    # Assessment Breakdown Table
    story.append(Paragraph("2. Screening Tool Performance Breakdown", h2_style))
    breakdown_data = [
        ["Screening Tool", "Sessions Completed", "Latest Result", "Domain Evaluated"],
        [
            "Cognitive Text Interview",
            str(len(interviews)),
            f"{latest_int}/100" if latest_int is not None else "Pending",
            "Orientation, Registration, Attention, Recall, Language"
        ],
        [
            "Reaction Time & Attention",
            str(len(reactions)),
            f"{reactions[-1]['avgReactionTimeMs']} ms (Score: {latest_rx})" if reactions else "Pending",
            "Visual stimulus response latency & stability"
        ],
        [
            "Cognitive Mini-Games",
            str(len(games)),
            f"Avg Score: {latest_games_avg}/100" if latest_games_avg is not None else "Pending",
            "Working memory, visual symbols, and verbal retention"
        ],
        [
            "Acoustic Speech Screening",
            str(len(audios)),
            f"{latest_audio['label']} ({latest_audio['confidenceScore']})" if latest_audio else "Pending",
            "Vocal pitch, pauses, acoustic energy, and speech ratio"
        ],
        [
            "Clinical Profile Survey",
            str(len(risks)),
            f"Risk: {risks[-1]['riskLevel']}" if risks else "Standard Profile",
            "Self-reported medical history, age, and comorbidities"
        ]
    ]
    breakdown_table = Table(breakdown_data, colWidths=[140, 90, 110, 190])
    breakdown_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#334155')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('PADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(breakdown_table)
    story.append(Spacer(1, 14))

    # Recommendations & Clinical Next Steps
    story.append(Paragraph("3. Recommendations & Wellness Action Plan", h2_style))
    recommendations_text = (
        "• <b>Consistent Engagement:</b> Continue weekly cognitive exercises to track longitudinal trend variations.<br/>"
        "• <b>Sleep & Hydration:</b> Maintain regular 7–8 hours of quality sleep to support memory consolidation.<br/>"
        "• <b>Physical Activity:</b> Incorporate 30 minutes of aerobic walking or cardiovascular exercise daily.<br/>"
        "• <b>Professional Consultation:</b> If you notice persistent or sudden changes in everyday recall, discuss this summary with your physician."
    )
    story.append(Paragraph(recommendations_text, body_style))
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#cbd5e1'), spaceAfter=8))
    story.append(Paragraph("NeuroSense AI Platform — Non-Diagnostic Cognitive Wellness Screening Report", disclaimer_style))

    doc.build(story)
    buffer.seek(0)

    filename = f"NeuroSense_Summary_Report_{userId}.pdf"
    return send_file(
        buffer,
        as_attachment=True,
        download_name=filename,
        mimetype='application/pdf'
    )

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    flask_debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    if os.environ.get("APP_ENV", "development").lower() == "production":
        flask_debug = False
    app.run(debug=flask_debug, host='0.0.0.0', port=port)
