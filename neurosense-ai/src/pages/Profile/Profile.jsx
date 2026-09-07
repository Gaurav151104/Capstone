import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import Card from '../../components/Card';
import { UserCircle, Mail, Calendar as CalendarIcon, FileText } from 'lucide-react';
import { useApp } from '../../hooks/useApp';

export default function Profile() {
  const { t } = useApp();
  const { user, logout } = useAuth();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center transition-colors">
        <UserCircle className="mr-3 h-7 w-7 text-primary-600 dark:text-primary-400" /> {t.profile}
      </h2>
      
      <Card>
        <div className="flex flex-col md:flex-row items-center md:items-start p-2">
          <div className="h-32 w-32 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center mb-6 md:mb-0 md:mr-8 border-4 border-white dark:border-slate-800 shadow-lg shadow-slate-200 dark:shadow-none transition-all">
            <span className="text-5xl font-bold text-primary-600 dark:text-primary-400">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          
          <div className="flex-1 w-full space-y-4">
            <div>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white transition-colors">{user?.name || 'User Name'}</h3>
              <p className="text-muted flex items-center mt-1 transition-colors">
                <Mail className="h-4 w-4 mr-2" /> {user?.email || 'user@example.com'}
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-sm font-medium text-muted flex items-center transition-colors">
                  <CalendarIcon className="h-4 w-4 mr-2" /> {t.age}
                </p>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1 transition-colors">{user?.age || 'N/A'} {t.years}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-muted flex items-center transition-colors">
                  <FileText className="h-4 w-4 mr-2" /> {t.medical_history}
                </p>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1 transition-colors">{user?.medicalHistory || t.none_provided}</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 p-4 -mx-6 -mb-6 mt-6 rounded-b-xl flex justify-between items-center transition-colors">
           <button className="btn-outline">{t.edit_profile}</button>
           <button 
             onClick={logout}
             className="text-red-500 hover:text-red-600 dark:hover:text-red-400 font-medium px-4 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
           >
             {t.logout}
           </button>
        </div>
      </Card>
      
      <div className="text-center text-slate-400 dark:text-slate-500 text-sm pt-8 transition-colors">
        <p>NeuroSense-AI Version 1.0.0</p>
        <p>© 2026 NeuroSense AI. {t.rights_reserved}</p>
      </div>
    </div>
  );
}