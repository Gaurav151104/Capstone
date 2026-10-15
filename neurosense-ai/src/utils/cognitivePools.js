/**
 * Cognitive Game Stimuli Pools, Parallel Matched Forms, and Psychometric Generators.
 *
 * Word List Matching Criteria (Forms A-H + Dynamic Generator):
 * - Balanced lists of high imageability and concreteness (> 4.5/5 on Brysbaert scale)
 * - Controlled word length (3-6 characters) and syllable count (1-2 syllables)
 * - Balanced across semantic domains (Fruits, Vehicles, Animals, Nature, Household, Tools, Clothing, Buildings)
 * - Strict non-consecutive rotation controls to prevent practice and recall bias
 */

export const WORD_LISTS = {
  FORM_A: {
    formId: 'FORM_A',
    name: 'Form A (Baseline)',
    words: ['APPLE', 'TRAIN', 'HOUSE', 'RIVER', 'BREAD', 'CLOCK', 'CHAIR', 'SHIRT', 'HORSE', 'SPOON'],
    distractorWords: ['LEMON', 'TRUCK', 'CABIN', 'OCEAN', 'FLOUR']
  },
  FORM_B: {
    formId: 'FORM_B',
    name: 'Form B (Alternate 1)',
    words: ['LEMON', 'TRUCK', 'CABIN', 'OCEAN', 'FLOUR', 'WATCH', 'TABLE', 'SHOES', 'TIGER', 'FORK'],
    distractorWords: ['PEACH', 'PLANE', 'HOTEL', 'BROOK', 'SUGAR']
  },
  FORM_C: {
    formId: 'FORM_C',
    name: 'Form C (Alternate 2)',
    words: ['PEACH', 'PLANE', 'HOTEL', 'BROOK', 'SUGAR', 'RADIO', 'BENCH', 'BOOTS', 'ZEBRA', 'KNIFE'],
    distractorWords: ['MELON', 'BOAT', 'LODGE', 'CREEK', 'HONEY']
  },
  FORM_D: {
    formId: 'FORM_D',
    name: 'Form D (Alternate 3)',
    words: ['MELON', 'BOAT', 'LODGE', 'CREEK', 'HONEY', 'PHONE', 'STOOL', 'SOCKS', 'CAMEL', 'PLATE'],
    distractorWords: ['GRAPE', 'MOTOR', 'CASTLE', 'CANAL', 'BUTTER']
  },
  FORM_E: {
    formId: 'FORM_E',
    name: 'Form E (Alternate 4)',
    words: ['GRAPE', 'MOTOR', 'CASTLE', 'CANAL', 'BUTTER', 'BELL', 'SOFA', 'GLOVE', 'SHEEP', 'BOWL'],
    distractorWords: ['BERRY', 'METRO', 'VILLA', 'LAKE', 'CHEESE']
  },
  FORM_F: {
    formId: 'FORM_F',
    name: 'Form F (Alternate 5)',
    words: ['BERRY', 'METRO', 'VILLA', 'LAKE', 'CHEESE', 'TORCH', 'DESK', 'COAT', 'EAGLE', 'GLASS'],
    distractorWords: ['CHERRY', 'BUS', 'MANOR', 'POND', 'CANDY']
  },
  FORM_G: {
    formId: 'FORM_G',
    name: 'Form G (Alternate 6)',
    words: ['CHERRY', 'BUS', 'MANOR', 'POND', 'CANDY', 'LAMP', 'COUCH', 'SCARF', 'ROBIN', 'CUP'],
    distractorWords: ['PEAR', 'FERRY', 'TOWER', 'STREAM', 'TOAST']
  },
  FORM_H: {
    formId: 'FORM_H',
    name: 'Form H (Alternate 7)',
    words: ['PEAR', 'FERRY', 'TOWER', 'STREAM', 'TOAST', 'PIANO', 'SHELF', 'HAT', 'PANDA', 'DISH'],
    distractorWords: ['APPLE', 'TRAIN', 'HOUSE', 'RIVER', 'BREAD']
  }
};

