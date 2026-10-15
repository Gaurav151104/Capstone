import { authService } from './authService';
import { API_BASE_URL, getFromStorage, saveToStorage } from './api';
import { 
  generateMemoryMatchCards, 
  generateConstrainedImageSequence, 
  selectWordForm, 
  generateDynamicWordList,
  generateReactionTimeISIs,
  calculateReactionTimeStats
} from '../utils/cognitivePools';
import { COGNITIVE_ASSESSMENT_CONFIG } from '../config/cognitiveConfig';

const BACKEND_URL = `${API_BASE_URL}/api`;
const UI_PLAYED_KEY = 'neurosense_ui_has_played';
const GAMES_KEY = 'neurosense_games';
const REACTION_KEY = 'neurosense_reaction_records';
const CONSENT_KEY = 'neurosense_cognitive_consent';
const CONSENT_DATE_KEY = 'neurosense_cognitive_consent_date';

function getAuthHeaders() {
  const token = authService.getToken();
  const user = authService.getCurrentUser();
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (user?.id) {
    headers['Authorization'] = `Bearer ${user.id}`;
    headers['X-User-Id'] = user.id;
  }
  return headers;
}

export const gameService = {
  /**
   * Check cognitive assessment consent on server or local fallback
   */
  async getServerConsent() {
    try {
      const res = await fetch(`${BACKEND_URL}/cognitive-consent`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        if (data.consented === true) {
          try { localStorage.setItem(CONSENT_KEY, 'true'); } catch { /* ignore */ }
          return true;
        }
      }
    } catch (err) {
      console.warn('[gameService] Backend consent check offline, using local cache:', err.message);
    }

    try {
      return localStorage.getItem(CONSENT_KEY) === 'true';
    } catch {
      return false;
    }
  },

  /**
   * Synchronous check if client has local consent
   */
  hasLocalConsent() {
    try {
      return localStorage.getItem(CONSENT_KEY) === 'true';
    } catch {
      return false;
    }
  },

  /**
   * Record cognitive assessment consent locally and attempt server sync
   */
  recordLocalConsent(version = '2.0') {
    try {
      localStorage.setItem(CONSENT_KEY, 'true');
      localStorage.setItem(CONSENT_DATE_KEY, new Date().toISOString());
      localStorage.setItem('neurosense_cognitive_consent_version', version);
    } catch (err) {
      console.warn('[gameService] Could not write consent to localStorage:', err);
    }
  },

  /**
   * Record cognitive assessment consent on server + local storage
   */
  async saveServerConsent(version = '2.0') {
    // Record locally first so offline/network delays never trap the participant
    this.recordLocalConsent(version);

    try {
      const res = await fetch(`${BACKEND_URL}/cognitive-consent`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          version,
          scope: ['cognitive_games', 'psychometric_norming']
        })
      });
      if (res.ok) {
        return true;
      }
    } catch (err) {
      console.warn('[gameService] Error syncing consent to backend:', err.message);
    }

    return true; // Local consent guaranteed
  },

  /**
   * Fetches next unrepeated form and stimuli derived from server seed,
   * with seamless local generator fallback if server is offline or unreachable.
   */
  async fetchNextSessionItems(game, options = {}) {
    // Ensure UI flag is updated
    try {
      localStorage.setItem(UI_PLAYED_KEY, 'true');
    } catch {
      /* ignore */
    }

    // 1. Attempt server fetch
    try {
      const queryParams = new URLSearchParams({
        game,
        ...options
      });

      const response = await fetch(`${BACKEND_URL}/session-items/next?${queryParams.toString()}`, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (err) {
      console.warn(`[gameService] Server stimuli unavailable for "${game}", utilizing deterministic local generator:`, err.message);
    }

    // 2. High-quality resilient local generator fallback
    const userLogs = this.getUserLogs();
    const recentSessions = userLogs.filter(l => l.gameType && l.gameType.toLowerCase().includes(game.toLowerCase()));
    const recentFormIds = recentSessions.map(s => s.formId).filter(Boolean);

    if (game.toLowerCase().includes('memory')) {
      const isLarge = options.gridSize === 'large';
      const pairCount = isLarge ? 8 : 6;
      const localCards = generateMemoryMatchCards(pairCount);
      return {
        game: 'Memory Match',
        formId: `GRID_${isLarge ? '4X4' : '4X3'}`,
        gridSize: options.gridSize || 'small',
        sessionNumber: recentSessions.length + 1,
        cards: localCards.cards,
        selectedIcons: localCards.selectedIcons,
        seed: localCards.seed
      };
    }

    if (game.toLowerCase().includes('image')) {
      const diff = options.difficulty || 'medium';
      const spanLength = diff === 'easy' ? 4 : (diff === 'hard' ? 6 : 5);
      const localSeq = generateConstrainedImageSequence(spanLength, 12);
      return {
        game: 'Image Recall',
        formId: `SEQ_${diff.toUpperCase()}`,
        difficulty: diff,
        sessionNumber: recentSessions.length + 1,
        sequence: localSeq.sequence,
        availableChoices: localSeq.availableChoices,
        available_choices: localSeq.availableChoices,
        seed: localSeq.seed
      };
    }

    if (game.toLowerCase().includes('word')) {
      const targetCount = options.count || 5;
      const recentWords = recentSessions.flatMap(s => s.itemIds || []);
      const localWordForm = (recentFormIds.length >= 8)
        ? generateDynamicWordList(targetCount, recentWords)
        : selectWordForm(recentFormIds, targetCount);
      return {
        game: 'Word Recall',
        formId: localWordForm.formId,
        formName: localWordForm.name,
        sessionNumber: recentSessions.length + 1,
        words: localWordForm.words,
        distractorWords: localWordForm.distractorWords,
        seed: localWordForm.seed
      };
    }

    if (game.toLowerCase().includes('reaction')) {
      const numPractice = options.num_practice || COGNITIVE_ASSESSMENT_CONFIG.reactionTime.numPracticeTrials;
      const numTest = options.num_test || COGNITIVE_ASSESSMENT_CONFIG.reactionTime.numTestTrials;
      const minDelay = COGNITIVE_ASSESSMENT_CONFIG.reactionTime.minDelayMs;
      const maxDelay = COGNITIVE_ASSESSMENT_CONFIG.reactionTime.maxDelayMs;

      return {
        game: 'Reaction Time',
        formId: 'RT_PROTOCOL_1',
        sessionNumber: recentSessions.length + 1,
        practiceIsis: generateReactionTimeISIs(numPractice, minDelay, maxDelay),
        testIsis: generateReactionTimeISIs(numTest, minDelay, maxDelay),
        numPractice,
        numTest
      };
    }

    // Default generic session
    return {
      game,
      formId: 'FORM_GENERIC',
      sessionNumber: recentSessions.length + 1,
      seed: Math.floor(Math.random() * 1_000_000)
    };
  },

  /**
   * Saves game session to server and local storage (with deduplication)
   */
  async saveGameSession(gameType, score, timeTaken, extraMetadata = {}) {
    const user = authService.getCurrentUser();
    const validScore = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
    const validTime = Math.max(0, Math.round(Number(timeTaken) || 0));

    const sessionId = extraMetadata.sessionId || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const payload = {
      id: sessionId,
      sessionId,
      userId: user?.id || 'guest',
      userName: user?.name || 'User',
      gameType,
      score: validScore,
      timeTaken: validTime,
      formId: extraMetadata.formId || 'FORM_A',
      sessionNumber: extraMetadata.sessionNumber || 1,
      errors: extraMetadata.errors !== undefined ? extraMetadata.errors : null,
      itemIds: extraMetadata.itemIds || extraMetadata.words || [],
      rawResponses: extraMetadata.rawResponses || null,
      seed: extraMetadata.seed || null,
      date: new Date().toISOString(),
      metadata: extraMetadata
    };

    // 1. Local storage persistence (instant reactivity and offline insurance)
    try {
      const existing = getFromStorage(GAMES_KEY, []) || [];
      // Deduplicate by sessionId
      const withoutDuplicate = existing.filter(item => item && item.sessionId !== sessionId);
      withoutDuplicate.push(payload);
      saveToStorage(GAMES_KEY, withoutDuplicate);
      localStorage.setItem(UI_PLAYED_KEY, 'true');
    } catch (e) {
      console.warn('[gameService] Could not persist to localStorage:', e);
    }

    // 2. Server persistence
    try {
      const res = await fetch(`${BACKEND_URL}/game-session`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const serverData = await res.json();
        return serverData;
      }
    } catch (err) {
      console.warn('[gameService] Backend game-session sync warning (saved locally):', err.message);
    }

    return payload;
  },

  /**
   * Saves reaction time session to server and local storage
   */
  async saveReactionTimeSession(metrics) {
    const user = authService.getCurrentUser();
    const sessionId = metrics.sessionId || `sess_rt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const { 
      avgReactionTimeMs, 
      variabilityMs, 
      falseStarts = 0, 
      trials = [], 
      score = 0,
      formId = 'RT_PROTOCOL_1',
      sessionNumber = 1,
      deviceInfo = {},
      seed = null,
      medianMs,
      lapses = 0,
      anticipations = 0
    } = metrics;

    let computedAvg = avgReactionTimeMs;
    let computedVar = variabilityMs;
    if ((computedAvg === undefined || computedVar === undefined) && Array.isArray(trials) && trials.length > 0) {
      const stats = calculateReactionTimeStats(trials);
      if (computedAvg === undefined) computedAvg = stats.mean;
      if (computedVar === undefined) computedVar = stats.variability;
    }

    const validAvg = Math.max(1, Math.min(5000, Math.round(Number(computedAvg) || 0)));
    const validVar = Math.max(0, Math.round(Number(computedVar) || 0));
    const validScore = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));

    const payload = {
      id: sessionId,
      sessionId,
      userId: user?.id || 'guest',
      userName: user?.name || 'User',
      date: new Date().toISOString(),
      avgReactionTimeMs: validAvg,
      variabilityMs: validVar,
      falseStarts: Math.max(0, Number(falseStarts) || 0),
      medianMs: medianMs || validAvg,
      lapses: Math.max(0, Number(lapses) || 0),
      anticipations: Math.max(0, Number(anticipations) || 0),
      trials,
      score: validScore,
      formId,
      sessionNumber,
      deviceInfo,
      seed
    };

    // 1. Local storage persistence in REACTION_KEY & GAMES_KEY
    try {
      const records = getFromStorage(REACTION_KEY, []) || [];
      const filteredRecords = records.filter(r => r && r.sessionId !== sessionId);
      filteredRecords.push(payload);
      saveToStorage(REACTION_KEY, filteredRecords);

      // Also add to GAMES_KEY so Dashboard and Progress trend shows Reaction Time
      const games = getFromStorage(GAMES_KEY, []) || [];
      const filteredGames = games.filter(g => g && g.sessionId !== sessionId);
      filteredGames.push({
        id: sessionId,
        sessionId,
        userId: user?.id || 'guest',
        gameType: 'Reaction Time',
        score: validScore,
        timeTaken: validAvg,
        formId,
        date: payload.date,
        avgReactionTimeMs: validAvg,
        variabilityMs: validVar,
        falseStarts: payload.falseStarts
      });
      saveToStorage(GAMES_KEY, filteredGames);
      localStorage.setItem(UI_PLAYED_KEY, 'true');
    } catch (e) {
      console.warn('[gameService] Could not persist reaction time locally:', e);
    }

    // 2. Server sync
    try {
      const res = await fetch(`${BACKEND_URL}/reaction-time-result`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[gameService] Backend reaction-time sync warning (saved locally):', err.message);
    }

    return payload;
  },

  /**
   * Request normative psychometric scoring from server engine with local fallback
   */
  async scoreSession(rawMeasures, customWeights = null) {
    // 1. Try server scoring
    try {
      const payload = { ...rawMeasures };
      if (customWeights) {
        payload.weights = customWeights;
      }
      const response = await fetch(`${BACKEND_URL}/score-cognitive-session`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.warn('[gameService] Server normative scoring unavailable, calculating local transparent metrics:', e.message);
    }

    // 2. Local transparent calculation fallback (enforcing MIN_MEASURES = 3)
    const validMeasures = [];
    const perMeasureZ = {};
    const rawValues = { ...rawMeasures };

    if (rawMeasures.reaction_time_mean_ms !== undefined) {
      const z = -(rawMeasures.reaction_time_mean_ms - 278.7) / 42.9; // Invert: faster = positive z
      perMeasureZ.reaction_time_mean_ms = Number(z.toFixed(2));
      validMeasures.push('reaction_time_mean_ms');
    }

    if (rawMeasures.word_recall_immediate_count !== undefined) {
      const total = rawMeasures.word_recall_immediate_total || 10;
      const prop = rawMeasures.word_recall_immediate_count / total;
      const z = (prop - 0.55) / 0.15;
      perMeasureZ.word_recall_immediate = Number(z.toFixed(2));
      validMeasures.push('word_recall_immediate');
    }

    if (rawMeasures.word_recall_delayed_count !== undefined) {
      const total = rawMeasures.word_recall_delayed_total || 10;
      const prop = rawMeasures.word_recall_delayed_count / total;
      const z = (prop - 0.50) / 0.18;
      perMeasureZ.word_recall_delayed = Number(z.toFixed(2));
      validMeasures.push('word_recall_delayed');
    }

    if (rawMeasures.image_recall_forward_span !== undefined) {
      const z = (rawMeasures.image_recall_forward_span - 5.0) / 1.0;
      perMeasureZ.image_recall_forward_span = Number(z.toFixed(2));
      validMeasures.push('image_recall_forward_span');
    }

    if (rawMeasures.memory_match_errors !== undefined) {
      const logErrors = Math.log(1 + Math.max(0, rawMeasures.memory_match_errors));
      const z = -(logErrors - 1.95) / 0.55; // Invert: fewer errors = positive z
      perMeasureZ.memory_match_errors = Number(z.toFixed(2));
      validMeasures.push('memory_match_errors');
    }

    const minMeasures = COGNITIVE_ASSESSMENT_CONFIG.scoring.minMeasuresForComposite || 3;

    if (validMeasures.length < minMeasures) {
      return {
        status: "INSUFFICIENT_NORMS",
        composite: null,
        composite_z: null,
        scaled_score_100: null,
        valid_measures_count: validMeasures.length,
        used_measures: validMeasures,
        per_measure_z: perMeasureZ,
        raw_values: rawValues,
        disclaimer: COGNITIVE_ASSESSMENT_CONFIG.clinicalNotice
      };
    }

    // Weighted composite z calculation
    const weightsConfig = COGNITIVE_ASSESSMENT_CONFIG.scoring.weights;
    let weightSum = 0;
    let weightedZ = 0;

    validMeasures.forEach(m => {
      const w = weightsConfig[m] || (1 / validMeasures.length);
      const z = perMeasureZ[m] || 0;
      weightSum += w;
      weightedZ += (w * z);
    });

    const compositeZ = weightSum > 0 ? Number((weightedZ / weightSum).toFixed(2)) : 0;
    // Scale z to [10, 100] with mean 70, sd 15
    const scaledScore = Math.max(10, Math.min(100, Math.round(70 + (compositeZ * 15))));

    return {
      status: "SUFFICIENT_NORMS",
      composite: scaledScore,
      composite_z: compositeZ,
      scaled_score_100: scaledScore,
      valid_measures_count: validMeasures.length,
      used_measures: validMeasures,
      per_measure_z: perMeasureZ,
      raw_values: rawValues,
      disclaimer: COGNITIVE_ASSESSMENT_CONFIG.clinicalNotice
    };
  },

  /**
   * Fetch authenticated user assessment history from server with local storage fallback
   */
  async getUserHistory(userId) {
    const user = authService.getCurrentUser();
    const uid = userId || user?.id;
    if (!uid) {
      return {
        games: this.getUserLogs() || [],
        reactions: this.getReactionTimeHistory() || [],
        interviews: []
      };
    }

    try {
      const res = await fetch(`${BACKEND_URL}/user-history/${uid}`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        if (data && (Array.isArray(data.games) || Array.isArray(data.reactions))) {
          return data;
        }
      }
    } catch (e) {
      console.warn('[gameService] Server history fetch unavailable, using local history cache:', e.message);
    }

    return {
      games: this.getUserLogs(uid) || [],
      reactions: this.getReactionTimeHistory(uid) || [],
      interviews: []
    };
  },

  /**
   * Retrieves game logs from localStorage
   */
  getUserLogs(userId) {
    try {
      const user = authService.getCurrentUser();
      const uid = userId || user?.id;
      const logs = getFromStorage(GAMES_KEY, []) || [];
      if (!Array.isArray(logs)) return [];
      if (!uid) return logs;
      return logs.filter(log => !log.userId || log.userId === uid || log.userId === 'guest');
    } catch {
      return [];
    }
  },

  /**
   * Retrieves reaction time records from localStorage
   */
  getReactionTimeHistory(userId) {
    try {
      const user = authService.getCurrentUser();
      const uid = userId || user?.id;
      const records = getFromStorage(REACTION_KEY, []) || [];
      if (!Array.isArray(records)) return [];
      if (!uid) return records;
      return records.filter(r => !r.userId || r.userId === uid || r.userId === 'guest');
    } catch {
      return [];
    }
  },

  hasPlayedGames() {
    try {
      if (localStorage.getItem(UI_PLAYED_KEY) === 'true') return true;
      return (this.getUserLogs() || []).length > 0;
    } catch {
      return false;
    }
  }
};
