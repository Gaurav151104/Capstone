"""
Unit Tests for Psychometric Norming, Composite Gating, and Age-Band Logic.

Verifies:
1. Gating with MIN_MEASURES = 3:
   - If fewer than 3 measures have valid norms, returns composite = None, status "INSUFFICIENT_NORMS".
   - Raw scores are preserved and returned per measure.
   - Never re-normalises down to a single measure.
   - Calculates composite only when >= 3 measures are valid and applicable.
2. Age-Band Logic & Refusals:
   - A 25-year-old must NOT receive the "60-64" RT norm.
   - A 70-year-old must NOT receive a "<55" norm.
   - A 62-year-old DOES receive the "60-64" RT norm.
   - A user with unknown age (None) is refused for age-banded norms.
   - Norms missing age_band are refused.
3. Disclaimer Generation from norms.json:
   - Marks PROVISIONAL measures as "provisional norm".
   - Marks null measures as "no norm available yet, raw score only".
   - Retains "Screening aid only, not a medical diagnosis."
4. Token Safety for User IDs with Dots:
   - Handles IDs like "john.doe.123@hospital.org" without token splitting errors.
"""

import os
import sys
import unittest

# Ensure backend directory is in sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from scoring import (
    MIN_MEASURES,
    is_norm_applicable,
    resolve_applicable_norm,
    generate_disclaimer,
    score_session_measures,
    compute_z_score,
    load_norms
)


