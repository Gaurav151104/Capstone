import { getFromStorage, saveToStorage } from './api';
import { authService } from './authService';

const INTERVIEWS_KEY = 'neurosense_interviews';
const BACKEND_URL = 'http://localhost:5000/api';

export const interviewService = {
  async saveInterviewResult(resultData) {
    const user = authService.getCurrentUser();
    const payload = {
      id: Date.now().toString(),
      userId: user?.id || 'anonymous',
      userName: user?.name || 'Guest User',
      date: new Date().toISOString(),
      ...resultData
    };

    // 1. Local fallback/cache
    const existing = getFromStorage(INTERVIEWS_KEY, []) || [];
    existing.push(payload);
    saveToStorage(INTERVIEWS_KEY, existing);

    // 2. Async backend sync (Flask)
    try {
      const response = await fetch(`${BACKEND_URL}/interview-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        console.warn('Backend returned non-200 for interview result sync');
      }
    } catch (err) {
      console.warn('Backend sync unavailable for interview result (operating offline/localStorage):', err.message);
    }

    return payload;
  },

  getInterviewHistory(userId) {
    const user = authService.getCurrentUser();
    const uid = userId || user?.id;
    const records = getFromStorage(INTERVIEWS_KEY, []) || [];
    if (!uid) return records;
    return records.filter(r => r.userId === uid);
  },

  getLatestInterview(userId) {
    const history = this.getInterviewHistory(userId);
    return history.length > 0 ? history[history.length - 1] : null;
  }
};
