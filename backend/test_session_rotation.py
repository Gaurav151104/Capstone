"""
Comprehensive Integration & Psychometric Tests for Cognitive Game Sessions.

Tests:
1. Real database layer & endpoint testing (temporary test database and data directory).
2. 100 sessions per user for Word Recall, Image Recall, and Memory Match:
   - form_id[i] != form_id[i-1] (never repeats consecutive forms)
   - Exhaustive pool cycling: no form repeats until all 8 forms in pool are used (Word Recall)
   - Consecutive sessions differ in item set / sequence (Memory Match & Image Recall)
   - Stored seed deterministically reproduces stored item_ids identically
3. Multi-user isolation: Two distinct users receive independent, isolated rotation state.
4. Image Recall constraints verified across 1000 generated sequences.
5. Security & Signed Auth enforcement: unauthenticated (401), unsigned raw token (401), unconsented (403), consented (200).
6. Production database isolation: Test database is dropped on tearDown, leaving zero test records in dementia_db.
"""

import os
import shutil
import tempfile
import unittest
import secrets
from typing import List, Dict, Any

# Point to temporary test database and temporary directory before importing app
TEST_DB_NAME = f"dementia_test_{secrets.token_hex(4)}"
os.environ["MONGO_DB_NAME"] = TEST_DB_NAME
TEST_DIR = tempfile.mkdtemp(prefix="neurosense_test_db_")
os.environ["DATA_DIR"] = TEST_DIR
os.environ["NEUROSENSE_PEPPER"] = "test_clinical_salt_12345"

from app import (
    app as flask_app,
    get_collection,
    session_items_col,
    consent_col,
    pseudonymise_user_id,
    generate_signed_token,
    mongo_client,
    use_mongo
)
from cognitive_data import (
    WORD_LIST_POOLS,
    IMAGE_SYMBOL_POOL,
    MEMORY_ICON_POOL,
    get_next_word_list_form,
    generate_constrained_image_sequence,
    regenerate_session_stimuli
)


def clear_collection(col):
    try:
        if hasattr(col, 'delete_many'):
            col.delete_many({})
        elif hasattr(col, '_write_all'):
            col._write_all([])
    except Exception:
        pass