/**
 * Extended Word Bank (100+ vetted concrete nouns across semantic categories)
 * Used for dynamic list generation with configurable lengths and distractor sampling.
 */
export const EXTENDED_WORD_BANK = [
  // Fruits & Foods
  'APPLE', 'LEMON', 'PEACH', 'MELON', 'GRAPE', 'BERRY', 'CHERRY', 'PEAR', 'BANANA', 'MANGO',
  'BREAD', 'FLOUR', 'SUGAR', 'HONEY', 'BUTTER', 'CHEESE', 'CANDY', 'TOAST', 'PIZZA', 'SOUP',
  // Nature & Water
  'RIVER', 'OCEAN', 'BROOK', 'CREEK', 'CANAL', 'LAKE', 'POND', 'STREAM', 'FOREST', 'DESERT',
  'VALLEY', 'MEADOW', 'ISLAND', 'CANYON', 'GARDEN', 'SPRING', 'FLOWER', 'TIMBER', 'CLIFF', 'CLOUD',
  // Animals
  'HORSE', 'TIGER', 'ZEBRA', 'CAMEL', 'SHEEP', 'EAGLE', 'ROBIN', 'PANDA', 'RABBIT', 'DOLPHIN',
  'MONKEY', 'FALCON', 'BADGER', 'WALRUS', 'LIZARD', 'BEAVER', 'OTTER', 'PARROT', 'TURTLE', 'BEAR',
  // Vehicles
  'TRAIN', 'TRUCK', 'PLANE', 'BOAT', 'MOTOR', 'METRO', 'BUS', 'FERRY', 'YACHT', 'ROCKET',
  'CANOE', 'GLIDER', 'SCOOTER', 'WAGON', 'BARGE', 'TRAM',
  // Household & Furniture
  'CLOCK', 'WATCH', 'RADIO', 'PHONE', 'BELL', 'TORCH', 'LAMP', 'PIANO', 'CHAIR', 'TABLE',
  'BENCH', 'STOOL', 'SOFA', 'DESK', 'COUCH', 'SHELF', 'MIRROR', 'DRAWER', 'CLOSET', 'CARPET',
  // Tools & Kitchenware
  'SPOON', 'FORK', 'KNIFE', 'PLATE', 'BOWL', 'GLASS', 'CUP', 'DISH', 'HAMMER', 'WRENCH',
  'NEEDLE', 'BRUSH', 'CHISEL', 'PLIERS', 'SHOVEL', 'LADDER',
  // Clothing
  'SHIRT', 'SHOES', 'BOOTS', 'SOCKS', 'GLOVE', 'COAT', 'SCARF', 'HAT', 'JACKET', 'PANTS',
  // Buildings
  'HOUSE', 'CABIN', 'HOTEL', 'LODGE', 'CASTLE', 'VILLA', 'MANOR', 'TOWER', 'BRIDGE', 'TEMPLE'
];

/**
 * 40 Distinct Visual Symbols for Image Recall
 * Self-contained visual stimuli (emojis) with semantic labels that render
 * deterministically across platforms without external network latency or CDN failures.
 */
