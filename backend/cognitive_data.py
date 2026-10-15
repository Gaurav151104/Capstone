"""
Cognitive Game Stimuli Pools, Matched Word Lists, and Validation Utilities.

Word Lists Matching Documentation:
----------------------------------
8 alternative parallel forms (A-H), each consisting of 10 concrete English nouns.
Matched across:
1. Lexical Class: 100% concrete common nouns.
2. Semantic Categories: Each 10-word list contains exactly one item from 10 parallel semantic domains:
   - [0] Fruit
   - [1] Vehicle
   - [2] Dwelling / Architecture
   - [3] Water body / Geographic feature
   - [4] Staple Food
   - [5] Handheld Object / Instrument
   - [6] Furniture
   - [7] Apparel / Clothing
   - [8] Familiar Animal
   - [9] Tableware / Kitchen item
3. Word Length: Range 3-6 letters; mean letters per form = 4.88 ± 0.16.
4. Syllable Count: Mean syllables per form = 1.38 ± 0.11 (1 to 2 syllables max, 2 words with 3).
5. Concreteness & Imageability: Selected as concrete, high-imageability nouns; not formally verified.
6. Lexical Frequency: Moderate-to-high frequency in everyday conversational usage.
"""

import math
import random
import secrets
from typing import Dict, List, Tuple, Any, Optional

# 8 Parallel Matched Word Lists (10 words each)
WORD_LIST_POOLS: Dict[str, Dict[str, Any]] = {
    "FORM_A": {
        "form_id": "FORM_A",
        "name": "List A (Standard Baseline)",
        "words": ["APPLE", "TRAIN", "HOUSE", "RIVER", "BREAD", "CLOCK", "CHAIR", "SHIRT", "HORSE", "SPOON"],
        "mean_length": 5.0,
        "mean_syllables": 1.2
    },
    "FORM_B": {
        "form_id": "FORM_B",
        "name": "List B (Alternate 1)",
        "words": ["LEMON", "TRUCK", "CABIN", "OCEAN", "FLOUR", "WATCH", "TABLE", "SHOES", "TIGER", "FORK"],
        "mean_length": 4.9,
        "mean_syllables": 1.5
    },
    "FORM_C": {
        "form_id": "FORM_C",
        "name": "List C (Alternate 2)",
        "words": ["PEACH", "PLANE", "HOTEL", "BROOK", "SUGAR", "RADIO", "BENCH", "BOOTS", "ZEBRA", "KNIFE"],
        "mean_length": 5.0,
        "mean_syllables": 1.5
    },
    "FORM_D": {
        "form_id": "FORM_D",
        "name": "List D (Alternate 3)",
        "words": ["MELON", "BOAT", "LODGE", "CREEK", "HONEY", "PHONE", "STOOL", "SOCKS", "CAMEL", "PLATE"],
        "mean_length": 4.9,
        "mean_syllables": 1.3
    },
    "FORM_E": {
        "form_id": "FORM_E",
        "name": "List E (Alternate 4)",
        "words": ["GRAPE", "MOTOR", "CASTLE", "CANAL", "BUTTER", "BELL", "SOFA", "GLOVE", "SHEEP", "BOWL"],
        "mean_length": 4.9,
        "mean_syllables": 1.5
    },
    "FORM_F": {
        "form_id": "FORM_F",
        "name": "List F (Alternate 5)",
        "words": ["BERRY", "METRO", "VILLA", "LAKE", "CHEESE", "TORCH", "DESK", "COAT", "EAGLE", "GLASS"],
        "mean_length": 4.8,
        "mean_syllables": 1.4
    },
    "FORM_G": {
        "form_id": "FORM_G",
        "name": "List G (Alternate 6)",
        "words": ["CHERRY", "BUS", "MANOR", "POND", "CANDY", "LAMP", "COUCH", "SCARF", "ROBIN", "CUP"],
        "mean_length": 4.5,
        "mean_syllables": 1.4
    },
    "FORM_H": {
        "form_id": "FORM_H",
        "name": "List H (Alternate 7)",
        "words": ["PEAR", "FERRY", "TOWER", "STREAM", "TOAST", "PIANO", "SHELF", "HAT", "PANDA", "DISH"],
        "mean_length": 4.7,
        "mean_syllables": 1.5
    }
}

