import os
import io
import json
import time
from datetime import datetime
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from pymongo import MongoClient
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

app = Flask(__name__)
CORS(app)

# --------------------------------------------------------------------------
# Persistence Layer: MongoDB with Local JSON Fallback Store
# --------------------------------------------------------------------------
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
os.makedirs(DATA_DIR, exist_ok=True)

mongo_client = None
db = None
use_mongo = False

try:
    mongo_client = MongoClient('mongodb://localhost:27017/', serverSelectionTimeoutMS=1000)
    mongo_client.server_info()  # trigger connection check
    db = mongo_client['dementia_db']
    use_mongo = True
    print("[Persistence] Successfully connected to local MongoDB.")
except Exception as e:
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
# API Endpoints
# --------------------------------------------------------------------------

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "service": "NeuroSense-AI Persistence API",
        "database": "mongodb" if use_mongo else "local_json_store",
        "timestamp": datetime.utcnow().isoformat()
    })

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
def save_reaction_time_result():
    data = request.get_json() or {}
    user_id = data.get('userId')
    avg_ms = data.get('avgReactionTimeMs')
    score = data.get('score')

    # Validation (Phase 8): guard against impossible or negative ms
    if not user_id or not isinstance(user_id, str):
        return jsonify({"error": "Validation failed", "details": "userId is required"}), 400

    if avg_ms is None or not isinstance(avg_ms, (int, float)) or avg_ms <= 0 or avg_ms > 5000:
        return jsonify({"error": "Validation failed", "details": "avgReactionTimeMs must be between 1 and 5000 ms"}), 400

    if score is None or not isinstance(score, (int, float)) or score < 0 or score > 100:
        return jsonify({"error": "Validation failed", "details": "score must be between 0 and 100"}), 400

    record = {
        "userId": user_id.strip(),
        "userName": data.get('userName', 'User'),
        "date": data.get('date') or datetime.utcnow().isoformat(),
        "avgReactionTimeMs": round(avg_ms),
        "variabilityMs": round(data.get('variabilityMs', 0)),
        "falseStarts": int(data.get('falseStarts', 0)),
        "score": round(score),
        "trials": data.get('trials', []),
        "createdAt": datetime.utcnow().isoformat()
    }

    res = reaction_col.insert_one(record)
    record['_id'] = str(res.inserted_id)

    return jsonify({
        "message": "Reaction time result saved successfully",
        "id": record['_id'],
        "data": record
    }), 201

# 3. POST /api/game-session
@app.route('/api/game-session', methods=['POST'])
def save_game_session():
    data = request.get_json() or {}
    user_id = data.get('userId')
    game_type = data.get('gameType')
    score = data.get('score')

    if not user_id or not isinstance(user_id, str):
        return jsonify({"error": "Validation failed", "details": "userId is required"}), 400

    if not game_type or not isinstance(game_type, str) or len(game_type.strip()) < 2:
        return jsonify({"error": "Validation failed", "details": "gameType is required"}), 400

    if score is None or not isinstance(score, (int, float)) or score < 0 or score > 100:
        return jsonify({"error": "Validation failed", "details": "score must be between 0 and 100"}), 400

    record = {
        "userId": user_id.strip(),
        "gameType": game_type.strip(),
        "score": round(score),
        "timeTaken": round(data.get('timeTaken', 0)),
        "date": data.get('date') or datetime.utcnow().isoformat(),
        "createdAt": datetime.utcnow().isoformat()
    }

    res = game_col.insert_one(record)
    record['_id'] = str(res.inserted_id)

    return jsonify({
        "message": "Game session saved successfully",
        "id": record['_id'],
        "data": record
    }), 201

# 4. POST /api/risk-assessment
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
def get_user_history(userId):
    if not userId:
        return jsonify({"error": "userId required"}), 400

    interviews = [clean_mongo_doc(d) for d in interview_col.find({"userId": userId})]
    reactions = [clean_mongo_doc(d) for d in reaction_col.find({"userId": userId})]
    games = [clean_mongo_doc(d) for d in game_col.find({"userId": userId})]
    risks = [clean_mongo_doc(d) for d in risk_col.find({"userId": userId})]

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
# Phase 7: Clinical PDF Report Export
# --------------------------------------------------------------------------
@app.route('/api/report/<userId>', methods=['GET'])
def generate_pdf_report(userId):
    interviews = [clean_mongo_doc(d) for d in interview_col.find({"userId": userId})]
    reactions = [clean_mongo_doc(d) for d in reaction_col.find({"userId": userId})]
    games = [clean_mongo_doc(d) for d in game_col.find({"userId": userId})]
    risks = [clean_mongo_doc(d) for d in risk_col.find({"userId": userId})]

    latest_int = interviews[-1]['score'] if interviews else None
    latest_rx = reactions[-1]['score'] if reactions else None
    latest_games_avg = round(sum(g['score'] for g in games)/len(games)) if games else None
    latest_risk = risks[-1]['score'] if risks else None

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
        ["Completed Assessment Sessions", str(len(interviews) + len(reactions) + len(games)), "Regular longitudinal monitoring"]
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
    app.run(debug=True, host='0.0.0.0', port=5000)
