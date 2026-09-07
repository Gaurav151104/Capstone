import { Link } from 'react-router-dom';
import { Bell, User } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import ThemeLanguageToggle from './ThemeLanguageToggle';

export default function Navbar() {
  const { user } = useAuth();
  
  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-6 z-10 sticky top-0 transition-colors duration-200">
      <div className="flex items-center md:hidden">
        {/* Mobile menu button would go here */}
      </div>
      
      <div className="flex-1 px-4 flex justify-between">
        <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100 md:hidden">NeuroSense</h1>
        <div className="hidden md:block"></div> {/* Spacer */}
      </div>

      <div className="flex items-center space-x-2 md:space-x-4">
        <ThemeLanguageToggle />

        <button className="text-slate-500 dark:text-slate-300 hover:text-primary-600 relative transition-colors p-2 md:p-0">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 md:top-0 md:right-0 h-2 w-2 bg-red-500 rounded-full"></span>
        </button>

        <Link 
          to="/dashboard/profile"
          className="flex items-center space-x-2 p-1 px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all group"
        >
          <span className="hidden sm:block text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
            {user?.name || 'User'}
          </span>
          <div className="h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-200 flex items-center justify-center font-bold border border-primary-200 dark:border-primary-700 shadow-sm group-hover:border-primary-400 dark:group-hover:border-primary-600 transition-all">
            {user?.name?.charAt(0).toUpperCase() || <User className="h-5 w-5" />}
          </div>
        </Link>
      </div>
    </header>
  );
}