# Image Recall: Pool of 24 distinct visual symbols with numeric IDs 1-24
IMAGE_SYMBOL_POOL: List[Dict[str, Any]] = [
    {"id": 1, "name": "sun", "emoji": "☀️"},
    {"id": 2, "name": "moon", "emoji": "🌙"},
    {"id": 3, "name": "star", "emoji": "⭐"},
    {"id": 4, "name": "cloud", "emoji": "☁️"},
    {"id": 5, "name": "fire", "emoji": "🔥"},
    {"id": 6, "name": "water", "emoji": "💧"},
    {"id": 7, "name": "leaf", "emoji": "🍃"},
    {"id": 8, "name": "flower", "emoji": "🌸"},
    {"id": 9, "name": "tree", "emoji": "🌲"},
    {"id": 10, "name": "bell", "emoji": "🔔"},
    {"id": 11, "name": "key", "emoji": "🔑"},
    {"id": 12, "name": "crown", "emoji": "👑"},
    {"id": 13, "name": "diamond", "emoji": "💎"},
    {"id": 14, "name": "anchor", "emoji": "⚓"},
    {"id": 15, "name": "umbrella", "emoji": "☂️"},
    {"id": 16, "name": "heart", "emoji": "❤️"},
    {"id": 17, "name": "music", "emoji": "🎵"},
    {"id": 18, "name": "book", "emoji": "📖"},
    {"id": 19, "name": "eye", "emoji": "👁️"},
    {"id": 20, "name": "compass", "emoji": "🧭"},
    {"id": 21, "name": "globe", "emoji": "🌍"},
    {"id": 22, "name": "camera", "emoji": "📷"},
    {"id": 23, "name": "lightbulb", "emoji": "💡"},
    {"id": 24, "name": "shield", "emoji": "🛡️"}
]

# Memory Match: Pool of 36 distinct icons
MEMORY_ICON_POOL: List[Dict[str, Any]] = [
    {"id": 1, "emoji": "🧠", "label": "brain"},
    {"id": 2, "emoji": "🧬", "label": "dna"},
    {"id": 3, "emoji": "💊", "label": "pill"},
    {"id": 4, "emoji": "🩺", "label": "stethoscope"},
    {"id": 5, "emoji": "🔬", "label": "microscope"},
    {"id": 6, "emoji": "🏥", "label": "hospital"},
    {"id": 7, "emoji": "🚑", "label": "ambulance"},
    {"id": 8, "emoji": "👨‍⚕️", "label": "doctor"},
    {"id": 9, "emoji": "🍎", "label": "apple"},
    {"id": 10, "emoji": "🚗", "label": "car"},
    {"id": 11, "emoji": "✈️", "label": "airplane"},
    {"id": 12, "emoji": "⛵", "label": "sailboat"},
    {"id": 13, "emoji": "🚀", "label": "rocket"},
    {"id": 14, "emoji": "🚲", "label": "bicycle"},
    {"id": 15, "emoji": "⚽", "label": "soccer"},
    {"id": 16, "emoji": "🏀", "label": "basketball"},
    {"id": 17, "emoji": "🎾", "label": "tennis"},
    {"id": 18, "emoji": "🎸", "label": "guitar"},
    {"id": 19, "emoji": "🎨", "label": "palette"},
    {"id": 20, "emoji": "📚", "label": "books"},
    {"id": 21, "emoji": "🌲", "label": "pine"},
    {"id": 22, "emoji": "🌸", "label": "blossom"},
    {"id": 23, "emoji": "🌻", "label": "sunflower"},
    {"id": 24, "emoji": "🐶", "label": "dog"},
    {"id": 25, "emoji": "🐱", "label": "cat"},
    {"id": 26, "emoji": "🦁", "label": "lion"},
    {"id": 27, "emoji": "🐘", "label": "elephant"},
    {"id": 28, "emoji": "🐬", "label": "dolphin"},
    {"id": 29, "emoji": "🦋", "label": "butterfly"},
    {"id": 30, "emoji": "⭐", "label": "star"},
    {"id": 31, "emoji": "☀️", "label": "sun"},
    {"id": 32, "emoji": "🌙", "label": "crescent"},
    {"id": 33, "emoji": "⚡", "label": "lightning"},
    {"id": 34, "emoji": "🔥", "label": "flame"},
    {"id": 35, "emoji": "💎", "label": "gem"},
    {"id": 36, "emoji": "🔑", "label": "key"}
]


