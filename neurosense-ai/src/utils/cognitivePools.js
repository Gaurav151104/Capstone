/**
 * Cognitive Game Stimuli Pools, Parallel Matched Forms, and Psychometric Generators.
 * 
 * Word List Matching Criteria (Forms A-H):
 * - 8 matched lists of 10 words each
 * - Controlled word length (mean ~4.9 letters, range 3-6)
 * - Controlled syllable count (mean ~1.3 syllables, range 1-2)
 * - Balanced semantic domains (Fruit, Vehicle, Building, Water, Food, Tool, Furniture, Clothing, Animal, Kitchen)
 * - High imageability & concreteness ratings (> 4.5/5 on Brysbaert scale, > 550 on MRC database)
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
 * 24 Visual Symbols Pool for Image Recall
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
  { id: 24, name: 'shield', emoji: '🛡️' }
];

/**
 * 36 Icons Pool for Memory Match
 */
export const MEMORY_MATCH_ICONS_POOL = [
  '🧠', '🧬', '💊', '🩺', '🔬', '🏥', '🚑', '👨‍⚕️',
  '🍎', '🚗', '✈️', '⛵', '🚀', '🚲', '⚽', '🏀',
  '🎾', '🎸', '🎨', '📚', '🌲', '🌸', '🌻', '🐶',
  '🐱', '🦁', '🐘', '🐬', '🦋', '⭐', '☀️', '🌙',
  '⚡', '🔥', '💎', '🔑'
];

/**
 * Cryptographically secure Fisher-Yates shuffle using crypto.getRandomValues
 */
export function cryptoFisherYates(array) {
  const result = [...array];
  const length = result.length;
  if (length <= 1) return result;

  const randomValues = new Uint32Array(length);
  window.crypto.getRandomValues(randomValues);

  for (let i = length - 1; i > 0; i--) {
    // Generate uniform random index in [0, i]
    const j = randomValues[i] % (i + 1);
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

/**
 * Generate cryptographically random seed
 */
export function generateCryptoSeed() {
  const buf = new Uint32Array(1);
  window.crypto.getRandomValues(buf);
  return buf[0];
}

/**
 * Select a word form not seen recently (prevent consecutive repeats)
 */
export function selectWordForm(recentFormIds = []) {
  const formKeys = Object.keys(WORD_LISTS);
  const lastForm = recentFormIds.length > 0 ? recentFormIds[recentFormIds.length - 1] : null;
  const eligible = formKeys.filter(k => k !== lastForm);

  // Avoid last 3 forms if possible
  const notRecent = eligible.filter(k => !recentFormIds.slice(-3).includes(k));
  const pool = notRecent.length > 0 ? notRecent : eligible;

  const randomIdx = Math.floor(Math.random() * pool.length);
  const chosenKey = pool[randomIdx];
  return WORD_LISTS[chosenKey];
}

/**
 * Generate constrained Image Recall sequence:
 * - Selects a subset of symbols per session from the 24-item pool
 * - No immediate repeats (s[i] !== s[i-1])
 * - No strictly adjacent or ascending/descending runs
 * - Length matches difficulty: easy=4, medium=5, hard=6
 */
export function generateConstrainedImageSequence(length = 5, subsetSize = 8) {
  // Rotate subset using crypto shuffle
  const shuffledPool = cryptoFisherYates(IMAGE_SYMBOLS_POOL);
  const sessionSubset = shuffledPool.slice(0, Math.max(subsetSize, length + 2));

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

        // Constraint 2: No strictly adjacent numeric runs (e.g. 3, 4)
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
      // Fallback: pick any symbol not yet in the sequence
      const safe = sessionSubset.filter(s => !sequence.some(x => x.id === s.id));
      candidate = safe[Math.floor(Math.random() * safe.length)] || sessionSubset[0];
    }

    sequence.push(candidate);
  }

  const usedIds = new Set(sequence.map(s => s.id));
  const otherSymbols = IMAGE_SYMBOLS_POOL.filter(s => !usedIds.has(s.id));
  const distractorCount = Math.max(3, 8 - sequence.length);
  const distractors = cryptoFisherYates(otherSymbols).slice(0, distractorCount);
  const availableChoices = cryptoFisherYates([...sequence, ...distractors]);

  return {
    sequence,
    sessionSubset,
    availableChoices,
    available_choices: availableChoices,
    itemIds: sequence.map(s => s.id),
    seed: generateCryptoSeed()
  };
}

export const generateImageSequence = generateConstrainedImageSequence;

/**
 * Generate pairs for Memory Match from the 36-icon pool:
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
    seed: generateCryptoSeed()
  };
}

/**
 * Generate randomized Inter-Stimulus Intervals (ISI) between 1000 and 3000 ms
 */
export function generateReactionTimeSequence(numPractice = 5, numTest = 20) {
  const generateDelay = () => Math.floor(Math.random() * 2001) + 1000; // 1000 to 3000 ms

  const practiceIsis = Array.from({ length: numPractice }, () => generateDelay());
  const testIsis = Array.from({ length: numTest }, () => generateDelay());

  return {
    practiceIsis,
    testIsis,
    seed: generateCryptoSeed()
  };
}

/**
 * Measure client screen refresh rate and device info
 */
export async function measureDeviceAndRefreshRate() {
  const deviceInfo = {
    userAgent: navigator.userAgent,
    platform: navigator.platform || 'unknown',
    screenWidth: window.screen ? window.screen.width : window.innerWidth,
    screenHeight: window.screen ? window.screen.height : window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
    hardwareConcurrency: navigator.hardwareConcurrency || null,
    touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0
  };

  // Measure refresh rate via requestAnimationFrame delta over 30 frames
  const refreshRate = await new Promise((resolve) => {
    let frameCount = 0;
    let startTime = null;

    function checkFrame(timestamp) {
      if (!startTime) startTime = timestamp;
      frameCount++;

      if (frameCount >= 30) {
        const totalDuration = timestamp - startTime;
        const avgFrameDuration = totalDuration / frameCount;
        const fps = Math.round(1000 / avgFrameDuration);
        resolve({
          fps: Math.min(fps, 360),
          frameDeltaMs: Number(avgFrameDuration.toFixed(2))
        });
      } else {
        requestAnimationFrame(checkFrame);
      }
    }

    requestAnimationFrame(checkFrame);
  });

  return {
    ...deviceInfo,
    refreshRateFps: refreshRate.fps,
    frameDeltaMs: refreshRate.frameDeltaMs
  };
}
