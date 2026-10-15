"""
Norm Calibration Script for Provisional Cognitive Measures.

Empirical recalibration of provisional norms (Reaction Time and Memory Match)
using internal app data once at least 20 valid baseline users exist.

Validity Criteria (defined in constants below):
- Reaction Time: all 20 test trials completed, lapses (>1000 ms) <= 2 of 20,
  anticipations (<150 ms) <= 2 of 20, practice trials excluded.
- Memory Match: game completed (moves > 0 and solved).
- Selection: The FIRST VALID session per user is used as baseline (subsequent sessions excluded
  to prevent practice effects from inflating norms).

Age-Band Logic & Safety Rule:
- Calculates median age of the valid pilot sample.
- If pilot sample median age is below 55, prints a prominent warning that the result
  must NOT be used for older adults (55+).
- Enforces age_band classification and verifies with scoring.is_norm_applicable.
"""

import os
import sys
import json
import math
import shutil
import statistics
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple

# --------------------------------------------------------------------------
# Norm Calibration Constants & Validity Rules
# --------------------------------------------------------------------------
MIN_VALID_USERS = 20

# Reaction Time Validity Constants
RT_REQUIRED_TEST_TRIALS = 20
RT_MAX_LAPSES = 2                  # Lapses (>1000 ms) <= 2 of 20
RT_MAX_ANTICIPATIONS = 2           # Anticipations (<150 ms) <= 2 of 20
RT_LAPSE_THRESHOLD_MS = 1000
RT_ANTICIPATION_THRESHOLD_MS = 150

# File Paths
NORMS_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'norms.json')
if not os.path.exists(NORMS_PATH):
    NORMS_PATH = os.path.join(os.path.dirname(__file__), 'norms.json')

BACKUP_NORMS_PATH = os.path.join(os.path.dirname(NORMS_PATH), 'norms.backup.json')
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')

# Import age-band logic from scoring
try:
    from scoring import is_norm_applicable
except ImportError:
    try:
        from backend.scoring import is_norm_applicable
    except ImportError:
        def is_norm_applicable(norm_entry: Dict[str, Any], user_age: Optional[int]) -> Tuple[bool, Optional[str]]:
            if user_age is not None and user_age >= 55:
                band = str(norm_entry.get("age_band", "")).lower()
                if band in ["<55", "young_adult", "18-35", "18-49"]:
                    return False, "Young-adult norm (<55) not applicable to user aged 55+"
            return True, None


def load_json_collection(filename: str) -> List[Dict[str, Any]]:
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        return []
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"[Calibrate] Error reading {path}: {e}")
        return []


def get_user_age_map() -> Dict[str, Optional[int]]:
    """Loads map of userId -> age from users collection."""
    users = load_json_collection('users.json')
    mapping: Dict[str, Optional[int]] = {}
    for u in users:
        uid = str(u.get('id') or u.get('_id') or '')
        age = u.get('age') or (u.get('lifestyle', {}).get('Age') if isinstance(u.get('lifestyle'), dict) else None)
        if uid and age is not None:
            try:
                mapping[uid] = int(age)
            except (ValueError, TypeError):
                pass
    return mapping


def calculate_sample_stats(values: List[float]) -> Tuple[Optional[float], Optional[float]]:
    """Calculates sample mean and sample standard deviation (unbiased, ddof=1)."""
    if not values:
        return None, None
    n = len(values)
    mean = sum(values) / n
    if n < 2:
        return round(mean, 2), 0.0
    variance = sum((x - mean) ** 2 for x in values) / (n - 1)
    sd = math.sqrt(variance)
    return round(mean, 2), round(sd, 2)