class TestPsychometricScoringAndGating(unittest.TestCase):

    def setUp(self):
        self.norms_data = load_norms()

    def test_age_band_refusal_rules(self):
        """A 25-year-old must NOT receive 60-64 norm; a 70-year-old must NOT receive <55 norm."""
        rt_norm_60_64 = {
            "mean": 278.7,
            "sd": 42.9,
            "age_band": "60-64",
            "status": "PROVISIONAL"
        }
        young_adult_norm = {
            "mean": 240.0,
            "sd": 30.0,
            "age_band": "<55",
            "status": "CALIBRATED_PILOT"
        }

        # 1. 25-year-old against 60-64 norm -> MUST REFUSE
        applicable_25, reason_25 = is_norm_applicable(rt_norm_60_64, user_age=25)
        self.assertFalse(applicable_25, "A 25-year-old must NOT receive the 60-64 RT norm")
        self.assertIn("outside norm age band", reason_25)

        # 2. 70-year-old against <55 norm -> MUST REFUSE
        applicable_70, reason_70 = is_norm_applicable(young_adult_norm, user_age=70)
        self.assertFalse(applicable_70, "A 70-year-old must NOT receive a <55 norm")
        self.assertIn("outside norm age band", reason_70)

        # 3. 62-year-old against 60-64 norm -> MUST ACCEPT
        applicable_62, reason_62 = is_norm_applicable(rt_norm_60_64, user_age=62)
        self.assertTrue(applicable_62, "A 62-year-old should receive the 60-64 RT norm")
        self.assertIsNone(reason_62)

        # 4. 30-year-old against <55 norm -> MUST ACCEPT
        applicable_30, reason_30 = is_norm_applicable(young_adult_norm, user_age=30)
        self.assertTrue(applicable_30, "A 30-year-old should receive the <55 norm")
        self.assertIsNone(reason_30)

        # 5. User age None against age-banded norm -> MUST REFUSE
        applicable_none, reason_none = is_norm_applicable(rt_norm_60_64, user_age=None)
        self.assertFalse(applicable_none, "User without age must not receive an age-banded norm")

        # 6. Norm missing age_band -> MUST REFUSE
        missing_band_norm = {"mean": 250.0, "sd": 20.0, "status": "TEST"}
        applicable_no_band, reason_no_band = is_norm_applicable(missing_band_norm, user_age=60)
        self.assertFalse(applicable_no_band, "Norm without age_band must be refused")

    def test_is_norm_applicable_exact_boundaries(self):
        """Boundary test: '60-64' (64 True, 65 False); '<55' (54 True, 55 False); unparseable -> False."""
        norm_60_64 = {"mean": 278.0, "sd": 40.0, "age_band": "60-64"}
        norm_lt_55 = {"mean": 240.0, "sd": 30.0, "age_band": "<55"}
        norm_unparseable = {"mean": 250.0, "sd": 25.0, "age_band": "middle-aged-adults-unparseable"}

        # '60-64': 64 -> True, 65 -> False
        app_64, _ = is_norm_applicable(norm_60_64, user_age=64)
        app_65, _ = is_norm_applicable(norm_60_64, user_age=65)
        self.assertTrue(app_64, "Age 64 must be within 60-64 band")
        self.assertFalse(app_65, "Age 65 must NOT be within 60-64 band")

        # '<55': 54 -> True, 55 -> False
        app_54, _ = is_norm_applicable(norm_lt_55, user_age=54)
        app_55, _ = is_norm_applicable(norm_lt_55, user_age=55)
        self.assertTrue(app_54, "Age 54 must be within <55 band")
        self.assertFalse(app_55, "Age 55 must NOT be within <55 band")

        # unparseable band string -> returns (False, "Unrecognised age band")
        app_unp, reason_unp = is_norm_applicable(norm_unparseable, user_age=60)
        self.assertFalse(app_unp, "Unparseable age band must fail closed")
        self.assertEqual(reason_unp, "Unrecognised age band")

    def test_composite_gating_0_1_2_measures(self):
        """0, 1, and 2 valid measures must all yield composite=None and status='INSUFFICIENT_NORMS'."""
        mock_norms = {
            "scoring_norms": {
                "word_recall_immediate": {"mean": 0.55, "sd": 0.15, "age_band": "60-64", "status": "PROVISIONAL"},
                "word_recall_delayed": {"mean": 0.50, "sd": 0.18, "age_band": "60-64", "status": "PROVISIONAL"},
                "reaction_time_mean_ms": {"mean": 280.0, "sd": 40.0, "age_band": "60-64", "status": "PROVISIONAL"},
                "image_recall_forward_span": {"mean": None, "sd": None, "status": "NO_SOURCE"},
                "memory_match_errors": {"mean": None, "sd": None, "status": "NO_SOURCE"}
            }
        }

        # Case 0 valid measures
        res_0 = score_session_measures({"age": 62}, norms_data=mock_norms, min_measures=3)
        self.assertEqual(res_0["status"], "INSUFFICIENT_NORMS")
        self.assertIsNone(res_0["composite"])
        self.assertEqual(res_0["valid_measures_count"], 0)

        # Case 1 valid measure
        res_1 = score_session_measures({"age": 62, "reaction_time_mean_ms": 285.0}, norms_data=mock_norms, min_measures=3)
        self.assertEqual(res_1["status"], "INSUFFICIENT_NORMS")
        self.assertIsNone(res_1["composite"])
        self.assertEqual(res_1["valid_measures_count"], 1)

        # Case 2 valid measures
        res_2 = score_session_measures({
            "age": 62,
            "reaction_time_mean_ms": 285.0,
            "word_recall_immediate_count": 6,
            "word_recall_immediate_total": 10
        }, norms_data=mock_norms, min_measures=3)
        self.assertEqual(res_2["status"], "INSUFFICIENT_NORMS")
        self.assertIsNone(res_2["composite"])
        self.assertEqual(res_2["valid_measures_count"], 2)

    def test_composite_gating_fewer_than_min_measures(self):
        """If fewer than MIN_MEASURES measures have valid norms, return composite=null, status INSUFFICIENT_NORMS."""
        # Provide only Reaction Time data for an applicable 62-year-old
        # Only 1 measure has valid norms in default norms.json (reaction_time_mean_ms)
        raw_input = {
            "age": 62,
            "reaction_time_mean_ms": 285.0,
            "reaction_time_sd_ms": 40.0,
            "memory_match_errors": 4,
            "word_recall_immediate_count": 7,
            "word_recall_delayed_count": 6
        }

        res = score_session_measures(raw_input, norms_data=self.norms_data, min_measures=3)

        # MUST NOT re-normalise down to single measure!
        self.assertEqual(res["status"], "INSUFFICIENT_NORMS")
        self.assertIsNone(res["composite"])
        self.assertIsNone(res["composite_z"])
        self.assertIsNone(res["scaled_score_100"])
        self.assertEqual(res["active_weights"], {})

        # Per-measure raw values must be preserved and returned
        self.assertIn("raw_values", res)
        self.assertEqual(res["raw_values"]["reaction_time_mean_ms"], 285.0)
        self.assertEqual(res["raw_values"]["memory_match_errors"], 4)
        self.assertEqual(res["raw_values"]["word_recall_immediate_count"], 7)

        # Exactly 1 measure had valid norms for age 62
        self.assertEqual(res["valid_measures_count"], 1)
        self.assertEqual(res["used_measures"], ["reaction_time_mean_ms"])

    def test_never_renormalise_to_single_measure(self):
        """Verify that single valid measure NEVER generates a composite score."""
        mock_norms = {
            "scoring_norms": {
                "reaction_time_mean_ms": {
                    "mean": 278.7,
                    "sd": 42.9,
                    "age_band": "60-64",
                    "status": "PROVISIONAL"
                },
                "word_recall_immediate": {"mean": None, "sd": None, "status": "NO_SOURCE"},
                "word_recall_delayed": {"mean": None, "sd": None, "status": "NO_SOURCE"},
                "image_recall_forward_span": {"mean": None, "sd": None, "status": "NO_SOURCE"},
                "reaction_time_sd_ms": {"mean": None, "sd": None, "status": "NO_SOURCE"},
                "memory_match_errors": {"mean": None, "sd": None, "status": "NO_SOURCE"}
            }
        }
        res = score_session_measures({"age": 62, "reaction_time_mean_ms": 290.0}, norms_data=mock_norms, min_measures=3)
        self.assertEqual(res["status"], "INSUFFICIENT_NORMS")
        self.assertIsNone(res["composite"])
        self.assertIsNone(res["scaled_score_100"])

    def test_composite_calculation_when_threshold_met(self):
        """When at least MIN_MEASURES are valid, composite score is calculated."""
        mock_norms = {
            "scoring_norms": {
                "word_recall_immediate": {"mean": 0.55, "sd": 0.15, "age_band": "60-64", "status": "PROVISIONAL"},
                "word_recall_delayed": {"mean": 0.50, "sd": 0.18, "age_band": "60-64", "status": "PROVISIONAL"},
                "reaction_time_mean_ms": {"mean": 280.0, "sd": 40.0, "age_band": "60-64", "status": "PROVISIONAL"},
                "image_recall_forward_span": {"mean": None, "sd": None, "status": "NO_SOURCE"},
                "reaction_time_sd_ms": {"mean": None, "sd": None, "status": "NO_SOURCE"},
                "memory_match_errors": {"mean": None, "sd": None, "status": "NO_SOURCE"}
            }
        }
        raw_input = {
            "age": 62,
            "word_recall_immediate_count": 6,
            "word_recall_immediate_total": 10,
            "word_recall_delayed_count": 5,
            "word_recall_delayed_total": 10,
            "reaction_time_mean_ms": 275.0
        }
        res = score_session_measures(raw_input, norms_data=mock_norms, min_measures=3)
        self.assertEqual(res["status"], "SUFFICIENT_NORMS")
        self.assertIsNotNone(res["composite"])
        self.assertIsNotNone(res["composite_z"])
        self.assertIsNotNone(res["scaled_score_100"])
        self.assertEqual(res["valid_measures_count"], 3)
        self.assertGreaterEqual(res["scaled_score_100"], 10)
        self.assertLessEqual(res["scaled_score_100"], 100)

    def test_disclaimer_generated_from_norms(self):
        """Verify dynamic disclaimer distinguishes PROVISIONAL norms from null norms and retains medical disclaimer."""
        disclaimer = generate_disclaimer(self.norms_data)
        self.assertIn("Provisional norm:", disclaimer)
        self.assertIn("Reaction Time (Mean)", disclaimer)
        self.assertIn("No norm available yet, raw score only:", disclaimer)
        self.assertIn("Word Recall", disclaimer)
        self.assertIn("Screening aid only, not a medical diagnosis.", disclaimer)

    def test_user_id_with_dots_in_token(self):
        """User IDs with dots must encode and verify safely without splitting errors."""
        os.environ["NEUROSENSE_PEPPER"] = "test_clinical_salt_12345"
        os.environ["JWT_SECRET"] = "test_jwt_secret_xyz"
        from app import generate_signed_token, verify_signed_token

        dotted_ids = [
            "john.doe@hospital.org",
            "participant.01.23.45",
            "dr.smith.jr.phd"
        ]
        for uid in dotted_ids:
            token = generate_signed_token(uid)
            verified = verify_signed_token(token)
            self.assertEqual(verified, uid, f"Failed round-trip token verification for dotted ID '{uid}'")


if __name__ == '__main__':
    unittest.main()
