// Simple mock api helper that simulates network delay
export const delay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

export const saveToStorage = (key, data) => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const getFromStorage = (key, defaultValue = null) => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultValue;
};
