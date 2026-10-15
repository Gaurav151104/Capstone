// Centralized API Base URL configured via environment with fallback
export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

// Simple mock api helper that simulates network delay
export const delay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

export const saveToStorage = (key, data) => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const getFromStorage = (key, defaultValue = null) => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultValue;
};
