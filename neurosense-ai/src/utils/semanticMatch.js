/**
 * Utility for fuzzy/near-match string comparison in cognitive recall tasks.
 * Tolerates minor typos, casing, and punctuation so users aren't unfairly penalized.
 */

export function cleanString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/gi, '');
}

/**
 * Calculates standard Levenshtein distance between two strings.
 */
export function levenshteinDistance(a, b) {
  const s1 = cleanString(a);
  const s2 = cleanString(b);

  const matrix = [];

  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[s2.length][s1.length];
}

/**
 * Checks if candidate word matches target word within an acceptable typo tolerance.
 */
export function isFuzzyMatch(candidate, target, similarityThreshold = 0.72) {
  const c = cleanString(candidate);
  const t = cleanString(target);

  if (!c || !t) return false;
  if (c === t) return true;

  const maxLen = Math.max(c.length, t.length);
  if (maxLen <= 3) {
    return c === t; // Short words require exact match
  }

  const distance = levenshteinDistance(c, t);
  if (distance <= 1 && maxLen >= 4) return true;
  if (distance <= 2 && maxLen >= 7) return true;

  const similarity = 1 - distance / maxLen;
  return similarity >= similarityThreshold;
}

/**
 * Evaluates a list of recalled words against a target list.
 * Returns { matches: [], unmatched: [], scorePercent: number }
 */
export function matchWordList(userInputWords, targetWords) {
  const targets = [...targetWords];
  const matchedTargets = new Set();
  const matchedInputs = [];

  const tokens = Array.isArray(userInputWords) 
    ? userInputWords 
    : userInputWords.split(/[\s,]+/).filter(Boolean);

  for (const token of tokens) {
    for (const target of targets) {
      if (!matchedTargets.has(target) && isFuzzyMatch(token, target)) {
        matchedTargets.add(target);
        matchedInputs.push({ token, target });
        break;
      }
    }
  }

  const scorePercent = targetWords.length > 0 
    ? Math.round((matchedTargets.size / targetWords.length) * 100) 
    : 0;

  return {
    matchedCount: matchedTargets.size,
    totalTargets: targetWords.length,
    matchedTargets: Array.from(matchedTargets),
    scorePercent
  };
}
