# NeuroSense AI — Backend API Documentation

The NeuroSense AI backend provides a RESTful persistence and scoring API built with **Flask** and backed by **MongoDB** (with automatic, resilient local file-based JSON storage fallback if MongoDB is unavailable).

Base URL: `http://localhost:5000`

---

## 1. Health Check

### `GET /health`
Verifies backend status and active database connection.

**Response `200 OK`**:
```json
{
  "status": "healthy",
  "service": "NeuroSense-AI Persistence API",
  "database": "mongodb", // or "local_json_store"
  "timestamp": "2026-09-07T08:45:00.000000"
}
```

---

## 2. Interview Results

### `POST /api/interview-result`
Persists a completed text-based cognitive interview assessment.

**Headers**: `Content-Type: application/json`

**Request Body**:
```json
{
  "userId": "user_123",
  "userName": "John Doe",
  "score": 85,
  "confidenceBand": "Lower Relative Risk Band",
  "sections": {
    "orientation": { "score": 18, "max": 20 },
    "registration": { "score": 20, "max": 20 },
    "attention": { "score": 20, "max": 20 },
    "language": { "score": 15, "max": 20 },
    "delayedRecall": { "score": 12, "max": 20 }
  },
  "answers": {
    "orientation_day": "Monday",
    "delayed_recall": "apple table penny"
  }
}
```

**Validation**:
- `userId` is mandatory (non-empty string).
- `score` must be numeric between `0` and `100`.

**Response `201 Created`**:
```json
{
  "message": "Interview result saved successfully",
  "id": "interview_results_1725700000000_1",
  "data": { ... }
}
```

---

## 3. Reaction Time & Attention Results

### `POST /api/reaction-time-result`
Persists a multi-trial visual reaction time and attention session.

**Headers**: `Content-Type: application/json`

**Request Body**:
```json
{
  "userId": "user_123",
  "userName": "John Doe",
  "avgReactionTimeMs": 285,
  "variabilityMs": 34,
  "falseStarts": 0,
  "score": 88,
  "trials": [290, 275, 310, 280, 265, 295, 270, 295]
}
```

**Validation**:
- `avgReactionTimeMs` must be between `1` and `5000` ms (rejects negative or impossible zeroes).
- `score` must be between `0` and `100`.

**Response `201 Created`**:
```json
{
  "message": "Reaction time result saved successfully",
  "id": "reaction_time_results_1725700000000_1",
  "data": { ... }
}
```

---

## 4. Cognitive Game Sessions

### `POST /api/game-session`
Saves general cognitive game scores (Memory Match, Image Recall, Word Recall).

**Headers**: `Content-Type: application/json`

**Request Body**:
```json
{
  "userId": "user_123",
  "gameType": "Memory Match (4x3)",
  "score": 92,
  "timeTaken": 34200
}
```

**Response `201 Created`**:
```json
{
  "message": "Game session saved successfully",
  "id": "game_sessions_1725700000000_1",
  "data": { ... }
}
```

---

## 5. Clinical Risk Assessment

### `POST /api/risk-assessment`
Saves self-reported medical baseline and risk survey outcomes.

**Headers**: `Content-Type: application/json`

**Request Body**:
```json
{
  "userId": "user_123",
  "riskLevel": "Low",
  "score": 15,
  "details": ["Age < 60", "No stroke history"],
  "explanation": "Calculated baseline based on medical history survey."
}
```

---

## 6. Longitudinal User History & Trend Fusion

### `GET /api/user-history/:userId`
Returns all assessments across modules, combined into a weighted **Composite Fusion Trend**.

**Response `200 OK`**:
```json
{
  "userId": "user_123",
  "latestComposite": 86,
  "bandInfo": {
    "band": "Lower Relative Risk Band",
    "category": "Optimal Performance",
    "interpretation": "Scores reflect stable cognitive performance across verbal recall, processing speed, and attention measures."
  },
  "interviews": [...],
  "reactionTime": [...],
  "games": [...],
  "riskAssessments": [...],
  "trendTimeline": [
    { "session": 1, "date": "2026-09-01", "type": "interview", "score": 85, "composite": 85 },
    { "session": 2, "date": "2026-09-03", "type": "reaction", "score": 88, "composite": 87 }
  ]
}
```

---

## 7. Clinical PDF Report Generation

### `GET /api/report/:userId`
Generates an official multi-page summary PDF with tables and non-diagnostic disclaimers for export.

**Response `200 OK`**:
- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="NeuroSense_Summary_Report_<userId>.pdf"`
- Headers trigger browser file download.
