"""
Psychometric Norming and Cognitive Scoring Engine.

Loads normative reference values from norms.json and computes standardized z-scores:
1. word_recall_immediate: raw score converted to proportion (recalled / total words), then z-scored.
2. word_recall_delayed: raw score converted to proportion (recalled / total words), then z-scored.
3. image_recall_forward_span: raw span length, z-scored against Corsi Block Tapping norms.
4. reaction_time_mean_ms: mean visual reaction time (lower is better; low weight).
5. reaction_time_sd_ms: within-person reaction time variability (lower is better; low weight).
6. memory_match_errors: incorrect pair attempts; log1p transformed prior to z-scoring.

Handles missing norms (where mean or sd is null) and dynamically re-weights
the composite score across only the available, valid measures.

Enforces MIN_MEASURES threshold (default 3): if fewer than MIN_MEASURES have valid,
applicable norms, composite is set to null, status "INSUFFICIENT_NORMS", and per-measure
raw scores are returned. Never re-normalises down to a single measure.
"""

import os
import json
import math
from typing import Dict, Any, Optional, Tuple, List

NORMS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'norms.json')
if not os.path.exists(NORMS_FILE):
    # Fallback to local directory
    NORMS_FILE = os.path.join(os.path.dirname(__file__), 'norms.json')

# Minimum number of valid, applicable measures required to compute a composite score.
# Never re-normalise down to a single measure or fewer than this threshold.
MIN_MEASURES: int = 3

# Baseline cognitive weights across domains
DEFAULT_MEASURE_WEIGHTS: Dict[str, float] = {
    "word_recall_immediate": 0.25,
    "word_recall_delayed": 0.30,
    "image_recall_forward_span": 0.25,
    "reaction_time_mean_ms": 0.06,  # Low weight per clinical guidelines
    "reaction_time_sd_ms": 0.04,    # Low weight per clinical guidelines
    "memory_match_errors": 0.10
}


def load_norms(filepath: Optional[str] = None) -> Dict[str, Any]:
    """Load scoring norms from norms.json."""
    path = filepath or NORMS_FILE
    if not os.path.exists(path):
        raise FileNotFoundError(f"Norms file not found at: {path}")
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def compute_z_score(
    value: float,
    mean: float,
    sd: float,
    higher_is_better: bool = True
) -> float:
    """
    Computes standardized z-score.
    If higher_is_better is False, the direction is inverted so that higher z always indicates better performance.
    """
    if sd is None or sd <= 0:
        raise ValueError(f"Standard deviation must be positive, got {sd}")
    raw_z = (value - mean) / sd
    return raw_z if higher_is_better else -raw_z