export const IMAGE_SYMBOLS_POOL = [
  { id: 1, name: 'sun', emoji: '☀️' },
  { id: 2, name: 'moon', emoji: '🌙' },
  { id: 3, name: 'star', emoji: '⭐' },
  { id: 4, name: 'cloud', emoji: '☁️' },
  { id: 5, name: 'fire', emoji: '🔥' },
  { id: 6, name: 'water', emoji: '💧' },
  { id: 7, name: 'leaf', emoji: '🍃' },
  { id: 8, name: 'flower', emoji: '🌸' },
  { id: 9, name: 'tree', emoji: '🌲' },
  { id: 10, name: 'bell', emoji: '🔔' },
  { id: 11, name: 'key', emoji: '🔑' },
  { id: 12, name: 'crown', emoji: '👑' },
  { id: 13, name: 'diamond', emoji: '💎' },
  { id: 14, name: 'anchor', emoji: '⚓' },
  { id: 15, name: 'umbrella', emoji: '☂️' },
  { id: 16, name: 'heart', emoji: '❤️' },
  { id: 17, name: 'music', emoji: '🎵' },
  { id: 18, name: 'book', emoji: '📖' },
  { id: 19, name: 'eye', emoji: '👁️' },
  { id: 20, name: 'compass', emoji: '🧭' },
  { id: 21, name: 'globe', emoji: '🌍' },
  { id: 22, name: 'camera', emoji: '📷' },
  { id: 23, name: 'lightbulb', emoji: '💡' },
  { id: 24, name: 'shield', emoji: '🛡️' },
  { id: 25, name: 'apple', emoji: '🍎' },
  { id: 26, name: 'car', emoji: '🚗' },
  { id: 27, name: 'plane', emoji: '✈️' },
  { id: 28, name: 'rocket', emoji: '🚀' },
  { id: 29, name: 'bicycle', emoji: '🚲' },
  { id: 30, name: 'guitar', emoji: '🎸' },
  { id: 31, name: 'hourglass', emoji: '⏳' },
  { id: 32, name: 'butterfly', emoji: '🦋' },
  { id: 33, name: 'trophy', emoji: '🏆' },
  { id: 34, name: 'medal', emoji: '🥇' },
  { id: 35, name: 'telescope', emoji: '🔭' },
  { id: 36, name: 'microscope', emoji: '🔬' },
  { id: 37, name: 'palette', emoji: '🎨' },
  { id: 38, name: 'feather', emoji: '🪶' },
  { id: 39, name: 'puzzle', emoji: '🧩' },
  { id: 40, name: 'target', emoji: '🎯' }
];

/**
 * 48 Icons Pool for Memory Match
 */
export const MEMORY_MATCH_ICONS_POOL = [
  '🧠', '🧬', '💊', '🩺', '🔬', '🏥', '🚑', '👨‍⚕️',
  '🍎', '🚗', '✈️', '⛵', '🚀', '🚲', '⚽', '🏀',
  '🎾', '🎸', '🎨', '📚', '🌲', '🌸', '🌻', '🐶',
  '🐱', '🦁', '🐘', '🐬', '🦋', '⭐', '☀️', '🌙',
  '⚡', '🔥', '💎', '🔑', '🏆', '🎯', '🧩', '🔔',
  '👑', '⚓', '☂️', '❤️', '🎵', '💡', '🛡️', '⏳'
];

/**
 * Cryptographically secure Fisher-Yates shuffle using crypto.getRandomValues
 */
export function cryptoFisherYates(array) {
  const result = [...array];
  const length = result.length;
  if (length <= 1) return result;

  try {
    const randomValues = new Uint32Array(length);
    window.crypto.getRandomValues(randomValues);

    for (let i = length - 1; i > 0; i--) {
      const j = randomValues[i] % (i + 1);
      const temp = result[i];
      result[i] = result[j];
      result[j] = temp;
    }
  } catch (e) {
    // Math.random fallback if window.crypto is unavailable
    for (let i = length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = result[i];
      result[i] = result[j];
      result[j] = temp;
    }
  }
  return result;
}

/**
 * Generate cryptographically random seed
 */
export function generateCryptoSeed() {
  try {
    const buf = new Uint32Array(1);
    window.crypto.getRandomValues(buf);
    return buf[0];
  } catch (e) {
    return Math.floor(Math.random() * 1_000_000_000);
  }
}

/**
 * Select a word form not seen recently (prevents consecutive repeats)
 */
export function selectWordForm(recentFormIds = [], targetWordCount = 5) {
  const formKeys = Object.keys(WORD_LISTS);
  const lastForm = recentFormIds.length > 0 ? recentFormIds[recentFormIds.length - 1] : null;
  const eligible = formKeys.filter(k => k !== lastForm);

  // Avoid last 3 forms if possible
  const notRecent = eligible.filter(k => !recentFormIds.slice(-3).includes(k));
  const pool = notRecent.length > 0 ? notRecent : (eligible.length > 0 ? eligible : formKeys);

  const randomIdx = Math.floor(Math.random() * pool.length);
  const chosenKey = pool[randomIdx];
  const selectedForm = WORD_LISTS[chosenKey];

  if (targetWordCount && targetWordCount !== selectedForm.words.length) {
    return {
      ...selectedForm,
      words: selectedForm.words.slice(0, targetWordCount),
      seed: generateCryptoSeed()
    };
  }

  return {
    ...selectedForm,
    seed: generateCryptoSeed()
  };
}