class TestRealDatabaseSessionRotation(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        flask_app.config['TESTING'] = True
        cls.client = flask_app.test_client()

    @classmethod
    def tearDownClass(cls):
        # Drop the isolated test database so no test data remains
        if use_mongo and mongo_client is not None:
            try:
                mongo_client.drop_database(TEST_DB_NAME)
            except Exception as e:
                print(f"[tearDownClass] Could not drop test db {TEST_DB_NAME}: {e}")
        try:
            shutil.rmtree(TEST_DIR, ignore_errors=True)
        except Exception:
            pass

    def setUp(self):
        clear_collection(session_items_col)
        clear_collection(consent_col)

    def get_auth_headers(self, user_id: str) -> Dict[str, str]:
        token = generate_signed_token(user_id)
        return {"Authorization": f"Bearer {token}"}

    def grant_consent(self, user_id: str):
        headers = self.get_auth_headers(user_id)
        resp = self.client.post("/api/cognitive-consent", json={"version": "2.0"}, headers=headers)
        self.assertEqual(resp.status_code, 201)

    def test_database_isolation_leaves_no_data_in_production(self):
        """Assert tests use an isolated test database and zero test rows remain in production collections."""
        if use_mongo and mongo_client is not None:
            prod_db = mongo_client['dementia_db']
            prod_records = list(prod_db['session_items'].find({"user_id": {"$regex": "^user_"}}))
            self.assertEqual(len(prod_records), 0, "Test data was written to production database dementia_db!")

    def test_auth_and_consent_enforcement(self):
        """Assert unauthenticated gets 401, unsigned token gets 401, unconsented gets 403, consented gets 200."""
        # 1a. Unauthenticated request -> 401
        res = self.client.get("/api/session-items/next?game=Word%20Recall")
        self.assertEqual(res.status_code, 401)

        # 1b. Unsigned raw string token in header -> 401 (never trusts raw user id)
        res = self.client.get(
            "/api/session-items/next?game=Word%20Recall",
            headers={"Authorization": "Bearer raw_unsigned_user_id"}
        )
        self.assertEqual(res.status_code, 401)

        # 1c. X-User-Id header alone -> 401 (never trusts X-User-Id header)
        res = self.client.get(
            "/api/session-items/next?game=Word%20Recall",
            headers={"X-User-Id": "victim_user_123"}
        )
        self.assertEqual(res.status_code, 401)

        # 2. Authenticated with cryptographic signed token but unconsented -> 403
        headers = self.get_auth_headers("test_user_unconsented")
        res = self.client.get("/api/session-items/next?game=Word%20Recall", headers=headers)
        self.assertEqual(res.status_code, 403)
        self.assertIn("Consent required", res.get_json()["error"])

        # 3. Grant consent -> 200
        self.grant_consent("test_user_unconsented")
        res = self.client.get("/api/session-items/next?game=Word%20Recall", headers=headers)
        self.assertEqual(res.status_code, 200)

    def test_word_recall_100_sessions_real_db(self):
        """
        Runs 100 Word Recall sessions through the real DB layer.
        Asserts:
        - form_id[i] != form_id[i-1]
        - no form repeats until all 8 forms in pool were used
        - stored seed reproduces stored item_ids
        """
        user_id = "user_word_recall_100"
        self.grant_consent(user_id)
        headers = self.get_auth_headers(user_id)

        pool_size = len(WORD_LIST_POOLS)  # 8 forms
        form_history: List[str] = []

        for i in range(1, 101):
            res = self.client.get("/api/session-items/next?game=Word%20Recall", headers=headers)
            self.assertEqual(res.status_code, 200)
            data = res.get_json()

            current_form = data["formId"]
            seed = data["seed"]
            words = data["words"]

            # Assert 1: Never repeats the immediate previous form
            if form_history:
                self.assertNotEqual(
                    current_form, form_history[-1],
                    f"Session {i}: repeated immediate previous form {form_history[-1]}"
                )

            # Assert 2: Stored seed reproduces stored item_ids identically
            reproduced_items = regenerate_session_stimuli("Word Recall", current_form, seed)
            self.assertEqual(
                words, reproduced_items,
                f"Session {i}: Seed {seed} failed to reproduce exact item_ids"
            )

            form_history.append(current_form)

        # Assert 3: No form repeats until all 8 forms in pool were used (exhaustion cycle)
        num_full_cycles = len(form_history) // pool_size
        for cycle_idx in range(num_full_cycles):
            cycle_forms = form_history[cycle_idx * pool_size : (cycle_idx + 1) * pool_size]
            unique_in_cycle = set(cycle_forms)
            self.assertEqual(
                len(unique_in_cycle), pool_size,
                f"Cycle {cycle_idx} did not use all {pool_size} forms before repeating! Forms: {cycle_forms}"
            )

    def test_image_recall_100_sessions_real_db(self):
        """
        Runs 100 Image Recall sessions through real DB layer.
        Asserts sequences differ consecutively and stored seed reproduces stored item_ids.
        """
        user_id = "user_image_recall_100"
        self.grant_consent(user_id)
        headers = self.get_auth_headers(user_id)

        previous_item_ids = None

        for i in range(1, 101):
            res = self.client.get("/api/session-items/next?game=Image%20Recall&difficulty=medium", headers=headers)
            self.assertEqual(res.status_code, 200)
            data = res.get_json()

            item_ids = data["itemIds"]
            seed = data["seed"]
            form_id = data["formId"]

            # Assert sequence differs from consecutive session
            if previous_item_ids is not None:
                self.assertNotEqual(
                    item_ids, previous_item_ids,
                    f"Session {i}: Image sequence was identical to session {i-1}"
                )

            # Assert seed reproduces exact item_ids
            reproduced = regenerate_session_stimuli("Image Recall", form_id, seed, {"difficulty": "medium"})
            self.assertEqual(item_ids, reproduced)

            previous_item_ids = item_ids

    def test_memory_match_100_sessions_real_db(self):
        """
        Runs 100 Memory Match sessions through real DB layer.
        Asserts board layouts differ consecutively and stored seed reproduces exact board positions.
        """
        user_id = "user_memory_match_100"
        self.grant_consent(user_id)
        headers = self.get_auth_headers(user_id)

        previous_board = None

        for i in range(1, 101):
            res = self.client.get("/api/session-items/next?game=Memory%20Match&gridSize=small", headers=headers)
            self.assertEqual(res.status_code, 200)
            data = res.get_json()

            cards = data["cards"]
            item_ids = data["itemIds"]
            seed = data["seed"]
            form_id = data["formId"]

            # Exact board positions must match item_ids
            board_emojis = [c["emoji"] for c in cards]
            self.assertEqual(item_ids, board_emojis)
            self.assertEqual(len(board_emojis), 12)

            if previous_board is not None:
                self.assertNotEqual(
                    board_emojis, previous_board,
                    f"Session {i}: Memory match board layout was identical to session {i-1}"
                )

            # Assert stored seed reproduces exact board positions
            reproduced = regenerate_session_stimuli("Memory Match", form_id, seed, {"grid_size": "small"})
            self.assertEqual(item_ids, reproduced)

            previous_board = board_emojis

    def test_two_users_independent_rotations(self):
        """Asserts two different users get independent rotations and sessions."""
        user_a = "user_alpha"
        user_b = "user_beta"
        self.grant_consent(user_a)
        self.grant_consent(user_b)

        headers_a = self.get_auth_headers(user_a)
        headers_b = self.get_auth_headers(user_b)

        # Advance user A by 3 sessions
        for _ in range(3):
            self.client.get("/api/session-items/next?game=Word%20Recall", headers=headers_a)

        # User B starts at session #1
        res_b = self.client.get("/api/session-items/next?game=Word%20Recall", headers=headers_b)
        data_b = res_b.get_json()
        self.assertEqual(data_b["sessionNumber"], 1)

        # User A requests session #4
        res_a = self.client.get("/api/session-items/next?game=Word%20Recall", headers=headers_a)
        data_a = res_a.get_json()
        self.assertEqual(data_a["sessionNumber"], 4)

        # User A cannot read User B's session items
        res_forbidden = self.client.get(f"/api/session-items/{data_b['sessionId']}", headers=headers_a)
        self.assertEqual(res_forbidden.status_code, 403)

    def test_image_recall_constraints_1000_sequences(self):
        """
        Validates the psychometric constraint generator across 1000 sequences:
        - Fixed length per difficulty (Easy 4, Medium 5, Hard 6)
        - Rejects immediate repeats
        - Rejects strictly adjacent numeric IDs (|id[i] - id[i-1]| == 1)
        - Rejects runs of 3 or more strictly ascending or strictly descending IDs
        """
        difficulties = [("easy", 4), ("medium", 5), ("hard", 6)]

        for i in range(1000):
            diff_name, expected_len = difficulties[i % len(difficulties)]
            seed = secrets.randbelow(1_000_000_000)
            seq, _ = generate_constrained_image_sequence(length=expected_len, seed=seed)

            # 1. Exact length
            self.assertEqual(len(seq), expected_len)

            # 2. No immediate repeats
            for idx in range(1, len(seq)):
                self.assertNotEqual(
                    seq[idx]["id"], seq[idx-1]["id"],
                    f"Sequence {i}: immediate repeat at {idx}"
                )

            # 3. No strictly adjacent IDs
            for idx in range(1, len(seq)):
                diff = abs(seq[idx]["id"] - seq[idx-1]["id"])
                self.assertNotEqual(
                    diff, 1,
                    f"Sequence {i}: adjacent IDs {seq[idx-1]['id']} -> {seq[idx]['id']}"
                )

            # 4. No run of 3 or more strictly ascending or strictly descending IDs
            for idx in range(2, len(seq)):
                is_ascending = (seq[idx-2]["id"] < seq[idx-1]["id"] < seq[idx]["id"])
                is_descending = (seq[idx-2]["id"] > seq[idx-1]["id"] > seq[idx]["id"])
                self.assertFalse(
                    is_ascending,
                    f"Sequence {i}: 3-run ascending at {idx}: {[s['id'] for s in seq]}"
                )
                self.assertFalse(
                    is_descending,
                    f"Sequence {i}: 3-run descending at {idx}: {[s['id'] for s in seq]}"
                )


if __name__ == '__main__':
    unittest.main()
