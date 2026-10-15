import { authService } from './authService';
import { API_BASE_URL, getFromStorage, saveToStorage } from './api';

const BACKEND_URL = `${API_BASE_URL}/api`;
// Non-sensitive UI preference storage only
const UI_PLAYED_KEY = 'neurosense_ui_has_played';
const GAMES_KEY = 'neurosense_games';
const REACTION_KEY = 'neurosense_reaction_records';

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
   * Check cognitive assessment consent on the server
   */
  async getServerConsent() {
    try {
      const res = await fetch(`${BACKEND_URL}/cognitive-consent`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        return data.consented === true;
      }
    } catch (err) {
      console.warn('[gameService] Error checking consent:', err.message);
    }
    return false;
  },

  /**
   * Record cognitive assessment consent on the server
   */
  async saveServerConsent(version = '2.0') {
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
      console.warn('[gameService] Error recording consent on server:', err.message);
    }
    return false;
  },

  /**
   * Fetches next unrepeated form and stimuli derived from the server seed
   * Server creates seed and renders deterministic order. Client does not reshuffle.
   */
  async fetchNextSessionItems(game, options = {}) {
    const user = authService.getCurrentUser();
    if (!user) {
      throw new Error("Authentication required to start cognitive session");
    }

    const queryParams = new URLSearchParams({
      game,
      ...options
    });

    const response = await fetch(`${BACKEND_URL}/session-items/next?${queryParams.toString()}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    if (response.status === 401) {
      throw new Error("Session expired or authentication required");
    }
    if (response.status === 403) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.details || "Cognitive consent required before starting games");
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch stimuli: ${response.statusText}`);
    }

    const data = await response.json();
    // Non-sensitive UI state flag
    try {
      localStorage.setItem(UI_PLAYED_KEY, 'true');
    } catch (e) {
      // storage unavailable
    }
    return data;
  },

  /**
   * Saves game session to secure server storage (pseudonymised at rest)
   * No raw clinical data is retained in client localStorage.
   */
  async saveGameSession(gameType, score, timeTaken, extraMetadata = {}) {
    const user = authService.getCurrentUser();
    if (!user) return null;

    const validScore = Math.max(0, Math.min(100, Number(score) || 0));
    const validTime = Math.max(0, Number(timeTaken) || 0);

    const payload = {
      gameType,
      score: validScore,
      timeTaken: validTime,
      formId: extraMetadata.formId || 'FORM_A',
      sessionNumber: extraMetadata.sessionNumber || 1,
      sessionId: extraMetadata.sessionId,
      errors: extraMetadata.errors !== undefined ? extraMetadata.errors : null,
      itemIds: extraMetadata.itemIds || extraMetadata.words || [],
      seed: extraMetadata.seed || null,
      date: new Date().toISOString()
    };

    try {
      const res = await fetch(`${BACKEND_URL}/game-session`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[gameService] Backend game-session sync error:', err.message);
    }

    return payload;
  },

  /**
   * Universal game logging helper for game session metrics
   */
  async saveGameLog(logData) {
    try {
      const gameType = logData.gameType || 'Voice Biomarker Screening';
      const score = logData.score || 0;
      const timeTaken = logData.timeTaken || 0;
      const metadata = logData.metadata || {};
      return await this.saveGameSession(gameType, score, timeTaken, metadata);
    } catch (e) {
      console.warn('[gameService] saveGameLog error:', e);
      return null;
    }
  },

  /**
   * Saves reaction time session to server
   * Detailed millisecond latencies are stored securely in database, not in localStorage.
   */
  async saveReactionTimeSession(metrics) {
    const user = authService.getCurrentUser();
    if (!user) return null;

    const { 
      avgReactionTimeMs, 
      variabilityMs, 
      falseStarts, 
      trials = [], 
      score,
      formId,
      sessionNumber,
      sessionId,
      deviceInfo,
      seed,
      medianMs,
      lapses,
      anticipations
    } = metrics;

    const validAvg = Math.max(1, Math.min(5000, Math.round(Number(avgReactionTimeMs) || 0)));
    const validVar = Math.max(0, Math.round(Number(variabilityMs) || 0));
    const validFalse = Math.max(0, Number(falseStarts) || 0);
    const validScore = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));

    const payload = {
      userName: user.name || 'User',
      date: new Date().toISOString(),
      avgReactionTimeMs: validAvg,
      variabilityMs: validVar,
      falseStarts: validFalse,
      medianMs: medianMs || validAvg,
      lapses: lapses || 0,
      anticipations: anticipations || 0,
      trials,
      score: validScore,
      formId: formId || 'RT_PROTOCOL_1',
      sessionNumber: sessionNumber || 1,
      sessionId: sessionId,
      deviceInfo: deviceInfo || {},
      seed: seed || null
    };

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
      console.warn('[gameService] Backend reaction-time sync error:', err.message);
    }

    return payload;
  },

  /**
   * Request normative psychometric scoring from server engine
   */
  async scoreSession(rawMeasures, customWeights = null) {
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
      console.warn('[gameService] Norm scoring endpoint offline:', e.message);
    }
    return null;
  },

  /**
   * Fetch authenticated user assessment history from server
   */
  async getUserHistory(userId) {
    const user = authService.getCurrentUser();
    const uid = userId || user?.id;
    if (!uid) return { games: [], reactions: [], interviews: [] };

    try {
      const res = await fetch(`${BACKEND_URL}/user-history/${uid}`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('[gameService] Failed to fetch user history:', e.message);
    }
    return { games: [], reactions: [], interviews: [] };
  },

  getUserLogs(userId) {
    try {
      const user = authService.getCurrentUser();
      const uid = userId || user?.id;
      const logs = getFromStorage(GAMES_KEY, []) || [];
      if (!uid) return Array.isArray(logs) ? logs : [];
      return Array.isArray(logs) ? logs.filter(log => log && log.userId === uid) : [];
    } catch (e) {
      return [];
    }
  },

  getReactionTimeHistory(userId) {
    try {
      const user = authService.getCurrentUser();
      const uid = userId || user?.id;
      const records = getFromStorage(REACTION_KEY, []) || [];
      if (!uid) return Array.isArray(records) ? records : [];
      return Array.isArray(records) ? records.filter(r => r && r.userId === uid) : [];
    } catch (e) {
      return [];
    }
  },

  hasPlayedGames() {
    try {
      if (localStorage.getItem(UI_PLAYED_KEY) === 'true') return true;
      return (this.getUserLogs() || []).length > 0;
    } catch (e) {
      return false;
    }
  }
};