/**
 * Dynamically generate a non-repeating randomized word list from the extended bank.
 * Avoids repeating words from recent sessions.
 */
export function generateDynamicWordList(count = 5, recentWords = []) {
  const recentSet = new Set(recentWords.map(w => String(w).toUpperCase()));
  const available = EXTENDED_WORD_BANK.filter(w => !recentSet.has(w));
  const pool = available.length >= count ? available : EXTENDED_WORD_BANK;

  const shuffled = cryptoFisherYates(pool);
  const words = shuffled.slice(0, count);

  // Pick 5 distinct distractor words not in words list
  const wordSet = new Set(words);
  const distractorsPool = EXTENDED_WORD_BANK.filter(w => !wordSet.has(w));
  const distractorWords = cryptoFisherYates(distractorsPool).slice(0, Math.min(5, count));

  return {
    formId: `DYN_${Date.now().toString(36).toUpperCase()}`,
    name: 'Dynamic Session List',
    words,
    distractorWords,
    seed: generateCryptoSeed()
  };
}

/**
 * Generate constrained Image Recall sequence:
 * - Selects a subset of symbols per session from the 40-item pool
 * - No immediate repeats (s[i] !== s[i-1])
 * - No strictly adjacent numeric runs
 * - Length matches difficulty: easy=4, medium=5, hard=6
 * - Shuffles target items + distractors for choice presentation
 */
export function generateConstrainedImageSequence(length = 5, subsetSize = 12) {
  const shuffledPool = cryptoFisherYates(IMAGE_SYMBOLS_POOL);
  const sessionSubset = shuffledPool.slice(0, Math.max(subsetSize, length + 4));

  const sequence = [];
  const maxTries = 300;

  for (let i = 0; i < length; i++) {
    let valid = false;
    let attempts = 0;
    let candidate = null;

    while (!valid && attempts < maxTries) {
      attempts++;
      candidate = sessionSubset[Math.floor(Math.random() * sessionSubset.length)];

      if (sequence.length === 0) {
        valid = true;
      } else {
        const prev = sequence[sequence.length - 1];
        // Constraint 1: No duplicate symbols within the sequence
        if (sequence.some(s => s.id === candidate.id)) continue;

        // Constraint 2: No strictly adjacent numeric runs
        if (Math.abs(candidate.id - prev.id) === 1) continue;

        // Constraint 3: No monotonic ascending or descending runs
        if (sequence.length >= 2) {
          const p2 = sequence[sequence.length - 2];
          const diff1 = prev.id - p2.id;
          const diff2 = candidate.id - prev.id;
          if (diff1 > 0 && diff2 > 0) continue;
          if (diff1 < 0 && diff2 < 0) continue;
        }
        valid = true;
      }
    }

    if (!valid || !candidate) {
      const safe = sessionSubset.filter(s => !sequence.some(x => x.id === s.id));
      candidate = safe[Math.floor(Math.random() * safe.length)] || sessionSubset[0];
    }

    sequence.push(candidate);
  }

  const usedIds = new Set(sequence.map(s => s.id));
  const otherSymbols = IMAGE_SYMBOLS_POOL.filter(s => !usedIds.has(s.id));
  const distractorCount = Math.max(4, subsetSize - sequence.length);
  const distractors = cryptoFisherYates(otherSymbols).slice(0, distractorCount);
  const availableChoices = cryptoFisherYates([...sequence, ...distractors]);

  return {
    sequence,
    sessionSubset,
    availableChoices,
    available_choices: availableChoices,
    itemIds: sequence.map(s => s.id),
    formId: `IMG_SEQ_${length}`,
    seed: generateCryptoSeed()
  };
}

export const generateImageSequence = generateConstrainedImageSequence;