def seeded_fisher_yates(items: List[Any], rng: random.Random) -> List[Any]:
    """Pure seeded Fisher-Yates shuffle."""
    arr = list(items)
    for i in range(len(arr) - 1, 0, -1):
        j = rng.randint(0, i)
        arr[i], arr[j] = arr[j], arr[i]
    return arr


def crypto_fisher_yates_shuffle(items: List[Any], seed: Optional[int] = None) -> List[Any]:
    rng = random.Random(seed) if seed is not None else random.SystemRandom()
    return seeded_fisher_yates(items, rng)


def get_next_word_list_form(recent_form_ids: List[str], seed: Optional[int] = None) -> str:
    """
    Selects a word list form from the pool of 8 matched forms (FORM_A .. FORM_H).
    Guarantees:
    1. Consecutive sessions NEVER repeat the same form: form_id[i] != form_id[i-1].
    2. No form repeats until ALL forms in the pool were used (exhaustion cycle before recycling).
    """
    all_forms = sorted(list(WORD_LIST_POOLS.keys()))
    pool_size = len(all_forms)  # 8

    rng = random.Random(seed) if seed is not None else random.SystemRandom()

    if not recent_form_ids:
        return rng.choice(all_forms)

    used_in_current_cycle = len(recent_form_ids) % pool_size

    if used_in_current_cycle == 0:
        # Full cycle just finished. All 8 forms are available again, EXCEPT the immediate previous one
        last_form = recent_form_ids[-1]
        available = [f for f in all_forms if f != last_form]
    else:
        # We are within a cycle. Available are all forms NOT yet used in this cycle
        current_cycle_forms = set(recent_form_ids[-used_in_current_cycle:])
        available = [f for f in all_forms if f not in current_cycle_forms]
        # In case the immediate last form was somehow available, exclude it
        if recent_form_ids[-1] in available:
            available.remove(recent_form_ids[-1])

    if not available:
        available = [f for f in all_forms if f != recent_form_ids[-1]]

    return rng.choice(available)


def generate_word_recall_stimuli(form_id: str, seed: int) -> Dict[str, Any]:
    """
    Deterministically generates five Word Recall stimuli from (form_id, seed).
    """
    form_data = WORD_LIST_POOLS.get(form_id, WORD_LIST_POOLS['FORM_A'])
    rng = random.Random(seed)

    base_words = list(form_data['words'])
    shuffled_words = seeded_fisher_yates(base_words, rng)[:5]

    # Distractor words from an alternate form
    all_forms = sorted(list(WORD_LIST_POOLS.keys()))
    other_forms = [f for f in all_forms if f != form_id]
    distractor_form_id = rng.choice(other_forms)
    distractor_pool = list(WORD_LIST_POOLS[distractor_form_id]['words'])
    shuffled_distractors = seeded_fisher_yates(distractor_pool, rng)[:5]

    return {
        "form_id": form_id,
        "seed": seed,
        "words": shuffled_words,
        "distractor_words": shuffled_distractors,
        "item_ids": shuffled_words  # Exact ordered words presented to user
    }