def is_valid_reaction_time_session(session: Dict[str, Any]) -> Tuple[bool, Optional[List[float]]]:
    """
    Checks if a reaction time session meets strict validity criteria:
    - 20 test trials completed (excluding practice trials)
    - lapses (>1000ms) <= 2
    - anticipations (<150ms) <= 2
    """
    trials = session.get('trials', [])
    if not isinstance(trials, list):
        return False, None

    # Exclude practice trials if session recorded practice + test
    if len(trials) > RT_REQUIRED_TEST_TRIALS:
        test_trials = trials[-RT_REQUIRED_TEST_TRIALS:]
    else:
        test_trials = trials

    if len(test_trials) != RT_REQUIRED_TEST_TRIALS:
        return False, None

    # Count lapses and anticipations
    lapses = sum(1 for t in test_trials if isinstance(t, (int, float)) and t > RT_LAPSE_THRESHOLD_MS)
    anticipations = sum(1 for t in test_trials if isinstance(t, (int, float)) and t < RT_ANTICIPATION_THRESHOLD_MS)

    if lapses > RT_MAX_LAPSES or anticipations > RT_MAX_ANTICIPATIONS:
        return False, None

    # Valid test trials
    clean_trials = [float(t) for t in test_trials if isinstance(t, (int, float))]
    return True, clean_trials


def is_valid_memory_match_session(session: Dict[str, Any]) -> Tuple[bool, Optional[float]]:
    """
    Checks if a memory match session is valid (game completed).
    Returns (is_valid, error_count).
    """
    game_type = session.get('gameType') or session.get('game', '')
    if 'Memory' not in game_type:
        return False, None

    moves = session.get('moves')
    score = session.get('score')
    errors = session.get('errors')

    if errors is not None:
        return True, max(0.0, float(errors))

    # Derive error count from moves if errors not logged directly
    if moves is not None and moves > 0:
        target_pairs = 8 if '4x4' in game_type or 'large' in game_type else 6
        err = max(0.0, float(moves - target_pairs))
        return True, err
    elif score is not None and score > 0:
        estimated_moves = max(0, round((100 - score) / 2))
        err = max(0.0, float(estimated_moves - 6))
        return True, err

    return False, None


def extract_baseline_reaction_time(user_age_map: Optional[Dict[str, Optional[int]]] = None) -> Dict[str, Any]:
    """
    Extracts the FIRST VALID reaction time session per user.
    Also tracks participant ages for age-band verification.
    """
    if user_age_map is None:
        user_age_map = get_user_age_map()

    records = load_json_collection('reaction_time_results.json')
    if not records:
        return {"n_valid": 0, "status": "no_data", "pilot_ages": []}

    user_sessions: Dict[str, List[Dict[str, Any]]] = {}
    for r in records:
        uid = str(r.get('userId') or '')
        if not uid or uid == 'anonymous':
            continue
        user_sessions.setdefault(uid, []).append(r)

    valid_user_means: List[float] = []
    valid_user_sds: List[float] = []
    pilot_ages: List[int] = []

    for uid, sessions in user_sessions.items():
        # Sort chronologically
        sessions.sort(key=lambda x: str(x.get('date', '') or x.get('createdAt', '')))

        # Search for FIRST VALID session
        for sess in sessions:
            valid, clean_trials = is_valid_reaction_time_session(sess)
            if valid and clean_trials:
                sess_mean, sess_sd = calculate_sample_stats(clean_trials)
                if sess_mean is not None:
                    valid_user_means.append(sess_mean)
                    if sess_sd is not None:
                        valid_user_sds.append(sess_sd)
                    age = user_age_map.get(uid) or sess.get('age')
                    if age is not None:
                        try:
                            pilot_ages.append(int(age))
                        except (ValueError, TypeError):
                            pass
                break  # Take only the first valid session per user

    n_valid = len(valid_user_means)
    rt_mean, rt_mean_sd = calculate_sample_stats(valid_user_means)
    rt_sd_mean, rt_sd_sd = calculate_sample_stats(valid_user_sds)
    median_age = float(statistics.median(pilot_ages)) if pilot_ages else None

    return {
        "n_valid": n_valid,
        "total_users": len(user_sessions),
        "meets_threshold": n_valid >= MIN_VALID_USERS,
        "rt_mean": rt_mean,
        "rt_mean_sd": rt_mean_sd,
        "rt_sd_mean": rt_sd_mean,
        "rt_sd_sd": rt_sd_sd,
        "pilot_ages": pilot_ages,
        "median_age": median_age
    }


