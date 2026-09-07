import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useApp } from '../hooks/useApp';
import { 
  LayoutDashboard, 
  Gamepad2, 
  TrendingUp, 
  ShieldAlert, 
  HeartHandshake, 
  UserCircle,
  LogOut,
  BrainCircuit,
  MessageSquareText
} from 'lucide-react';

export default function Sidebar() {
  const { logout } = useAuth();
  const { t } = useApp();

  const navItems = [
    { name: t.overview, path: '/dashboard', icon: LayoutDashboard, exact: true },
    { name: t.interview || 'Cognitive Interview', path: '/dashboard/interview', icon: MessageSquareText },
    { name: t.games, path: '/dashboard/games', icon: Gamepad2 },
    { name: t.progress, path: '/dashboard/progress', icon: TrendingUp },
    { name: t.risk_assessment, path: '/dashboard/risk', icon: ShieldAlert },
    { name: t.therapy, path: '/dashboard/therapy', icon: HeartHandshake },
    { name: t.profile, path: '/dashboard/profile', icon: UserCircle },
  ];

  return (
    <div className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 hidden md:flex flex-col transition-colors duration-200">
      <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-slate-800 transition-colors">
        <BrainCircuit className="h-8 w-8 text-primary-600 dark:text-primary-400 mr-3" />
        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-secondary-500">
          NeuroSense
        </span>
      </div>
      
      <div className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            end={item.exact}
            className={({ isActive }) => 
              `flex items-center px-3 py-2.5 rounded-lg transition-colors duration-200 font-medium ${
                isActive 
                  ? 'bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-200' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-100'
              }`
            }
          >
            <item.icon className="h-5 w-5 mr-3" />
            {item.name}
          </NavLink>
        ))}
      </div>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 transition-colors">
        <button 
          onClick={logout}
          className="flex items-center w-full px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200 font-medium"
        >
          <LogOut className="h-5 w-5 mr-3" />
          {t.logout}
        </button>
      </div>
    </div>
  );
}