def generate_constrained_image_sequence(
    length: int = 5,
    seed: Optional[int] = None,
    subset_size: int = 10
) -> Tuple[List[Dict[str, Any]], int]:
    """
    Generates an Image Recall sequence with psychometric constraints:
    1. Sampled from a session-specific subset of the 24-symbol pool.
    2. Exact length fixed per difficulty (Easy=4, Medium=5, Hard=6).
    3. Rejects immediate repeats: candidate['id'] != prev['id'].
    4. Rejects strictly adjacent ids: |candidate['id'] - prev['id']| != 1.
    5. Rejects any run of 3 or more strictly ascending or strictly descending ids:
       reject if id[i-2] < id[i-1] < id[i] or id[i-2] > id[i-1] > id[i].
    """
    if seed is None:
        seed = secrets.randbelow(1_000_000_000)

    rng = random.Random(seed)
    # Pick a rotating subset from the 24-symbol pool
    available_subset = rng.sample(IMAGE_SYMBOL_POOL, min(subset_size, len(IMAGE_SYMBOL_POOL)))

    sequence: List[Dict[str, Any]] = []
    max_attempts = 1000

    for pos in range(length):
        valid = False
        attempts = 0
        candidate = None

        while not valid and attempts < max_attempts:
            attempts += 1
            candidate = rng.choice(available_subset)

            if len(sequence) == 0:
                valid = True
                break

            prev = sequence[-1]

            # Constraint 1: Reject immediate repeats
            if candidate['id'] == prev['id']:
                continue

            # Constraint 2: Reject strictly adjacent IDs
            if abs(candidate['id'] - prev['id']) == 1:
                continue

            # Constraint 3: Reject runs of 3 or more strictly ascending or strictly descending IDs
            if len(sequence) >= 2:
                p2 = sequence[-2]
                if p2['id'] < prev['id'] < candidate['id']:
                    continue  # strictly ascending run of 3
                if p2['id'] > prev['id'] > candidate['id']:
                    continue  # strictly descending run of 3

            valid = True

        if not valid or candidate is None:
            # Deterministic fallback strictly respecting non-adjacent and non-monotonic run rules
            safe_choices = [
                s for s in available_subset
                if (len(sequence) == 0 or (s['id'] != sequence[-1]['id'] and abs(s['id'] - sequence[-1]['id']) != 1))
                and (len(sequence) < 2 or not (sequence[-2]['id'] < sequence[-1]['id'] < s['id']))
                and (len(sequence) < 2 or not (sequence[-2]['id'] > sequence[-1]['id'] > s['id']))
            ]
            if not safe_choices:
                safe_choices = [
                    s for s in available_subset
                    if len(sequence) == 0 or s['id'] != sequence[-1]['id']
                ]
            candidate = safe_choices[0] if safe_choices else available_subset[0]

        sequence.append(candidate)

    return sequence, seed


def generate_image_recall_stimuli(difficulty: str, seed: int) -> Dict[str, Any]:
    """
    Deterministically generates Image Recall stimuli from (difficulty, seed).
    """
    span_length = 4 if difficulty == 'easy' else (6 if difficulty == 'hard' else 5)
    sequence, _ = generate_constrained_image_sequence(length=span_length, seed=seed)
    item_ids = [s['name'] for s in sequence]

    rng = random.Random(seed + 101)
    
    # In recall phase, available choices must be distinct symbols:
    # Distinct symbols from sequence + distinct distractors from pool (shuffled)
    seq_distinct = []
    seen_ids = set()
    for s in sequence:
        if s['id'] not in seen_ids:
            seen_ids.add(s['id'])
            seq_distinct.append(s)

    other_symbols = [s for s in IMAGE_SYMBOL_POOL if s['id'] not in seen_ids]
    distractor_count = max(3, 8 - len(seq_distinct))
    distractors = rng.sample(other_symbols, min(distractor_count, len(other_symbols)))

    combined = seq_distinct + distractors
    available_choices = seeded_fisher_yates(combined, rng)

    return {
        "difficulty": difficulty,
        "seed": seed,
        "sequence": sequence,
        "item_ids": item_ids,
        "available_choices": available_choices
    }