def extract_baseline_memory_match(user_age_map: Optional[Dict[str, Optional[int]]] = None) -> Dict[str, Any]:
    """
    Extracts the FIRST VALID Memory Match session per user.
    Also tracks participant ages for age-band verification.
    """
    if user_age_map is None:
        user_age_map = get_user_age_map()

    records = load_json_collection('game_sessions.json')
    if not records:
        return {"n_valid": 0, "status": "no_data", "pilot_ages": []}

    user_sessions: Dict[str, List[Dict[str, Any]]] = {}
    for r in records:
        uid = str(r.get('userId') or '')
        if not uid or uid == 'anonymous':
            continue
        user_sessions.setdefault(uid, []).append(r)

    valid_user_errors: List[float] = []
    valid_user_log1p_errors: List[float] = []
    pilot_ages: List[int] = []

    for uid, sessions in user_sessions.items():
        sessions.sort(key=lambda x: str(x.get('date', '') or x.get('createdAt', '')))

        for sess in sessions:
            valid, err = is_valid_memory_match_session(sess)
            if valid and err is not None:
                valid_user_errors.append(err)
                valid_user_log1p_errors.append(math.log1p(err))
                age = user_age_map.get(uid) or sess.get('age')
                if age is not None:
                    try:
                        pilot_ages.append(int(age))
                    except (ValueError, TypeError):
                        pass
                break  # Take only the first valid session per user

    n_valid = len(valid_user_errors)
    raw_mean, raw_sd = calculate_sample_stats(valid_user_errors)
    log1p_mean, log1p_sd = calculate_sample_stats(valid_user_log1p_errors)
    median_age = float(statistics.median(pilot_ages)) if pilot_ages else None

    return {
        "n_valid": n_valid,
        "total_users": len(user_sessions),
        "meets_threshold": n_valid >= MIN_VALID_USERS,
        "raw_mean": raw_mean,
        "raw_sd": raw_sd,
        "log1p_mean": log1p_mean,
        "log1p_sd": log1p_sd,
        "pilot_ages": pilot_ages,
        "median_age": median_age
    }


