from cognitive_data import WORD_LIST_POOLS

# Accurate syllable count dictionary for the 80 words across forms
SYLLABLE_MAP = {
    # Form A
    "APPLE": 2, "TRAIN": 1, "HOUSE": 1, "RIVER": 2, "BREAD": 1,
    "CLOCK": 1, "CHAIR": 1, "SHIRT": 1, "HORSE": 1, "SPOON": 1,
    # Form B
    "LEMON": 2, "TRUCK": 1, "CABIN": 2, "OCEAN": 2, "FLOUR": 1,
    "WATCH": 1, "TABLE": 2, "SHOES": 1, "TIGER": 2, "FORK": 1,
    # Form C
    "PEACH": 1, "PLANE": 1, "HOTEL": 2, "BROOK": 1, "SUGAR": 2,
    "RADIO": 3, "BENCH": 1, "BOOTS": 1, "ZEBRA": 2, "KNIFE": 1,
    # Form D
    "MELON": 2, "BOAT": 1, "LODGE": 1, "CREEK": 1, "HONEY": 2,
    "PHONE": 1, "STOOL": 1, "SOCKS": 1, "CAMEL": 2, "PLATE": 1,
    # Form E
    "GRAPE": 1, "MOTOR": 2, "CASTLE": 2, "CANAL": 2, "BUTTER": 2,
    "BELL": 1, "SOFA": 2, "GLOVE": 1, "SHEEP": 1, "BOWL": 1,
    # Form F
    "BERRY": 2, "METRO": 2, "VILLA": 2, "LAKE": 1, "CHEESE": 1,
    "TORCH": 1, "DESK": 1, "COAT": 1, "EAGLE": 2, "GLASS": 1,
    # Form G
    "CHERRY": 2, "BUS": 1, "MANOR": 2, "POND": 1, "CANDY": 2,
    "LAMP": 1, "COUCH": 1, "SCARF": 1, "ROBIN": 2, "CUP": 1,
    # Form H
    "PEAR": 1, "FERRY": 2, "TOWER": 2, "STREAM": 1, "TOAST": 1,
    "PIANO": 3, "SHELF": 1, "HAT": 1, "PANDA": 2, "DISH": 1
}

def analyze_lists():
    print("| Form | Form Name | Mean Word Length | Mean Syllables | Words |")
    print("|---|---|---|---|---|")
    for form_id, form_data in sorted(WORD_LIST_POOLS.items()):
        words = form_data["words"]
        lengths = [len(w) for w in words]
        syllables = [SYLLABLE_MAP.get(w, 1) for w in words]
        mean_len = sum(lengths) / len(lengths)
        mean_syl = sum(syllables) / len(syllables)
        words_str = ", ".join(words)
        print(f"| {form_id} | {form_data['name']} | {mean_len:.2f} letters | {mean_syl:.2f} syllables | {words_str} |")

if __name__ == "__main__":
    analyze_lists()