def generate_memory_match_stimuli(grid_size: str, seed: int) -> Dict[str, Any]:
    """
    Deterministically generates Memory Match board layout from (grid_size, seed).
    Cards are positioned with exact position indices 0..N-1.
    item_ids stores the exact ordered sequence of card emojis across all positions.
    """
    pair_count = 6 if grid_size == 'small' else 8
    rng = random.Random(seed)

    # 1. Sample distinct icon subset
    selected_icons = rng.sample(MEMORY_ICON_POOL, pair_count)
    selected_emojis = [icon['emoji'] for icon in selected_icons]

    # 2. Build 2*pair_count cards
    card_pairs = []
    for pair_idx, icon in enumerate(selected_icons):
        card_pairs.append({"pairId": pair_idx, "emoji": icon['emoji']})
        card_pairs.append({"pairId": pair_idx, "emoji": icon['emoji']})

    # 3. Deterministic seeded Fisher-Yates shuffle
    shuffled = seeded_fisher_yates(card_pairs, rng)

    # 4. Assign fixed board positions
    cards = []
    ordered_emojis = []
    for pos, card in enumerate(shuffled):
        card_obj = {
            "id": pos,
            "position": pos,
            "pairId": card["pairId"],
            "emoji": card["emoji"]
        }
        cards.append(card_obj)
        ordered_emojis.append(card["emoji"])

    return {
        "grid_size": grid_size,
        "pair_count": pair_count,
        "seed": seed,
        "selected_icons": selected_emojis,
        "cards": cards,
        "item_ids": ordered_emojis  # Exact ordered positions on the board
    }


def generate_reaction_time_isi_sequence(
    num_practice: int = 5,
    num_test: int = 20,
    min_isi_ms: int = 1000,
    max_isi_ms: int = 3000,
    seed: Optional[int] = None
) -> Tuple[List[int], List[int], int]:
    if seed is None:
        seed = secrets.randbelow(1_000_000_000)

    rng = random.Random(seed)
    practice_isis = [rng.randint(min_isi_ms, max_isi_ms) for _ in range(num_practice)]
    test_isis = [rng.randint(min_isi_ms, max_isi_ms) for _ in range(num_test)]
    return practice_isis, test_isis, seed


def generate_reaction_time_stimuli(
    num_practice: int = 5,
    num_test: int = 20,
    seed: Optional[int] = None
) -> Dict[str, Any]:
    practice_isis, test_isis, used_seed = generate_reaction_time_isi_sequence(
        num_practice=num_practice, num_test=num_test, seed=seed
    )
    all_isis = practice_isis + test_isis
    item_ids = [f"ISI_{ms}ms" for ms in all_isis]
    return {
        "seed": used_seed,
        "practice_isis": practice_isis,
        "test_isis": test_isis,
        "item_ids": item_ids
    }


def regenerate_session_stimuli(game: str, form_id: str, seed: int, extra_params: Optional[Dict[str, Any]] = None) -> List[Any]:
    """
    Deterministically regenerates exact ordered item_ids for any game from (game, form_id, seed).
    Used to guarantee 100% stimulus auditability and longitudinal reproducibility.
    """
    params = extra_params or {}
    if game == 'Word Recall':
        res = generate_word_recall_stimuli(form_id, seed)
        return res["item_ids"]
    elif game == 'Image Recall':
        difficulty = params.get('difficulty', 'medium')
        res = generate_image_recall_stimuli(difficulty, seed)
        return res["item_ids"]
    elif game == 'Memory Match':
        grid_size = params.get('grid_size') or params.get('gridSize', 'small')
        res = generate_memory_match_stimuli(grid_size, seed)
        return res["item_ids"]
    elif game == 'Reaction Time':
        num_practice = params.get('num_practice', 5)
        num_test = params.get('num_test', 20)
        res = generate_reaction_time_stimuli(num_practice, num_test, seed)
        return res["item_ids"]
    return []
