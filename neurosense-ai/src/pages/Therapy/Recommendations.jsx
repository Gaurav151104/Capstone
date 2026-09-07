import React from 'react';
import { useApp } from '../../hooks/useApp';
import Card from '../../components/Card';
import { HeartHandshake, CheckSquare, Clock, Lightbulb, BellRing } from 'lucide-react';

const mockTherapy = [
  { id: 1, type: 'Exercise', title: 'Aerobic Walk', duration: '30 mins', freq: 'Daily', done: true },
  { id: 2, type: 'Cognitive', title: 'Sudoku / Crossword', duration: '15 mins', freq: 'Daily', done: false },
  { id: 3, type: 'Social', title: 'Call a friend/family', duration: '20 mins', freq: '3x / week', done: false },
  { id: 4, type: 'Diet', title: 'Mediterranean Meal', duration: '-', freq: 'Daily', done: true },
];

export default function Recommendations() {
  const { t } = useApp();

  const mapTherapyTask = (task) => {
    const titles = {
      'Aerobic Walk': t.walk_title,
      'Sudoku / Crossword': t.puzzles_title,
      'Call a friend/family': t.social_title,
      'Mediterranean Meal': t.meal_title
    };
    const types = {
      'Exercise': t.activity_exercise,
      'Cognitive': t.activity_cognitive,
      'Social': t.activity_social,
      'Diet': t.activity_diet
    };
    const freqs = {
      'Daily': t.daily,
      '3x / week': t.times_week
    };
    return {
      ...task,
      title: titles[task.title] || task.title,
      type: types[task.type] || task.type,
      duration: task.duration.replace('mins', t.min_unit),
      freq: freqs[task.freq] || task.freq
    };
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center transition-colors">
          <HeartHandshake className="mr-2 h-6 w-6 text-primary-600 dark:text-primary-400" /> {t.therapy_recommendations}
        </h2>
        <p className="text-muted">{t.therapy_desc}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card title={t.action_plan} icon={CheckSquare}>
            <div className="mt-4 space-y-3">
              {mockTherapy.map(task => {
                const mapped = mapTherapyTask(task);
                return (
                  <div key={task.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/20 hover:bg-white dark:hover:bg-slate-800 transition-all group">
                    <div className="flex items-center">
                      <input 
                        type="checkbox" 
                        className="h-5 w-5 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-primary-600 focus:ring-primary-500 transition-all cursor-pointer"
                        defaultChecked={task.done} 
                      />
                      <div className="ml-4">
                        <h4 className={`font-semibold transition-colors ${task.done ? 'text-slate-400 dark:text-slate-600 line-through' : 'text-slate-800 dark:text-slate-200'}`}>
                          {mapped.title}
                        </h4>
                        <p className="text-xs text-muted">{mapped.type} • {mapped.duration}</p>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500 bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded-md transition-colors">{mapped.freq}</span>
                  </div>
                );
              })}
            </div>
          </Card>
          
          <Card title={t.cognitive_tips} icon={Lightbulb}>
             <div className="mt-4 space-y-4">
               <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-lg p-4 transition-colors">
                 <h4 className="font-semibold text-amber-900 dark:text-amber-300">{t.sleep_hygiene}</h4>
                 <p className="text-sm text-amber-800 dark:text-amber-400/80 mt-1">{t.sleep_tip}</p>
               </div>
               <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-lg p-4 transition-colors">
                 <h4 className="font-semibold text-emerald-900 dark:text-emerald-300">{t.stay_hydrated}</h4>
                 <p className="text-sm text-emerald-800 dark:text-emerald-400/80 mt-1">{t.hydration_tip}</p>
               </div>
             </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title={t.reminders} icon={BellRing}>
            <ul className="mt-4 space-y-4">
              <li className="flex items-start">
                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mr-3 mt-0.5 transition-colors">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-200 text-sm transition-colors">{t.medication_dose}</p>
                  <p className="text-xs text-muted">2:00 PM • {t.after_lunch}</p>
                </div>
              </li>
              <li className="flex items-start">
                <div className="h-8 w-8 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 flex items-center justify-center mr-3 mt-0.5 transition-colors">
                  <HeartHandshake className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-200 text-sm transition-colors">{t.doctors_appointment}</p>
                  <p className="text-xs text-muted">{t.tomorrow} • {t.dr_smith}</p>
                </div>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}