def is_norm_applicable(norm_entry: Dict[str, Any], user_age: Optional[int]) -> Tuple[bool, Optional[str]]:
    """
    Determines if a normative reference entry applies to a user of a given age.
    Every norm with a numeric mean/SD must state its age band, and users outside
    that band are refused.

    Enforces strict age-band gating:
    - 25-year-old must NOT receive a "60-64" RT norm.
    - 70-year-old must NOT receive a "<55" norm.
    - Norms without a stated age_band cannot be applied to any user.
    - If user_age is unknown (None), age-banded norms cannot be applied.
    """
    if not isinstance(norm_entry, dict):
        return False, "Invalid norm entry structure"

    mean = norm_entry.get("mean")
    sd = norm_entry.get("sd")
    if mean is None or sd is None:
        return False, "Norm has null mean or SD"

    age_band = norm_entry.get("age_band")
    if not age_band:
        return False, "Norm with numeric values is missing required age_band"

    if user_age is None:
        return False, f"User age unknown; age-banded norm '{age_band}' cannot be applied"

    band_clean = str(age_band).strip().lower()

    # Case: Range "60-64", "18-35", "49-79"
    if "-" in band_clean and not band_clean.startswith("-"):
        parts = band_clean.split("-")
        try:
            min_a = float(parts[0].strip().split()[0])
            max_a = float(parts[1].strip().split()[0])
            if not (min_a <= user_age <= max_a):
                return False, f"User age {user_age} outside norm age band '{age_band}' ({min_a}-{max_a})"
            return True, None
        except (ValueError, IndexError):
            pass

    # Case: "<55"
    if band_clean.startswith("<") and not band_clean.startswith("<="):
        try:
            cutoff = float(band_clean[1:].strip())
            if user_age >= cutoff:
                return False, f"User age {user_age} outside norm age band '{age_band}' (<{cutoff})"
            return True, None
        except ValueError:
            pass

    # Case: "<=55"
    if band_clean.startswith("<="):
        try:
            cutoff = float(band_clean[2:].strip())
            if user_age > cutoff:
                return False, f"User age {user_age} outside norm age band '{age_band}' (<={cutoff})"
            return True, None
        except ValueError:
            pass

    # Case: ">=55" or "55+"
    if band_clean.startswith(">="):
        try:
            cutoff = float(band_clean[2:].strip())
            if user_age < cutoff:
                return False, f"User age {user_age} outside norm age band '{age_band}' (>={cutoff})"
            return True, None
        except ValueError:
            pass

    if band_clean.endswith("+"):
        try:
            cutoff = float(band_clean[:-1].strip())
            if user_age < cutoff:
                return False, f"User age {user_age} outside norm age band '{age_band}' (>={cutoff})"
            return True, None
        except ValueError:
            pass

    if band_clean in ["young_adult", "18-35", "18-49"]:
        if user_age >= 55:
            return False, f"Young-adult norm '{age_band}' not applicable to user aged {user_age}"
        return True, None

    if band_clean in ["older_adult", "55+"]:
        if user_age < 55:
            return False, f"Older-adult norm '{age_band}' not applicable to user aged {user_age}"
        return True, None

    return False, "Unrecognised age band"


def resolve_applicable_norm(norm_dict: Dict[str, Any], user_age: Optional[int]) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """
    Resolves the applicable norm entry from a metric that may either have a direct norm
    or an 'age_bands' dictionary containing sub-band norms.
    """
    if not isinstance(norm_dict, dict):
        return None, "Invalid norm definition"

    # Multi age band schema
    if "age_bands" in norm_dict and isinstance(norm_dict["age_bands"], dict):
        if user_age is None:
            return None, "User age required to select applicable age band"
        for band_key, sub_entry in norm_dict["age_bands"].items():
            entry = dict(sub_entry)
            if "age_band" not in entry:
                entry["age_band"] = band_key
            applicable, _ = is_norm_applicable(entry, user_age)
            if applicable:
                return entry, None
        return None, f"No applicable age band in norms for user age {user_age}"

    # Single age band schema
    applicable, reason = is_norm_applicable(norm_dict, user_age)
    if applicable:
        return norm_dict, None
    return None, reason


def generate_disclaimer(norms_data: Optional[Dict[str, Any]] = None) -> str:
    """
    Generate dynamic disclaimer statement directly from norms.json.
    Lists measures with status PROVISIONAL as 'provisional norm' and
    measures with null norms as 'no norm available yet, raw score only'.
    Retains 'Screening aid only, not a medical diagnosis.'
    """
    if norms_data is None:
        try:
            norms_data = load_norms()
        except Exception:
            norms_data = {}

    norms = norms_data.get("scoring_norms", {})

    provisional = []
    no_norm = []

    label_map = {
        "word_recall_immediate": "Word Recall (Immediate)",
        "word_recall_delayed": "Word Recall (Delayed)",
        "image_recall_forward_span": "Image Recall (Forward Span)",
        "image_recall_backward_span": "Image Recall (Backward Span)",
        "reaction_time_mean_ms": "Reaction Time (Mean)",
        "reaction_time_sd_ms": "Reaction Time (SD)",
        "memory_match_time_s": "Memory Match (Time)",
        "memory_match_errors": "Memory Match (Errors)"
    }

    for key, item in norms.items():
        name = label_map.get(key, key.replace("_", " ").title())
        status = str(item.get("status", "")).upper()
        mean = item.get("mean")
        sd = item.get("sd")
        if status == "PROVISIONAL" or (mean is not None and sd is not None and status != "ESTABLISHED"):
            band = item.get("age_band")
            band_str = f" (age {band})" if band else ""
            provisional.append(f"{name}{band_str}")
        elif mean is None or sd is None or status in ["NO_SOURCE", "UNAVAILABLE"]:
            no_norm.append(name)

    parts = []
    if provisional:
        parts.append(f"Provisional norm: {', '.join(provisional)}.")
    if no_norm:
        parts.append(f"No norm available yet, raw score only: {', '.join(no_norm)}.")
    parts.append("The Reaction Time norm comes from lab timing and browser timing usually reads slower, so it is a provisional reference only.")
    parts.append("Screening aid only, not a medical diagnosis.")
    return " ".join(parts)