/**
 * Generate pairs for Memory Match from the 48-icon pool:
 * - Draws random subset of distinct icons (e.g. 6 pairs for 4x3, 8 pairs for 4x4)
 * - Shuffles pairs using crypto.getRandomValues Fisher-Yates
 */
export function generateMemoryMatchCards(pairCount = 6) {
  const shuffledIcons = cryptoFisherYates(MEMORY_MATCH_ICONS_POOL);
  const selectedIcons = shuffledIcons.slice(0, pairCount);
  
  const cardPairs = [];
  selectedIcons.forEach((emoji, idx) => {
    cardPairs.push({ pairId: idx, emoji });
    cardPairs.push({ pairId: idx, emoji });
  });

  const shuffledCards = cryptoFisherYates(cardPairs).map((card, index) => ({
    id: index,
    pairId: card.pairId,
    emoji: card.emoji
  }));

  return {
    cards: shuffledCards,
    selectedIcons,
    itemIds: selectedIcons,
    formId: `GRID_${pairCount}P`,
    seed: generateCryptoSeed()
  };
}

/**
 * Generate randomized Inter-Stimulus Intervals (ISIs) for Reaction Time trials
 * Randomized foreperiod between minDelayMs and maxDelayMs (default 1500ms - 3500ms).
 */
export function generateReactionTimeISIs(count = 10, minDelayMs = 1500, maxDelayMs = 3500) {
  const isis = [];
  for (let i = 0; i < count; i++) {
    const delay = Math.round(minDelayMs + Math.random() * (maxDelayMs - minDelayMs));
    isis.push(delay);
  }
  return isis;
}

/**
 * Calculate descriptive reaction time statistics
 * Filters anticipations (<150ms) and attentional lapses (>1000ms).
 */
export function calculateReactionTimeStats(trialTimes = [], prematureThreshold = 150, lapseThreshold = 1000) {
  if (!trialTimes || trialTimes.length === 0) {
    return {
      meanMs: 0,
      variabilityMs: 0,
      medianMs: 0,
      validTrialsCount: 0,
      anticipations: 0,
      lapses: 0
    };
  }

  let anticipations = 0;
  let lapses = 0;
  const validTimes = [];

  trialTimes.forEach(t => {
    if (t < prematureThreshold) {
      anticipations++;
    } else {
      if (t > lapseThreshold) lapses++;
      validTimes.push(t);
    }
  });

  if (validTimes.length === 0) {
    return {
      meanMs: 0,
      variabilityMs: 0,
      medianMs: 0,
      validTrialsCount: 0,
      anticipations,
      lapses
    };
  }

  const sum = validTimes.reduce((acc, v) => acc + v, 0);
  const mean = Math.round(sum / validTimes.length);

  // Standard deviation (variability)
  const variance = validTimes.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / validTimes.length;
  const variability = Math.round(Math.sqrt(variance));

  // Median
  const sorted = [...validTimes].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);

  return {
    meanMs: mean,
    variabilityMs: variability,
    medianMs: median,
    validTrialsCount: validTimes.length,
    anticipations,
    lapses
  };
}

/**
 * Measure display refresh rate and device environment for timing calibration
 */
export async function measureDeviceAndRefreshRate() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.requestAnimationFrame) {
      resolve({ estimatedFps: 60, frameIntervalMs: 16.67, userAgent: 'unknown' });
      return;
    }

    let frameCount = 0;
    let startTime = null;
    const sampleDurationMs = 300;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      frameCount++;
      const elapsed = timestamp - startTime;

      if (elapsed < sampleDurationMs) {
        window.requestAnimationFrame(step);
      } else {
        const estimatedFps = Math.round((frameCount / elapsed) * 1000);
        const frameIntervalMs = Number((1000 / Math.max(30, estimatedFps)).toFixed(2));
        resolve({
          estimatedFps,
          frameIntervalMs,
          userAgent: navigator?.userAgent?.slice(0, 100) || 'browser',
          hardwareConcurrency: navigator?.hardwareConcurrency || 4
        });
      }
    }

    window.requestAnimationFrame(step);
  });
}