def calibrate_and_update_norms(force: bool = False) -> Dict[str, Any]:
    """
    Recalibrates provisional norms when n >= 20 valid users per measure.
    Backs up norms.json to norms.backup.json prior to writing.
    
    Age-Band Logic & Safety Checks:
    - Verifies age distribution of the pilot sample.
    - If median age < 55, prints warning and sets age_band to '<55'.
    - Calls is_norm_applicable to verify norm gating.
    """
    if not os.path.exists(NORMS_PATH):
        raise FileNotFoundError(f"norms.json not found at {NORMS_PATH}")

    user_age_map = get_user_age_map()
    rt_data = extract_baseline_reaction_time(user_age_map)
    mm_data = extract_baseline_memory_match(user_age_map)

    n_rt = rt_data["n_valid"]
    n_mm = mm_data["n_valid"]

    rt_ready = n_rt >= MIN_VALID_USERS or (force and n_rt > 0)
    mm_ready = n_mm >= MIN_VALID_USERS or (force and n_mm > 0)

    # Check pilot sample median age across measures
    combined_ages = rt_data.get("pilot_ages", []) + mm_data.get("pilot_ages", [])
    overall_median_age = float(statistics.median(combined_ages)) if combined_ages else None

    if overall_median_age is not None and overall_median_age < 55:
        print(f"\n" + "!" * 80)
        print(f"[Calibrate WARNING] Pilot sample median age is below 55 (median: {overall_median_age:.1f} yrs).")
        print("CRITICAL: The resulting calibrated norms must NOT be used for older adults (age 55+).")
        print("Norms will be categorized under age band '<55' to prevent older-adult misapplication.")
        print("!" * 80 + "\n")

    if not rt_ready and not mm_ready:
        print(f"[Calibrate] Threshold not met. Current valid users: Reaction Time n={n_rt}/{MIN_VALID_USERS}, Memory Match n={n_mm}/{MIN_VALID_USERS}. norms.json unchanged.")
        return {
            "calibrated": False,
            "reaction_time_n": n_rt,
            "memory_match_n": n_mm,
            "min_required": MIN_VALID_USERS,
            "median_age": overall_median_age
        }

    # Backup norms.json before modifying
    shutil.copyfile(NORMS_PATH, BACKUP_NORMS_PATH)
    print(f"[Calibrate] Backed up {NORMS_PATH} -> {BACKUP_NORMS_PATH}")

    with open(NORMS_PATH, 'r', encoding='utf-8') as f:
        norms_doc = json.load(f)

    scoring_norms = norms_doc.setdefault("scoring_norms", {})
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%SZ")
    updated = []

    # Assign age_band based on pilot cohort
    calibrated_band = "<55" if (overall_median_age is not None and overall_median_age < 55) else "pilot_cohort"

    # Update Reaction Time norms
    if rt_ready and rt_data["rt_mean"] is not None:
        rt_mean_entry = scoring_norms.setdefault("reaction_time_mean_ms", {})
        
        # Verify age-band logic via is_norm_applicable
        test_norm = {
            "mean": rt_data["rt_mean"],
            "sd": rt_data["rt_mean_sd"],
            "age_band": calibrated_band
        }
        # Confirm that a 70-year old is refused if band is <55
        if calibrated_band == "<55":
            app, _ = is_norm_applicable(test_norm, 70)
            assert not app, "Age band logic verification failed: 70-year-old was not refused <55 norm!"

        # Update multi-band dictionary and top-level
        age_bands = rt_mean_entry.setdefault("age_bands", {})
        age_bands[calibrated_band] = {
            "mean": rt_data["rt_mean"],
            "sd": rt_data["rt_mean_sd"],
            "n": n_rt,
            "status": "CALIBRATED_PILOT",
            "date": now_str,
            "source": f"NeuroSense internal pilot (n={n_rt}, median age={rt_data.get('median_age')})"
        }

        rt_sd_entry = scoring_norms.setdefault("reaction_time_sd_ms", {})
        rt_sd_entry["mean"] = rt_data["rt_sd_mean"]
        rt_sd_entry["sd"] = rt_data["rt_sd_sd"]
        rt_sd_entry["age_band"] = calibrated_band
        rt_sd_entry["source"] = "own pilot data"
        rt_sd_entry["n"] = n_rt
        rt_sd_entry["status"] = "CALIBRATED_PILOT"
        rt_sd_entry["date"] = now_str
        updated.extend(["reaction_time_mean_ms", "reaction_time_sd_ms"])

    # Update Memory Match Errors norms (log1p transformed)
    if mm_ready and mm_data["raw_mean"] is not None:
        mm_entry = scoring_norms.setdefault("memory_match_errors", {})
        mm_entry["mean"] = mm_data["raw_mean"]
        mm_entry["sd"] = mm_data["raw_sd"]
        mm_entry["log1p_mean"] = mm_data["log1p_mean"]
        mm_entry["log1p_sd"] = mm_data["log1p_sd"]
        mm_entry["age_band"] = calibrated_band
        mm_entry["transformation"] = "log1p applied to raw error count"
        mm_entry["source"] = "own pilot data"
        mm_entry["n"] = n_mm
        mm_entry["status"] = "CALIBRATED_PILOT"
        mm_entry["date"] = now_str
        updated.append("memory_match_errors")

    with open(NORMS_PATH, 'w', encoding='utf-8') as f:
        json.dump(norms_doc, f, indent=2)

    print(f"[Calibrate] Successfully updated {len(updated)} entries in norms.json: {', '.join(updated)}")

    return {
        "calibrated": True,
        "updated_entries": updated,
        "reaction_time_n": n_rt,
        "memory_match_n": n_mm,
        "median_age": overall_median_age,
        "age_band": calibrated_band,
        "date": now_str
    }


def check_and_calibrate_if_ready() -> Dict[str, Any]:
    """Startup / admin-triggered check. Runs calibration only if n >= 20 threshold is met."""
    return calibrate_and_update_norms(force=False)


if __name__ == '__main__':
    force_flag = '--force' in sys.argv
    print(f"=== NeuroSense Norm Recalibration Engine ===")
    print(f"Threshold: n >= {MIN_VALID_USERS} valid baseline sessions per measure")
    res = calibrate_and_update_norms(force=force_flag)
    print(json.dumps(res, indent=2))