def score_session_measures(
    raw_data: Dict[str, Any],
    norms_data: Optional[Dict[str, Any]] = None,
    weights: Optional[Dict[str, float]] = None,
    min_measures: int = MIN_MEASURES
) -> Dict[str, Any]:
    """
    Scores raw cognitive performance measures against norms.json.
    
    Composite Gating:
    - If fewer than min_measures (default 3) measures have valid, applicable norms,
      returns composite = null, status "INSUFFICIENT_NORMS", and per-measure raw values.
    - Never re-normalises down to a single measure.

    Expected raw_data keys (any subset allowed):
    - word_recall_immediate_count: int, recalled words
    - word_recall_immediate_total: int, total words in list (default 10)
    - word_recall_delayed_count: int, recalled delayed words
    - word_recall_delayed_total: int, total words in list (default 10)
    - image_recall_span: int or float, longest sequence recalled (or count recalled)
    - reaction_time_mean_ms: float, average reaction time in ms
    - reaction_time_sd_ms: float, reaction time variability in ms
    - memory_match_errors: int, number of incorrect card flips
    - age or user_age: int, user age
    """
    if norms_data is None:
        norms_data = load_norms()

    norms = norms_data.get("scoring_norms", {})
    base_weights = dict(weights or DEFAULT_MEASURE_WEIGHTS)

    user_age = raw_data.get("age") or raw_data.get("user_age")
    try:
        user_age = int(user_age) if user_age is not None else None
    except (ValueError, TypeError):
        user_age = None

    measure_z_scores: Dict[str, float] = {}
    measure_details: Dict[str, Any] = {}
    skipped_measures: List[str] = []
    raw_values: Dict[str, Any] = {}

    # Extract all raw inputs provided
    for k, v in raw_data.items():
        if k not in ["weights", "age", "user_age"] and v is not None:
            raw_values[k] = v

    # 1. Word Recall Immediate: convert to proportion of words recalled
    if "word_recall_immediate_count" in raw_data:
        count = float(raw_data["word_recall_immediate_count"])
        total = float(raw_data.get("word_recall_immediate_total", 10))
        proportion = count / total if total > 0 else 0.0
        raw_values["word_recall_immediate_proportion"] = proportion

        norm_def = norms.get("word_recall_immediate", {})
        norm, reason = resolve_applicable_norm(norm_def, user_age)
        if norm and norm.get("mean") is not None and norm.get("sd") is not None and norm["sd"] > 0:
            z = compute_z_score(proportion, norm["mean"], norm["sd"], higher_is_better=True)
            measure_z_scores["word_recall_immediate"] = z
            measure_details["word_recall_immediate"] = {
                "raw_proportion": proportion,
                "norm_mean": norm["mean"],
                "norm_sd": norm["sd"],
                "z_score": round(z, 3)
            }
        else:
            skipped_measures.append("word_recall_immediate")
    elif "word_recall_immediate" in raw_data and isinstance(raw_data["word_recall_immediate"], (int, float)):
        proportion = float(raw_data["word_recall_immediate"])
        raw_values["word_recall_immediate_proportion"] = proportion
        norm_def = norms.get("word_recall_immediate", {})
        norm, reason = resolve_applicable_norm(norm_def, user_age)
        if norm and norm.get("mean") is not None and norm.get("sd") is not None and norm["sd"] > 0:
            z = compute_z_score(proportion, norm["mean"], norm["sd"], higher_is_better=True)
            measure_z_scores["word_recall_immediate"] = z
            measure_details["word_recall_immediate"] = {
                "raw_proportion": proportion,
                "norm_mean": norm["mean"],
                "norm_sd": norm["sd"],
                "z_score": round(z, 3)
            }
        else:
            skipped_measures.append("word_recall_immediate")

    # 2. Word Recall Delayed: convert to proportion of words recalled
    if "word_recall_delayed_count" in raw_data:
        count = float(raw_data["word_recall_delayed_count"])
        total = float(raw_data.get("word_recall_delayed_total", 10))
        proportion = count / total if total > 0 else 0.0
        raw_values["word_recall_delayed_proportion"] = proportion

        norm_def = norms.get("word_recall_delayed", {})
        norm, reason = resolve_applicable_norm(norm_def, user_age)
        if norm and norm.get("mean") is not None and norm.get("sd") is not None and norm["sd"] > 0:
            z = compute_z_score(proportion, norm["mean"], norm["sd"], higher_is_better=True)
            measure_z_scores["word_recall_delayed"] = z
            measure_details["word_recall_delayed"] = {
                "raw_proportion": proportion,
                "norm_mean": norm["mean"],
                "norm_sd": norm["sd"],
                "z_score": round(z, 3)
            }
        else:
            skipped_measures.append("word_recall_delayed")
    elif "word_recall_delayed" in raw_data and isinstance(raw_data["word_recall_delayed"], (int, float)):
        proportion = float(raw_data["word_recall_delayed"])
        raw_values["word_recall_delayed_proportion"] = proportion
        norm_def = norms.get("word_recall_delayed", {})
        norm, reason = resolve_applicable_norm(norm_def, user_age)
        if norm and norm.get("mean") is not None and norm.get("sd") is not None and norm["sd"] > 0:
            z = compute_z_score(proportion, norm["mean"], norm["sd"], higher_is_better=True)
            measure_z_scores["word_recall_delayed"] = z
            measure_details["word_recall_delayed"] = {
                "raw_proportion": proportion,
                "norm_mean": norm["mean"],
                "norm_sd": norm["sd"],
                "z_score": round(z, 3)
            }
        else:
            skipped_measures.append("word_recall_delayed")

    # 3. Image Recall Forward Span
    span_val = raw_data.get("image_recall_forward_span") or raw_data.get("image_recall_span")
    if span_val is not None:
        span = float(span_val)
        raw_values["image_recall_forward_span"] = span
        norm_def = norms.get("image_recall_forward_span", {})
        norm, reason = resolve_applicable_norm(norm_def, user_age)
        if norm and norm.get("mean") is not None and norm.get("sd") is not None and norm["sd"] > 0:
            z = compute_z_score(span, norm["mean"], norm["sd"], higher_is_better=True)
            measure_z_scores["image_recall_forward_span"] = z
            measure_details["image_recall_forward_span"] = {
                "raw_span": span,
                "norm_mean": norm["mean"],
                "norm_sd": norm["sd"],
                "z_score": round(z, 3)
            }
        else:
            skipped_measures.append("image_recall_forward_span")

    # 4. Reaction Time Mean (lower is better)
    rt_mean = raw_data.get("reaction_time_mean_ms")
    if rt_mean is not None:
        rt = float(rt_mean)
        raw_values["reaction_time_mean_ms"] = rt
        norm_def = norms.get("reaction_time_mean_ms", {})
        norm, reason = resolve_applicable_norm(norm_def, user_age)
        if norm and norm.get("mean") is not None and norm.get("sd") is not None and norm["sd"] > 0:
            z = compute_z_score(rt, norm["mean"], norm["sd"], higher_is_better=False)
            measure_z_scores["reaction_time_mean_ms"] = z
            measure_details["reaction_time_mean_ms"] = {
                "raw_ms": rt,
                "norm_mean": norm["mean"],
                "norm_sd": norm["sd"],
                "z_score": round(z, 3)
            }
        else:
            skipped_measures.append("reaction_time_mean_ms")

    # 5. Reaction Time SD (lower is better; skip if sd is null)
    rt_sd = raw_data.get("reaction_time_sd_ms")
    if rt_sd is not None:
        sd_val = float(rt_sd)
        raw_values["reaction_time_sd_ms"] = sd_val
        norm_def = norms.get("reaction_time_sd_ms", {})
        norm, reason = resolve_applicable_norm(norm_def, user_age)
        if norm and norm.get("mean") is not None and norm.get("sd") is not None and norm["sd"] > 0:
            z = compute_z_score(sd_val, norm["mean"], norm["sd"], higher_is_better=False)
            measure_z_scores["reaction_time_sd_ms"] = z
            measure_details["reaction_time_sd_ms"] = {
                "raw_sd": sd_val,
                "norm_mean": norm["mean"],
                "norm_sd": norm["sd"],
                "z_score": round(z, 3)
            }
        else:
            skipped_measures.append("reaction_time_sd_ms")

    # 6. Memory Match Errors: Apply log1p transform (lower is better)
    mm_errors = raw_data.get("memory_match_errors")
    if mm_errors is not None:
        errors = max(0.0, float(mm_errors))
        raw_values["memory_match_errors"] = errors
        log_errors = math.log1p(errors)

        norm_def = norms.get("memory_match_errors", {})
        norm, reason = resolve_applicable_norm(norm_def, user_age)
        log_mean = norm.get("log1p_mean") if norm else None
        log_sd = norm.get("log1p_sd") if norm else None

        if log_mean is not None and log_sd is not None and log_sd > 0:
            z = compute_z_score(log_errors, log_mean, log_sd, higher_is_better=False)
            measure_z_scores["memory_match_errors"] = z
            measure_details["memory_match_errors"] = {
                "raw_errors": errors,
                "log1p_errors": round(log_errors, 3),
                "z_score": round(z, 3)
            }
        else:
            skipped_measures.append("memory_match_errors")

    disclaimer_text = generate_disclaimer(norms_data)
    valid_count = len(measure_z_scores)

    # --------------------------------------------------------------------------
    # COMPOSITE GATING RULE:
    # If fewer than min_measures (default 3) measures have valid, applicable norms,
    # return composite = null, status "INSUFFICIENT_NORMS", and per-measure raw values.
    # Never re-normalise down to a single measure.
    # --------------------------------------------------------------------------
    if valid_count < min_measures:
        return {
            "status": "INSUFFICIENT_NORMS",
            "min_measures": min_measures,
            "valid_measures_count": valid_count,
            "composite": None,
            "composite_z": None,
            "scaled_score_100": None,
            "used_measures": list(measure_z_scores.keys()),
            "skipped_measures": list(set(skipped_measures)),
            "active_weights": {},
            "per_measure_z": measure_z_scores,
            "measure_details": measure_details,
            "raw_values": raw_values,
            "disclaimer": disclaimer_text
        }

    # Re-weight available measures dynamically across valid measures
    active_weights: Dict[str, float] = {}
    sum_weight = 0.0

    for measure in measure_z_scores.keys():
        w = base_weights.get(measure, 0.15)
        active_weights[measure] = w
        sum_weight += w

    if sum_weight > 0:
        for m in active_weights:
            active_weights[m] = round(active_weights[m] / sum_weight, 4)

    # Compute composite z-score
    composite_z = 0.0
    for m, z in measure_z_scores.items():
        composite_z += z * active_weights[m]

    composite_z = round(composite_z, 3)

    # Scale to 0-100 cognitive index (mean 75, 1 SD = 12 points, clamped 10-100)
    scaled_score = round(max(10.0, min(100.0, 75.0 + (composite_z * 12.0))))

    return {
        "status": "SUFFICIENT_NORMS",
        "min_measures": min_measures,
        "valid_measures_count": valid_count,
        "composite": scaled_score,
        "composite_z": composite_z,
        "scaled_score_100": scaled_score,
        "used_measures": list(measure_z_scores.keys()),
        "skipped_measures": list(set(skipped_measures)),
        "active_weights": active_weights,
        "per_measure_z": measure_z_scores,
        "measure_details": measure_details,
        "raw_values": raw_values,
        "disclaimer": disclaimer_text
    }
