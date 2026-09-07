import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useApp } from '../../hooks/useApp';
import { BrainCircuit, AlertCircle } from 'lucide-react';
import ThemeLanguageToggle from '../../components/ThemeLanguageToggle';
import { validateLoginForm } from '../../utils/validation';

export default function Login() {
  const [email, setEmail] = useState('user@test.com'); // Pre-filled for demo
  const [password, setPassword] = useState('password123');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { t } = useApp();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Phase 8: Client validation
    const validation = validateLoginForm({ email, password });
    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      return;
    }
    setFieldErrors({});

    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to login. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors duration-200 relative">
      <div className="absolute top-4 right-4 z-10">
        <ThemeLanguageToggle />
      </div>
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary-50 dark:bg-primary-900/30 mb-4">
            <BrainCircuit className="h-8 w-8 text-primary-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t.welcome_back}</h2>
          <p className="text-muted mt-2">{t.signin_desc}</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm border border-red-100 dark:border-red-900/30 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1" htmlFor="email">
              {t.email}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: '' });
              }}
              className={`w-full px-4 py-2 bg-white dark:bg-slate-800 border ${fieldErrors.email ? 'border-red-500' : 'border-slate-300 dark:border-slate-700'} text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all`}
            />
            {fieldErrors.email && (
              <p className="mt-1 text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {fieldErrors.email}
              </p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1" htmlFor="password">
              {t.password}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: '' });
              }}
              className={`w-full px-4 py-2 bg-white dark:bg-slate-800 border ${fieldErrors.password ? 'border-red-500' : 'border-slate-300 dark:border-slate-700'} text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all`}
            />
            {fieldErrors.password && (
              <p className="mt-1 text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {fieldErrors.password}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3 text-lg mt-2"
          >
            {loading ? t.signing_in : t.sign_in}
          </button>
        </form>

        <p className="mt-6 text-center text-slate-600 dark:text-slate-400">
          {t.no_account}{' '}
          <Link to="/register" className="text-primary-600 dark:text-primary-400 font-semibold hover:underline">
            {t.register_here}
          </Link>
        </p>
      </div>
    </div>
  );
}