import { delay, saveToStorage, getFromStorage } from './api';

const USERS_KEY = 'neurosense_users';
const CURRENT_USER_KEY = 'neurosense_current_user';

export const authService = {
  async login(email, password) {
    await delay(800);
    const users = getFromStorage(USERS_KEY, []);
    const user = users.find(u => u.email === email && u.password === password);
    
    if (!user) {
      throw new Error('Invalid email or password');
    }
    
    // Don't leak password in session
    const { password: _, ...userWithoutPassword } = user;
    saveToStorage(CURRENT_USER_KEY, userWithoutPassword);
    return userWithoutPassword;
  },

  async register(userData) {
    await delay(800);
    const users = getFromStorage(USERS_KEY, []);
    
    // Check if user exists
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
    await delay(300);
    localStorage.removeItem(CURRENT_USER_KEY);
  },

  getCurrentUser() {
    return getFromStorage(CURRENT_USER_KEY);
  }
};
