import { getFromStorage, saveToStorage } from './api';
import { authService } from './authService';

const GAMES_KEY = 'neurosense_games';
const REACTION_KEY = 'neurosense_reaction_time';
const BACKEND_URL = 'http://localhost:5000/api';

export const gameService = {
  saveGameSession(gameType, score, timeTaken) {
    const user = authService.getCurrentUser();
    if (!user) return null;

    // Validate inputs
    const validScore = Math.max(0, Math.min(100, Number(score) || 0));
    const validTime = Math.max(0, Number(timeTaken) || 0);
    
    const logs = getFromStorage(GAMES_KEY, []) || [];
    const newLog = {
      id: Date.now().toString(),
      userId: user.id,
      gameType,
      score: validScore,
      timeTaken: validTime,
      date: new Date().toISOString()
    };
    
    logs.push(newLog);
    saveToStorage(GAMES_KEY, logs);

    // Async backend sync
    fetch(`${BACKEND_URL}/game-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLog)
    }).catch(err => {
      console.warn('Backend game-session sync offline fallback:', err.message);
    });

    return newLog;
  },

  async saveReactionTimeSession(metrics) {
    const user = authService.getCurrentUser();
    const { 
      avgReactionTimeMs, 
      variabilityMs, 
      falseStarts, 
      trials = [], 
      score 
    } = metrics;

    // Strict validation (reject impossible values <= 0 or NaN)
    const validAvg = Math.max(1, Math.min(5000, Math.round(Number(avgReactionTimeMs) || 0)));
    const validVar = Math.max(0, Math.round(Number(variabilityMs) || 0));
    const validFalse = Math.max(0, Number(falseStarts) || 0);
    const validScore = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));

    // 1. Save standard session for Dashboard & Progress
    this.saveGameSession('Reaction & Attention', validScore, validAvg);

    // 2. Save detailed reaction metrics
    const reactionLogs = getFromStorage(REACTION_KEY, []) || [];
    const payload = {
      id: Date.now().toString(),
      userId: user?.id || 'anonymous',
      userName: user?.name || 'User',
      date: new Date().toISOString(),
      avgReactionTimeMs: validAvg,
      variabilityMs: validVar,
      falseStarts: validFalse,
      trials,
      score: validScore
    };

    reactionLogs.push(payload);
    saveToStorage(REACTION_KEY, reactionLogs);

    // 3. Sync to Flask backend
    try {
      await fetch(`${BACKEND_URL}/reaction-time-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.warn('Backend reaction-time sync offline fallback:', err.message);
    }

    return payload;
  },

  getUserLogs() {
    const user = authService.getCurrentUser();
    if (!user) return [];
    
    const logs = getFromStorage(GAMES_KEY, []) || [];
    return logs.filter(log => log.userId === user.id);
  },

  getReactionTimeHistory(userId) {
    const user = authService.getCurrentUser();
    const uid = userId || user?.id;
    const records = getFromStorage(REACTION_KEY, []) || [];
    if (!uid) return records;
    return records.filter(r => r.userId === uid);
  },

  hasPlayedGames() {
    return this.getUserLogs().length > 0;
  }
};
