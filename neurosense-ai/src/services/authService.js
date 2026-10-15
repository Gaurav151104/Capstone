import { delay, saveToStorage, getFromStorage, API_BASE_URL } from './api';

const USERS_KEY = 'neurosense_users';
const CURRENT_USER_KEY = 'neurosense_current_user';
const TOKEN_KEY = 'neurosense_token';
const BACKEND_URL = API_BASE_URL;

export const authService = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY) || null;
  },

  async login(email, password) {
    try {
      const res = await fetch(`${BACKEND_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          localStorage.setItem(TOKEN_KEY, data.token);
        }
        saveToStorage(CURRENT_USER_KEY, data.user);
        return data.user;
      }
      if (res.status === 401 || res.status === 400) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Invalid email or password');
      }
    } catch (err) {
      if (err.message && (err.message.includes('Invalid email') || err.message.includes('password'))) {
        throw err;
      }
      console.warn('[AuthService] Backend login unreachable:', err.message);
      if (!import.meta.env.DEV) {
        throw new Error('Authentication server unavailable. Please try again later.');
      }
    }

    // Local fallback for DEV only
    await delay(500);
    const users = getFromStorage(USERS_KEY, []);
    const user = users.find(u => u.email === email && (u.password === password || u.password_hash));
    
    if (!user) {
      throw new Error('Invalid email or password');
    }
    
    const { password: _, salt: _s, password_hash: _ph, ...userWithoutPassword } = user;
    saveToStorage(CURRENT_USER_KEY, userWithoutPassword);
    return userWithoutPassword;
  },

  async register(userData) {
    try {
      const res = await fetch(`${BACKEND_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          localStorage.setItem(TOKEN_KEY, data.token);
        }
        const users = getFromStorage(USERS_KEY, []);
        users.push(data.user);
        saveToStorage(USERS_KEY, users);
        saveToStorage(CURRENT_USER_KEY, data.user);
        return data.user;
      }
      if (res.status === 400 || res.status === 409) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Registration failed');
      }
    } catch (err) {
      if (err.message && (err.message.includes('exists') || err.message.includes('Registration failed'))) {
        throw err;
      }
      console.warn('[AuthService] Backend registration unreachable:', err.message);
      if (!import.meta.env.DEV) {
        throw new Error('Registration server unavailable. Please try again later.');
      }
    }

    // Fallback if backend offline (DEV only)
    await delay(500);
    const users = getFromStorage(USERS_KEY, []);
    if (users.find(u => u.email === userData.email)) {
      throw new Error('User with this email already exists');
    }

    const newUser = {
      ...userData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    saveToStorage(USERS_KEY, users);

    const { password: _password, ...userWithoutPassword } = newUser;
    saveToStorage(CURRENT_USER_KEY, userWithoutPassword);
    return userWithoutPassword;
  },

  async logout() {
    await delay(200);
    localStorage.removeItem(CURRENT_USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
  },

  getCurrentUser() {
    return getFromStorage(CURRENT_USER_KEY) || null;
  }
};
