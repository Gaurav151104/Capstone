/**
 * Centralized Form & Input Validation Utility for NeuroSense AI
 */

export const validationRules = {
  isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  },

  isValidAge(age) {
    const num = Number(age);
    return !isNaN(num) && Number.isInteger(num) && num >= 1 && num <= 120;
  },

  isNonEmpty(value, minLength = 1) {
    if (!value) return false;
    return typeof value === 'string' && value.trim().length >= minLength;
  },

  isValidPassword(password, minLength = 6) {
    return this.isNonEmpty(password, minLength);
  },

  isValidReactionTime(ms) {
    const num = Number(ms);
    return !isNaN(num) && num > 10 && num <= 5000;
  },

  isValidScore(score) {
    const num = Number(score);
    return !isNaN(num) && num >= 0 && num <= 100;
  }
};

/**
 * Validates Login inputs
 * @returns { errors: Record<string, string>, isValid: boolean }
 */
export function validateLoginForm(formData) {
  const errors = {};

  if (!formData.email || !formData.email.trim()) {
    errors.email = 'Email address is required.';
  } else if (!validationRules.isValidEmail(formData.email)) {
    errors.email = 'Please enter a valid email address (e.g. name@example.com).';
  }

  if (!formData.password) {
    errors.password = 'Password is required.';
  } else if (formData.password.length < 6) {
    errors.password = 'Password must be at least 6 characters.';
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0
  };
}

/**
 * Validates Registration Step 1 (Personal Info)
 * @returns { errors: Record<string, string>, isValid: boolean }
 */
export function validateRegisterStep1(formData, existingEmails = []) {
  const errors = {};

  if (!formData.name || !formData.name.trim()) {
    errors.name = 'Full name is required.';
  } else if (formData.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters.';
  }

  if (!formData.email || !formData.email.trim()) {
    errors.email = 'Email address is required.';
  } else if (!validationRules.isValidEmail(formData.email)) {
    errors.email = 'Please enter a valid email address.';
  } else if (existingEmails.includes(formData.email.trim().toLowerCase())) {
    errors.email = 'An account with this email already exists.';
  }

  if (!formData.password) {
    errors.password = 'Password is required.';
  } else if (formData.password.length < 6) {
    errors.password = 'Password must be at least 6 characters.';
  }

  if (!formData.age) {
    errors.age = 'Age is required.';
  } else if (!validationRules.isValidAge(formData.age)) {
    errors.age = 'Please enter a realistic age between 1 and 120.';
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0
  };
}

/**
 * Validates Cognitive Interview text response
 */
export function validateInterviewInput(input) {
  if (!input || !input.trim()) {
    return { isValid: false, error: 'Please enter a response before continuing.' };
  }
  const trimmed = input.trim();
  if (trimmed.length < 2) {
    return { isValid: false, error: 'Please enter a complete word or answer.' };
  }
  return { isValid: true, error: '' };
}
