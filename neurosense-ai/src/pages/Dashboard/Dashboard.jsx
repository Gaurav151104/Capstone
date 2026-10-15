import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useApp } from '../../hooks/useApp';
import Card from '../../components/Card';
import Chart from '../../components/Chart';
import { Link } from 'react-router-dom';
import { gameService } from '../../services/gameService';
import { riskService } from '../../services/riskService';
import DisclaimerNote from '../../components/DisclaimerNote';
import { 
  Activity, 
  Brain, 
  Clock, 
  Award, 
  TrendingUp, 
  AlertTriangle,
  Play,
  Gamepad2,
  ShieldAlert,
  MessageSquareText
} from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const { t = {} } = useApp();
  const [logs] = useState(() => {
    try {
      return (gameService && typeof gameService.getUserLogs === 'function') ? gameService.getUserLogs() : [];
    } catch (e) {
      return [];
    }
  });
  const [riskAssessment] = useState(() => {
    try {
      return (riskService && typeof riskService.calculateRisk === 'function') ? riskService.calculateRisk(user) : { riskLevel: 'Unknown', score: 0 };
    } catch (e) {
      return { riskLevel: 'Unknown', score: 0 };
    }
  });
  const hasData = Array.isArray(logs) && logs.length > 0;

  const getRecentChartData = () => {
    if (!hasData) return [];
    return logs.slice(-7).map((log) => ({
      name: new Date(log.date).toLocaleDateString(undefined, { weekday: 'short' }),
      score: log.score,
    }));
  };

  const getRiskLevelTranslated = (level) => {
    if (level === 'Low') return t.low || 'Lower Relative Risk';
    if (level === 'Medium') return t.medium || 'Moderate Risk Band';
    if (level === 'High') return t.high || 'Higher Relative Risk';
    return t.unknown || 'Assessment Pending';
  };

  const latest = hasData ? logs[logs.length - 1] : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
            {t.greeting}, {user?.name || 'User'}!
          </h2>
          <p className="text-muted">{t.dashboard_summary}</p>
        </div>
        <div className="flex space-x-3">
          <Link to="/dashboard/games" className="btn-primary flex items-center">
            <Play className="h-4 w-4 mr-2" /> {t.play_games}
          </Link>
        </div>
      </div>

      <DisclaimerNote compact />

      {!hasData ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-8 text-center flex flex-col items-center justify-center min-h-[400px]">
             <div className="h-20 w-20 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center mb-6">
               <Gamepad2 className="h-10 w-10" />
             </div>
             <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">{t.no_activity}</h3>
             <p className="text-muted max-w-sm mb-8 text-lg">
               {t.no_activity_desc}
             </p>
             <Link to="/dashboard/interview" className="btn-primary flex items-center justify-center text-lg px-8 py-3 w-full sm:w-auto mt-4 mb-4">
               <MessageSquareText className="h-5 w-5 mr-3" /> {t.start_interview || 'Start Cognitive Interview'}
             </Link>
             <Link to="/dashboard/games" className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 font-medium">
               {t.explore_games}
             </Link>
           </div>
           
           <div className="lg:col-span-1">
             <Card title={t.clinical_assessment} icon={ShieldAlert} className="h-full">
               <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 mt-4 border border-slate-100 dark:border-slate-800 items-center text-center">
                 <h4 className="text-sm font-semibold text-muted uppercase tracking-wider mb-2">{t.baseline_risk}</h4>
                 <div className={`text-4xl font-extrabold mb-4 
                   ${riskAssessment?.riskLevel === 'Low' ? 'text-emerald-500 dark:text-emerald-400' : 
                     riskAssessment?.riskLevel === 'Medium' ? 'text-yellow-500 dark:text-yellow-400' : 'text-red-500 dark:text-red-400'}`}>
                   {getRiskLevelTranslated(riskAssessment?.riskLevel)}
                 </div>
                 <p className="text-sm text-slate-600 dark:text-slate-400 flex-1 leading-relaxed">
                   {riskAssessment?.explanation || t.medical_history_basis}
                 </p>
                 <Link to="/dashboard/risk" className="btn-outline w-full mt-6 text-sm">{t.view_details}</Link>
               </div>
             </Card>
           </div>
        </div>
      ) : (
        <>
          {/* Top Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="hover:border-primary-200 dark:hover:border-primary-800 transition-colors">
              <div className="flex items-center">
                <div className="h-12 w-12 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mr-4">
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted">{t.latest_score}</p>
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{latest.score}</h3>
                </div>
              </div>
            </Card>

            <Card className="hover:border-teal-200 dark:hover:border-teal-800 transition-colors">
              <div className="flex items-center">
                <div className="h-12 w-12 rounded-full bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center mr-4">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted">{t.total_games}</p>
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{logs.length}</h3>
                </div>
              </div>
            </Card>

            <Card className="hover:border-purple-200 dark:hover:border-purple-800 transition-colors">
              <div className="flex items-center">
                <div className="h-12 w-12 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mr-4">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted">{t.last_activity}</p>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white mt-1 truncate">{latest.gameType}</h3>
                </div>
              </div>
            </Card>

            <Link to="/dashboard/risk" className="block focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-xl">
              <Card className="hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors h-full">
                 <div className="flex items-center">
                  <div className="h-12 w-12 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mr-4">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium dark:text-slate-400">{t.composite_risk}</p>
                    <h3 className={`text-2xl font-bold ${riskAssessment?.riskLevel === 'Low' ? 'text-emerald-600 dark:text-emerald-400' : riskAssessment?.riskLevel === 'Medium' ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                      {getRiskLevelTranslated(riskAssessment?.riskLevel)}
                    </h3>
                  </div>
                </div>
              </Card>
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Chart */}
            <div className="lg:col-span-2 space-y-6">
              <Card title={t.activity_trend} subtitle={t.recent_perf} icon={Activity}>
                <div className="h-72 mt-4">
                  <Chart data={getRecentChartData()} type="line" dataKeys={['score']} />
                </div>
              </Card>
            </div>

            {/* Recommended Actions */}
            <div className="space-y-6">
              <Card title={t.recommended} icon={Brain}>
                <div className="space-y-4 mt-2">
                  <Link to="/dashboard/interview" className="block p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all flex items-center justify-between group">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mr-3">
                        <MessageSquareText className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-800 dark:text-slate-100 group-hover:text-purple-700 dark:group-hover:text-purple-300">{t.cognitive_interview || 'Cognitive Interview'}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t.interview_desc || 'Interactive text-based wellness screening'}</p>
                      </div>
                    </div>
                    <Play className="h-4 w-4 text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                  
                  <Link to="/dashboard/games/memory" className="block p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all flex items-center justify-between group">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mr-3">
                        <span className="font-bold">M</span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-800 dark:text-slate-100 group-hover:text-primary-700 dark:group-hover:text-primary-300">{t.memory_cards}</h4>
                      </div>
                    </div>
                    <Play className="h-4 w-4 text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                  
                  <Link to="/dashboard/games/image-recall" className="block p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-orange-300 dark:hover:border-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all flex items-center justify-between group">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-500 dark:text-orange-400 flex items-center justify-center mr-3">
                        <span className="font-bold">I</span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-800 dark:text-slate-100 group-hover:text-orange-600 dark:group-hover:text-orange-300">{t.image_recall}</h4>
                      </div>
                    </div>
                    <Play className="h-4 w-4 text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}