import React from 'react';
import { Link } from 'react-router-dom';
import { BrainCircuit, ShieldAlert, Gamepad2, TrendingUp, ArrowRight } from 'lucide-react';
import { useApp } from '../../hooks/useApp';
import ThemeLanguageToggle from '../../components/ThemeLanguageToggle';

export default function Landing() {
  const { t } = useApp();

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors duration-200">
      {/* Navbar */}
      <nav className="container mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <BrainCircuit className="h-8 w-8 text-primary-600" />
          <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-secondary-500">
            NeuroSense-AI
          </span>
        </div>
        <div className="flex items-center space-x-4">
          <ThemeLanguageToggle />
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden md:block"></div>
          <Link to="/login" className="text-slate-600 dark:text-slate-300 font-medium hover:text-primary-600 whitespace-nowrap">{t.login}</Link>
          <Link to="/register" className="btn-primary whitespace-nowrap">{t.get_started}</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-slate-50 dark:bg-slate-900/50 pt-16 pb-32">
        <div className="container mx-auto px-6 text-center relative z-10">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight mb-6">
              {t.hero_title}
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-300 mb-10 leading-relaxed">
              {t.hero_subtitle}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
              <Link to="/register" className="btn-primary text-lg px-8 py-4 flex items-center w-full sm:w-auto justify-center">
                {t.start_assessment} <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <Link to="/about" className="btn-outline text-lg px-8 py-4 w-full sm:w-auto justify-center bg-white dark:bg-slate-800">
                {t.learn_more}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{t.features_title}</h2>
            <p className="text-muted mt-4 text-lg">{t.features_subtitle}</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="card text-center hover:-translate-y-1 transition-transform duration-300">
              <div className="inline-flex h-16 w-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full items-center justify-center mb-6">
                <ShieldAlert className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-3">{t.feature_ai_title}</h3>
              <p className="text-slate-600 dark:text-slate-300">{t.feature_ai_desc}</p>
            </div>
            
            <div className="card text-center hover:-translate-y-1 transition-transform duration-300">
              <div className="inline-flex h-16 w-16 bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-full items-center justify-center mb-6">
                <Gamepad2 className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-3">{t.feature_games_title}</h3>
              <p className="text-slate-600 dark:text-slate-300">{t.feature_games_desc}</p>
            </div>
            
            <div className="card text-center hover:-translate-y-1 transition-transform duration-300">
              <div className="inline-flex h-16 w-16 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full items-center justify-center mb-6">
                <TrendingUp className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-3">{t.feature_tracking_title}</h3>
              <p className="text-slate-600 dark:text-slate-300">{t.feature_tracking_desc}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}