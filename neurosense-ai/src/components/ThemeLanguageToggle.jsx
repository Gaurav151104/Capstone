import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useApp } from '../hooks/useApp';

export default function ThemeLanguageToggle() {
  const { theme, toggleTheme, language, setLanguage, t } = useApp();

  return (
    <div className="flex items-center space-x-2 md:space-x-4">
      {/* Language Toggle */}
      <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
        <button 
          type="button"
          onClick={() => setLanguage('en')}
          className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${language === 'en' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          EN
        </button>
        <button 
          type="button"
          onClick={() => setLanguage('mr')}
          className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${language === 'mr' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          मराठी
        </button>
      </div>

      {/* Theme Toggle */}
      <button 
        type="button"
        onClick={toggleTheme}
        className="p-2 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
        title={theme === 'light' ? (t?.switch_dark || 'Dark Mode') : (t?.switch_light || 'Light Mode')}
      >
        {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
      </button>
    </div>
  );
}
